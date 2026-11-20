import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response, type Router } from 'express';
import { generatePublishMetadataPackage } from '../../src/publishing/metadataService.ts';
import type {
  MetadataGenerateRequestInput,
  PublishHistoryItem,
  PublishJobRecord,
  PublishMetadataPackage,
  PublishPlatform,
  PublishStartRequest,
} from '../../src/publishing/types';
import { validatePublishPackage } from '../../src/publishing/validators.ts';
import type { ActiveJobLock } from '../activeJobLock.ts';
import { probeVideoFile } from '../chatspikeFfmpeg.ts';
import {
  createRequireAuthMiddleware,
  isAllowedLocalOrigin,
  isPathInsideRoot,
  isValidSafeId,
  sanitizeDownloadFilename,
  strictOriginMiddleware,
  type SecurityContext,
} from '../chatspikeSecurity.ts';
import {
  loadLibraryStore,
  type ChatSpikeDirectories,
} from '../chatspikeStorage.ts';
import { publishInstagramReelOfficial, uploadYouTubeVideoResumable } from './providers.ts';
import {
  PublishingOAuthManager,
  type FetchLike,
  type OAuthConfig,
} from './publishingOAuth.ts';
import {
  initPublishingDirectories,
  loadPublishHistory,
  loadPublishJobs,
  savePublishHistory,
  savePublishJobs,
  scrubPublishingSecretText,
  type TempMediaTokenRecord,
} from './publishingStorage.ts';

export interface PublishingRouterOptions {
  baseDirs: ChatSpikeDirectories;
  security: SecurityContext;
  activeJobLock: ActiveJobLock;
  fetchFn?: FetchLike;
  oauthEnvOverrides?: Partial<OAuthConfig>;
}

function getRequestOrigin(req: Request): string | undefined {
  const origin = req.get('origin');
  if (origin && isAllowedLocalOrigin(origin, req.get('host'))) {
    return origin;
  }
  const host = req.get('host');
  if (!host) return undefined;
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const candidate = `${proto}://${host}`;
  return isAllowedLocalOrigin(candidate, host) ? candidate : undefined;
}

function buildFinalPackageOverrides(
  basePkg: PublishMetadataPackage,
  overrides: PublishStartRequest['overrides']
): PublishMetadataPackage {
  if (!overrides) return basePkg;
  const cloned = structuredClone(basePkg);
  if (overrides.title !== undefined) {
    cloned.content.title = overrides.title;
    cloned.platforms.youtube.title = overrides.title;
  }
  if (overrides.description !== undefined) {
    cloned.content.description = overrides.description;
    cloned.platforms.youtube.description = overrides.description;
  }
  if (overrides.tags !== undefined) {
    cloned.content.tags = overrides.tags;
    cloned.platforms.youtube.tags = overrides.tags;
  }
  if (overrides.youtubeFormat !== undefined) {
    cloned.platforms.youtube.format = overrides.youtubeFormat;
  }
  if (overrides.youtubePrivacy !== undefined) {
    cloned.platforms.youtube.privacy = overrides.youtubePrivacy;
  }
  if (overrides.madeForKids !== undefined) {
    cloned.platforms.youtube.madeForKids = overrides.madeForKids;
  }
  if (overrides.categoryId !== undefined) {
    cloned.platforms.youtube.categoryId = overrides.categoryId;
  }
  if (overrides.instagramCaption !== undefined) {
    cloned.platforms.instagram.caption = overrides.instagramCaption;
  }
  return cloned;
}

