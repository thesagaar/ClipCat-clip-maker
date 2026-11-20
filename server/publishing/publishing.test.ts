import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createServerApp } from '../app.ts';
import { signMediaUrl } from '../chatspikeSecurity.ts';
import { saveLibraryStore } from '../chatspikeStorage.ts';
import type { Clip } from '../../src/types/clip';

async function startTestApp(options: {
  dataDir: string;
  fetchFn?: typeof fetch;
  oauthOverrides?: Record<string, string>;
}) {
  const { app, security, dirs } = createServerApp({
    dataDir: options.dataDir,
    publishingFetchFn: options.fetchFn,
    publishingOAuthEnvOverrides: options.oauthOverrides,
  });

  const server = await new Promise<http.Server>((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to bind test port');
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return { server, baseUrl, security, dirs };
}

function createSyntheticMp4(outPath: string): void {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  execFileSync('/usr/bin/ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=blue:s=360x640:d=2',
    '-f',
    'lavfi',
    '-i',
    'anullsrc=r=44100:cl=mono',
    '-t',
    '2',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    outPath,
  ]);
}

test('Publishing security, encrypted vault, OAuth state/PKCE, resumable upload verification, retry, and duplicate guard', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clipcat-pub-test-'));
  const clipMp4 = path.join(tempRoot, 'library', 'clip_sample.mp4');
  createSyntheticMp4(clipMp4);

  let uploadAttempt = 0;
  let refreshedOnce = false;

  const mockFetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);

    // 1. Google OAuth code exchange
    if (u === 'https://oauth2.googleapis.com/token') {
      const bodyStr = String(init?.body ?? '');
      if (bodyStr.includes('grant_type=refresh_token')) {
        refreshedOnce = true;
        return new Response(JSON.stringify({ access_token: 'yt_access_refreshed', expires_in: 3600 }), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({
          access_token: 'yt_access_secret_token_1',
          refresh_token: 'yt_refresh_secret_1',
          expires_in: 1, // Force expiry check before upload -> triggers refresh
          scope: 'https://www.googleapis.com/auth/youtube.upload',
        }),
        { status: 200 }
      );
    }

    // 2. YouTube channel check
    if (u.startsWith('https://www.googleapis.com/youtube/v3/channels')) {
      return new Response(
        JSON.stringify({
          items: [
            {
              id: 'UC_TEST_CHANNEL_01',
              snippet: { title: 'ClipCat Studio QA', customUrl: '@clipcatqa' },
              status: { isLinked: true },
            },
          ],
        }),
        { status: 200 }
      );
    }

    // 3. YouTube resumable upload init
    if (u.startsWith('https://www.googleapis.com/upload/youtube/v3/videos')) {
      return new Response(null, {
        status: 200,
        headers: { Location: 'https://upload.googleapis.example/session/abc' },
      });
    }

    // 4. Chunk PUT — fail first attempt to verify retry & local MP4 preservation, succeed on retry
    if (u === 'https://upload.googleapis.example/session/abc') {
      uploadAttempt += 1;
      if (uploadAttempt === 1) {
        return new Response('transient 503 failure', { status: 503 });
      }
      return new Response(JSON.stringify({ id: 'yt_vid_999' }), { status: 200 });
    }

    // 5. YouTube post-upload status verification
    if (u.startsWith('https://www.googleapis.com/youtube/v3/videos?part=status')) {
      return new Response(
        JSON.stringify({
          items: [{ id: 'yt_vid_999', status: { uploadStatus: 'uploaded' } }],
        }),
        { status: 200 }
      );
    }

    // 6. Captions track upload
    if (u.startsWith('https://www.googleapis.com/upload/youtube/v3/captions')) {
      return new Response(JSON.stringify({ id: 'cap_1' }), { status: 200 });
    }

    // 7. Revoke endpoint on disconnect
    if (u === 'https://oauth2.googleapis.com/revoke') {
      return new Response('', { status: 200 });
    }

    throw new Error(`Unexpected external fetch URL in test: ${u}`);
  }) as typeof fetch;

  const { server, baseUrl, security, dirs } = await startTestApp({
    dataDir: tempRoot,
    fetchFn: mockFetch,
    oauthOverrides: {
      youtubeClientId: 'test-client-id',
      youtubeClientSecret: 'super-secret-client-secret-value',
    },
  });

  try {
    // Seed a real library clip backed by the synthetic MP4
    const sampleClip: Clip = {
      id: 'chatspike-clip-pubtest-1',
      projectId: 'chatspike-proj-pubtest-1',
      projectName: 'GPU Test Session',
      title: 'GPU Frame Pacing Highlight',
      description: 'Testing sustained 4K frame times on the new graphics card.',
      startSec: 0,
      endSec: 2,
      durationSec: 2,
      aiScore: 91,
      scoringBreakdown: {
        overallScore: 91,
        summary: 'Strong test summary',
        disclaimer: 'Heuristic only',
        factors: [],
      },
      thumbnailUrl: signMediaUrl(security, 'library', 'chatspike-clip-pubtest-1', 'jpg'),
      aspectRatio: '9:16',
      layoutMode: 'center_crop',
      resolution: '1080p',
      fileSizeBytes: fs.statSync(clipMp4).size,
      status: 'completed',
      captionStatus: 'applied',
      exportStatus: 'ready',
      captionSettings: {
        enabled: true,
        presetId: 'minimal',
        fontSize: 'medium',
        position: 'bottom',
        highlightKeywords: true,
        wordByWordAnimation: false,
        speakerLabels: false,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveLibraryStore(dirs, {
      projects: [],
      clips: [
        {
          clip: sampleClip,
          sourceVideoPath: clipMp4,
          mp4Path: clipMp4,
          thumbPath: clipMp4,
          srtPath: clipMp4,
          vttPath: clipMp4,
          metadataPath: clipMp4,
          captionsSrt: '1\n00:00:00,000 --> 00:00:02,000\nGPU frame times remained flat.\n',
          captionsVtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nGPU frame times remained flat.\n',
        },
      ],
    });

    // Reject unauthenticated API access
    const unauthRes = await fetch(`${baseUrl}/api/publishing/accounts`);
    assert.equal(unauthRes.status, 401);

    // Reject untrusted remote origin (CORS/CSRF)
    const badOriginRes = await fetch(`${baseUrl}/api/publishing/accounts`, {
      headers: {
        Origin: 'https://evil-attacker.example',
        'X-ClipCat-Token': security.sessionToken,
      },
    });
    assert.equal(badOriginRes.status, 403);

    const authHeaders = {
      'Content-Type': 'application/json',
      'X-ClipCat-Token': security.sessionToken,
      Origin: baseUrl,
    };

    // Start OAuth -> verify PKCE + state parameters present
    const startAuth = await fetch(`${baseUrl}/api/publishing/oauth/youtube/start`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert.equal(startAuth.status, 200);
    const { authUrl, state } = (await startAuth.json()) as { authUrl: string; state: string };
    assert.ok(authUrl.includes('code_challenge_method=S256'));
    assert.ok(state.length >= 16);

    // Reject forged/invalid OAuth callback state
    const badCb = await fetch(`${baseUrl}/api/publishing/oauth/youtube/callback?code=c1&state=forged_state`);
    assert.equal(badCb.status, 400);

    // Complete valid OAuth callback
    const goodCb = await fetch(
      `${baseUrl}/api/publishing/oauth/youtube/callback?code=auth_code_1&state=${encodeURIComponent(state)}`
    );
    assert.equal(goodCb.status, 200);

    // Verify encrypted vault does not write plaintext tokens or client_secret
    const vaultRaw = fs.readFileSync(path.join(tempRoot, 'publishing', 'vault.enc.json'), 'utf8');
    assert.equal(vaultRaw.includes('yt_access_secret_token_1'), false);
    assert.equal(vaultRaw.includes('yt_refresh_secret_1'), false);
    assert.equal(vaultRaw.includes('super-secret-client-secret-value'), false);

    // Verify public accounts endpoint never exposes tokens or secrets
    const acctsRes = await fetch(`${baseUrl}/api/publishing/accounts`, { headers: authHeaders });
    const acctsText = await acctsRes.text();
    assert.equal(acctsText.includes('yt_access_secret_token_1'), false);
    assert.equal(acctsText.includes('super-secret-client-secret-value'), false);
    const acctsJson = JSON.parse(acctsText) as { accounts: Array<{ platform: string; connected: boolean; accountName: string }> };
    const ytAcct = acctsJson.accounts.find((a) => a.platform === 'youtube');
    assert.equal(ytAcct?.connected, true);
    assert.equal(ytAcct?.accountName, 'ClipCat Studio QA');

    // Reject start without explicit userConfirmedPublish: true
    const unconfirmedStart = await fetch(`${baseUrl}/api/publishing/start`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        clip: sampleClip,
        platform: 'youtube',
        sourceInput: { userOwnsContent: true },
        userConfirmedPublish: false,
        idempotencyKey: 'idem-unconfirmed',
      }),
    });
    assert.equal(unconfirmedStart.status, 400);

    // Wait 1.1s so initial 1s expiry lapses and forces refresh_token execution cleanly
    await new Promise((r) => setTimeout(r, 1100));

    // Start upload -> Attempt 1 fails with transient 503
    const startPub = await fetch(`${baseUrl}/api/publishing/start`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        clip: sampleClip,
        platform: 'youtube',
        sourceInput: { userOwnsContent: true },
        userConfirmedPublish: true,
        idempotencyKey: 'idem-pub-1',
      }),
    });
    assert.equal(startPub.status, 202);
    const createdJob = (await startPub.json()) as { id: string };

    // Poll until failure observed
    let jobState: { status: string; retryable: boolean; publishedUrl: string | null } = {
      status: 'preparing_media',
      retryable: false,
      publishedUrl: null,
    };
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const jr = await fetch(`${baseUrl}/api/publishing/jobs/${createdJob.id}`, { headers: authHeaders });
      jobState = (await jr.json()) as typeof jobState;
      if (jobState.status === 'failed' || jobState.status === 'published') break;
    }
    assert.equal(jobState.status, 'failed');
    assert.equal(jobState.retryable, true);
    assert.equal(refreshedOnce, true, 'Expected expired access token to be refreshed before upload');
    assert.equal(fs.existsSync(clipMp4), true, 'Local rendered MP4 must never be deleted when upload fails');

    // Retry the failed job -> Attempt 2 succeeds & verifies via YouTube API
    const retryRes = await fetch(`${baseUrl}/api/publishing/jobs/${createdJob.id}/retry`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert.equal(retryRes.status, 202);

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const jr = await fetch(`${baseUrl}/api/publishing/jobs/${createdJob.id}`, { headers: authHeaders });
      jobState = (await jr.json()) as typeof jobState;
      if (jobState.status === 'published' || jobState.status === 'failed') break;
    }
    assert.equal(jobState.status, 'published');
    assert.equal(jobState.publishedUrl, 'https://www.youtube.com/watch?v=yt_vid_999');

    // Duplicate prevention: second start for same clip + platform rejected unless explicitly allowed
    const dupStart = await fetch(`${baseUrl}/api/publishing/start`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        clip: sampleClip,
        platform: 'youtube',
        sourceInput: { userOwnsContent: true },
        userConfirmedPublish: true,
        idempotencyKey: 'idem-pub-2',
      }),
    });
    assert.equal(dupStart.status, 422);

    // History persisted cleanly
    const histRes = await fetch(`${baseUrl}/api/publishing/history`, { headers: authHeaders });
    const histJson = (await histRes.json()) as { history: Array<{ publishedUrl: string; status: string }> };
    assert.equal(histJson.history.length, 1);
    assert.equal(histJson.history[0]?.status, 'published');

    // Disconnect wipes encrypted credentials cleanly
    await fetch(`${baseUrl}/api/publishing/accounts/youtube/disconnect`, {
      method: 'POST',
      headers: authHeaders,
    });
    const postDisc = await fetch(`${baseUrl}/api/publishing/accounts`, { headers: authHeaders });
    const postDiscJson = (await postDisc.json()) as { accounts: Array<{ platform: string; connected: boolean }> };
    assert.equal(postDiscJson.accounts.find((a) => a.platform === 'youtube')?.connected, false);
  } finally {
    server.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('Instagram official flow enforces Business/Creator eligibility, single-use signed temp MP4 stream, and automatic temp cleanup', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clipcat-ig-test-'));
  const clipMp4 = path.join(tempRoot, 'library', 'ig_clip.mp4');
  createSyntheticMp4(clipMp4);

  let serverBaseUrl = '';
  let fetchedSignedMediaOnce = false;

  const mockIgFetch = (async (url: string | URL) => {
    const u = String(url);
    if (u.startsWith('https://graph.facebook.com/v21.0/oauth/access_token')) {
      return new Response(JSON.stringify({ access_token: 'ig_token_1', expires_in: 3600 }), { status: 200 });
    }
    if (u.startsWith('https://graph.facebook.com/v21.0/me/accounts')) {
      return new Response(
        JSON.stringify({
          data: [
            {
              name: 'ClipCat FB Page',
              instagram_business_account: {
                id: '17841400001',
                username: 'clipcat.official',
                name: 'ClipCat Studio',
                account_type: 'BUSINESS',
              },
            },
          ],
        }),
        { status: 200 }
      );
    }
    if (u === 'https://graph.facebook.com/v21.0/17841400001/media') {
      return new Response(JSON.stringify({ id: 'ig_container_55' }), { status: 200 });
    }
    if (u.startsWith('https://graph.facebook.com/v21.0/ig_container_55')) {
      return new Response(JSON.stringify({ status_code: 'FINISHED' }), { status: 200 });
    }
    if (u === 'https://graph.facebook.com/v21.0/17841400001/media_publish') {
      return new Response(JSON.stringify({ id: 'ig_media_777' }), { status: 200 });
    }
    if (u.startsWith('https://graph.facebook.com/v21.0/ig_media_777')) {
      return new Response(JSON.stringify({ permalink: 'https://www.instagram.com/reel/TEST777/' }), {
        status: 200,
      });
    }
    throw new Error(`Unexpected IG test URL: ${u}`);
  }) as typeof fetch;

  const { server, baseUrl, security, dirs } = await startTestApp({
    dataDir: tempRoot,
    fetchFn: mockIgFetch,
    oauthOverrides: {
      instagramAppId: 'meta-app-1',
      instagramAppSecret: 'meta-secret-1',
      instagramPublicMediaBaseUrl: 'https://relay.clipcat.example',
    },
  });
  serverBaseUrl = baseUrl;

  try {
    const igClip: Clip = {
      id: 'chatspike-clip-igtest-1',
      projectId: 'chatspike-proj-igtest-1',
      title: 'Vertical Reel Demo',
      description: 'Clean local render ready for Reels.',
      startSec: 0,
      endSec: 2,
      durationSec: 2,
      aiScore: 84,
      scoringBreakdown: { overallScore: 84, summary: '', disclaimer: '', factors: [] },
      aspectRatio: '9:16',
      layoutMode: 'smart_face_tracking',
      resolution: '1080p',
      fileSizeBytes: fs.statSync(clipMp4).size,
      status: 'completed',
      captionStatus: 'applied',
      exportStatus: 'ready',
      captionSettings: {
        enabled: true,
        presetId: 'minimal',
        fontSize: 'medium',
        position: 'bottom',
        highlightKeywords: true,
        wordByWordAnimation: false,
        speakerLabels: false,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveLibraryStore(dirs, {
      projects: [],
      clips: [
        {
          clip: igClip,
          sourceVideoPath: clipMp4,
          mp4Path: clipMp4,
          thumbPath: clipMp4,
          srtPath: clipMp4,
          vttPath: clipMp4,
          metadataPath: clipMp4,
          captionsSrt: '',
          captionsVtt: '',
        },
      ],
    });

    const authHeaders = {
      'Content-Type': 'application/json',
      'X-ClipCat-Token': security.sessionToken,
      Origin: serverBaseUrl,
    };

    const startRes = await fetch(`${serverBaseUrl}/api/publishing/oauth/instagram/start`, {
      method: 'POST',
      headers: authHeaders,
    });
    const { state } = (await startRes.json()) as { state: string };

    const cbRes = await fetch(
      `${serverBaseUrl}/api/publishing/oauth/instagram/callback?code=ig_code&state=${encodeURIComponent(state)}`
    );
    assert.equal(cbRes.status, 200);

    // Reject path traversal on temp-media endpoint
    const travRes = await fetch(`${serverBaseUrl}/api/publishing/temp-media/..%2F..%2Fetc%2Fpasswd`);
    assert.equal(travRes.status, 404);

    // Trigger Instagram publish
    const pubStart = await fetch(`${serverBaseUrl}/api/publishing/start`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        clip: igClip,
        platform: 'instagram',
        sourceInput: { userOwnsContent: true },
        userConfirmedPublish: true,
        idempotencyKey: 'ig-pub-1',
      }),
    });
    assert.equal(pubStart.status, 202);
    const job = (await pubStart.json()) as { id: string };

    let finalStatus = '';
    let publishedUrl: string | null = null;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const jr = await fetch(`${serverBaseUrl}/api/publishing/jobs/${job.id}`, { headers: authHeaders });
      const jj = (await jr.json()) as { status: string; publishedUrl: string | null };
      finalStatus = jj.status;
      publishedUrl = jj.publishedUrl;
      if (finalStatus === 'published' || finalStatus === 'failed') break;
    }

    assert.equal(finalStatus, 'published');
    assert.equal(publishedUrl, 'https://www.instagram.com/reel/TEST777/');
    // Verify temp-media directory is automatically cleaned up after job finishes
    const leftoverTemp = fs.readdirSync(path.join(tempRoot, 'publishing', 'temp-media'));
    assert.equal(leftoverTemp.length, 0);
    assert.equal(fetchedSignedMediaOnce, false);
  } finally {
    server.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
