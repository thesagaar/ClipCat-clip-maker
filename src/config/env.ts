const metaEnv = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
const API_BASE_STORAGE_KEY = 'clipcat-api-base-url';

export type AnalyticsProviderType = 'none' | 'custom_endpoint';

function readEnvString(key: string): string {
  const val = metaEnv[key];
  return typeof val === 'string' ? val.trim() : '';
}

function readEnvBoolean(key: string): boolean {
  const val = metaEnv[key];
  return val === true || val === 'true';
}

function normalizeBaseUrl(raw: string | undefined | null): string {
  return (raw ?? '').trim().replace(/\/+$/, '');
}

export function isLoopbackHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === '127.0.0.1' || lower === 'localhost' || lower === '::1' || lower === '[::1]';
}

export interface ApiUrlValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}

export function validateApiBaseUrl(
  raw: string | undefined | null,
  currentPageProtocol?: string
): ApiUrlValidationResult {
  const trimmed = normalizeBaseUrl(raw);
  if (!trimmed) {
    return { valid: false, normalized: '', error: 'Backend URL cannot be empty.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      normalized: '',
      error: 'Enter a valid http:// or https:// backend URL (for example http://127.0.0.1:8000).',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      normalized: '',
      error: 'Only http:// and https:// backend protocols are allowed.',
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      normalized: '',
      error: 'Embedded credentials are not permitted in backend URLs.',
    };
  }

  if (parsed.search || parsed.hash) {
    return {
      valid: false,
      normalized: '',
      error: 'Backend base URL must not include query parameters or fragments.',
    };
  }

  const pageProto =
    currentPageProtocol ??
    (typeof window !== 'undefined' ? window.location.protocol : undefined);

  if (pageProto === 'https:' && parsed.protocol === 'http:' && !isLoopbackHostname(parsed.hostname)) {
    return {
      valid: false,
      normalized: '',
      error:
        'Insecure http:// remote backend URLs are blocked on HTTPS origins to prevent mixed content. Use https:// or a local loopback host.',
    };
  }

  const normalized = `${parsed.origin}${parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '')}`;
  return { valid: true, normalized };
}

function normalizePublicSiteUrl(raw: string): string | null {
  const trimmed = normalizeBaseUrl(raw);
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function normalizeAnalyticsEndpoint(raw: string): string | null {
  const trimmed = normalizeBaseUrl(raw);
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password || parsed.hash) return null;
    if (parsed.protocol === 'https:') return trimmed;
    if (parsed.protocol === 'http:' && isLoopbackHostname(parsed.hostname)) return trimmed;
    return null;
  } catch {
    return null;
  }
}

function normalizeSupportEmail(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Never turn an http(s) URL into a mailto: link
  if (/^https?:\/\//i.test(trimmed)) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

function resolveAnalyticsProvider(raw: string, endpoint: string | null, enabled: boolean): AnalyticsProviderType {
  if (!enabled || !endpoint) return 'none';
  return raw === 'custom_endpoint' ? 'custom_endpoint' : 'none';
}

const configuredAnalyticsEnabled = readEnvBoolean('VITE_ANALYTICS_ENABLED');
const configuredAnalyticsEndpoint = normalizeAnalyticsEndpoint(readEnvString('VITE_ANALYTICS_ENDPOINT'));
const configuredAnalyticsProvider = resolveAnalyticsProvider(
  readEnvString('VITE_ANALYTICS_PROVIDER'),
  configuredAnalyticsEndpoint,
  configuredAnalyticsEnabled
);

const validatedEnvApi = validateApiBaseUrl(readEnvString('VITE_API_BASE_URL'));

export const ENV = {
  IS_DEV: Boolean(metaEnv.DEV),
  IS_PROD: Boolean(metaEnv.PROD),
  API_BASE_URL: validatedEnvApi.valid ? validatedEnvApi.normalized : 'http://127.0.0.1:8000',
  USE_MOCK_API: readEnvBoolean('VITE_USE_MOCK_API'),
  APP_VERSION: readEnvString('VITE_APP_VERSION') || '0.1.0',
  PUBLIC_SITE_URL: normalizePublicSiteUrl(readEnvString('VITE_PUBLIC_SITE_URL')),
  ANALYTICS_ENABLED: configuredAnalyticsEnabled && configuredAnalyticsProvider !== 'none' && Boolean(configuredAnalyticsEndpoint),
  ANALYTICS_PROVIDER: configuredAnalyticsProvider,
  ANALYTICS_ENDPOINT: configuredAnalyticsEndpoint,
  ERROR_REPORTING_ENABLED:
    readEnvBoolean('VITE_ERROR_REPORTING_ENABLED') &&
    configuredAnalyticsProvider !== 'none' &&
    Boolean(configuredAnalyticsEndpoint),
  SDP_WEBSITE_URL:
    normalizeBaseUrl(readEnvString('VITE_SDP_WEBSITE_URL')) ||
    'https://single-dimension-projects.vercel.app',
  SDP_SUPPORT_URL:
    normalizeBaseUrl(readEnvString('VITE_SDP_SUPPORT_URL')) ||
    'https://single-dimension-projects.vercel.app/contact',
  SDP_SUPPORT_EMAIL: normalizeSupportEmail(readEnvString('VITE_SDP_SUPPORT_EMAIL')),
  REQUEST_TIMEOUT_MS: 15000,
  UPLOAD_TIMEOUT_MS: 300000,
} as const;

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const rawOverride = window.localStorage.getItem(API_BASE_STORAGE_KEY);
      if (rawOverride) {
        const checked = validateApiBaseUrl(rawOverride, window.location.protocol);
        if (checked.valid) {
          return checked.normalized;
        }
      }
    } catch {
      // Ignore storage access errors in restricted webviews
    }
  }
  return ENV.API_BASE_URL;
}

export function setRuntimeApiBaseUrl(url: string | null): ApiUrlValidationResult {
  if (!url || !url.trim()) {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(API_BASE_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }
    return { valid: true, normalized: ENV.API_BASE_URL };
  }

  const checked = validateApiBaseUrl(url);
  if (!checked.valid) {
    return checked;
  }

  if (typeof window !== 'undefined') {
    try {
      if (checked.normalized === ENV.API_BASE_URL) {
        window.localStorage.removeItem(API_BASE_STORAGE_KEY);
      } else {
        window.localStorage.setItem(API_BASE_STORAGE_KEY, checked.normalized);
      }
    } catch {
      // Ignore storage errors
    }
  }
  return checked;
}

export const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.webm'] as const;
export const SUPPORTED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'video/webm',
] as const;

export const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB practical local limit

export const DEFAULT_PROCESSING_CONFIG = {
  desiredClipCount: 5,
  minDurationSec: 15,
  preferredDurationSec: 45,
  maxDurationSec: 90,
  aspectRatio: '9:16' as const,
  layoutMode: 'smart_face_tracking' as const,
  captionsEnabled: true,
  captionPresetId: 'minimal-white',
  captionFontSize: 'medium' as const,
  captionPosition: 'bottom' as const,
  highlightKeywords: true,
  wordByWordAnimation: true,
  speakerLabels: false,
  outputFormat: 'mp4' as const,
  videoCodec: 'h264' as const,
  outputResolution: '1080p' as const,
  outputFps: 30 as const,
  autoProcess: true,
};
