import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apiRequest,
  apiUpload,
  buildApiUrl,
  getFastApiAuthHeader,
  hasFastApiAuthToken,
  isMockApiEnabled,
  setFastApiAuthToken,
  setRuntimeMockMode,
} from './client';
import {
  ApiClientError,
  extractErrorMessage,
  normalizeUnknownError,
} from './errors';
import { pingBackendServer } from './system';

test('buildApiUrl joins configured base URL and normalized paths', () => {
  assert.equal(buildApiUrl('/api/projects'), 'http://127.0.0.1:8000/api/projects');
  assert.equal(buildApiUrl('api/system/health'), 'http://127.0.0.1:8000/api/system/health');
});

test('extractErrorMessage parses FastAPI string and Pydantic validation detail arrays', () => {
  const simple = extractErrorMessage({ detail: 'Project not found' }, 'Fallback');
  assert.equal(simple.message, 'Project not found');

  const pydantic = extractErrorMessage(
    {
      detail: [
        { loc: ['body', 'desiredClipCount'], msg: 'ensure this value is greater than 0' },
      ],
    },
    'Fallback'
  );
  assert.equal(pydantic.message, 'ensure this value is greater than 0');
  assert.equal(
    pydantic.fieldErrors?.desiredClipCount,
    'ensure this value is greater than 0'
  );
});

test('normalizeUnknownError identifies offline TypeError as BACKEND_UNAVAILABLE', () => {
  const err = normalizeUnknownError(new TypeError('Failed to fetch'));
  assert.ok(err instanceof ApiClientError);
  assert.equal(err.code, 'BACKEND_UNAVAILABLE');
  assert.equal(err.isBackendOffline, true);
});

test('mock mode defaults to false and can be toggled explicitly in runtime', () => {
  setRuntimeMockMode(null);
  assert.equal(isMockApiEnabled(), false);

  setRuntimeMockMode(true);
  assert.equal(isMockApiEnabled(), true);

  setRuntimeMockMode(false);
  assert.equal(isMockApiEnabled(), false);
  setRuntimeMockMode(null);
});

test('setFastApiAuthToken injects in-memory Bearer header and maps 401/409/422 responses', async () => {
  const originalFetch = globalThis.fetch;
  let capturedHeaders: Record<string, string> = {};
  let capturedMethod = '';

  try {
    setFastApiAuthToken('  clipcat_dev_token_123  ');
    assert.equal(hasFastApiAuthToken(), true);
    assert.deepEqual(getFastApiAuthHeader(), {
      Authorization: 'Bearer clipcat_dev_token_123',
    });

    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      capturedMethod = init?.method ?? 'GET';
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const ok = await apiRequest<{ ok: boolean }>('/api/projects', {
      method: 'POST',
      body: { name: 'Demo' },
    });
    assert.equal(ok.ok, true);
    assert.equal(capturedMethod, 'POST');
    assert.equal(capturedHeaders.Authorization, 'Bearer clipcat_dev_token_123');
    assert.equal(capturedHeaders['Content-Type'], 'application/json');

    // 401 -> UNAUTHORIZED
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ detail: 'Invalid install token' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;

    await assert.rejects(
      () => apiRequest('/api/projects'),
      (err: unknown) =>
        err instanceof ApiClientError &&
        err.code === 'UNAUTHORIZED' &&
        err.status === 401 &&
        err.message === 'Invalid install token'
    );

    // 409 -> CONFLICT
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ detail: 'Active job running' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;

    await assert.rejects(
      () => apiRequest('/api/projects/p1/process', { method: 'POST' }),
      (err: unknown) => err instanceof ApiClientError && err.code === 'CONFLICT'
    );

    // 422 Pydantic validation -> VALIDATION_ERROR + fieldErrors
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          detail: [{ loc: ['body', 'startSec'], msg: 'must be >= 0' }],
        }),
        { status: 422, headers: { 'content-type': 'application/json' } }
      )) as typeof fetch;

    await assert.rejects(
      () => apiRequest('/api/clips/c1', { method: 'PATCH', body: { startSec: -1 } }),
      (err: unknown) =>
        err instanceof ApiClientError &&
        err.code === 'VALIDATION_ERROR' &&
        err.fieldErrors?.startSec === 'must be >= 0'
    );
  } finally {
    setFastApiAuthToken(null);
    assert.equal(hasFastApiAuthToken(), false);
    globalThis.fetch = originalFetch;
  }
});

