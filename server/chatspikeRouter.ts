import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import express, { type Request, type Response, type Router } from 'express';
import {
  buildSynchronizedCaptions,
  clampClipWindow,
  mergeSelectedCandidates,
} from '../src/intelligence/clipMerging.ts';
import { parseChatLog } from '../src/intelligence/chatParser.ts';
import {
  REGISTERED_CHAT_SOURCE_ADAPTERS,
  REGISTERED_DETECTION_ENGINES,
  runDecisionEngine,
} from '../src/intelligence/decisionEngine.ts';
import { createDefaultDetectionConfig } from '../src/intelligence/spikeDetector.ts';
import type {
  ChatEvent,
  ChatLogParseResult,
  ChatSourceFormat,
  ChatSpikeCandidate,
  ChatSpikeDetectionConfig,
  ChatSpikeJob,
} from '../src/intelligence/types';
import type { Clip } from '../src/types/clip';
import type { AspectRatio, OutputResolution, Project } from '../src/types/project';
import {
  detectMediaBinaries,
  probeVideoFile,
  renderClipSegment,
} from './chatspikeFfmpeg.ts';
import {
  createRequireAuthMiddleware,
  createSecurityContext,
  isAllowedLocalOrigin,
  isPathInsideRoot,
  isValidSafeId,
  sanitizeDownloadFilename,
  scrubLogLine,
  signMediaUrl,
  strictOriginMiddleware,
  VALID_ARTIFACTS,
  verifySignedMediaParams,
  type SecurityContext,
} from './chatspikeSecurity.ts';
import {
  cleanupJobTempDir,
  getAvailableDiskBytes,
  getJobJsonPath,
  getJobTempDir,
  initChatSpikeStorage,
  loadLibraryStore,
  loadPersistedJobs,
  saveLibraryStore,
  writeJsonAtomic,
  type ChatSpikeDirectories,
} from './chatspikeStorage.ts';

const MAX_VIDEO_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB cap
const MAX_CHAT_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB cap
const MIN_FREE_DISK_BYTES = 150 * 1024 * 1024; // 150 MB headroom

interface JobRuntimeMeta {
  videoPath: string | null;
  rawChatPath: string | null;
  chatFormat?: ChatSourceFormat;
  rawChatFilename?: string;
}

export interface ChatSpikeRouterOptions {
  dataDir?: string;
  maxVideoUploadBytes?: number;
}

function buildTinyZipBuffer(
  files: Array<{ name: string; content: Buffer }>
): Buffer {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name.replace(/[^\x20-\x7e]/g, '_'), 'utf8');
    const crc = zlib.crc32(file.content);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8); // store method
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc >>> 0, 14);
    localHeader.writeUInt32LE(file.content.length, 18);
    localHeader.writeUInt32LE(file.content.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localChunks.push(localHeader, nameBuf, file.content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc >>> 0, 16);
    centralHeader.writeUInt32LE(file.content.length, 20);
    centralHeader.writeUInt32LE(file.content.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralChunks.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + file.content.length;
  }

  const centralDir = Buffer.concat(centralChunks);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralDir.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, centralDir, endRecord]);
}

function srtToVtt(srt: string): string {
  const converted = srt
    .trim()
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return converted ? `WEBVTT\n\n${converted}\n` : 'WEBVTT\n\n';
}

function sanitizeConfigPatch(
  current: ChatSpikeDetectionConfig,
  patch: Partial<ChatSpikeDetectionConfig>
): ChatSpikeDetectionConfig {
  const next: ChatSpikeDetectionConfig = { ...current };

  if (patch.sensitivity === 'low' || patch.sensitivity === 'medium' || patch.sensitivity === 'high') {
    next.sensitivity = patch.sensitivity;
  }
  if (typeof patch.preRollSec === 'number' && Number.isFinite(patch.preRollSec)) {
    next.preRollSec = Math.min(180, Math.max(0, Math.round(patch.preRollSec)));
  }
  if (typeof patch.postRollSec === 'number' && Number.isFinite(patch.postRollSec)) {
    next.postRollSec = Math.min(180, Math.max(2, Math.round(patch.postRollSec)));
  }
  if (patch.minSpikeMessagesPerSec === null) {
    next.minSpikeMessagesPerSec = null;
  } else if (
    typeof patch.minSpikeMessagesPerSec === 'number' &&
    Number.isFinite(patch.minSpikeMessagesPerSec)
  ) {
    next.minSpikeMessagesPerSec = Math.min(500, Math.max(1, Math.round(patch.minSpikeMessagesPerSec)));
  }
  if (patch.minUniqueParticipants === null) {
    next.minUniqueParticipants = null;
  } else if (
    typeof patch.minUniqueParticipants === 'number' &&
    Number.isFinite(patch.minUniqueParticipants)
  ) {
    next.minUniqueParticipants = Math.min(500, Math.max(1, Math.round(patch.minUniqueParticipants)));
  }
  if (typeof patch.cooldownSec === 'number' && Number.isFinite(patch.cooldownSec)) {
    next.cooldownSec = Math.min(300, Math.max(2, Math.round(patch.cooldownSec)));
  }
  if (typeof patch.spamDedupWindowSec === 'number' && Number.isFinite(patch.spamDedupWindowSec)) {
    next.spamDedupWindowSec = Math.min(60, Math.max(0, Math.round(patch.spamDedupWindowSec)));
  }
  if (typeof patch.spamMaxRepeatsPerUser === 'number' && Number.isFinite(patch.spamMaxRepeatsPerUser)) {
    next.spamMaxRepeatsPerUser = Math.min(20, Math.max(1, Math.round(patch.spamMaxRepeatsPerUser)));
  }
  if (typeof patch.videoStartOffsetSec === 'number' && Number.isFinite(patch.videoStartOffsetSec)) {
    next.videoStartOffsetSec = Math.min(86400, Math.max(-86400, patch.videoStartOffsetSec));
  }
  if (typeof patch.chatStartOffsetSec === 'number' && Number.isFinite(patch.chatStartOffsetSec)) {
    next.chatStartOffsetSec = Math.min(86400, Math.max(-86400, patch.chatStartOffsetSec));
  }
  if (typeof patch.manualSyncOffsetSec === 'number' && Number.isFinite(patch.manualSyncOffsetSec)) {
    next.manualSyncOffsetSec = Math.min(86400, Math.max(-86400, patch.manualSyncOffsetSec));
  }
  if (typeof patch.mergeOverlappingClips === 'boolean') {
    next.mergeOverlappingClips = patch.mergeOverlappingClips;
  }
  if (typeof patch.mergeGapSec === 'number' && Number.isFinite(patch.mergeGapSec)) {
    next.mergeGapSec = Math.min(120, Math.max(0, Math.round(patch.mergeGapSec)));
  }
  if (patch.aspectRatio === '9:16' || patch.aspectRatio === '1:1' || patch.aspectRatio === '16:9') {
    next.aspectRatio = patch.aspectRatio;
  }
  if (patch.resolution === '720p' || patch.resolution === '1080p') {
    next.resolution = patch.resolution;
  }
  if (typeof patch.captionsEnabled === 'boolean') {
    next.captionsEnabled = patch.captionsEnabled;
  }
  if (
    patch.whisperModel === 'tiny' ||
    patch.whisperModel === 'base' ||
    patch.whisperModel === 'small' ||
    patch.whisperModel === 'medium'
  ) {
    next.whisperModel = patch.whisperModel;
  } else if (patch.whisperModel === 'large-v3') {
    throw new Error('Whisper large-v3 is disabled for stability on 8 GB RAM systems.');
  }

  return next;
}

