import {
  MAX_UPLOAD_SIZE_BYTES,
  SUPPORTED_VIDEO_EXTENSIONS,
  SUPPORTED_VIDEO_MIME_TYPES,
  isLoopbackHostname,
} from '../config/env';
import type { ProcessingConfig, UrlValidationResult } from '../types/project';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

const DISALLOWED_CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/;

export function sanitizeDownloadFilename(rawName: string, extension: string): string {
  const normalizedExt = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  const cleanedBase = rawName
    .replace(DISALLOWED_CONTROL_CHARS_RE, '')
    .replace(/[/\\]+/g, '_')
    .replace(/\.\.+/g, '_')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 100);

  const safeBase = cleanedBase || 'clipcat_export';
  if (safeBase.toLowerCase().endsWith(normalizedExt)) {
    return safeBase;
  }
  return `${safeBase}${normalizedExt}`;
}

export function isPrivateOrInternalHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!lower) return true;
  if (isLoopbackHostname(lower) || lower === '0.0.0.0') return true;
  if (lower.endsWith('.local') || lower.endsWith('.internal') || lower.endsWith('.localhost')) {
    return true;
  }

  // IPv6 unique local / link-local ranges
  if (lower.includes(':')) {
    if (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fe80:') ||
      lower.startsWith('fc') ||
      lower.startsWith('fd')
    ) {
      return true;
    }
    return false;
  }

  // IPv4 private / link-local / CGNAT ranges
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  return false;
}

export function validateVideoFileInput(file: {
  name: string;
  size: number;
  type?: string;
}): FileValidationResult {
  const trimmedName = file.name.trim();
  if (!trimmedName || DISALLOWED_CONTROL_CHARS_RE.test(trimmedName) || trimmedName.length > 255) {
    return { valid: false, error: 'Selected file has an invalid filename.' };
  }

  const lower = trimmedName.toLowerCase();
  const hasSupportedExt = SUPPORTED_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
  const mime = (file.type ?? '').trim().toLowerCase();

  // Strictly reject mismatched non-video MIME types (for example HTML/JS disguised with .mp4)
  const hasAcceptableMime =
    mime === '' ||
    mime === 'application/octet-stream' ||
    SUPPORTED_VIDEO_MIME_TYPES.some((allowed) => allowed === mime) ||
    mime.startsWith('video/');

  if (mime && !hasAcceptableMime) {
    return {
      valid: false,
      error: `MIME type "${mime}" is not a supported video media type.`,
    };
  }

  if (!hasSupportedExt) {
    return {
      valid: false,
      error: 'Unsupported format. Please select an MP4, MOV, MKV, or WEBM video file.',
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

  if (trimmed.length > 2048 || DISALLOWED_CONTROL_CHARS_RE.test(trimmed)) {
    return {
      valid: false,
      canAutoDownload: false,
      category: 'invalid',
      hostname: null,
      detectedFilename: null,
      message: 'URL exceeds the 2,048-character limit or contains unsupported characters.',
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

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      canAutoDownload: false,
      category: 'invalid',
      hostname: parsed.hostname,
      detectedFilename: null,
      message: 'URLs containing embedded usernames or passwords are not permitted.',
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (isPrivateOrInternalHost(hostname)) {
    return {
      valid: false,
      canAutoDownload: false,
      category: 'invalid',
      hostname,
      detectedFilename: null,
      message: 'Private, loopback, and internal network hosts cannot be fetched via Video URL.',
    };
  }

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

export function validateProjectNameValue(rawName: string): string | undefined {
  const trimmed = rawName.trim();
  if (!trimmed) {
    return 'Project name is required.';
  }
  if (DISALLOWED_CONTROL_CHARS_RE.test(trimmed)) {
    return 'Project name contains unsupported control characters.';
  }
  if (trimmed.length > 120) {
    return 'Project name must be 120 characters or fewer.';
  }
  return undefined;
}

export function validateProcessingConfig(config: ProcessingConfig): ConfigValidationErrors {
  const errors: ConfigValidationErrors = {};

  const nameError = validateProjectNameValue(config.projectName);
  if (nameError) {
    errors.projectName = nameError;
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
