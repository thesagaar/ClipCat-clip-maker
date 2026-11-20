import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createServerApp } from './app';
import {
  isAllowedLocalOrigin,
  isPathInsideRoot,
  sanitizeDownloadFilename,
  signMediaUrl,
  verifySignedMediaParams,
} from './chatspikeSecurity';

const execFileAsync = promisify(execFile);

async function startEphemeralTestServer(dataDir: string) {
  const { app, security, dirs } = createServerApp({
    dataDir,
    maxVideoUploadBytes: 5 * 1024 * 1024,
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return { server, baseUrl, security, dirs };
}

test('security helpers enforce canonical path containment, origin allowlist, and signed URL verification', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clipcat-sec-unit-'));
  try {
    const safeInside = path.join(tmpRoot, 'exports', 'clip1.mp4');
    fs.mkdirSync(path.dirname(safeInside), { recursive: true });
    assert.equal(isPathInsideRoot(safeInside, tmpRoot), true);
    assert.equal(isPathInsideRoot(path.join(tmpRoot, '..', 'etc', 'passwd'), tmpRoot), false);
    assert.equal(isPathInsideRoot(`${safeInside}\0.png`, tmpRoot), false);
    assert.equal(isPathInsideRoot(tmpRoot, tmpRoot), false);

    assert.equal(isAllowedLocalOrigin('http://localhost:3000', 'localhost:3000'), true);
    assert.equal(isAllowedLocalOrigin('http://127.0.0.1:3000', '127.0.0.1:3000'), true);
    assert.equal(isAllowedLocalOrigin('https://evil.example', 'localhost:3000'), false);
    assert.equal(isAllowedLocalOrigin('null', 'localhost:3000'), false);

    assert.equal(
      sanitizeDownloadFilename('evil\r\n"../../clip', 'mp4'),
      'evil___.._.._clip.mp4'
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('HTTP security controls block unauthenticated calls, evil origins, tampered signatures, spoofed MP4s, and large-v3', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipcat-sec-http-'));
  const { server, baseUrl, security } = await startEphemeralTestServer(tmpDir);

  try {
    // 1. Unauthenticated access must fail 401
    const unauth = await fetch(`${baseUrl}/api/chatspike/capabilities`);
    assert.equal(unauth.status, 401);

    // 2. Evil origin rejected 403 without wildcard CORS
    const evilOrigin = await fetch(`${baseUrl}/api/chatspike/session`, {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(evilOrigin.status, 403);
    assert.equal(evilOrigin.headers.get('access-control-allow-origin'), null);

    // 3. Valid local origin receives session token
    const sessionRes = await fetch(`${baseUrl}/api/chatspike/session`, {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000' },
    });
    assert.equal(sessionRes.status, 200);
    const { token } = (await sessionRes.json()) as { token: string };
    assert.ok(token.length >= 20);

    // 4. Signed URL tamper & expiry rejection
    const signedPath = signMediaUrl(security, 'csjob_test1', 'clip_1', 'mp4');
    const tampered = signedPath.replace(/sig=[a-f0-9]{4}/, 'sig=0000');
    const tamperRes = await fetch(`${baseUrl}${tampered}`);
    assert.equal(tamperRes.status, 403);
    assert.equal(
      verifySignedMediaParams(security, 'csjob_test1', 'clip_1', 'mp4', '1000', 'a'.repeat(64)),
      false
    );

    // 5. Whisper large-v3 disabled server-side
    const largeRes = await fetch(`${baseUrl}/api/chatspike/jobs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectName: 'Large V3 Check',
        config: { whisperModel: 'large-v3' },
      }),
    });
    assert.equal(largeRes.status, 400);

    // 6. Create valid draft job
    const jobRes = await fetch(`${baseUrl}/api/chatspike/jobs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ projectName: 'Security Test Job' }),
    });
    assert.equal(jobRes.status, 201);
    const job = (await jobRes.json()) as { id: string };

    // 7. Spoofed non-video file renamed .mp4 rejected 415 and removed from disk
    const spoofRes = await fetch(`${baseUrl}/api/chatspike/jobs/${job.id}/video`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'X-ClipCat-Filename': '../../malicious_html_spoof.mp4',
      },
      body: '<html><script>alert(1)</script></html>',
    });
    assert.equal(spoofRes.status, 415);
    const uploadsLeft = fs.readdirSync(path.join(tmpDir, 'uploads'));
    assert.equal(uploadsLeft.length, 0, 'Spoofed upload must be deleted immediately');

    // 8. Traversal ID rejected
    const travRes = await fetch(`${baseUrl}/api/chatspike/jobs/..%2Fetc`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(travRes.status, 400);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('full local FFmpeg pipeline extracts verified MP4, serves HTTP 206 video range, and syncs to library cleanly', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipcat-sec-e2e-'));
  const sampleVideoPath = path.join(tmpDir, 'synthetic_source.mp4');

  // Generate real tiny synthetic 4s H.264 MP4 using host /usr/bin/ffmpeg
  await execFileAsync(
    '/usr/bin/ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=4:size=320x240:rate=15',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=4',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      sampleVideoPath,
    ],
    { shell: false, timeout: 15_000 }
  );

  const { server, baseUrl } = await startEphemeralTestServer(path.join(tmpDir, 'data'));

  try {
    const sess = await fetch(`${baseUrl}/api/chatspike/session`, {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000' },
    });
    const { token } = (await sess.json()) as { token: string };

    const createRes = await fetch(`${baseUrl}/api/chatspike/jobs`, {
      method: 'POST',
      headers: {
        'X-ClipCat-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectName: 'Synthetic Highlight Test',
        config: {
          sensitivity: 'medium',
          preRollSec: 1,
          postRollSec: 1,
          aspectRatio: '9:16',
          resolution: '720p',
        },
      }),
    });
    assert.equal(createRes.status, 201);
    const createdJob = (await createRes.json()) as { id: string };

    // Upload real synthetic MP4
    const mp4Bytes = fs.readFileSync(sampleVideoPath);
    const upRes = await fetch(`${baseUrl}/api/chatspike/jobs/${createdJob.id}/video`, {
      method: 'POST',
      headers: {
        'X-ClipCat-Token': token,
        'Content-Type': 'application/octet-stream',
        'X-ClipCat-Filename': 'synthetic_source.mp4',
      },
      body: mp4Bytes,
    });
    assert.equal(upRes.status, 200);
    const afterVideo = (await upRes.json()) as { video: { durationSec: number } };
    assert.ok(afterVideo.video.durationSec >= 3.5);

    // Upload chat log with a crowd reaction spike at t=2s
    const chatEvents = [
      { timestamp: 0, username: 'viewer1', message: 'hi' },
      { timestamp: 2.0, username: 'alice', message: 'LMAO!!' },
      { timestamp: 2.1, username: 'bob', message: 'NO WAY!!' },
      { timestamp: 2.2, username: 'carol', message: 'CLIP IT 🔥' },
      { timestamp: 2.3, username: 'dave', message: 'WTF?!' },
    ];
    const chatRes = await fetch(`${baseUrl}/api/chatspike/jobs/${createdJob.id}/chat`, {
      method: 'POST',
      headers: {
        'X-ClipCat-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: 'chat.json',
        content: JSON.stringify(chatEvents),
      }),
    });
    assert.equal(chatRes.status, 200);

    // Start real processing
    const procRes = await fetch(`${baseUrl}/api/chatspike/jobs/${createdJob.id}/process`, {
      method: 'POST',
      headers: {
        'X-ClipCat-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert.equal(procRes.status, 202);

    // Poll until completed
    interface PollJobResult {
      status: string;
      candidates: Array<{
        id: string;
        renderStatus: string;
        previewUrl: string | null;
        srtUrl: string | null;
        fileSizeBytes: number | null;
      }>;
    }
    let finalJob: PollJobResult | null = null;

    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const poll = await fetch(`${baseUrl}/api/chatspike/jobs/${createdJob.id}`, {
        headers: { 'X-ClipCat-Token': token },
      });
      const candidateData = (await poll.json()) as PollJobResult;
      finalJob = candidateData;
      if (candidateData.status === 'completed' || candidateData.status === 'failed') {
        break;
      }
    }

    assert.ok(finalJob);
    assert.equal(finalJob.status, 'completed');
    assert.equal(finalJob.candidates.length, 1);
    const cand = finalJob.candidates[0];
    assert.equal(cand.renderStatus, 'ready');
    assert.ok(cand.fileSizeBytes && cand.fileSizeBytes > 500);
    assert.ok(cand.previewUrl);
    assert.ok(cand.srtUrl);

    // Verify HTTP 206 byte range media streaming
    const rangeRes = await fetch(`${baseUrl}${cand.previewUrl}`, {
      headers: { Range: 'bytes=0-127' },
    });
    assert.equal(rangeRes.status, 206);
    assert.equal(rangeRes.headers.get('accept-ranges'), 'bytes');
    assert.equal(rangeRes.headers.get('x-content-type-options'), 'nosniff');

    // Verify SRT download attachment headers
    const srtRes = await fetch(`${baseUrl}${cand.srtUrl}`);
    assert.equal(srtRes.status, 200);
    assert.ok(srtRes.headers.get('content-disposition')?.includes('attachment;'));

    // Save to ClipCat Library
    const saveRes = await fetch(
      `${baseUrl}/api/chatspike/jobs/${createdJob.id}/save-to-library`,
      {
        method: 'POST',
        headers: {
          'X-ClipCat-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );
    assert.equal(saveRes.status, 200);

    const libRes = await fetch(`${baseUrl}/api/chatspike/library`, {
      headers: { 'X-ClipCat-Token': token },
    });
    assert.equal(libRes.status, 200);
    const lib = (await libRes.json()) as {
      projects: Array<{ id: string }>;
      clips: Array<{ id: string }>;
    };
    assert.equal(lib.projects.length, 1);
    assert.equal(lib.clips.length, 1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
