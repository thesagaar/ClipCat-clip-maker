const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const API_BASE_STORAGE_KEY = 'clipcat-api-base-url';

function normalizeBaseUrl(raw: string | undefined | null): string {
  const trimmed = (raw ?? '').trim().replace(/\/+$/, '');
  return trimmed;
}

export const ENV = {
  API_BASE_URL: normalizeBaseUrl(metaEnv.VITE_API_BASE_URL) || 'http://127.0.0.1:8000',
  USE_MOCK_API: metaEnv.VITE_USE_MOCK_API === 'true',
  APP_VERSION: metaEnv.VITE_APP_VERSION?.trim() || '0.1.0',
  SDP_WEBSITE_URL:
    normalizeBaseUrl(metaEnv.VITE_SDP_WEBSITE_URL) ||
    'https://single-dimension-projects.vercel.app',
  SDP_SUPPORT_URL:
    normalizeBaseUrl(metaEnv.VITE_SDP_SUPPORT_URL) ||
    'https://single-dimension-projects.vercel.app/contact',
  SDP_SUPPORT_EMAIL: metaEnv.VITE_SDP_SUPPORT_EMAIL?.trim() || null,
  REQUEST_TIMEOUT_MS: 15000,
  UPLOAD_TIMEOUT_MS: 300000,
} as const;

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const override = normalizeBaseUrl(window.localStorage.getItem(API_BASE_STORAGE_KEY));
      if (override && /^https?:\/\//i.test(override)) {
        return override;
      }
    } catch {
      // Ignore storage access errors in restricted webviews
    }
  }
  return ENV.API_BASE_URL;
}

export function setRuntimeApiBaseUrl(url: string | null): string {
  const normalized = normalizeBaseUrl(url);
  if (typeof window !== 'undefined') {
    try {
      if (!normalized || normalized === ENV.API_BASE_URL) {
        window.localStorage.removeItem(API_BASE_STORAGE_KEY);
      } else {
        window.localStorage.setItem(API_BASE_STORAGE_KEY, normalized);
      }
    } catch {
      // Ignore storage access errors
    }
  }
  return getApiBaseUrl();
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
