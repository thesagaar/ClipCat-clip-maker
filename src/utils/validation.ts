import {
  MAX_UPLOAD_SIZE_BYTES,
  SUPPORTED_VIDEO_EXTENSIONS,
  SUPPORTED_VIDEO_MIME_TYPES,
} from '../config/env';
import type { ProcessingConfig, UrlValidationResult } from '../types/project';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateVideoFileInput(file: {
  name: string;
  size: number;
  type?: string;
}): FileValidationResult {
  if (!file.name.trim()) {
    return { valid: false, error: 'Selected file has an invalid filename.' };
  }

  const lower = file.name.toLowerCase();
  const hasSupportedExt = SUPPORTED_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
  const mime = file.type?.toLowerCase();
  const hasSupportedMime =
    !mime ||
    SUPPORTED_VIDEO_MIME_TYPES.some((allowed) => allowed === mime) ||
    mime.startsWith('video/');

  if (!hasSupportedExt && !hasSupportedMime) {
    return {
      valid: false,
      error: 'Unsupported format. Please select an MP4, MOV, MKV, or WEBM video file.',
    };
  }

  if (!hasSupportedExt) {
    return {
      valid: false,
      error: 'Unsupported file extension. Supported formats: MP4, MOV, MKV, WEBM.',
    };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'The selected video file appears to be empty (0 bytes).' };
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return {
      valid: false,
      error: 'File exceeds the 8 GB local upload limit.',
    };
  }

  return { valid: true };
}

export function classifyAndValidateVideoUrl(rawUrl: string): UrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      valid: false,
      canAutoDownload: false,
      category: 'invalid',
      hostname: null,
      detectedFilename: null,
      message: 'Enter a video URL to validate.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      canAutoDownload: false,
      category: 'invalid',
      hostname: null,
      detectedFilename: null,
      message: 'Invalid URL format. Include https:// or http://.',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      canAutoDownload: false,
      category: 'invalid',
      hostname: parsed.hostname,
      detectedFilename: null,
      message: 'Only HTTP and HTTPS media URLs are supported.',
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;
  const segments = pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? null;

  // Recognize YouTube URLs explicitly without claiming guaranteed auto-download
  if (
    hostname === 'youtube.com' ||
    hostname === 'www.youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'youtu.be'
  ) {
    return {
      valid: true,
      canAutoDownload: false,
      category: 'youtube',
      hostname,
      detectedFilename: null,
      message: 'YouTube URL recognized. Automatic download may be restricted.',
      restrictionReason:
        'YouTube enforces stream restrictions, age gates, and anti-bot checks that prevent reliable automated retrieval. ClipCat will not bypass authentication or DRM. For reliable local processing, use an authorized local video file via Upload Video.',
    };
  }

  const lowerPath = pathname.toLowerCase();
  if (lowerPath.endsWith('.mp4')) {
    return {
      valid: true,
      canAutoDownload: true,
      category: 'direct_mp4',
      hostname,
      detectedFilename: lastSegment,
      message: 'Direct MP4 media URL detected and ready for backend retrieval.',
    };
  }

  if (
    lowerPath.endsWith('.mov') ||
    lowerPath.endsWith('.webm') ||
    lowerPath.endsWith('.mkv')
  ) {
    return {
      valid: true,
      canAutoDownload: true,
      category: 'authorized_media',
      hostname,
      detectedFilename: lastSegment,
      message: 'Direct downloadable video URL detected.',
    };
  }

  return {
    valid: true,
    canAutoDownload: false,
    category: 'unsupported',
    hostname,
    detectedFilename: lastSegment,
    message: 'URL does not point to a direct MP4/MOV/WEBM/MKV file.',
    restrictionReason:
      'Webpage links or streaming playlists may require authorization or cannot be directly retrieved. Provide a direct downloadable media URL or upload the video file locally.',
  };
}

export interface ConfigValidationErrors {
  projectName?: string;
  desiredClipCount?: string;
  durationRange?: string;
}

export function validateProcessingConfig(config: ProcessingConfig): ConfigValidationErrors {
  const errors: ConfigValidationErrors = {};

  if (!config.projectName.trim()) {
    errors.projectName = 'Project name is required.';
  } else if (config.projectName.trim().length > 120) {
    errors.projectName = 'Project name must be 120 characters or fewer.';
  }

  if (!Number.isInteger(config.desiredClipCount) || config.desiredClipCount < 1 || config.desiredClipCount > 30) {
    errors.desiredClipCount = 'Desired clip count must be between 1 and 30.';
  }

  if (config.minDurationSec < 5) {
    errors.durationRange = 'Minimum clip duration must be at least 5 seconds.';
  } else if (config.preferredDurationSec < config.minDurationSec) {
    errors.durationRange = 'Preferred duration cannot be shorter than minimum duration.';
  } else if (config.maxDurationSec < config.preferredDurationSec) {
    errors.durationRange = 'Maximum duration cannot be shorter than preferred duration.';
  } else if (config.maxDurationSec > 300) {
    errors.durationRange = 'Maximum clip duration cannot exceed 300 seconds.';
  }

  return errors;
}

export function validateClipTrimRange(
  startSec: number,
  endSec: number,
  maxDurationSec?: number | null
): { valid: boolean; error?: string } {
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) {
    return { valid: false, error: 'Start and end timestamps must be valid numbers.' };
  }
  if (startSec < 0) {
    return { valid: false, error: 'Start time cannot be negative.' };
  }
  if (endSec <= startSec) {
    return { valid: false, error: 'End time must be greater than start time.' };
  }
  if (endSec - startSec < 3) {
    return { valid: false, error: 'Clip duration must be at least 3 seconds.' };
  }
  if (maxDurationSec !== null && maxDurationSec !== undefined && endSec > maxDurationSec) {
    return { valid: false, error: 'End time exceeds source video duration.' };
  }
  return { valid: true };
}
