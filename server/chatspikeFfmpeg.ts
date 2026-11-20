import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ChatSpikeVideoInfo } from '../src/intelligence/types';
import type { AspectRatio, OutputResolution } from '../src/types/project';
import { isPathInsideRoot } from './chatspikeSecurity.ts';

const execFileAsync = promisify(execFile);

const FFPROBE_TIMEOUT_MS = 15_000;
const FFMPEG_CLIP_TIMEOUT_MS = 180_000;
const ALLOWED_CODECS = new Set([
  'h264',
  'hevc',
  'h265',
  'vp8',
  'vp9',
  'av1',
  'mpeg4',
]);

export interface MediaBinariesStatus {
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  ffmpegPath: string | null;
  ffprobePath: string | null;
}

let cachedBinaries: MediaBinariesStatus | null = null;

export async function detectMediaBinaries(): Promise<MediaBinariesStatus> {
  if (cachedBinaries) return cachedBinaries;

  const findBin = async (name: string): Promise<string | null> => {
    for (const candidate of [`/usr/bin/${name}`, name]) {
      try {
        await execFileAsync(candidate, ['-version'], {
          shell: false,
          timeout: 4000,
        });
        return candidate;
      } catch {
        continue;
      }
    }
    return null;
  };

  const [ffmpegPath, ffprobePath] = await Promise.all([
    findBin('ffmpeg'),
    findBin('ffprobe'),
  ]);

  cachedBinaries = {
    ffmpegAvailable: Boolean(ffmpegPath),
    ffprobeAvailable: Boolean(ffprobePath),
    ffmpegPath,
    ffprobePath,
  };
  return cachedBinaries;
}

function parseFrameRate(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw.includes('/')) return null;
  const [nStr, dStr] = raw.split('/');
  const n = Number(nStr);
  const d = Number(dStr);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return Number((n / d).toFixed(2));
}

export async function probeVideoFile(
  filePath: string,
  rootDir: string,
  originalFilename: string,
  fileSizeBytes: number
): Promise<ChatSpikeVideoInfo> {
  if (!isPathInsideRoot(filePath, rootDir)) {
    throw new Error('Blocked media probe outside ClipCat storage root.');
  }

  const bins = await detectMediaBinaries();
  if (!bins.ffprobePath) {
    throw new Error('ffprobe binary is not available on this host.');
  }

  let stdout: string;
  try {
    const res = await execFileAsync(
      bins.ffprobePath,
      [
        '-v',
        'error',
        '-protocol_whitelist',
        'file,pipe',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        '--',
        filePath,
      ],
      {
        shell: false,
        timeout: FFPROBE_TIMEOUT_MS,
        maxBuffer: 2 * 1024 * 1024,
      }
    );
    stdout = res.stdout;
  } catch {
    throw new Error(
      'Uploaded file could not be verified as a valid MP4, MOV, MKV, or WEBM video container.'
    );
  }

  let parsed: {
    format?: { format_name?: string; duration?: string };
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
      duration?: string;
    }>;
  };

  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error('Unable to parse media inspection metadata.');
  }

  const formatName = (parsed.format?.format_name ?? '').toLowerCase();
  const validFormat =
    formatName.includes('mp4') ||
    formatName.includes('mov') ||
    formatName.includes('matroska') ||
    formatName.includes('webm');

  const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');
  const audioStream = parsed.streams?.find((s) => s.codec_type === 'audio');

  if (!validFormat || !videoStream) {
    throw new Error(
      'File does not contain a valid MP4, MOV, MKV, or WEBM video stream.'
    );
  }

  const codec = (videoStream.codec_name ?? '').toLowerCase();
  if (codec && !ALLOWED_CODECS.has(codec)) {
    throw new Error(`Unsupported video codec "${codec}". Expected H.264, HEVC, VP8/VP9, or AV1.`);
  }

  const durationSec = Number(videoStream.duration ?? parsed.format?.duration ?? 0);
  const width = Number(videoStream.width ?? 0);
  const height = Number(videoStream.height ?? 0);

  if (!Number.isFinite(durationSec) || durationSec <= 0 || width <= 0 || height <= 0) {
    throw new Error('Video stream reports invalid duration or frame dimensions.');
  }

  return {
    originalFilename,
    fileSizeBytes,
    durationSec: Number(durationSec.toFixed(2)),
    width,
    height,
    fps: parseFrameRate(videoStream.r_frame_rate),
    codec: codec || null,
    hasAudio: Boolean(audioStream),
  };
}

export function getTargetDimensions(
  aspectRatio: AspectRatio,
  resolution: OutputResolution
): { width: number; height: number } {
  const shortSide = resolution === '1080p' ? 1080 : 720;
  if (aspectRatio === '9:16') {
    return resolution === '1080p' ? { width: 1080, height: 1920 } : { width: 720, height: 1280 };
  }
  if (aspectRatio === '1:1') {
    return { width: shortSide, height: shortSide };
  }
  return resolution === '1080p' ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
}

