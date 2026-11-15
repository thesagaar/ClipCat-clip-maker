import {
  ALLOWED_PROPERTY_KEYS_BY_EVENT,
  ANALYTICS_EVENT_NAMES,
  DIAGNOSTIC_EVENT_NAMES,
  type AnalyticsEventName,
  type SanitizedAnalyticsEnvelope,
} from './events';

const ALLOWED_EVENT_SET: ReadonlySet<string> = new Set(ANALYTICS_EVENT_NAMES);

export const FORBIDDEN_PROPERTY_KEYS: ReadonlySet<string> = new Set([
  'video',
  'audio',
  'frame',
  'frames',
  'screenshot',
  'screenshots',
  'thumbnail',
  'transcript',
  'transcripts',
  'caption',
  'captions',
  'subtitle',
  'subtitles',
  'note',
  'notes',
  'description',
  'projectname',
  'title',
  'filename',
  'sourcefilename',
  'originalname',
  'filepath',
  'path',
  'directory',
  'projectdirectory',
  'exportdirectory',
  'tempdirectory',
  'url',
  'sourceurl',
  'videourl',
  'downloadurl',
  'previewvideourl',
  'archiveurl',
  'apikey',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'password',
  'secret',
  'credential',
  'credentials',
  'email',
  'phone',
  'ip',
  'ipaddress',
  'clipboard',
  'keystroke',
  'keystrokes',
  'body',
  'requestbody',
  'responsebody',
  'storage',
  'localstorage',
  'payload',
  'cookie',
  'cookies',
  'user',
  'username',
]);

export function isValidAnalyticsEventName(name: string): name is AnalyticsEventName {
  return ALLOWED_EVENT_SET.has(name);
}

/**
 * Strips query parameters, fragments, and dynamic project/clip identifiers
 * so routes never transmit user IDs or signed URL tokens.
 */
export function sanitizeRouteIdentifier(rawRoute: string): string {
  const withoutHash = rawRoute.split('#')[0] ?? '/';
  const pathname = (withoutHash.split('?')[0] ?? '/').trim() || '/';
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (normalized === '/' || normalized === '/privacy' || normalized === '/terms') {
    return normalized;
  }
  if (/^\/projects\/[^/]+\/processing\/?$/.test(normalized)) {
    return '/projects/:id/processing';
  }
  if (/^\/projects\/[^/]+\/clips\/?$/.test(normalized)) {
    return '/projects/:id/clips';
  }
  if (/^\/clips\/[^/]+\/edit\/?$/.test(normalized)) {
    return '/clips/:id/edit';
  }
  const knownStatic = [
    '/projects/new',
    '/projects',
    '/clips',
    '/exports',
    '/presets',
    '/templates',
    '/settings',
    '/system',
    '/404',
  ];
  for (const route of knownStatic) {
    if (normalized === route) return route;
  }
  return '/unknown';
}

/**
 * Scrubs paths, full URLs, tokens, emails, and potential filenames from any error message or stack trace.
 */
export function scrubSensitiveText(rawText: string, maxLength = 260): string {
  if (!rawText) return '';
  let scrubbed = rawText
    // Redact Bearer / JWT / common token shapes
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]+)?/g, '[REDACTED_JWT]')
    .replace(/\b(?:sk|pk|AIza|ghp|gho|xoxb|xoxp)[-_A-Za-z0-9]{10,}\b/g, '[REDACTED_KEY]')
    // Redact URLs (may include credentials or sensitive query tokens)
    .replace(/https?:\/\/[^\s"'<>)]+/gi, '[REDACTED_URL]')
    // Redact Windows drive paths (e.g. C:\Users\alice\video.mp4)
    .replace(/[A-Za-z]:\\(?:[^\s"'<>|*?\r\n]+\\)*[^\s"'<>|*?\r\n]*/g, '[REDACTED_PATH]')
    // Redact Unix user/system paths while keeping bundler module frame names readable when possible
    .replace(/\/(?:Users|home|tmp|var|mnt|Volumes|root|etc|srv)\/[^\s):"'<>]+/gi, '[REDACTED_PATH]')
    // Redact email addresses
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]')
    // Redact private/local IPv4 addresses & ports
    .replace(/\b(?:127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+)(?::\d+)?\b/g, '[REDACTED_HOST]');

  // Collapse whitespace
  scrubbed = scrubbed.replace(/\s+/g, ' ').trim();
  if (scrubbed.length > maxLength) {
    return `${scrubbed.slice(0, maxLength - 3)}...`;
  }
  return scrubbed;
}

export function sanitizeStackSummary(stack: string | undefined, maxLines = 4): string {
  if (!stack) return '';
  const lines = stack
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .map((line) => scrubSensitiveText(line, 140));
  return lines.join(' | ').slice(0, 480);
}

export function bucketFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'unknown';
  const mb = bytes / (1024 * 1024);
  if (mb < 25) return '<25MB';
  if (mb < 100) return '25MB-100MB';
  if (mb < 500) return '100MB-500MB';
  if (mb < 2048) return '500MB-2GB';
  return '>2GB';
}

export function extractSafeExtension(filename: string): string {
  const match = /\.(mp4|mov|mkv|webm)$/i.exec(filename.trim());
  return match ? match[1].toLowerCase() : 'other';
}

export function sanitizeEventPayload(
  eventName: string,
  rawProperties: Record<string, unknown> = {},
  context: {
    appVersion: string;
    route?: string;
    runtime?: 'web' | 'desktop';
    viewportWidth?: number;
  }
): SanitizedAnalyticsEnvelope | null {
  if (!isValidAnalyticsEventName(eventName)) {
    return null;
  }

  const allowedKeys = new Set(ALLOWED_PROPERTY_KEYS_BY_EVENT[eventName]);
  const properties: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(rawProperties)) {
    const lowerKey = key.toLowerCase();
    if (FORBIDDEN_PROPERTY_KEYS.has(lowerKey)) continue;
    if (!allowedKeys.has(key)) continue;

    if (typeof value === 'string') {
      const cleaned = scrubSensitiveText(value, key === 'stackSummary' ? 480 : 180);
      if (cleaned) properties[key] = cleaned;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      properties[key] = Math.round(value * 100) / 100;
    } else if (typeof value === 'boolean') {
      properties[key] = value;
    }
  }

  const width = context.viewportWidth ?? 1280;
  const viewportBucket: SanitizedAnalyticsEnvelope['viewportBucket'] =
    width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';

  const idSuffix = Math.random().toString(36).slice(2, 8);

  return {
    eventId: `evt_${Date.now().toString(36)}_${idSuffix}`,
    event: eventName,
    category: DIAGNOSTIC_EVENT_NAMES.has(eventName) ? 'diagnostic' : 'usage',
    timestamp: new Date().toISOString(),
    appVersion: scrubSensitiveText(context.appVersion || '0.1.0', 32),
    route: sanitizeRouteIdentifier(context.route ?? '/'),
    runtime: context.runtime ?? 'web',
    viewportBucket,
    properties,
  };
}
