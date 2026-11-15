import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApiUrl, isMockApiEnabled, setRuntimeMockMode } from './client';
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
