export type ApiErrorCode =
  | 'BACKEND_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'HTTP_ERROR'
  | 'CANCELLED';

export interface BackendErrorPayload {
  detail?: string | Array<{ loc?: Array<string | number>; msg?: string; type?: string }>;
  message?: string;
  code?: string;
  fieldErrors?: Record<string, string>;
}

export class ApiClientError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number | null;
  public readonly fieldErrors?: Record<string, string>;
  public readonly isBackendOffline: boolean;

  constructor(options: {
    message: string;
    code: ApiErrorCode;
    status?: number | null;
    fieldErrors?: Record<string, string>;
  }) {
    super(options.message);
    this.name = 'ApiClientError';
    this.code = options.code;
    this.status = options.status ?? null;
    this.fieldErrors = options.fieldErrors;
    this.isBackendOffline =
      options.code === 'BACKEND_UNAVAILABLE' || options.code === 'NETWORK_ERROR';
  }
}

export function extractErrorMessage(payload: unknown, fallback: string): {
  message: string;
  fieldErrors?: Record<string, string>;
} {
  if (!payload || typeof payload !== 'object') {
    return { message: fallback };
  }

  const data = payload as BackendErrorPayload;
  if (typeof data.message === 'string' && data.message.trim()) {
    return { message: data.message, fieldErrors: data.fieldErrors };
  }

  if (typeof data.detail === 'string' && data.detail.trim()) {
    return { message: data.detail, fieldErrors: data.fieldErrors };
  }

  if (Array.isArray(data.detail) && data.detail.length > 0) {
    const fieldErrors: Record<string, string> = {};
    const messages: string[] = [];
    for (const item of data.detail) {
      const msg = item.msg || 'Invalid value';
      messages.push(msg);
      if (Array.isArray(item.loc) && item.loc.length > 0) {
        const key = String(item.loc[item.loc.length - 1]);
        fieldErrors[key] = msg;
      }
    }
    return {
      message: messages.join('; '),
      fieldErrors,
    };
  }

  return { message: fallback, fieldErrors: data.fieldErrors };
}

export function normalizeUnknownError(err: unknown): ApiClientError {
  if (err instanceof ApiClientError) {
    return err;
  }

  if (err instanceof DOMException && err.name === 'AbortError') {
    return new ApiClientError({
      message: 'Request timed out or was cancelled.',
      code: 'TIMEOUT',
    });
  }

  if (err instanceof TypeError) {
    return new ApiClientError({
      message:
        'Cannot reach the ClipCat FastAPI backend. Ensure the local server is running at the configured API URL.',
      code: 'BACKEND_UNAVAILABLE',
    });
  }

  if (err instanceof Error) {
    return new ApiClientError({
      message: err.message,
      code: 'HTTP_ERROR',
    });
  }

  return new ApiClientError({
    message: 'An unexpected communication error occurred.',
    code: 'HTTP_ERROR',
  });
}