test('apiUpload attaches Bearer auth, reports XHR upload progress, and normalizes 401/abort/network', async () => {
  const originalXhr = (globalThis as { XMLHttpRequest?: typeof XMLHttpRequest }).XMLHttpRequest;

  class MockXHR {
    method = '';
    url = '';
    timeout = 0;
    status = 201;
    responseText = '';
    headers: Record<string, string> = {};
    upload: { onprogress: ((ev: ProgressEvent) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    ontimeout: (() => void) | null = null;

    static nextBehavior: 'success' | 'unauthorized' | 'error' | 'abort' = 'success';
    static lastHeaders: Record<string, string> = {};

    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader(k: string, v: string) {
      this.headers[k] = v;
      MockXHR.lastHeaders[k] = v;
    }
    abort() {
      this.onabort?.();
    }
    send() {
      queueMicrotask(() => {
        if (MockXHR.nextBehavior === 'abort') {
          this.onabort?.();
          return;
        }
        if (MockXHR.nextBehavior === 'error') {
          this.onerror?.();
          return;
        }
        if (MockXHR.nextBehavior === 'unauthorized') {
          this.status = 401;
          this.responseText = JSON.stringify({ detail: 'Missing bearer token' });
          this.onload?.();
          return;
        }
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 512,
          total: 1024,
        } as ProgressEvent);
        this.status = 201;
        this.responseText = JSON.stringify({ id: 'proj-99', name: 'Uploaded Demo' });
        this.onload?.();
      });
    }
  }

  try {
    (globalThis as unknown as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
      MockXHR as unknown as typeof XMLHttpRequest;

    setFastApiAuthToken('upload_bearer_xyz');
    const progressCalls: number[] = [];
    const formData = new FormData();
    formData.append('name', 'Uploaded Demo');

    MockXHR.nextBehavior = 'success';
    const created = await apiUpload<{ id: string }>('/api/projects/upload', {
      formData,
      onProgress: (pct) => progressCalls.push(pct),
    });
    assert.equal(created.id, 'proj-99');
    assert.deepEqual(progressCalls, [50]);
    assert.equal(MockXHR.lastHeaders.Authorization, 'Bearer upload_bearer_xyz');

    MockXHR.nextBehavior = 'unauthorized';
    await assert.rejects(
      () => apiUpload('/api/projects/upload', { formData }),
      (err: unknown) => err instanceof ApiClientError && err.code === 'UNAUTHORIZED'
    );

    MockXHR.nextBehavior = 'error';
    await assert.rejects(
      () => apiUpload('/api/projects/upload', { formData }),
      (err: unknown) => err instanceof ApiClientError && err.code === 'BACKEND_UNAVAILABLE'
    );

    const abortController = new AbortController();
    abortController.abort();
    await assert.rejects(
      () => apiUpload('/api/projects/upload', { formData, signal: abortController.signal }),
      (err: unknown) => err instanceof ApiClientError && err.code === 'CANCELLED'
    );
  } finally {
    setFastApiAuthToken(null);
    if (originalXhr) {
      (globalThis as unknown as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest = originalXhr;
    } else {
      delete (globalThis as { XMLHttpRequest?: typeof XMLHttpRequest }).XMLHttpRequest;
    }
  }
});

test('pingBackendServer reports reachable and unreachable FastAPI responses accurately', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          status: 'operational',
          backendVersion: '0.2.0',
          uptimeSec: 120,
          databaseStatus: 'operational',
          activeJobsCount: 0,
          cpuUsagePercent: 12,
          ramUsedBytes: 1000,
          ramTotalBytes: 2000,
          checkedAt: '2026-11-14T22:00:00Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )) as typeof fetch;

    const okResult = await pingBackendServer();
    assert.equal(okResult.reachable, true);
    assert.equal(okResult.status, 'operational');
    assert.equal(okResult.backendVersion, '0.2.0');
    assert.equal(okResult.targetUrl, 'http://127.0.0.1:8000/api/system/health');

    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;

    const offlineResult = await pingBackendServer();
    assert.equal(offlineResult.reachable, false);
    assert.equal(offlineResult.status, 'unavailable');
    assert.ok(offlineResult.message.includes('FastAPI'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