export function createPublishingRouter(options: PublishingRouterOptions): {
  router: Router;
  oauthManager: PublishingOAuthManager;
} {
  const pubDirs = initPublishingDirectories(options.baseDirs);
  const oauthManager = new PublishingOAuthManager(pubDirs, {
    fetchFn: options.fetchFn,
    envOverrides: options.oauthEnvOverrides,
  });

  const jobs = loadPublishJobs(pubDirs);
  const history: PublishHistoryItem[] = loadPublishHistory(pubDirs);
  const activeAbortControllers = new Map<string, AbortController>();
  const tempMediaTokens = new Map<string, TempMediaTokenRecord>();

  const persistAll = () => {
    savePublishJobs(pubDirs, jobs);
    savePublishHistory(pubDirs, history);
  };

  const cleanupTempMediaRecord = (token: string) => {
    const rec = tempMediaTokens.get(token);
    if (!rec) return;
    tempMediaTokens.delete(token);
    if (isPathInsideRoot(rec.filePath, pubDirs.tempMediaDir) && fs.existsSync(rec.filePath)) {
      fs.rmSync(rec.filePath, { force: true });
    }
  };

  const upsertHistoryFromJob = (job: PublishJobRecord) => {
    const entry: PublishHistoryItem = {
      id: job.id,
      clipId: job.clipId,
      clipTitle: job.packageSnapshot.platforms.youtube.title || job.clipTitle,
      platform: job.platform,
      format: job.format,
      privacy: job.privacy,
      accountName: job.accountName,
      accountHandle: job.accountHandle,
      status: job.status,
      publishedUrl: job.publishedUrl,
      platformMediaId: job.platformMediaId,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      retryable: job.retryable,
      clipAvailableLocally: job.clipAvailableLocally,
      attributionStatus: job.packageSnapshot.attribution.status,
      rightsStatus: job.packageSnapshot.rights.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      publishedAt: job.publishedAt,
    };
    const idx = history.findIndex((h) => h.id === job.id);
    if (idx === -1) {
      history.unshift(entry);
    } else {
      history[idx] = entry;
    }
  };

  const resolveLocalClipMedia = (clipId: string): { mp4Path: string | null; srtText: string; vttText: string } => {
    const store = loadLibraryStore(options.baseDirs);
    const entry = store.clips.find((c) => c.clip.id === clipId);
    if (!entry) {
      return { mp4Path: null, srtText: '', vttText: '' };
    }
    const validMp4 =
      entry.mp4Path &&
      isPathInsideRoot(entry.mp4Path, options.baseDirs.root) &&
      fs.existsSync(entry.mp4Path)
        ? entry.mp4Path
        : null;
    return {
      mp4Path: validMp4,
      srtText: entry.captionsSrt ?? '',
      vttText: entry.captionsVtt ?? '',
    };
  };

  const findDuplicatePublication = (
    clipId: string,
    platform: PublishPlatform
  ): { id: string; status: string; publishedUrl: string | null } | null => {
    const match = history.find(
      (item) =>
        item.clipId === clipId &&
        item.platform === platform &&
        (item.status === 'published' ||
          item.status === 'uploading' ||
          item.status === 'processing_platform')
    );
    if (!match) return null;
    return { id: match.id, status: match.status, publishedUrl: match.publishedUrl };
  };

  const runPublishJobAsync = async (job: PublishJobRecord, localMp4Path: string) => {
    const controller = new AbortController();
    activeAbortControllers.set(job.id, controller);
    let tempMediaToken: string | null = null;

    const updateJob = (patch: Partial<PublishJobRecord>) => {
      Object.assign(job, patch, { updatedAt: new Date().toISOString() });
      upsertHistoryFromJob(job);
      persistAll();
    };

    try {
      // Stage 1: Validate local video file using FFprobe (no fabricated playback claims)
      updateJob({
        status: 'preparing_media',
        stageMessage: 'Verifying rendered MP4 container via FFprobe…',
        progressPercent: null,
      });

      if (!fs.existsSync(localMp4Path)) {
        throw Object.assign(
          new Error('Rendered local MP4 file could not be located. Re-render the clip first.'),
          { code: 'MEDIA_NOT_FOUND', retryable: true }
        );
      }
      const stats = fs.statSync(localMp4Path);
      if (stats.size <= 0) {
        throw Object.assign(new Error('Local clip MP4 file is empty.'), {
          code: 'UNSUPPORTED_VIDEO_FORMAT',
          retryable: false,
        });
      }

      const probe = await probeVideoFile(
        localMp4Path,
        options.baseDirs.root,
        path.basename(localMp4Path),
        stats.size
      );
      if (job.platform === 'instagram' && probe.durationSec > 900) {
        throw Object.assign(new Error('Video exceeds Instagram Reels 15-minute limit.'), {
          code: 'VIDEO_EXCEEDS_LIMITS',
          retryable: false,
        });
      }

      updateJob({
        status: 'validating_metadata',
        totalBytes: stats.size,
        stageMessage: 'Verifying OAuth credentials and destination metadata…',
      });

      const accountSecret = await oauthManager.ensureValidAccessToken(job.platform);

      if (job.platform === 'youtube') {
        const ytPkg = job.packageSnapshot.platforms.youtube;
        const result = await uploadYouTubeVideoResumable({
          filePath: localMp4Path,
          fileSizeBytes: stats.size,
          accessToken: accountSecret.accessToken,
          title: ytPkg.title,
          description: ytPkg.description,
          tags: ytPkg.tags,
          categoryId: ytPkg.categoryId,
          privacyStatus: ytPkg.privacy,
          madeForKids: ytPkg.madeForKids,
          defaultLanguage: ytPkg.language,
          srtContent: job.packageSnapshot.content.captions.srtContent,
          uploadSeparateCaptions: ytPkg.captionTrackUploadSupported,
          fetchFn: options.fetchFn,
          signal: controller.signal,
          onStage: (st, message) => {
            updateJob({ status: st, stageMessage: message });
          },
          onProgress: (bytesUploaded, totalBytes) => {
            const pct = totalBytes > 0 ? Math.min(100, Math.round((bytesUploaded / totalBytes) * 100)) : null;
            updateJob({
              status: 'uploading',
              bytesUploaded,
              totalBytes,
              progressPercent: pct,
              stageMessage: `Uploaded ${(bytesUploaded / (1024 * 1024)).toFixed(1)} MB of ${(totalBytes / (1024 * 1024)).toFixed(1)} MB…`,
            });
          },
        });

        updateJob({
          status: 'published',
          progressPercent: 100,
          bytesUploaded: stats.size,
          platformMediaId: result.platformMediaId,
          publishedUrl: result.publishedUrl,
          publishedAt: new Date().toISOString(),
          stageMessage: 'Published and verified on YouTube.',
          errorCode: null,
          errorMessage: null,
          retryable: false,
          clipAvailableLocally: fs.existsSync(localMp4Path),
        });
      } else {
        // Instagram Reels: strict temporary signed HTTPS transfer validation
        const cfg = oauthManager.getConfig();
        if (!cfg.instagramPublicMediaBaseUrl.startsWith('https://')) {
          throw Object.assign(
            new Error(
              'Instagram direct API upload requires an HTTPS media relay (CLIPCAT_PUBLIC_MEDIA_BASE_URL). Use Export & Manual Share locally.'
            ),
            { code: 'INSTAGRAM_MEDIA_ACCESS_REQUIRED', retryable: false }
          );
        }

        tempMediaToken = crypto.randomBytes(24).toString('base64url');
        const tempCopyPath = path.join(pubDirs.tempMediaDir, `${tempMediaToken}.mp4`);
        fs.copyFileSync(localMp4Path, tempCopyPath);
        tempMediaTokens.set(tempMediaToken, {
          token: tempMediaToken,
          filePath: tempCopyPath,
          expiresAtMs: Date.now() + 10 * 60 * 1000,
          consumed: false,
          sizeBytes: stats.size,
        });

        const publicHttpsUrl = `${cfg.instagramPublicMediaBaseUrl}/api/publishing/temp-media/${tempMediaToken}`;
        const result = await publishInstagramReelOfficial({
          igAccountId: accountSecret.accountId,
          accessToken: accountSecret.accessToken,
          publicMediaHttpsUrl: publicHttpsUrl,
          caption: job.packageSnapshot.platforms.instagram.caption,
          fetchFn: options.fetchFn,
          signal: controller.signal,
          onStage: (st, message) => {
            updateJob({ status: st, stageMessage: message });
          },
        });

        updateJob({
          status: 'published',
          progressPercent: null,
          platformMediaId: result.platformMediaId,
          publishedUrl: result.publishedUrl,
          publishedAt: new Date().toISOString(),
          stageMessage: 'Published and verified as an Instagram Reel.',
          errorCode: null,
          errorMessage: null,
          retryable: false,
          clipAvailableLocally: fs.existsSync(localMp4Path),
        });
      }
    } catch (err) {
      const code =
        typeof (err as { code?: string })?.code === 'string'
          ? (err as { code: string }).code
          : controller.signal.aborted
            ? 'UPLOAD_CANCELLED'
            : 'PUBLISH_FAILED';
      const rawMsg = err instanceof Error ? err.message : 'Publishing upload failed.';
      const safeMsg = scrubPublishingSecretText(rawMsg);
      const retryable =
        (err as { retryable?: boolean })?.retryable ??
        (code !== 'UNSUPPORTED_VIDEO_FORMAT' && code !== 'INSTAGRAM_MEDIA_ACCESS_REQUIRED');

      updateJob({
        status: controller.signal.aborted ? 'cancelled' : 'failed',
        errorCode: code,
        errorMessage: safeMsg,
        stageMessage: controller.signal.aborted ? 'Publishing cancelled.' : safeMsg,
        retryable,
        // Critical invariant: NEVER discard or delete the locally rendered clip when upload fails!
        clipAvailableLocally: fs.existsSync(localMp4Path),
      });
    } finally {
      if (tempMediaToken) cleanupTempMediaRecord(tempMediaToken);
      activeAbortControllers.delete(job.id);
      options.activeJobLock.release(job.id);
    }
  };

  const router = express.Router();
  router.use(strictOriginMiddleware);

  // Ephemeral session token handshake (aligned with ChatSpike local security model)
  router.post('/session', (req: Request, res: Response) => {
    const origin = req.get('origin');
    const host = req.get('host');
    if (origin && !isAllowedLocalOrigin(origin, host)) {
      res.status(403).json({ detail: 'Origin not permitted for publishing session.' });
      return;
    }
    res.json({ token: options.security.sessionToken });
  });

  // OAuth callback endpoints MUST work via top-level browser redirect (GET without custom headers)
  // Support both trailing-slash and exact callback paths cleanly.
  router.get(
    ['/oauth/:platform/callback', '/oauth/:platform/callback/'],
    async (req: Request, res: Response) => {
      const platform = req.params.platform as PublishPlatform;
      if (platform !== 'youtube' && platform !== 'instagram') {
        res.status(400).send('Unsupported publishing platform.');
        return;
      }

      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      const oauthErr = typeof req.query.error === 'string' ? req.query.error : '';

      const renderCallbackHtml = (ok: boolean, errorMsg?: string) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>ClipCat Authorization</title></head>
<body style="font-family:system-ui,sans-serif;background:#13141B;color:#F2F2F7;padding:24px;">
<p>${ok ? 'Authorization complete. Returning to ClipCat…' : 'Authorization could not be completed: ' + (errorMsg || 'cancelled')}</p>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage({
        type: 'CLIPCAT_PUBLISH_OAUTH',
        platform: ${JSON.stringify(platform)},
        ok: ${JSON.stringify(ok)},
        error: ${JSON.stringify(errorMsg || null)}
      }, '*');
      window.close();
    }
  } catch (e) {}
</script>
</body></html>`;

      if (oauthErr) {
        res.status(400).send(renderCallbackHtml(false, scrubPublishingSecretText(oauthErr)));
        return;
      }
      if (!code || !state) {
        res.status(400).send(renderCallbackHtml(false, 'Missing OAuth code or state parameter.'));
        return;
      }

      try {
        await oauthManager.completeCallback(platform, code, state);
        res.status(200).send(renderCallbackHtml(true));
      } catch (err) {
        const msg = err instanceof Error ? scrubPublishingSecretText(err.message) : 'OAuth verification failed.';
        res.status(400).send(renderCallbackHtml(false, msg));
      }
    }
  );

  // Short-lived signed temporary media transfer exclusively for Meta Graph API crawler
  router.get('/temp-media/:token', (req: Request, res: Response) => {
    const token = String(req.params.token || '');
    const record = tempMediaTokens.get(token);
    if (!record || record.consumed || Date.now() > record.expiresAtMs) {
      if (record) cleanupTempMediaRecord(token);
      res.status(404).json({ detail: 'Temporary media transfer link invalid or expired.' });
      return;
    }
    if (!isPathInsideRoot(record.filePath, pubDirs.tempMediaDir) || !fs.existsSync(record.filePath)) {
      cleanupTempMediaRecord(token);
      res.status(404).json({ detail: 'Temporary media file no longer exists.' });
      return;
    }

    record.consumed = true;
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', String(record.sizeBytes));
    res.setHeader('Cache-Control', 'no-store');
    const stream = fs.createReadStream(record.filePath);
    stream.on('close', () => cleanupTempMediaRecord(token));
    stream.on('error', () => cleanupTempMediaRecord(token));
    stream.pipe(res);
  });

  // Require timing-safe session token for all studio control endpoints
  const requireAuth = createRequireAuthMiddleware(options.security);
  router.use(requireAuth);
  router.use(express.json({ limit: '2mb' }));

  router.get('/accounts', (req: Request, res: Response) => {
    const origin = getRequestOrigin(req);
    res.json({
      accounts: oauthManager.listPublicAccounts(origin),
      activeJob: options.activeJobLock.getActive(),
    });
  });

  router.post('/oauth/:platform/start', (req: Request, res: Response) => {
    const platform = req.params.platform as PublishPlatform;
    if (platform !== 'youtube' && platform !== 'instagram') {
      res.status(400).json({ detail: 'Unsupported OAuth platform.' });
      return;
    }
    try {
      const origin = getRequestOrigin(req);
      const started = oauthManager.startAuthorization(platform, origin);
      res.json(started);
    } catch (err) {
      res.status(400).json({
        detail: err instanceof Error ? scrubPublishingSecretText(err.message) : 'Cannot start OAuth flow.',
      });
    }
  });

  router.post('/accounts/:platform/disconnect', async (req: Request, res: Response) => {
    const platform = req.params.platform as PublishPlatform;
    if (platform !== 'youtube' && platform !== 'instagram') {
      res.status(400).json({ detail: 'Unsupported publishing platform.' });
      return;
    }
    await oauthManager.disconnect(platform);
    res.json({
      account: oauthManager.getPublicAccount(platform, getRequestOrigin(req)),
    });
  });

  router.post('/metadata/generate', (req: Request, res: Response) => {
    const body = req.body as MetadataGenerateRequestInput | undefined;
    if (!body?.clip?.id) {
      res.status(422).json({ detail: 'Request body must include a valid clip payload.' });
      return;
    }

    const media = resolveLocalClipMedia(body.clip.id);
    const pkg = generatePublishMetadataPackage({
      ...body,
      srtContent: body.srtContent ?? media.srtText,
      vttContent: body.vttContent ?? media.vttText,
    });

    const igAccount = oauthManager.getPublicAccount('instagram', getRequestOrigin(req));
    pkg.platforms.instagram.directPublishSupported =
      igAccount.instagramMediaTransferMode === 'https_signed_relay';

    res.json({
      package: pkg,
      localMediaAvailable: Boolean(media.mp4Path),
    });
  });

  router.post('/validate', (req: Request, res: Response) => {
    const body = req.body as Partial<PublishStartRequest> | undefined;
    if (!body?.clip?.id || (body.platform !== 'youtube' && body.platform !== 'instagram')) {
      res.status(422).json({ detail: 'Clip and target platform are required for validation.' });
      return;
    }

    const media = resolveLocalClipMedia(body.clip.id);
    const pkg = generatePublishMetadataPackage({
      clip: body.clip,
      project: body.project,
      transcript: body.transcript,
      srtContent: body.srtContent ?? media.srtText,
      vttContent: body.vttContent ?? media.vttText,
      sourceInput: body.sourceInput,
      youtubeFormat: body.overrides?.youtubeFormat,
      youtubePrivacy: body.overrides?.youtubePrivacy,
      madeForKids: body.overrides?.madeForKids,
      includeAiDisclosure: body.includeAiDisclosure,
    });

    const mergedPkg = buildFinalPackageOverrides(pkg, body.overrides);
    const account = oauthManager.getPublicAccount(body.platform, getRequestOrigin(req));
    mergedPkg.platforms.instagram.directPublishSupported =
      account.instagramMediaTransferMode === 'https_signed_relay';

    const fileSizeBytes = media.mp4Path && fs.existsSync(media.mp4Path)
      ? fs.statSync(media.mp4Path).size
      : body.clip.fileSizeBytes;

    const validation = validatePublishPackage({
      pkg: mergedPkg,
      platform: body.platform,
      account,
      overrides: body.overrides,
      clipFileSizeBytes: fileSizeBytes,
      duplicateMatch: findDuplicatePublication(body.clip.id, body.platform),
      allowDuplicateRepublish: body.allowDuplicateRepublish,
    });

    if (!media.mp4Path) {
      validation.errors.push(
        'Rendered MP4 binary is not present in local ClipCat storage. Re-render or save the clip via ClipCat/ChatSpike first.'
      );
      validation.valid = false;
    }

    res.json({ validation, package: mergedPkg });
  });

  router.post('/start', (req: Request, res: Response) => {
    const body = req.body as PublishStartRequest | undefined;
    if (!body?.clip?.id || (body.platform !== 'youtube' && body.platform !== 'instagram')) {
      res.status(422).json({ detail: 'Valid clip and platform required.' });
      return;
    }
    if (body.userConfirmedPublish !== true) {
      res.status(400).json({
        detail: 'Explicit user confirmation (userConfirmedPublish: true) is required before uploading.',
      });
      return;
    }

    // Check idempotency key to prevent double-click / network retry duplicates
    if (body.idempotencyKey) {
      for (const existing of jobs.values()) {
        if (existing.idempotencyKey === body.idempotencyKey) {
          res.json(existing);
          return;
        }
      }
    }

    const media = resolveLocalClipMedia(body.clip.id);
    if (!media.mp4Path) {
      res.status(400).json({
        detail: 'No local rendered MP4 found for this clip. Render the clip before publishing.',
      });
      return;
    }

    const pkg = buildFinalPackageOverrides(
      generatePublishMetadataPackage({
        clip: body.clip,
        project: body.project,
        transcript: body.transcript,
        srtContent: body.srtContent ?? media.srtText,
        vttContent: body.vttContent ?? media.vttText,
        sourceInput: body.sourceInput,
        youtubeFormat: body.overrides?.youtubeFormat,
        youtubePrivacy: body.overrides?.youtubePrivacy,
        madeForKids: body.overrides?.madeForKids,
        includeAiDisclosure: body.includeAiDisclosure,
      }),
      body.overrides
    );

    const account = oauthManager.getPublicAccount(body.platform, getRequestOrigin(req));
    pkg.platforms.instagram.directPublishSupported =
      account.instagramMediaTransferMode === 'https_signed_relay';

    const stats = fs.statSync(media.mp4Path);
    const validation = validatePublishPackage({
      pkg,
      platform: body.platform,
      account,
      overrides: body.overrides,
      clipFileSizeBytes: stats.size,
      duplicateMatch: findDuplicatePublication(body.clip.id, body.platform),
      allowDuplicateRepublish: body.allowDuplicateRepublish,
    });

    if (!validation.valid) {
      res.status(422).json({
        detail: validation.errors[0] ?? 'Publishing validation failed.',
        errors: validation.errors,
      });
      return;
    }

    const jobId = `pub_${crypto.randomBytes(6).toString('hex')}`;
    if (!options.activeJobLock.tryAcquire(jobId, 'publishing')) {
      res.status(409).json({
        detail:
          'Another ClipCat processing or publishing job is already running. Wait for it to finish cleanly before starting a new upload.',
      });
      return;
    }

    const now = new Date().toISOString();
    const record: PublishJobRecord = {
      id: jobId,
      clipId: body.clip.id,
      clipTitle: pkg.content.title,
      platform: body.platform,
      format: body.platform === 'youtube' ? pkg.platforms.youtube.format : 'reel',
      privacy: body.platform === 'youtube' ? pkg.platforms.youtube.privacy : null,
      accountName: account.accountName,
      accountHandle: account.accountHandle,
      status: 'preparing_media',
      progressPercent: null,
      bytesUploaded: 0,
      totalBytes: stats.size,
      stageMessage: 'Queued publishing workflow…',
      publishedUrl: null,
      platformMediaId: null,
      idempotencyKey: body.idempotencyKey || `${body.clip.id}:${body.platform}:${Date.now()}`,
      errorCode: null,
      errorMessage: null,
      retryable: false,
      clipAvailableLocally: true,
      packageSnapshot: pkg,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
    };

    jobs.set(jobId, record);
    upsertHistoryFromJob(record);
    persistAll();

    void runPublishJobAsync(record, media.mp4Path);
    res.status(202).json(record);
  });

  router.get('/jobs/:jobId', (req: Request, res: Response) => {
    const jobId = String(req.params.jobId || '');
    if (!isValidSafeId(jobId)) {
      res.status(400).json({ detail: 'Invalid job ID.' });
      return;
    }
    const job = jobs.get(jobId);
    if (!job) {
      res.status(404).json({ detail: 'Publishing job not found.' });
      return;
    }
    res.json(job);
  });

  router.post('/jobs/:jobId/retry', (req: Request, res: Response) => {
    const jobId = String(req.params.jobId || '');
    if (!isValidSafeId(jobId)) {
      res.status(400).json({ detail: 'Invalid job ID.' });
      return;
    }
    const existing = jobs.get(jobId);
    if (!existing) {
      res.status(404).json({ detail: 'Publishing job not found.' });
      return;
    }
    if (existing.status === 'published') {
      res.status(409).json({ detail: 'This job already published successfully.' });
      return;
    }
    const media = resolveLocalClipMedia(existing.clipId);
    if (!media.mp4Path) {
      res.status(400).json({
        detail: 'Local MP4 file no longer exists; re-render the clip before retrying.',
      });
      return;
    }
    if (!options.activeJobLock.tryAcquire(jobId, 'publishing')) {
      res.status(409).json({
        detail: 'Another job is currently active. Wait until it completes before retrying.',
      });
      return;
    }

    existing.status = 'preparing_media';
    existing.errorCode = null;
    existing.errorMessage = null;
    existing.bytesUploaded = 0;
    existing.progressPercent = null;
    existing.stageMessage = 'Retrying failed publish job…';
    existing.updatedAt = new Date().toISOString();
    upsertHistoryFromJob(existing);
    persistAll();

    void runPublishJobAsync(existing, media.mp4Path);
    res.status(202).json(existing);
  });

  router.post('/jobs/:jobId/cancel', (req: Request, res: Response) => {
    const jobId = String(req.params.jobId || '');
    if (!isValidSafeId(jobId)) {
      res.status(400).json({ detail: 'Invalid job ID.' });
      return;
    }
    const job = jobs.get(jobId);
    if (!job) {
      res.status(404).json({ detail: 'Publishing job not found.' });
      return;
    }
    const ctrl = activeAbortControllers.get(jobId);
    if (ctrl) {
      ctrl.abort();
    }
    res.json(job);
  });

  router.get('/history', (_req: Request, res: Response) => {
    res.json({ history });
  });

  // Safe local export helper for manual Instagram / cross-platform sharing when direct HTTPS relay is absent
  router.post('/manual-share-package', (req: Request, res: Response) => {
    const body = req.body as {
      clip?: MetadataGenerateRequestInput['clip'];
      pkg?: PublishMetadataPackage;
      platform?: PublishPlatform;
    };
    if (!body?.clip?.id || !body?.pkg) {
      res.status(422).json({ detail: 'Clip and prepared metadata package are required.' });
      return;
    }
    const platform = body.platform === 'youtube' ? 'youtube' : 'instagram';
    const media = resolveLocalClipMedia(body.clip.id);
    const filenameSlug = sanitizeDownloadFilename(
      `${body.pkg.content.title}_${platform}_package`,
      'json'
    );
    const content = JSON.stringify(
      {
        platform,
        generatedAt: body.pkg.generatedAt,
        title: platform === 'youtube' ? body.pkg.platforms.youtube.title : body.pkg.content.title,
        captionOrDescription:
          platform === 'youtube'
            ? body.pkg.platforms.youtube.description
            : body.pkg.platforms.instagram.caption,
        hashtags:
          platform === 'youtube'
            ? body.pkg.platforms.youtube.hashtags
            : body.pkg.platforms.instagram.hashtags,
        youtubeTags: platform === 'youtube' ? body.pkg.platforms.youtube.tags : undefined,
        attribution: body.pkg.attribution,
        rights: body.pkg.rights,
        captionsSrt: body.pkg.content.captions.srtContent || media.srtText || undefined,
      },
      null,
      2
    );

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameSlug}"`);
    res.send(content);
  });

  return { router, oauthManager };
}
