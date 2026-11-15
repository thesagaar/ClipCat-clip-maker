import { ENV } from '../config/env';
import { isTauriEnvironment } from '../utils/desktop';
import { useConsentStore } from './consentStore';
import {
  DIAGNOSTIC_EVENT_NAMES,
  type AnalyticsEventName,
  type SanitizedAnalyticsEnvelope,
} from './events';
import { sanitizeEventPayload } from './sanitize';

export interface AnalyticsTransport {
  send: (endpoint: string, payload: SanitizedAnalyticsEnvelope) => void | Promise<void>;
}

const DEFAULT_COOLDOWN_MS = 2000;
const ERROR_COOLDOWN_MS = 5000;

const recentDispatchTimestamps = new Map<string, number>();
let customTransport: AnalyticsTransport | null = null;

export function setAnalyticsTransportForTest(transport: AnalyticsTransport | null): void {
  customTransport = transport;
  recentDispatchTimestamps.clear();
}

function defaultSend(endpoint: string, payload: SanitizedAnalyticsEnvelope): void {
  try {
    const serialized = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([serialized], { type: 'application/json' });
      if (navigator.sendBeacon(endpoint, blob)) {
        return;
      }
    }
    if (typeof fetch === 'function') {
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serialized,
        keepalive: true,
        credentials: 'omit',
      }).catch(() => {
        // Never disrupt user workflows if analytics endpoint is offline
      });
    }
  } catch {
    // Strictly swallow transport serialization/network errors
  }
}

export interface DispatchCheckContext {
  analyticsEnabled?: boolean;
  errorReportingEnabled?: boolean;
  endpoint?: string | null;
  analyticsConsent?: boolean;
  diagnosticsConsent?: boolean;
  nowMs?: number;
}

export function canDispatchAnalyticsEvent(
  eventName: AnalyticsEventName,
  overrides: DispatchCheckContext = {}
): boolean {
  const analyticsEnabled = overrides.analyticsEnabled ?? ENV.ANALYTICS_ENABLED;
  const errorReportingEnabled = overrides.errorReportingEnabled ?? ENV.ERROR_REPORTING_ENABLED;
  const endpoint = overrides.endpoint !== undefined ? overrides.endpoint : ENV.ANALYTICS_ENDPOINT;

  if (!analyticsEnabled || !endpoint) {
    return false;
  }

  const consentState = useConsentStore.getState();
  const isDiagnostic = DIAGNOSTIC_EVENT_NAMES.has(eventName);

  if (isDiagnostic) {
    const diagConsent = overrides.diagnosticsConsent ?? (consentState.hasResponded && consentState.diagnostics);
    return Boolean(errorReportingEnabled && diagConsent);
  }

  const usageConsent = overrides.analyticsConsent ?? (consentState.hasResponded && consentState.analytics);
  return Boolean(usageConsent);
}

/**
 * Tracks a strictly allowlisted, sanitized analytics or error event ONLY when both
 * explicit environment config AND user consent permit dispatch.
 */
export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  rawProperties: Record<string, unknown> = {},
  overrides: DispatchCheckContext = {}
): SanitizedAnalyticsEnvelope | null {
  try {
    if (!canDispatchAnalyticsEvent(eventName, overrides)) {
      return null;
    }

    const route =
      typeof window !== 'undefined' ? window.location.pathname : '/';
    const viewportWidth =
      typeof window !== 'undefined' ? window.innerWidth : 1280;

    const envelope = sanitizeEventPayload(eventName, rawProperties, {
      appVersion: ENV.APP_VERSION,
      route,
      runtime: isTauriEnvironment() ? 'desktop' : 'web',
      viewportWidth,
    });

    if (!envelope) {
      return null;
    }

    const nowMs = overrides.nowMs ?? Date.now();
    const isError = DIAGNOSTIC_EVENT_NAMES.has(eventName);
    const dedupeKey = `${envelope.event}:${envelope.route}:${String(envelope.properties.stage ?? envelope.properties.errorCategory ?? '')}`;
    const cooldown = isError ? ERROR_COOLDOWN_MS : DEFAULT_COOLDOWN_MS;
    const prevTime = recentDispatchTimestamps.get(dedupeKey) ?? 0;

    if (nowMs - prevTime < cooldown) {
      return null;
    }

    recentDispatchTimestamps.set(dedupeKey, nowMs);
    if (recentDispatchTimestamps.size > 100) {
      const oldestKey = recentDispatchTimestamps.keys().next().value;
      if (oldestKey) recentDispatchTimestamps.delete(oldestKey);
    }

    const endpoint =
      (overrides.endpoint !== undefined ? overrides.endpoint : ENV.ANALYTICS_ENDPOINT) ?? '';

    if (customTransport) {
      void customTransport.send(endpoint, envelope);
    } else if (endpoint) {
      defaultSend(endpoint, envelope);
    }

    return envelope;
  } catch {
    return null;
  }
}