function runFfmpegCommand(
  ffmpegPath: string,
  args: string[],
  signal?: AbortSignal,
  timeoutMs = FFMPEG_CLIP_TIMEOUT_MS
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Processing cancelled.'));
      return;
    }

    const child = spawn(ffmpegPath, args, {
      shell: false,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderrTail = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString('utf8')).slice(-2000);
    });

    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (err) reject(err);
      else resolve();
    };

    const killChild = () => {
      try {
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!settled) {
            try {
              child.kill('SIGKILL');
            } catch {
              // Ignore already-exited
            }
          }
        }, 1200).unref();
      } catch {
        // Ignore already-exited
      }
    };

    const onAbort = () => {
      killChild();
      finish(new Error('Processing cancelled by user.'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });

    const timer = setTimeout(() => {
      killChild();
      finish(new Error('FFmpeg processing timed out.'));
    }, timeoutMs);

    child.on('error', (err) => {
      finish(new Error(`FFmpeg failed to start: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        finish();
      } else {
        const cleanTail = stderrTail.replace(/[\r\n]+/g, ' ').slice(-240);
        finish(new Error(`FFmpeg exited with status ${code}: ${cleanTail || 'encode failed'}`));
      }
    });
  });
}

export async function renderClipSegment(params: {
  sourceVideoPath: string;
  outputVideoPath: string;
  outputThumbPath: string;
  tempDir: string;
  rootDir: string;
  startSec: number;
  endSec: number;
  videoDurationSec: number;
  aspectRatio: AspectRatio;
  resolution: OutputResolution;
  hasAudio: boolean;
  signal?: AbortSignal;
}): Promise<{ fileSizeBytes: number; startSec: number; endSec: number; durationSec: number }> {
  const {
    sourceVideoPath,
    outputVideoPath,
    outputThumbPath,
    tempDir,
    rootDir,
    videoDurationSec,
    aspectRatio,
    resolution,
    hasAudio,
    signal,
  } = params;

  if (
    !isPathInsideRoot(sourceVideoPath, rootDir) ||
    !isPathInsideRoot(outputVideoPath, rootDir) ||
    !isPathInsideRoot(outputThumbPath, rootDir) ||
    !isPathInsideRoot(tempDir, rootDir)
  ) {
    throw new Error('Blocked FFmpeg execution outside canonical ClipCat storage root.');
  }

  const bins = await detectMediaBinaries();
  if (!bins.ffmpegPath) {
    throw new Error('ffmpeg binary is not available on this host.');
  }

  const safeStart = Math.max(0, Math.min(videoDurationSec - 0.25, params.startSec));
  const safeEnd = Math.max(safeStart + 0.25, Math.min(videoDurationSec, params.endSec));
  const duration = Number((safeEnd - safeStart).toFixed(3));

  fs.mkdirSync(path.dirname(outputVideoPath), { recursive: true });
  fs.mkdirSync(path.dirname(outputThumbPath), { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const tmpMp4 = path.join(tempDir, `${path.basename(outputVideoPath)}.part.mp4`);
  const tmpThumb = path.join(tempDir, `${path.basename(outputThumbPath)}.part.jpg`);

  const dims = getTargetDimensions(aspectRatio, resolution);
  const vfFilter = `scale=${dims.width}:${dims.height}:force_original_aspect_ratio=increase,crop=${dims.width}:${dims.height},setsar=1,format=yuv420p`;

  const videoArgs = [
    '-y',
    '-nostdin',
    '-protocol_whitelist',
    'file,pipe',
    '-ss',
    safeStart.toFixed(3),
    '-t',
    duration.toFixed(3),
    '-i',
    sourceVideoPath,
    '-map',
    '0:v:0',
    ...(hasAudio ? ['-map', '0:a:0?', '-c:a', 'aac', '-b:a', '128k'] : ['-an']),
    '-vf',
    vfFilter,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-movflags',
    '+faststart',
    '--',
    tmpMp4,
  ];

  try {
    await runFfmpegCommand(bins.ffmpegPath, videoArgs, signal);

    if (!fs.existsSync(tmpMp4) || fs.statSync(tmpMp4).size <= 0) {
      throw new Error('FFmpeg produced an empty MP4 output file.');
    }

    // Generate midpoint thumbnail
    const thumbOffset = Math.max(0, Number((safeStart + duration * 0.4).toFixed(3)));
    const thumbArgs = [
      '-y',
      '-nostdin',
      '-protocol_whitelist',
      'file,pipe',
      '-ss',
      thumbOffset.toFixed(3),
      '-i',
      sourceVideoPath,
      '-frames:v',
      '1',
      '-vf',
      `scale=${dims.width}:${dims.height}:force_original_aspect_ratio=increase,crop=${dims.width}:${dims.height}`,
      '-q:v',
      '4',
      '--',
      tmpThumb,
    ];
    try {
      await runFfmpegCommand(bins.ffmpegPath, thumbArgs, signal, 20_000);
      if (fs.existsSync(tmpThumb) && fs.statSync(tmpThumb).size > 0) {
        fs.renameSync(tmpThumb, outputThumbPath);
      }
    } catch {
      // Thumbnail failure must not abort valid MP4 render if video succeeded
    }

    fs.renameSync(tmpMp4, outputVideoPath);
    const finalSize = fs.statSync(outputVideoPath).size;

    return {
      fileSizeBytes: finalSize,
      startSec: Number(safeStart.toFixed(2)),
      endSec: Number(safeEnd.toFixed(2)),
      durationSec: Number(duration.toFixed(2)),
    };
  } catch (err) {
    fs.rmSync(tmpMp4, { force: true });
    fs.rmSync(tmpThumb, { force: true });
    throw err;
  }
}
