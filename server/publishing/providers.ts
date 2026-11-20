import fs from 'node:fs';
import { scrubPublishingSecretText } from './publishingStorage.ts';
import type { FetchLike } from './publishingOAuth.ts';
import type { YouTubePrivacy } from '../../src/publishing/types';

const CHUNK_SIZE_BYTES = 1024 * 1024; // 1 MB chunked upload budget for 8GB hosts

export interface ProviderUploadResult {
  platformMediaId: string;
  publishedUrl: string;
  captionTrackUploaded?: boolean;
}

export async function uploadYouTubeVideoResumable(params: {
  filePath: string;
  fileSizeBytes: number;
  accessToken: string;
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: YouTubePrivacy;
  madeForKids: boolean;
  defaultLanguage: string;
  srtContent?: string;
  uploadSeparateCaptions?: boolean;
  fetchFn?: FetchLike;
  signal?: AbortSignal;
  onProgress: (bytesUploaded: number, totalBytes: number) => void;
  onStage: (status: 'uploading' | 'processing_platform', message: string) => void;
}): Promise<ProviderUploadResult> {
  const fetchFn = params.fetchFn ?? fetch;

  // 1. Initiate resumable upload session
  const initRes = await fetchFn(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      signal: params.signal,
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(params.fileSizeBytes),
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify({
        snippet: {
          title: params.title,
          description: params.description,
          tags: params.tags,
          categoryId: params.categoryId || '22',
          defaultLanguage: params.defaultLanguage || 'en',
        },
        status: {
          privacyStatus: params.privacyStatus,
          selfDeclaredMadeForKids: params.madeForKids,
        },
      }),
    }
  );

  if (!initRes.ok) {
    const errBody = scrubPublishingSecretText(await initRes.text());
    throw new Error(`YouTube resumable upload initiation failed (HTTP ${initRes.status}): ${errBody}`);
  }

  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) {
    throw new Error('YouTube did not return a resumable upload session Location header.');
  }

  // 2. Stream local MP4 in chunks without loading the whole video into memory
  params.onStage('uploading', 'Uploading video chunks to YouTube Data API v3…');
  const fd = fs.openSync(params.filePath, 'r');
  let offset = 0;
  let uploadedVideoJson: { id?: string } | null = null;

  try {
    const chunkBuf = Buffer.allocUnsafe(Math.min(CHUNK_SIZE_BYTES, params.fileSizeBytes));
    while (offset < params.fileSizeBytes) {
      if (params.signal?.aborted) {
        throw new Error('Upload cancelled by user.');
      }
      const remaining = params.fileSizeBytes - offset;
      const toRead = Math.min(CHUNK_SIZE_BYTES, remaining);
      const bytesRead = fs.readSync(fd, chunkBuf, 0, toRead, offset);
      if (bytesRead <= 0) break;

      const slice = chunkBuf.subarray(0, bytesRead);
      const endByte = offset + bytesRead - 1;

      const putRes = await fetchFn(uploadUrl, {
        method: 'PUT',
        signal: params.signal,
        headers: {
          'Content-Length': String(bytesRead),
          'Content-Range': `bytes ${offset}-${endByte}/${params.fileSizeBytes}`,
          'Content-Type': 'video/mp4',
        },
        body: new Uint8Array(slice),
      });

      if (putRes.status === 308) {
        offset += bytesRead;
        params.onProgress(offset, params.fileSizeBytes);
        continue;
      }

      if (!putRes.ok) {
        const bodyErr = scrubPublishingSecretText(await putRes.text());
        throw new Error(`YouTube chunk upload failed at byte ${offset} (HTTP ${putRes.status}): ${bodyErr}`);
      }

      offset += bytesRead;
      params.onProgress(offset, params.fileSizeBytes);
      uploadedVideoJson = (await putRes.json()) as { id?: string };
      break;
    }
  } finally {
    fs.closeSync(fd);
  }

  if (!uploadedVideoJson?.id) {
    throw new Error('YouTube upload completed HTTP transfer without returning a video ID.');
  }
  const videoId = uploadedVideoJson.id;

  // 3. Verify uploaded video exists / status via official API before marking complete
  params.onStage('processing_platform', 'Verifying upload status on YouTube…');
  const verifyRes = await fetchFn(
    `https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails&id=${encodeURIComponent(videoId)}`,
    {
      signal: params.signal,
      headers: { Authorization: `Bearer ${params.accessToken}` },
    }
  );
  if (!verifyRes.ok) {
    throw new Error(`Unable to verify published YouTube video status (HTTP ${verifyRes.status}).`);
  }
  const verifyJson = (await verifyRes.json()) as {
    items?: Array<{ id?: string; status?: { uploadStatus?: string; failureReason?: string } }>;
  };
  const item = verifyJson.items?.[0];
  if (!item?.id) {
    throw new Error('YouTube verification did not return the uploaded video record.');
  }
  if (item.status?.uploadStatus === 'rejected' || item.status?.uploadStatus === 'failed') {
    throw new Error(
      `YouTube rejected the uploaded video: ${item.status.failureReason ?? item.status.uploadStatus}`
    );
  }

  // 4. Optional separate SRT caption track upload where requested
  let captionTrackUploaded = false;
  if (params.uploadSeparateCaptions && params.srtContent && params.srtContent.trim().length > 0) {
    const boundary = `clipcat_${Date.now().toString(16)}`;
    const metaPart = JSON.stringify({
      snippet: {
        videoId,
        language: params.defaultLanguage || 'en',
        name: `ClipCat (${params.defaultLanguage || 'en'})`,
        isDraft: false,
      },
    });
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metaPart}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n` +
      `${params.srtContent}\r\n` +
      `--${boundary}--\r\n`;

    const capRes = await fetchFn(
      'https://www.googleapis.com/upload/youtube/v3/captions?uploadType=multipart&part=snippet',
      {
        method: 'POST',
        signal: params.signal,
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );
    captionTrackUploaded = capRes.ok;
  }

  return {
    platformMediaId: videoId,
    publishedUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    captionTrackUploaded,
  };
}

export async function publishInstagramReelOfficial(params: {
  igAccountId: string;
  accessToken: string;
  publicMediaHttpsUrl: string;
  caption: string;
  fetchFn?: FetchLike;
  signal?: AbortSignal;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  onStage: (status: 'uploading' | 'processing_platform', message: string) => void;
}): Promise<ProviderUploadResult> {
  const fetchFn = params.fetchFn ?? fetch;
  if (!params.publicMediaHttpsUrl.startsWith('https://')) {
    throw new Error('Instagram Graph API requires an HTTPS video_url.');
  }

  // 1. Create REELS media container
  params.onStage('uploading', 'Submitting signed short-lived MP4 transfer to Instagram Graph API…');
  const createRes = await fetchFn(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(params.igAccountId)}/media`,
    {
      method: 'POST',
      signal: params.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        media_type: 'REELS',
        video_url: params.publicMediaHttpsUrl,
        caption: params.caption,
        access_token: params.accessToken,
      }),
    }
  );

  if (!createRes.ok) {
    const errText = scrubPublishingSecretText(await createRes.text());
    throw new Error(`Instagram container creation failed (HTTP ${createRes.status}): ${errText}`);
  }

  const createJson = (await createRes.json()) as { id?: string };
  if (!createJson.id) {
    throw new Error('Instagram did not return a media container ID.');
  }
  const containerId = createJson.id;

  // 2. Poll container status until FINISHED
  params.onStage('processing_platform', 'Waiting for Instagram to fetch and process the Reel…');
  const maxAttempts = params.maxPollAttempts ?? 15;
  const pollInterval = params.pollIntervalMs ?? 2000;
  let containerReady = false;

  for (let i = 0; i < maxAttempts; i++) {
    if (params.signal?.aborted) {
      throw new Error('Instagram publishing cancelled.');
    }
    const statusRes = await fetchFn(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(containerId)}?fields=status_code,status&access_token=${encodeURIComponent(params.accessToken)}`,
      { signal: params.signal }
    );
    if (!statusRes.ok) {
      const txt = scrubPublishingSecretText(await statusRes.text());
      throw new Error(`Instagram container status check failed (HTTP ${statusRes.status}): ${txt}`);
    }
    const statusJson = (await statusRes.json()) as { status_code?: string; status?: string };
    if (statusJson.status_code === 'FINISHED') {
      containerReady = true;
      break;
    }
    if (statusJson.status_code === 'ERROR' || statusJson.status_code === 'EXPIRED') {
      throw new Error(`Instagram media container failed: ${statusJson.status ?? statusJson.status_code}`);
    }
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  if (!containerReady) {
    throw new Error('Timed out waiting for Instagram container processing to complete.');
  }

  // 3. Publish container
  const pubRes = await fetchFn(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(params.igAccountId)}/media_publish`,
    {
      method: 'POST',
      signal: params.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: params.accessToken,
      }),
    }
  );
  if (!pubRes.ok) {
    const errText = scrubPublishingSecretText(await pubRes.text());
    throw new Error(`Instagram media_publish failed (HTTP ${pubRes.status}): ${errText}`);
  }
  const pubJson = (await pubRes.json()) as { id?: string };
  if (!pubJson.id) {
    throw new Error('Instagram media_publish completed without returning a media ID.');
  }

  // Query permalink when permitted
  let permalink = `https://www.instagram.com/`;
  try {
    const linkRes = await fetchFn(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(pubJson.id)}?fields=permalink&access_token=${encodeURIComponent(params.accessToken)}`
    );
    if (linkRes.ok) {
      const linkJson = (await linkRes.json()) as { permalink?: string };
      if (linkJson.permalink?.startsWith('https://')) {
        permalink = linkJson.permalink;
      }
    }
  } catch {
    // Fallback cleanly to https://www.instagram.com/
  }

  return {
    platformMediaId: pubJson.id,
    publishedUrl: permalink,
  };
}