export function createChatSpikeRouter(options: ChatSpikeRouterOptions = {}): {
  router: Router;
  security: SecurityContext;
  dirs: ChatSpikeDirectories;
} {
  const dirs = initChatSpikeStorage(options.dataDir);
  const security = createSecurityContext();
  const maxVideoBytes = options.maxVideoUploadBytes ?? MAX_VIDEO_UPLOAD_BYTES;
  const requireAuth = createRequireAuthMiddleware(security);

  const jobs = loadPersistedJobs(dirs);
  const jobMetaMap = new Map<string, JobRuntimeMeta>();
  const jobEventsCache = new Map<string, ChatEvent[]>();

  // Rebuild runtime paths cleanly from canonical folder structure if restarted
  for (const job of jobs.values()) {
    const metaFile = path.join(dirs.jobs, job.id, 'meta.json');
    if (fs.existsSync(metaFile)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')) as JobRuntimeMeta;
        jobMetaMap.set(job.id, meta);
      } catch {
        // Ignore
      }
    }
    const eventsFile = path.join(dirs.jobs, job.id, 'events.json');
    if (fs.existsSync(eventsFile)) {
      try {
        const ev = JSON.parse(fs.readFileSync(eventsFile, 'utf8')) as ChatEvent[];
        if (Array.isArray(ev)) jobEventsCache.set(job.id, ev);
      } catch {
        // Ignore
      }
    }
  }

  let activeProcessingJobId: string | null = null;
  let activeAbortController: AbortController | null = null;

  const persistJob = (job: ChatSpikeJob) => {
    job.updatedAt = new Date().toISOString();
    writeJsonAtomic(getJobJsonPath(dirs, job.id), dirs.root, job);
  };

  const persistJobMeta = (jobId: string, meta: JobRuntimeMeta) => {
    jobMetaMap.set(jobId, meta);
    const metaPath = path.join(dirs.jobs, jobId, 'meta.json');
    writeJsonAtomic(metaPath, dirs.root, meta);
  };

  const writeCandidateSidecars = (jobId: string, candidate: ChatSpikeCandidate) => {
    const exportDir = path.join(dirs.exports, jobId);
    if (!isPathInsideRoot(exportDir, dirs.exports)) return;
    fs.mkdirSync(exportDir, { recursive: true });

    const srtPath = path.join(exportDir, `${candidate.id}.srt`);
    const vttPath = path.join(exportDir, `${candidate.id}.vtt`);
    const jsonPath = path.join(exportDir, `${candidate.id}.json`);

    fs.writeFileSync(srtPath, candidate.captionsSrt || '', 'utf8');
    fs.writeFileSync(vttPath, candidate.captionsVtt || 'WEBVTT\n\n', 'utf8');
    writeJsonAtomic(jsonPath, dirs.exports, {
      id: candidate.id,
      jobId,
      title: candidate.title,
      startSec: candidate.startSec,
      endSec: candidate.endSec,
      durationSec: candidate.durationSec,
      peakSpikeSec: candidate.peakSpikeSec,
      constituentSpikeTimestamps: candidate.constituentSpikeTimestamps,
      engagementScore: candidate.engagementScore,
      engagementReasons: candidate.engagementReasons,
      engagementDisclaimer: candidate.engagementDisclaimer,
      peakMessagesPerSec: candidate.peakMessagesPerSec,
      uniqueParticipants: candidate.uniqueParticipants,
      dominantKeywords: candidate.dominantKeywords,
      aspectRatio: candidate.aspectRatio,
      resolution: candidate.resolution,
    });
  };

  const attachSignedUrlsToCandidate = (
    jobId: string,
    candidate: ChatSpikeCandidate
  ): ChatSpikeCandidate => {
    const exportDir = path.join(dirs.exports, jobId);
    const hasMp4 = fs.existsSync(path.join(exportDir, `${candidate.id}.mp4`));
    const hasThumb = fs.existsSync(path.join(exportDir, `${candidate.id}.jpg`));
    const hasSrt = fs.existsSync(path.join(exportDir, `${candidate.id}.srt`));
    const hasVtt = fs.existsSync(path.join(exportDir, `${candidate.id}.vtt`));
    const hasJson = fs.existsSync(path.join(exportDir, `${candidate.id}.json`));

    return {
      ...candidate,
      previewUrl: hasMp4 ? signMediaUrl(security, jobId, candidate.id, 'mp4') : null,
      downloadUrl: hasMp4
        ? `${signMediaUrl(security, jobId, candidate.id, 'mp4')}&download=1`
        : null,
      thumbnailUrl: hasThumb ? signMediaUrl(security, jobId, candidate.id, 'jpg') : null,
      srtUrl: hasSrt ? signMediaUrl(security, jobId, candidate.id, 'srt') : null,
      vttUrl: hasVtt ? signMediaUrl(security, jobId, candidate.id, 'vtt') : null,
      metadataUrl: hasJson ? signMediaUrl(security, jobId, candidate.id, 'json') : null,
    };
  };

  const serializeJobResponse = (job: ChatSpikeJob): ChatSpikeJob => ({
    ...job,
    candidates: job.candidates.map((c) => attachSignedUrlsToCandidate(job.id, c)),
  });

  const reparseChatForJob = (job: ChatSpikeJob): ChatEvent[] => {
    const meta = jobMetaMap.get(job.id);
    if (!meta?.rawChatPath || !fs.existsSync(meta.rawChatPath)) {
      return [];
    }
    if (!isPathInsideRoot(meta.rawChatPath, dirs.chatlogs)) {
      throw new Error('Chat file failed containment check.');
    }
    const rawText = fs.readFileSync(meta.rawChatPath, 'utf8');
    const parsed: ChatLogParseResult = parseChatLog(rawText, {
      filename: meta.rawChatFilename,
      format: meta.chatFormat,
      alignment: {
        videoStartOffsetSec: job.config.videoStartOffsetSec,
        chatStartOffsetSec: job.config.chatStartOffsetSec,
        manualSyncOffsetSec: job.config.manualSyncOffsetSec,
        videoDurationSec: job.video?.durationSec ?? null,
      },
    });
    const { events, ...summary } = parsed;
    job.chatSummary = summary;
    jobEventsCache.set(job.id, events);
    const eventsPath = path.join(dirs.jobs, job.id, 'events.json');
    writeJsonAtomic(eventsPath, dirs.root, events);
    return events;
  };

  const router = express.Router();
  router.use(strictOriginMiddleware);

  // Ephemeral session token issuer — verifies Origin / Sec-Fetch-Site against local origin policy
  router.post('/session', (req: Request, res: Response) => {
    const origin = req.get('origin');
    const host = req.get('host');
    const fetchSite = (req.get('sec-fetch-site') ?? '').toLowerCase();

    if (origin && !isAllowedLocalOrigin(origin, host)) {
      res.status(403).json({ detail: 'Origin rejected.' });
      return;
    }
    if (fetchSite === 'cross-site') {
      res.status(403).json({ detail: 'Cross-site session requests are blocked.' });
      return;
    }

    res.json({
      token: security.sessionToken,
      dataRootConfigured: true,
    });
  });

  // Publicly signed media artifact endpoint (HMAC-SHA256 + timingSafeEqual + Range 206 streaming)
  const handleMediaRequest = (req: Request, res: Response) => {
    const jobId = String(req.params.jobId ?? '');
    const clipId = String(req.params.clipId ?? '');
    const artifact = String(req.params.artifact ?? '');
    const exp = typeof req.query.exp === 'string' ? req.query.exp : undefined;
    const sig = typeof req.query.sig === 'string' ? req.query.sig : undefined;

    if (!verifySignedMediaParams(security, jobId, clipId, artifact, exp, sig)) {
      res.status(403).json({ detail: 'Invalid or expired media signature.' });
      return;
    }

    const candidateRoots =
      jobId === 'library'
        ? [path.join(dirs.library, clipId)]
        : [path.join(dirs.exports, jobId), path.join(dirs.library, clipId)];

    let filePath: string | null = null;
    for (const base of candidateRoots) {
      if (!isPathInsideRoot(base, dirs.root)) continue;
      const attempt = path.join(base, `${clipId}.${artifact}`);
      if (isPathInsideRoot(attempt, dirs.root) && fs.existsSync(attempt)) {
        filePath = attempt;
        break;
      }
    }

    if (!filePath) {
      res.status(404).json({ detail: 'Media artifact not found.' });
      return;
    }

    const stat = fs.statSync(filePath);
    const totalSize = stat.size;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');

    const mimeMap: Record<string, string> = {
      mp4: 'video/mp4',
      jpg: 'image/jpeg',
      srt: 'application/x-subrip; charset=utf-8',
      vtt: 'text/vtt; charset=utf-8',
      json: 'application/json; charset=utf-8',
    };
    const contentType = mimeMap[artifact] ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    const downloadFilename = sanitizeDownloadFilename(clipId, artifact);
    if (req.query.download === '1' || artifact === 'srt' || artifact === 'vtt' || artifact === 'json') {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${downloadFilename}"`
      );
    }

    if (artifact === 'mp4') {
      res.setHeader('Accept-Ranges', 'bytes');
      const rangeHeader = req.get('range');
      if (rangeHeader) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
        if (!match) {
          res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
          return;
        }
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Math.min(totalSize - 1, Number(match[2])) : totalSize - 1;
        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= totalSize) {
          res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
          return;
        }

        const chunkSize = end - start + 1;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.setHeader('Content-Length', String(chunkSize));
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    res.setHeader('Content-Length', String(totalSize));
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  };

  router.get('/media/:jobId/:clipId/:artifact', handleMediaRequest);
  router.head('/media/:jobId/:clipId/:artifact', handleMediaRequest);

  // Also support HEAD /library-zip downloads via signed URL
  router.get('/media-zip/:archiveId', (req: Request, res: Response) => {
    const archiveId = String(req.params.archiveId ?? '');
    const exp = typeof req.query.exp === 'string' ? req.query.exp : undefined;
    const sig = typeof req.query.sig === 'string' ? req.query.sig : undefined;
    if (!verifySignedMediaParams(security, 'library', archiveId, 'json', exp, sig)) {
      res.status(403).json({ detail: 'Invalid or expired archive link.' });
      return;
    }
    const zipPath = path.join(dirs.temp, `${archiveId}.zip`);
    if (!isPathInsideRoot(zipPath, dirs.temp) || !fs.existsSync(zipPath)) {
      res.status(404).json({ detail: 'Export archive not found or expired.' });
      return;
    }
    const stat = fs.statSync(zipPath);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="clipcat_chatspike_exports.zip"');
    res.setHeader('Content-Length', String(stat.size));
    fs.createReadStream(zipPath).pipe(res);
  });

  // Require bearer token auth for all remaining management routes
  router.use(requireAuth);

  router.get('/capabilities', async (_req: Request, res: Response) => {
    const bins = await detectMediaBinaries();
    res.json({
      ffmpegAvailable: bins.ffmpegAvailable,
      ffprobeAvailable: bins.ffprobeAvailable,
      fasterWhisperAvailable: false,
      whisperNote:
        'Local Express ChatSpike runs real FFmpeg/FFprobe media extraction & heuristic chat spike detection. Full Whisper speech recognition runs via ClipCat Python FastAPI when connected.',
      activeProcessingJobId,
      maxVideoUploadBytes: maxVideoBytes,
      maxChatUploadBytes: MAX_CHAT_UPLOAD_BYTES,
      engines: REGISTERED_DETECTION_ENGINES.map((e) => ({
        id: e.id,
        name: e.name,
        signalType: e.signalType,
        availability: e.availability,
        availabilityNote: e.availabilityNote,
      })),
      chatSourceAdapters: REGISTERED_CHAT_SOURCE_ADAPTERS,
    });
  });

  router.post('/jobs', express.json({ limit: '64kb' }), (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawName = typeof body.projectName === 'string' ? body.projectName.trim() : '';
    const projectName = scrubLogLine(rawName || 'ChatSpike Session').slice(0, 100);

    let config = createDefaultDetectionConfig();
    if (body.config && typeof body.config === 'object') {
      try {
        config = sanitizeConfigPatch(config, body.config as Partial<ChatSpikeDetectionConfig>);
      } catch (err) {
        res.status(400).json({ detail: err instanceof Error ? err.message : 'Invalid settings.' });
        return;
      }
    }

    const jobId = `csjob_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();
    const job: ChatSpikeJob = {
      id: jobId,
      projectName,
      status: 'draft',
      overallProgress: 0,
      currentTask: 'Upload source video and chat log to begin.',
      video: null,
      chatSummary: null,
      config,
      stages: [
        { id: 'media_probe', label: 'Video inspection (FFprobe)', status: 'waiting', progressPercent: null },
        { id: 'chat_parse', label: 'Chat parsing & alignment', status: 'waiting', progressPercent: null },
        { id: 'spike_detect', label: 'Rolling Median + MAD spike detection', status: 'waiting', progressPercent: null },
        { id: 'clip_render', label: 'FFmpeg clip extraction & thumbnails', status: 'waiting', progressPercent: null },
      ],
      logs: [`Created ChatSpike session "${projectName}".`],
      timeseries: [],
      candidates: [],
      savedProjectId: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };

    jobs.set(jobId, job);
    persistJob(job);
    persistJobMeta(jobId, { videoPath: null, rawChatPath: null });
    res.status(201).json(serializeJobResponse(job));
  });

  router.get('/jobs/:jobId', (req: Request, res: Response) => {
    const jobId = String(req.params.jobId ?? '');
    if (!isValidSafeId(jobId)) {
      res.status(400).json({ detail: 'Invalid job identifier.' });
      return;
    }
    const job = jobs.get(jobId);
    if (!job) {
      res.status(404).json({ detail: 'ChatSpike job not found.' });
      return;
    }
    res.json(serializeJobResponse(job));
  });

  // Streaming binary video upload directly to UUID filename on disk (no RAM buffering)
  router.post('/jobs/:jobId/video', (req: Request, res: Response) => {
    const jobId = String(req.params.jobId ?? '');
    if (!isValidSafeId(jobId)) {
      res.status(400).json({ detail: 'Invalid job identifier.' });
      return;
    }
    const job = jobs.get(jobId);
    if (!job) {
      res.status(404).json({ detail: 'ChatSpike job not found.' });
      return;
    }
    if (job.status === 'running') {
      res.status(409).json({ detail: 'Cannot replace video while job is running.' });
      return;
    }

    const freeBytes = getAvailableDiskBytes(dirs.uploads);
    if (freeBytes < MIN_FREE_DISK_BYTES) {
      res.status(507).json({ detail: 'Insufficient free disk space to accept video upload.' });
      return;
    }

    const declaredLen = Number(req.get('content-length') ?? 0);
    if (declaredLen > maxVideoBytes) {
      res.status(413).json({
        detail: `Video file exceeds server limit (${Math.round(maxVideoBytes / (1024 * 1024))} MB).`,
      });
      return;
    }

    const origHeader = req.get('x-clipcat-filename') || 'source_video.mp4';
    const rawExt = path.extname(origHeader).toLowerCase();
    const safeExt = ['.mp4', '.mov', '.mkv', '.webm'].includes(rawExt) ? rawExt : '.mp4';
    const displayName = scrubLogLine(path.basename(origHeader)).slice(0, 120) || `video${safeExt}`;

    const diskPath = path.join(dirs.uploads, `${jobId}_${crypto.randomBytes(6).toString('hex')}${safeExt}`);
    if (!isPathInsideRoot(diskPath, dirs.uploads)) {
      res.status(400).json({ detail: 'Invalid upload storage path.' });
      return;
    }

    const writeStream = fs.createWriteStream(diskPath);
    let totalReceived = 0;
    let aborted = false;

    const cleanupPartial = () => {
      try {
        writeStream.destroy();
      } catch {
        // ignore
      }
      fs.rmSync(diskPath, { force: true });
    };

    req.on('data', (chunk: Buffer) => {
      if (aborted) return;
      totalReceived += chunk.length;
      if (totalReceived > maxVideoBytes) {
        aborted = true;
        cleanupPartial();
        if (!res.headersSent) {
          res.status(413).json({
            detail: `Video upload aborted: exceeded maximum size limit (${maxVideoBytes} bytes).`,
          });
        }
        req.destroy();
        return;
      }
      if (!writeStream.write(chunk)) {
        req.pause();
        writeStream.once('drain', () => {
          if (!aborted) req.resume();
        });
      }
    });

    req.on('error', () => {
      if (aborted) return;
      aborted = true;
      cleanupPartial();
      if (!res.headersSent) {
        res.status(400).json({ detail: 'Upload stream interrupted.' });
      }
    });

    req.on('end', () => {
      if (aborted) return;
      writeStream.end(async () => {
        if (totalReceived <= 0) {
          cleanupPartial();
          res.status(400).json({ detail: 'Empty video file uploaded.' });
          return;
        }
        try {
          const videoInfo = await probeVideoFile(
            diskPath,
            dirs.root,
            displayName,
            totalReceived
          );

          const prevMeta = jobMetaMap.get(jobId);
          if (
            prevMeta?.videoPath &&
            prevMeta.videoPath !== diskPath &&
            isPathInsideRoot(prevMeta.videoPath, dirs.uploads)
          ) {
            fs.rmSync(prevMeta.videoPath, { force: true });
          }

          persistJobMeta(jobId, {
            videoPath: diskPath,
            rawChatPath: prevMeta?.rawChatPath ?? null,
            chatFormat: prevMeta?.chatFormat,
            rawChatFilename: prevMeta?.rawChatFilename,
          });

          job.video = videoInfo;
          job.status = job.chatSummary && job.chatSummary.validEvents > 0 ? 'ready' : 'draft';
          job.logs.push(
            `Verified video "${displayName}" (${videoInfo.width}x${videoInfo.height}, ${videoInfo.durationSec.toFixed(1)}s, codec=${videoInfo.codec ?? 'unknown'}).`
          );

          // Re-align chat events against known video duration if chat was uploaded first
          if (prevMeta?.rawChatPath) {
            reparseChatForJob(job);
          }

          persistJob(job);
          res.json(serializeJobResponse(job));
        } catch (err) {
          cleanupPartial();
          res.status(415).json({
            detail:
              err instanceof Error
                ? err.message
                : 'Media verification failed for uploaded file.',
          });
        }
      });
    });
  });

  // Upload & inspect chat log (JSON, JSONL, CSV, TXT) bounded to 25 MB
  router.post(
    '/jobs/:jobId/chat',
    express.json({ limit: '26mb' }),
    (req: Request, res: Response) => {
      const jobId = String(req.params.jobId ?? '');
      if (!isValidSafeId(jobId)) {
        res.status(400).json({ detail: 'Invalid job identifier.' });
        return;
      }
      const job = jobs.get(jobId);
      if (!job) {
        res.status(404).json({ detail: 'ChatSpike job not found.' });
        return;
      }
      if (job.status === 'running') {
        res.status(409).json({ detail: 'Cannot update chat log while job is running.' });
        return;
      }

      const body = (req.body ?? {}) as {
        filename?: unknown;
        content?: unknown;
        format?: unknown;
      };

      if (typeof body.content !== 'string' || body.content.trim().length === 0) {
        res.status(400).json({ detail: 'Chat file content must be a non-empty UTF-8 string.' });
        return;
      }

      if (Buffer.byteLength(body.content, 'utf8') > MAX_CHAT_UPLOAD_BYTES) {
        res.status(413).json({ detail: 'Chat log exceeds the 25 MB maximum upload limit.' });
        return;
      }

      const safeFilename = scrubLogLine(
        typeof body.filename === 'string' && body.filename.trim()
          ? path.basename(body.filename.trim())
          : 'chat_log.txt'
      ).slice(0, 120);

      const requestedFormat =
        body.format === 'json' ||
        body.format === 'jsonl' ||
        body.format === 'csv' ||
        body.format === 'txt'
          ? body.format
          : undefined;

      const chatDiskPath = path.join(dirs.chatlogs, `${jobId}_chat.txt`);
      if (!isPathInsideRoot(chatDiskPath, dirs.chatlogs)) {
        res.status(400).json({ detail: 'Invalid chat log path.' });
        return;
      }

      try {
        const parsed = parseChatLog(body.content, {
          filename: safeFilename,
          format: requestedFormat,
          alignment: {
            videoStartOffsetSec: job.config.videoStartOffsetSec,
            chatStartOffsetSec: job.config.chatStartOffsetSec,
            manualSyncOffsetSec: job.config.manualSyncOffsetSec,
            videoDurationSec: job.video?.durationSec ?? null,
          },
        });

        fs.writeFileSync(chatDiskPath, body.content, 'utf8');
        const prevMeta = jobMetaMap.get(jobId);
        persistJobMeta(jobId, {
          videoPath: prevMeta?.videoPath ?? null,
          rawChatPath: chatDiskPath,
          chatFormat: parsed.format,
          rawChatFilename: safeFilename,
        });

        const { events, ...summary } = parsed;
        job.chatSummary = summary;
        jobEventsCache.set(jobId, events);
        writeJsonAtomic(path.join(dirs.jobs, jobId, 'events.json'), dirs.root, events);

        if (job.video && summary.validEvents > 0) {
          job.status = 'ready';
        }
        job.logs.push(
          `Imported chat log "${safeFilename}" (${summary.format.toUpperCase()}, ${summary.validEvents} valid events, confidence=${summary.alignmentConfidence}).`
        );
        persistJob(job);
        res.json(serializeJobResponse(job));
      } catch (err) {
        res.status(400).json({
          detail: err instanceof Error ? err.message : 'Unable to parse uploaded chat log.',
        });
      }
    }
  );

  router.patch(
    '/jobs/:jobId/config',
    express.json({ limit: '64kb' }),
    (req: Request, res: Response) => {
      const jobId = String(req.params.jobId ?? '');
      if (!isValidSafeId(jobId)) {
        res.status(400).json({ detail: 'Invalid job identifier.' });
        return;
      }
      const job = jobs.get(jobId);
      if (!job) {
        res.status(404).json({ detail: 'ChatSpike job not found.' });
        return;
      }
      if (job.status === 'running') {
        res.status(409).json({ detail: 'Cannot modify detection settings while processing runs.' });
        return;
      }

      const body = (req.body ?? {}) as {
        projectName?: unknown;
        config?: Partial<ChatSpikeDetectionConfig>;
      };

      if (typeof body.projectName === 'string' && body.projectName.trim()) {
        job.projectName = scrubLogLine(body.projectName.trim()).slice(0, 100);
      }

      const prevOffsets = {
        v: job.config.videoStartOffsetSec,
        c: job.config.chatStartOffsetSec,
        m: job.config.manualSyncOffsetSec,
      };

      if (body.config && typeof body.config === 'object') {
        try {
          job.config = sanitizeConfigPatch(job.config, body.config);
        } catch (err) {
          res.status(400).json({
            detail: err instanceof Error ? err.message : 'Invalid configuration parameters.',
          });
          return;
        }
      }

      const offsetsChanged =
        prevOffsets.v !== job.config.videoStartOffsetSec ||
        prevOffsets.c !== job.config.chatStartOffsetSec ||
        prevOffsets.m !== job.config.manualSyncOffsetSec;

      if (offsetsChanged && jobMetaMap.get(jobId)?.rawChatPath) {
        reparseChatForJob(job);
      }

      persistJob(job);
      res.json(serializeJobResponse(job));
    }
  );

  // Start real ChatSpike analysis + FFmpeg clip extraction (single active job enforced)
  router.post(
    '/jobs/:jobId/process',
    express.json({ limit: '64kb' }),
    (req: Request, res: Response) => {
      const jobId = String(req.params.jobId ?? '');
      if (!isValidSafeId(jobId)) {
        res.status(400).json({ detail: 'Invalid job identifier.' });
        return;
      }
      const job = jobs.get(jobId);
      if (!job) {
        res.status(404).json({ detail: 'ChatSpike job not found.' });
        return;
      }

      if (activeProcessingJobId !== null) {
        res.status(409).json({
          detail: `Another ChatSpike job (${activeProcessingJobId}) is already running. Cancel it or wait for completion.`,
        });
        return;
      }

      const meta = jobMetaMap.get(jobId);
      if (!job.video || !meta?.videoPath || !fs.existsSync(meta.videoPath)) {
        res.status(400).json({ detail: 'Upload and verify a source video before processing.' });
        return;
      }

      let events = jobEventsCache.get(jobId) ?? [];
      if (meta.rawChatPath && fs.existsSync(meta.rawChatPath)) {
        events = reparseChatForJob(job);
      }
      if (!job.chatSummary || events.length === 0) {
        res.status(400).json({
          detail: 'Upload a valid chat log containing at least one aligned timestamped message.',
        });
        return;
      }

      const body = (req.body ?? {}) as { config?: Partial<ChatSpikeDetectionConfig> };
      if (body.config && typeof body.config === 'object') {
        try {
          job.config = sanitizeConfigPatch(job.config, body.config);
          events = reparseChatForJob(job);
        } catch (err) {
          res.status(400).json({ detail: err instanceof Error ? err.message : 'Invalid settings.' });
          return;
        }
      }

      activeProcessingJobId = jobId;
      const controller = new AbortController();
      activeAbortController = controller;

      job.status = 'running';
      job.errorMessage = null;
      job.overallProgress = 8;
      job.currentTask = 'Starting ChatSpike analysis...';
      job.candidates = [];
      job.timeseries = [];
      job.stages = [
        { id: 'media_probe', label: 'Video inspection (FFprobe)', status: 'completed', progressPercent: 100 },
        { id: 'chat_parse', label: 'Chat parsing & alignment', status: 'running', progressPercent: 40 },
        { id: 'spike_detect', label: 'Rolling Median + MAD spike detection', status: 'waiting', progressPercent: null },
        { id: 'clip_render', label: 'FFmpeg clip extraction & thumbnails', status: 'waiting', progressPercent: null },
      ];
      job.logs.push('Started ChatSpike detection pipeline.');
      persistJob(job);

      const sourceVideoPath = meta.videoPath;
      const tempDir = getJobTempDir(dirs, jobId);

      // Run async worker without blocking HTTP response
      void (async () => {
        try {
          if (controller.signal.aborted) throw new Error('Processing cancelled by user.');

          // Stage 2 complete
          job.stages[1].status = 'completed';
          job.stages[1].progressPercent = 100;
          job.stages[2].status = 'running';
          job.stages[2].progressPercent = 35;
          job.overallProgress = 25;
          job.currentTask = 'Scanning rolling 1s chat buckets for statistical spikes...';
          persistJob(job);

          const decision = runDecisionEngine({
            jobId,
            events,
            videoDurationSec: job.video!.durationSec,
            config: job.config,
          });

          job.timeseries = decision.timeseries;
          job.candidates = decision.candidates;
          job.stages[2].status = 'completed';
          job.stages[2].progressPercent = 100;
          job.logs.push(
            ...decision.engineNotes,
            `Detected ${decision.candidates.length} candidate highlight clip${decision.candidates.length === 1 ? '' : 's'}.`
          );

          if (decision.candidates.length === 0) {
            job.stages[3].status = 'completed';
            job.stages[3].progressPercent = 100;
            job.stages[3].detail = 'No spikes crossed threshold';
            job.overallProgress = 100;
            job.status = 'completed';
            job.currentTask = 'Analysis completed with 0 spikes above current thresholds.';
            job.logs.push(
              'No chat spikes exceeded thresholds. Try High sensitivity, fewer minimum messages, or adjust timestamp offset.'
            );
            persistJob(job);
            return;
          }

          job.stages[3].status = 'running';
          job.stages[3].progressPercent = 0;
          job.overallProgress = 35;
          persistJob(job);

          const exportDir = path.join(dirs.exports, jobId);
          fs.mkdirSync(exportDir, { recursive: true });

          for (let i = 0; i < job.candidates.length; i++) {
            if (controller.signal.aborted) {
              throw new Error('Processing cancelled by user.');
            }
            const cand = job.candidates[i];
            cand.renderStatus = 'rendering';
            job.currentTask = `Extracting clip ${i + 1} of ${job.candidates.length}: ${cand.title}`;
            job.stages[3].progressPercent = Math.round((i / job.candidates.length) * 100);
            job.overallProgress = 35 + Math.round(((i + 0.1) / job.candidates.length) * 60);
            persistJob(job);

            const mp4Path = path.join(exportDir, `${cand.id}.mp4`);
            const thumbPath = path.join(exportDir, `${cand.id}.jpg`);

            try {
              const renderRes = await renderClipSegment({
                sourceVideoPath,
                outputVideoPath: mp4Path,
                outputThumbPath: thumbPath,
                tempDir,
                rootDir: dirs.root,
                startSec: cand.startSec,
                endSec: cand.endSec,
                videoDurationSec: job.video!.durationSec,
                aspectRatio: cand.aspectRatio,
                resolution: cand.resolution,
                hasAudio: job.video!.hasAudio,
                signal: controller.signal,
              });

              cand.startSec = renderRes.startSec;
              cand.endSec = renderRes.endSec;
              cand.durationSec = renderRes.durationSec;
              cand.fileSizeBytes = renderRes.fileSizeBytes;
              cand.renderStatus = 'ready';
              cand.status = 'approved';
              writeCandidateSidecars(jobId, cand);
              job.logs.push(
                `Extracted clip ${i + 1}/${job.candidates.length}: ${cand.title} (${renderRes.durationSec.toFixed(1)}s, ${Math.round(renderRes.fileSizeBytes / 1024)} KB).`
              );
            } catch (err) {
              if (controller.signal.aborted) throw err;
              cand.renderStatus = 'failed';
              cand.errorMessage = err instanceof Error ? err.message : 'FFmpeg clip extraction failed.';
              job.logs.push(`Failed extracting "${cand.title}": ${cand.errorMessage}`);
            }

            job.stages[3].progressPercent = Math.round(((i + 1) / job.candidates.length) * 100);
            job.overallProgress = 35 + Math.round(((i + 1) / job.candidates.length) * 65);
            persistJob(job);
          }

          job.stages[3].status = 'completed';
          job.stages[3].progressPercent = 100;
          job.overallProgress = 100;
          job.status = 'completed';
          job.currentTask = `Completed extraction for ${job.candidates.filter((c) => c.renderStatus === 'ready').length} of ${job.candidates.length} clips.`;
          persistJob(job);
        } catch (err) {
          if (controller.signal.aborted) {
            job.status = 'cancelled';
            job.currentTask = 'Cancelled by user.';
            job.stages = job.stages.map((st) =>
              st.status === 'running' ? { ...st, status: 'cancelled' } : st
            );
            job.logs.push('Processing cancelled cleanly and active FFmpeg processes terminated.');
          } else {
            job.status = 'failed';
            job.errorMessage = err instanceof Error ? err.message : 'Processing failed.';
            job.currentTask = job.errorMessage;
            job.stages = job.stages.map((st) =>
              st.status === 'running' ? { ...st, status: 'failed' } : st
            );
            job.logs.push(`Pipeline failed: ${job.errorMessage}`);
          }
          persistJob(job);
        } finally {
          cleanupJobTempDir(dirs, jobId);
          if (activeProcessingJobId === jobId) {
            activeProcessingJobId = null;
            activeAbortController = null;
          }
        }
      })();

      res.status(202).json(serializeJobResponse(job));
    }
  );

  router.post('/jobs/:jobId/cancel', (req: Request, res: Response) => {
    const jobId = String(req.params.jobId ?? '');
    if (!isValidSafeId(jobId)) {
      res.status(400).json({ detail: 'Invalid job identifier.' });
      return;
    }
    const job = jobs.get(jobId);
    if (!job) {
      res.status(404).json({ detail: 'ChatSpike job not found.' });
      return;
    }

    if (activeProcessingJobId === jobId && activeAbortController) {
      activeAbortController.abort();
      job.status = 'cancelled';
      job.currentTask = 'Cancelling FFmpeg worker...';
      persistJob(job);
    }
    res.json(serializeJobResponse(job));
  });

  router.patch(
    '/jobs/:jobId/candidates/:candidateId',
    express.json({ limit: '512kb' }),
    (req: Request, res: Response) => {
      const jobId = String(req.params.jobId ?? '');
      const candidateId = String(req.params.candidateId ?? '');
      if (!isValidSafeId(jobId) || !isValidSafeId(candidateId)) {
        res.status(400).json({ detail: 'Invalid identifier.' });
        return;
      }
      const job = jobs.get(jobId);
      if (!job) {
        res.status(404).json({ detail: 'ChatSpike job not found.' });
        return;
      }
      const cand = job.candidates.find((c) => c.id === candidateId);
      if (!cand) {
        res.status(404).json({ detail: 'Candidate clip not found.' });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      if (typeof body.title === 'string' && body.title.trim()) {
        cand.title = scrubLogLine(body.title.trim()).slice(0, 120);
      }
      if (body.status === 'pending' || body.status === 'approved' || body.status === 'rejected') {
        cand.status = body.status;
      }
      if (body.aspectRatio === '9:16' || body.aspectRatio === '1:1' || body.aspectRatio === '16:9') {
        cand.aspectRatio = body.aspectRatio;
      }
      if (body.resolution === '720p' || body.resolution === '1080p') {
        cand.resolution = body.resolution;
      }
      if (typeof body.captionsEnabled === 'boolean') {
        cand.captionsEnabled = body.captionsEnabled;
      }
      if (typeof body.captionsSrt === 'string') {
        cand.captionsSrt = body.captionsSrt.slice(0, 100_000);
        cand.captionsVtt = srtToVtt(cand.captionsSrt);
      }
      if (
        (typeof body.startSec === 'number' || typeof body.endSec === 'number') &&
        job.video
      ) {
        const clamped = clampClipWindow(
          typeof body.startSec === 'number' ? body.startSec : cand.startSec,
          typeof body.endSec === 'number' ? body.endSec : cand.endSec,
          job.video.durationSec
        );
        cand.startSec = clamped.startSec;
        cand.endSec = clamped.endSec;
        cand.durationSec = clamped.durationSec;
      }

      writeCandidateSidecars(jobId, cand);
      persistJob(job);
      res.json(serializeJobResponse(job));
    }
  );

  router.post(
    '/jobs/:jobId/candidates/:candidateId/regenerate',
    express.json({ limit: '64kb' }),
    async (req: Request, res: Response) => {
      const jobId = String(req.params.jobId ?? '');
      const candidateId = String(req.params.candidateId ?? '');
      if (!isValidSafeId(jobId) || !isValidSafeId(candidateId)) {
        res.status(400).json({ detail: 'Invalid identifier.' });
        return;
      }
      const job = jobs.get(jobId);
      const meta = jobMetaMap.get(jobId);
      if (!job || !job.video || !meta?.videoPath || !fs.existsSync(meta.videoPath)) {
        res.status(404).json({ detail: 'Job or source video not found.' });
        return;
      }
      const cand = job.candidates.find((c) => c.id === candidateId);
      if (!cand) {
        res.status(404).json({ detail: 'Candidate clip not found.' });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const nextAspect: AspectRatio =
        body.aspectRatio === '9:16' || body.aspectRatio === '1:1' || body.aspectRatio === '16:9'
          ? body.aspectRatio
          : cand.aspectRatio;
      const nextRes: OutputResolution =
        body.resolution === '720p' || body.resolution === '1080p'
          ? body.resolution
          : cand.resolution;

      const clamped = clampClipWindow(
        typeof body.startSec === 'number' ? body.startSec : cand.startSec,
        typeof body.endSec === 'number' ? body.endSec : cand.endSec,
        job.video.durationSec
      );

      cand.aspectRatio = nextAspect;
      cand.resolution = nextRes;
      cand.startSec = clamped.startSec;
      cand.endSec = clamped.endSec;
      cand.durationSec = clamped.durationSec;

      if (cand.captionsEnabled) {
        const evs = jobEventsCache.get(jobId) ?? [];
        const rebuilt = buildSynchronizedCaptions({
          startSec: cand.startSec,
          endSec: cand.endSec,
          events: evs,
        });
        if (!cand.captionsSrt || body.startSec !== undefined || body.endSec !== undefined) {
          cand.captionsSrt = rebuilt.srt;
          cand.captionsVtt = rebuilt.vtt;
        }
      }

      const exportDir = path.join(dirs.exports, jobId);
      const tempDir = getJobTempDir(dirs, jobId);
      const mp4Path = path.join(exportDir, `${cand.id}.mp4`);
      const thumbPath = path.join(exportDir, `${cand.id}.jpg`);

      try {
        cand.renderStatus = 'rendering';
        const rendered = await renderClipSegment({
          sourceVideoPath: meta.videoPath,
          outputVideoPath: mp4Path,
          outputThumbPath: thumbPath,
          tempDir,
          rootDir: dirs.root,
          startSec: cand.startSec,
          endSec: cand.endSec,
          videoDurationSec: job.video.durationSec,
          aspectRatio: cand.aspectRatio,
          resolution: cand.resolution,
          hasAudio: job.video.hasAudio,
        });
        cand.fileSizeBytes = rendered.fileSizeBytes;
        cand.startSec = rendered.startSec;
        cand.endSec = rendered.endSec;
        cand.durationSec = rendered.durationSec;
        cand.renderStatus = 'ready';
        cand.errorMessage = null;
        writeCandidateSidecars(jobId, cand);
        persistJob(job);
        res.json(serializeJobResponse(job));
      } catch (err) {
        cand.renderStatus = 'failed';
        cand.errorMessage = err instanceof Error ? err.message : 'Regeneration failed.';
        persistJob(job);
        res.status(500).json({ detail: cand.errorMessage });
      } finally {
        cleanupJobTempDir(dirs, jobId);
      }
    }
  );

  router.post(
    '/jobs/:jobId/candidates/merge',
    express.json({ limit: '64kb' }),
    async (req: Request, res: Response) => {
      const jobId = String(req.params.jobId ?? '');
      if (!isValidSafeId(jobId)) {
        res.status(400).json({ detail: 'Invalid job identifier.' });
        return;
      }
      const job = jobs.get(jobId);
      const meta = jobMetaMap.get(jobId);
      if (!job || !job.video || !meta?.videoPath || !fs.existsSync(meta.videoPath)) {
        res.status(404).json({ detail: 'Job or source video not found.' });
        return;
      }

      const body = (req.body ?? {}) as { candidateIds?: unknown };
      const ids = Array.isArray(body.candidateIds)
        ? body.candidateIds.filter((id): id is string => typeof id === 'string')
        : [];
      const selected = job.candidates.filter((c) => ids.includes(c.id));
      if (selected.length < 2) {
        res.status(400).json({ detail: 'Select at least 2 clip candidates to merge.' });
        return;
      }

      const events = jobEventsCache.get(jobId) ?? [];
      const mergedId = `cscand_m_${crypto.randomBytes(4).toString('hex')}`;
      const merged = mergeSelectedCandidates(
        selected,
        job.video.durationSec,
        events,
        mergedId
      );

      const exportDir = path.join(dirs.exports, jobId);
      const tempDir = getJobTempDir(dirs, jobId);
      const mp4Path = path.join(exportDir, `${merged.id}.mp4`);
      const thumbPath = path.join(exportDir, `${merged.id}.jpg`);

      try {
        const rendered = await renderClipSegment({
          sourceVideoPath: meta.videoPath,
          outputVideoPath: mp4Path,
          outputThumbPath: thumbPath,
          tempDir,
          rootDir: dirs.root,
          startSec: merged.startSec,
          endSec: merged.endSec,
          videoDurationSec: job.video.durationSec,
          aspectRatio: merged.aspectRatio,
          resolution: merged.resolution,
          hasAudio: job.video.hasAudio,
        });
        merged.fileSizeBytes = rendered.fileSizeBytes;
        merged.startSec = rendered.startSec;
        merged.endSec = rendered.endSec;
        merged.durationSec = rendered.durationSec;
        merged.renderStatus = 'ready';
        writeCandidateSidecars(jobId, merged);

        // Replace source candidates with merged clip while keeping non-merged candidates
        job.candidates = [
          merged,
          ...job.candidates.filter((c) => !ids.includes(c.id)),
        ];
        job.logs.push(
          `Merged ${selected.length} clips into "${merged.title}" (${merged.durationSec.toFixed(1)}s).`
        );
        persistJob(job);
        res.json(serializeJobResponse(job));
      } catch (err) {
        res.status(500).json({
          detail: err instanceof Error ? err.message : 'Failed to extract merged MP4.',
        });
      } finally {
        cleanupJobTempDir(dirs, jobId);
      }
    }
  );

  // Commit approved clips from ChatSpike job into persistent ClipCat Library (/clips, /exports, /clips/:id/edit)
  router.post(
    '/jobs/:jobId/save-to-library',
    express.json({ limit: '64kb' }),
    (req: Request, res: Response) => {
      const jobId = String(req.params.jobId ?? '');
      if (!isValidSafeId(jobId)) {
        res.status(400).json({ detail: 'Invalid job identifier.' });
        return;
      }
      const job = jobs.get(jobId);
      const meta = jobMetaMap.get(jobId);
      if (!job || !job.video || !meta?.videoPath) {
        res.status(404).json({ detail: 'ChatSpike job or source video not found.' });
        return;
      }

      const body = (req.body ?? {}) as { candidateIds?: unknown };
      const requestedIds = Array.isArray(body.candidateIds)
        ? new Set(body.candidateIds.filter((x): x is string => typeof x === 'string'))
        : null;

      const toSave = job.candidates.filter((c) => {
        if (c.renderStatus !== 'ready') return false;
        if (requestedIds) return requestedIds.has(c.id);
        return c.status === 'approved';
      });

      if (toSave.length === 0) {
        res.status(400).json({
          detail: 'Approve at least one extracted clip before saving to the ClipCat library.',
        });
        return;
      }

      const store = loadLibraryStore(dirs);
      const projectId = job.savedProjectId ?? `chatspike-proj-${job.id}`;
      const now = new Date().toISOString();

      const existingProjIdx = store.projects.findIndex((p) => p.id === projectId);
      const projectRecord: Project = {
        id: projectId,
        name: job.projectName,
        sourceType: 'upload',
        sourceFilename: job.video.originalFilename,
        sourceUrl: null,
        thumbnailUrl: null,
        durationSec: job.video.durationSec,
        resolution: `${job.video.width}x${job.video.height}`,
        fileSizeBytes: job.video.fileSizeBytes,
        clipCount: toSave.length,
        status: 'completed',
        activeJobId: null,
        config: {
          projectName: job.projectName,
          desiredClipCount: toSave.length,
          minDurationSec: 5,
          preferredDurationSec: Math.round(
            toSave.reduce((s, c) => s + c.durationSec, 0) / toSave.length
          ),
          maxDurationSec: 180,
          aspectRatio: job.config.aspectRatio,
          layoutMode: 'center_crop',
          captionsEnabled: job.config.captionsEnabled,
          captionPresetId: 'minimal',
          captionFontSize: 'medium',
          captionPosition: 'bottom',
          highlightKeywords: true,
          wordByWordAnimation: false,
          speakerLabels: false,
          outputFormat: 'mp4',
          videoCodec: 'h264',
          outputResolution: job.config.resolution,
          outputFps: 30,
          autoProcess: true,
        },
        createdAt: existingProjIdx >= 0 ? store.projects[existingProjIdx].createdAt : now,
        updatedAt: now,
        completedAt: now,
      };

      const savedClipsOut: Clip[] = [];
      for (const cand of toSave) {
        const clipId = cand.savedClipId ?? `chatspike-clip-${cand.id}`;
        const exportDir = path.join(dirs.exports, jobId);
        const libClipDir = path.join(dirs.library, clipId);
        fs.mkdirSync(libClipDir, { recursive: true });

        const copySafe = (src: string, dest: string) => {
          if (fs.existsSync(src) && isPathInsideRoot(dest, dirs.library)) {
            fs.copyFileSync(src, dest);
          }
        };

        const mp4Path = path.join(libClipDir, `${clipId}.mp4`);
        const thumbPath = path.join(libClipDir, `${clipId}.jpg`);
        const srtPath = path.join(libClipDir, `${clipId}.srt`);
        const vttPath = path.join(libClipDir, `${clipId}.vtt`);
        const metadataPath = path.join(libClipDir, `${clipId}.json`);

        copySafe(path.join(exportDir, `${cand.id}.mp4`), mp4Path);
        copySafe(path.join(exportDir, `${cand.id}.jpg`), thumbPath);
        fs.writeFileSync(srtPath, cand.captionsSrt || '', 'utf8');
        fs.writeFileSync(vttPath, cand.captionsVtt || 'WEBVTT\n\n', 'utf8');
        writeJsonAtomic(metadataPath, dirs.library, {
          clipId,
          projectId,
          title: cand.title,
          startSec: cand.startSec,
          endSec: cand.endSec,
          engagementScore: cand.engagementScore,
          engagementReasons: cand.engagementReasons,
          constituentSpikeTimestamps: cand.constituentSpikeTimestamps,
          dominantKeywords: cand.dominantKeywords,
        });

        const clipRecord: Clip = {
          id: clipId,
          projectId,
          projectName: job.projectName,
          title: cand.title,
          description: cand.engagementReasons.join(' · '),
          startSec: cand.startSec,
          endSec: cand.endSec,
          durationSec: cand.durationSec,
          aiScore: cand.engagementScore,
          scoringBreakdown: {
            overallScore: cand.engagementScore,
            summary: cand.engagementReasons[0] ?? 'Chat spike reaction peak',
            disclaimer: cand.engagementDisclaimer,
            factors: [
              {
                label: 'Spike Intensity',
                score: cand.scoreComponents.intensity,
                maxScore: 35,
                explanation: `Peak ${cand.peakMessagesPerSec} msg/s above surrounding chat baseline`,
              },
              {
                label: 'Unique Participants',
                score: cand.scoreComponents.uniqueParticipants,
                maxScore: 25,
                explanation: `${cand.uniqueParticipants} unique chat participants in clip window`,
              },
              {
                label: 'Reaction Density',
                score: cand.scoreComponents.reactionDensity,
                maxScore: 25,
                explanation:
                  cand.dominantKeywords.length > 0
                    ? `Keywords: ${cand.dominantKeywords.join(', ')}`
                    : 'Emoji / hype expression density',
              },
              {
                label: 'Sustainment',
                score: cand.scoreComponents.sustainment,
                maxScore: 15,
                explanation: `Multi-second sustained reaction momentum`,
              },
            ],
          },
          aspectRatio: cand.aspectRatio,
          layoutMode: 'center_crop',
          resolution: cand.resolution,
          fileSizeBytes: cand.fileSizeBytes,
          status: 'completed',
          captionStatus: cand.captionsEnabled && cand.captionsSrt ? 'applied' : 'disabled',
          exportStatus: 'ready',
          captionSettings: {
            enabled: cand.captionsEnabled,
            presetId: 'minimal',
            fontSize: 'medium',
            position: 'bottom',
            highlightKeywords: true,
            wordByWordAnimation: false,
            speakerLabels: false,
          },
          createdAt: now,
          updatedAt: now,
        };

        const existingClipIdx = store.clips.findIndex((entry) => entry.clip.id === clipId);
        const entry = {
          clip: clipRecord,
          sourceVideoPath: meta.videoPath,
          mp4Path,
          thumbPath,
          srtPath,
          vttPath,
          metadataPath,
          captionsSrt: cand.captionsSrt,
          captionsVtt: cand.captionsVtt,
        };
        if (existingClipIdx >= 0) {
          store.clips[existingClipIdx] = entry;
        } else {
          store.clips.unshift(entry);
        }

        cand.savedClipId = clipId;
        savedClipsOut.push(clipRecord);
      }

      if (savedClipsOut.length > 0 && fs.existsSync(path.join(dirs.library, savedClipsOut[0].id, `${savedClipsOut[0].id}.jpg`))) {
        projectRecord.thumbnailUrl = signMediaUrl(
          security,
          'library',
          savedClipsOut[0].id,
          'jpg'
        );
      }

      if (existingProjIdx >= 0) {
        store.projects[existingProjIdx] = projectRecord;
      } else {
        store.projects.unshift(projectRecord);
      }

      job.savedProjectId = projectId;
      saveLibraryStore(dirs, store);
      persistJob(job);

      res.json({
        project: projectRecord,
        clips: savedClipsOut.map((c) => signLibraryClip(security, c)),
      });
    }
  );

  // Unified ClipCat Library integration routes
  const signLibraryClip = (ctx: SecurityContext, clip: Clip): Clip => {
    const libDir = path.join(dirs.library, clip.id);
    const hasMp4 = fs.existsSync(path.join(libDir, `${clip.id}.mp4`));
    const hasThumb = fs.existsSync(path.join(libDir, `${clip.id}.jpg`));
    const hasSrt = fs.existsSync(path.join(libDir, `${clip.id}.srt`));
    const hasVtt = fs.existsSync(path.join(libDir, `${clip.id}.vtt`));
    const hasJson = fs.existsSync(path.join(libDir, `${clip.id}.json`));

    return {
      ...clip,
      previewVideoUrl: hasMp4 ? signMediaUrl(ctx, 'library', clip.id, 'mp4') : null,
      downloadUrl: hasMp4 ? `${signMediaUrl(ctx, 'library', clip.id, 'mp4')}&download=1` : null,
      thumbnailUrl: hasThumb ? signMediaUrl(ctx, 'library', clip.id, 'jpg') : null,
      srtUrl: hasSrt ? signMediaUrl(ctx, 'library', clip.id, 'srt') : null,
      vttUrl: hasVtt ? signMediaUrl(ctx, 'library', clip.id, 'vtt') : null,
      metadataUrl: hasJson ? signMediaUrl(ctx, 'library', clip.id, 'json') : null,
    };
  };

  router.get('/library', (_req: Request, res: Response) => {
    const store = loadLibraryStore(dirs);
    const signedClips = store.clips.map((entry) => signLibraryClip(security, entry.clip));
    const signedProjects = store.projects.map((p) => {
      const firstClip = signedClips.find((c) => c.projectId === p.id && c.thumbnailUrl);
      return {
        ...p,
        thumbnailUrl: firstClip?.thumbnailUrl ?? null,
      };
    });
    res.json({
      projects: signedProjects,
      clips: signedClips,
    });
  });

  router.patch(
    '/library/clips/:clipId',
    express.json({ limit: '64kb' }),
    (req: Request, res: Response) => {
      const clipId = String(req.params.clipId ?? '');
      if (!isValidSafeId(clipId)) {
        res.status(400).json({ detail: 'Invalid clip ID.' });
        return;
      }
      const store = loadLibraryStore(dirs);
      const entry = store.clips.find((e) => e.clip.id === clipId);
      if (!entry) {
        res.status(404).json({ detail: 'Saved ChatSpike clip not found.' });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      if (typeof body.title === 'string' && body.title.trim()) {
        entry.clip.title = scrubLogLine(body.title.trim()).slice(0, 120);
      }
      if (typeof body.description === 'string') {
        entry.clip.description = scrubLogLine(body.description.trim()).slice(0, 400);
      }
      if (body.aspectRatio === '9:16' || body.aspectRatio === '1:1' || body.aspectRatio === '16:9') {
        entry.clip.aspectRatio = body.aspectRatio;
      }
      if (body.resolution === '720p' || body.resolution === '1080p') {
        entry.clip.resolution = body.resolution;
      }
      entry.clip.updatedAt = new Date().toISOString();
      saveLibraryStore(dirs, store);
      res.json(signLibraryClip(security, entry.clip));
    }
  );

  router.post(
    '/library/clips/:clipId/render',
    express.json({ limit: '64kb' }),
    async (req: Request, res: Response) => {
      const clipId = String(req.params.clipId ?? '');
      if (!isValidSafeId(clipId)) {
        res.status(400).json({ detail: 'Invalid clip ID.' });
        return;
      }
      const store = loadLibraryStore(dirs);
      const entry = store.clips.find((e) => e.clip.id === clipId);
      if (!entry || !fs.existsSync(entry.sourceVideoPath)) {
        res.status(404).json({ detail: 'Saved ChatSpike clip or source video not found.' });
        return;
      }

      const proj = store.projects.find((p) => p.id === entry.clip.projectId);
      const videoDurationSec = proj?.durationSec ?? entry.clip.endSec + 10;

      const body = (req.body ?? {}) as Record<string, unknown>;
      const clamped = clampClipWindow(
        typeof body.startSec === 'number' ? body.startSec : entry.clip.startSec,
        typeof body.endSec === 'number' ? body.endSec : entry.clip.endSec,
        videoDurationSec
      );
      const nextAspect: AspectRatio =
        body.aspectRatio === '9:16' || body.aspectRatio === '1:1' || body.aspectRatio === '16:9'
          ? body.aspectRatio
          : entry.clip.aspectRatio;
      const nextRes: OutputResolution =
        body.resolution === '720p' || body.resolution === '1080p'
          ? body.resolution
          : entry.clip.resolution;

      const tempDir = getJobTempDir(dirs, clipId);
      try {
        const rendered = await renderClipSegment({
          sourceVideoPath: entry.sourceVideoPath,
          outputVideoPath: entry.mp4Path,
          outputThumbPath: entry.thumbPath,
          tempDir,
          rootDir: dirs.root,
          startSec: clamped.startSec,
          endSec: clamped.endSec,
          videoDurationSec,
          aspectRatio: nextAspect,
          resolution: nextRes,
          hasAudio: true,
        });

        entry.clip.startSec = rendered.startSec;
        entry.clip.endSec = rendered.endSec;
        entry.clip.durationSec = rendered.durationSec;
        entry.clip.aspectRatio = nextAspect;
        entry.clip.resolution = nextRes;
        entry.clip.fileSizeBytes = rendered.fileSizeBytes;
        entry.clip.status = 'completed';
        entry.clip.exportStatus = 'ready';
        entry.clip.updatedAt = new Date().toISOString();

        saveLibraryStore(dirs, store);
        res.json(signLibraryClip(security, entry.clip));
      } catch (err) {
        res.status(500).json({
          detail: err instanceof Error ? err.message : 'FFmpeg re-render failed.',
        });
      } finally {
        cleanupJobTempDir(dirs, clipId);
      }
    }
  );

  router.delete('/library/clips/:clipId', (req: Request, res: Response) => {
    const clipId = String(req.params.clipId ?? '');
    if (!isValidSafeId(clipId)) {
      res.status(400).json({ detail: 'Invalid clip ID.' });
      return;
    }
    const store = loadLibraryStore(dirs);
    const idx = store.clips.findIndex((e) => e.clip.id === clipId);
    if (idx === -1) {
      res.status(404).json({ detail: 'Saved ChatSpike clip not found.' });
      return;
    }
    const removed = store.clips.splice(idx, 1)[0];
    const libDir = path.join(dirs.library, clipId);
    if (isPathInsideRoot(libDir, dirs.library)) {
      fs.rmSync(libDir, { recursive: true, force: true });
    }
    const proj = store.projects.find((p) => p.id === removed.clip.projectId);
    if (proj) {
      proj.clipCount = store.clips.filter((c) => c.clip.projectId === proj.id).length;
    }
    saveLibraryStore(dirs, store);
    res.status(204).end();
  });

  router.post(
    '/library/batch-export',
    express.json({ limit: '64kb' }),
    (req: Request, res: Response) => {
      const body = (req.body ?? {}) as { clipIds?: unknown; formats?: unknown };
      const clipIds = Array.isArray(body.clipIds)
        ? body.clipIds.filter((id): id is string => typeof id === 'string')
        : [];
      const formats = Array.isArray(body.formats)
        ? body.formats.filter((f): f is string => VALID_ARTIFACTS.has(String(f)))
        : ['mp4', 'srt'];

      const store = loadLibraryStore(dirs);
      const selected = store.clips.filter((e) => clipIds.includes(e.clip.id));
      if (selected.length === 0) {
        res.status(404).json({ detail: 'No matching ChatSpike library clips found.' });
        return;
      }

      const zipFiles: Array<{ name: string; content: Buffer }> = [];
      for (const entry of selected) {
        const slug = sanitizeDownloadFilename(entry.clip.title, '').replace(/\.$/, '');
        if (formats.includes('mp4') && fs.existsSync(entry.mp4Path)) {
          zipFiles.push({ name: `${slug}.mp4`, content: fs.readFileSync(entry.mp4Path) });
        }
        if (formats.includes('srt') && fs.existsSync(entry.srtPath)) {
          zipFiles.push({ name: `${slug}.srt`, content: fs.readFileSync(entry.srtPath) });
        }
        if (formats.includes('vtt') && fs.existsSync(entry.vttPath)) {
          zipFiles.push({ name: `${slug}.vtt`, content: fs.readFileSync(entry.vttPath) });
        }
        if (formats.includes('json') && fs.existsSync(entry.metadataPath)) {
          zipFiles.push({ name: `${slug}.json`, content: fs.readFileSync(entry.metadataPath) });
        }
      }

      const archiveId = `cszip_${crypto.randomBytes(6).toString('hex')}`;
      const zipPath = path.join(dirs.temp, `${archiveId}.zip`);
      fs.writeFileSync(zipPath, buildTinyZipBuffer(zipFiles));

      const signedBase = signMediaUrl(security, 'library', archiveId, 'json');
      const queryPart = signedBase.split('?')[1] ?? '';

      res.json({
        archiveUrl: `/api/chatspike/media-zip/${archiveId}?${queryPart}`,
        exportedCount: selected.length,
        message: `Packaged ${selected.length} ChatSpike clip${selected.length === 1 ? '' : 's'} into ZIP archive.`,
      });
    }
  );

  return { router, security, dirs };
}
