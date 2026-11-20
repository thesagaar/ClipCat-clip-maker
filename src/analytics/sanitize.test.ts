import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { trackAnalyticsEvent, setAnalyticsTransportForTest, canDispatchAnalyticsEvent } from './client';
import { useConsentStore } from './consentStore';
import { ANALYTICS_EVENT_NAMES } from './events';
import {
  bucketFileSize,
  extractSafeExtension,
  sanitizeEventPayload,
  sanitizeRouteIdentifier,
  sanitizeStackSummary,
  scrubSensitiveText,
} from './sanitize';

describe('analytics sanitization and consent gates', () => {
  it('redacts paths, URLs, tokens, emails, and private IPs from error messages and stacks', () => {
    const raw =
      'Failed uploading C:\\Users\\Alice\\Videos\\secret_clip.mp4 to http://192.168.1.42:8000/upload?token=abc&user=alice@example.com with Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig';
    const clean = scrubSensitiveText(raw, 400);
    assert.equal(clean.includes('Alice'), false);
    assert.equal(clean.includes('secret_clip.mp4'), false);
    assert.equal(clean.includes('192.168.1.42'), false);
    assert.equal(clean.includes('alice@example.com'), false);
    assert.equal(clean.includes('eyJhbGciOi'), false);
    assert.ok(clean.includes('[REDACTED_'));
  });

  it('redacts POSIX paths cleanly', () => {
    const stack = 'Error: boom\n    at upload (/Users/dev/project/video.mov:10:4)\n    at /home/bob/run.ts:44:2';
    const clean = sanitizeStackSummary(stack);
    assert.equal(clean.includes('/Users/dev'), false);
    assert.equal(clean.includes('/home/bob'), false);
    assert.ok(clean.includes('[REDACTED_PATH]'));
  });

  it('strips dynamic IDs and query parameters from routes', () => {
    assert.equal(sanitizeRouteIdentifier('/projects/proj-999/processing?jobId=job-123&token=xyz'), '/projects/:id/processing');
    assert.equal(sanitizeRouteIdentifier('/projects/proj-999/clips#top'), '/projects/:id/clips');
    assert.equal(sanitizeRouteIdentifier('/clips/clip_888/edit?mock=1'), '/clips/:id/edit');
    assert.equal(sanitizeRouteIdentifier('/publish'), '/publish');
    assert.equal(sanitizeRouteIdentifier('/publish/clip_888?token=secret'), '/publish/:id');
    assert.equal(sanitizeRouteIdentifier('/privacy'), '/privacy');
    assert.equal(sanitizeRouteIdentifier('/some-unknown-secret-path'), '/unknown');
  });

  it('strips forbidden fields and unallowlisted properties from event envelopes', () => {
    const envelope = sanitizeEventPayload(
      'upload_started',
      {
        fileExtension: extractSafeExtension('My Private Video.mp4'),
        sizeBucket: bucketFileSize(150 * 1024 * 1024),
        filename: 'My Private Video.mp4',
        projectName: 'Confidential Podcast',
        transcript: 'Hello world secret transcript',
        apiKey: 'sk-1234567890abcdef',
        filePath: 'C:\\Users\\Owner\\file.mp4',
        arbitraryExtraField: 'should be dropped',
      },
      { appVersion: '0.1.0', route: '/projects/new?secret=1', viewportWidth: 390 }
    );

    assert.ok(envelope);
    assert.equal(envelope.event, 'upload_started');
    assert.equal(envelope.viewportBucket, 'mobile');
    assert.equal(envelope.route, '/projects/new');
    assert.deepEqual(envelope.properties, {
      fileExtension: 'mp4',
      sizeBucket: '100MB-500MB',
    });
  });

  it('rejects non-allowlisted event names', () => {
    const envelope = sanitizeEventPayload('custom_arbitrary_event', { foo: 'bar' }, { appVersion: '0.1.0' });
    assert.equal(envelope, null);
    assert.ok(ANALYTICS_EVENT_NAMES.includes('app_opened'));
  });

  it('blocks dispatch when disabled, unconfigured, or lacking user consent, and deduplicates bursts when enabled', () => {
    const sent: unknown[] = [];
    setAnalyticsTransportForTest({
      send: (_endpoint, payload) => {
        sent.push(payload);
      },
    });

    // Disabled by default (no endpoint / no consent)
    assert.equal(canDispatchAnalyticsEvent('app_opened'), false);
    assert.equal(trackAnalyticsEvent('app_opened', { themeMode: 'dark' }), null);
    assert.equal(sent.length, 0);

    // Enabled config + no consent -> still blocked
    assert.equal(
      canDispatchAnalyticsEvent('app_opened', {
        analyticsEnabled: true,
        endpoint: 'https://analytics.example/collect',
        analyticsConsent: false,
      }),
      false
    );

    // Enabled config + granted consent -> sends once, deduplicates immediate duplicate
    useConsentStore.getState().acceptAll();
    const first = trackAnalyticsEvent(
      'page_viewed',
      { pageGroup: 'dashboard', themeMode: 'dark' },
      {
        analyticsEnabled: true,
        endpoint: 'https://analytics.example/collect',
        analyticsConsent: true,
        nowMs: 10_000,
      }
    );
    const secondImmediate = trackAnalyticsEvent(
      'page_viewed',
      { pageGroup: 'dashboard', themeMode: 'dark' },
      {
        analyticsEnabled: true,
        endpoint: 'https://analytics.example/collect',
        analyticsConsent: true,
        nowMs: 10_500,
      }
    );
    assert.ok(first);
    assert.equal(secondImmediate, null);
    assert.equal(sent.length, 1);

    setAnalyticsTransportForTest(null);
    useConsentStore.getState().rejectOptional();
  });
});
