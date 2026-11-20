import { captureSanitizedError } from '../analytics/errorAdapter';
import { ENV, getApiBaseUrl } from '../config/env';
import {
  ApiClientError,
  extractErrorMessage,
  normalizeUnknownError,
} from './errors';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface UploadOptions {
  formData: FormData;
  onProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

let mockModeRuntimeOverride: boolean | null = null;
let inMemoryFastApiAuthToken: string | null = null;

/**
 * Stores an authorized per-install bearer token strictly in memory (never localStorage or logs)
 * once obtained cleanly from the desktop shell / backend handshake.
 */
export function setFastApiAuthToken(token: string | null): void {
  const trimmed = token?.trim() ?? '';
  inMemoryFastApiAuthToken = trimmed.length > 0 ? trimmed : null;
}

export function getFastApiAuthHeader(): Record<string, string> {
  return inMemoryFastApiAuthToken
    ? { Authorization: `Bearer ${inMemoryFastApiAuthToken}` }
    : {};
}

export function hasFastApiAuthToken(): boolean {
  return Boolean(inMemoryFastApiAuthToken);
}

export function setRuntimeMockMode(enabled: boolean | null): void {
  if (ENV.IS_PROD) {
    mockModeRuntimeOverride = false;
    return;
  }
  mockModeRuntimeOverride = enabled;
}

export function resolveMockApiEnabled(params: {
  isProd: boolean;
  isDev: boolean;
  useMockEnv: boolean;
  runtimeOverride: boolean | null;
  search?: string;
}): boolean {
  // Never allow mock mode bypass in production builds via runtime state, env, or URL params
  if (params.isProd) {
    return false;
  }
  if (params.runtimeOverride !== null) {
    return params.runtimeOverride;
  }
  if (params.isDev && params.search) {
    const query = new URLSearchParams(params.search);
    if (query.get('mock') === '1') return true;
  }
  return params.useMockEnv;
}

export function isMockApiEnabled(): boolean {
  return resolveMockApiEnabled({
    isProd: ENV.IS_PROD,
    isDev: ENV.IS_DEV,
    useMockEnv: ENV.USE_MOCK_API,
    runtimeOverride: mockModeRuntimeOverride,
    search: typeof window !== 'undefined' ? window.location.search : undefined,
  });
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    timeoutMs = ENV.REQUEST_TIMEOUT_MS,
    signal: externalSignal,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new ApiClientError({
        message: 'Request was cancelled.',
        code: 'CANCELLED',
      });
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const isJsonBody = body !== undefined && !(body instanceof FormData);
    const response = await fetch(buildApiUrl(path), {
      method,
      headers: {
        ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
        Accept: 'application/json',
        ...getFastApiAuthHeader(),
        ...headers,
      },
      body: isJsonBody ? JSON.stringify(body) : (body as BodyInit | undefined),
      signal: controller.signal,
    });

    if (!response.ok) {
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      const { message, fieldErrors } = extractErrorMessage(
        payload,
        `Backend returned HTTP ${response.status}`
      );

      const code =
        response.status === 401 || response.status === 403
          ? 'UNAUTHORIZED'
          : response.status === 422 || response.status === 400
            ? 'VALIDATION_ERROR'
            : response.status === 404
              ? 'NOT_FOUND'
              : response.status === 409
                ? 'CONFLICT'
                : 'HTTP_ERROR';

      throw new ApiClientError({
        message,
        code,
        status: response.status,
        fieldErrors,
      });
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return (await response.text()) as unknown as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (externalSignal?.aborted) {
      throw new ApiClientError({
        message: 'Request was cancelled.',
        code: 'CANCELLED',
      });
    }
    const normalized = normalizeUnknownError(error);
    captureSanitizedError(normalized, { operation: `${method} ${path.split('?')[0] ?? '/'}` });
    throw normalized;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

export function apiUpload<T>(path: string, options: UploadOptions): Promise<T> {
  const {
    formData,
    onProgress,
    signal,
    timeoutMs = ENV.UPLOAD_TIMEOUT_MS,
  } = options;

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildApiUrl(path), true);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader('Accept', 'application/json');
    if (inMemoryFastApiAuthToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${inMemoryFastApiAuthToken}`);
    }

    if (signal) {
      if (signal.aborted) {
        reject(new ApiClientError({ message: 'Upload cancelled.', code: 'CANCELLED' }));
        return;
      }
      signal.addEventListener(
        'abort',
        () => {
          xhr.abort();
        },
        { once: true }
      );
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const pct = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress(pct, event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      let parsed: unknown = null;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        parsed = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed as T);
        return;
      }

      const { message, fieldErrors } = extractErrorMessage(
        parsed,
        `Upload failed with HTTP ${xhr.status}`
      );
      reject(
        new ApiClientError({
          message,
          code:
            xhr.status === 401 || xhr.status === 403
              ? 'UNAUTHORIZED'
              : xhr.status === 422 || xhr.status === 400
                ? 'VALIDATION_ERROR'
                : 'HTTP_ERROR',
          status: xhr.status,
          fieldErrors,
        })
      );
    };

    xhr.onerror = () => {
      reject(
        new ApiClientError({
          message:
            'Network error during upload. Ensure the local FastAPI backend is running.',
          code: 'BACKEND_UNAVAILABLE',
        })
      );
    };

    xhr.ontimeout = () => {
      reject(
        new ApiClientError({
          message: 'Video upload timed out.',
          code: 'TIMEOUT',
        })
      );
    };

    xhr.onabort = () => {
      reject(
        new ApiClientError({
          message: 'Video upload was cancelled.',
          code: 'CANCELLED',
        })
      );
    };

    xhr.send(formData);
  });
}
