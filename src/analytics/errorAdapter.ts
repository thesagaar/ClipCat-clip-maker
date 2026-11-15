import { ApiClientError } from '../api/errors';
import { trackAnalyticsEvent } from './client';
import { sanitizeStackSummary, scrubSensitiveText } from './sanitize';

let globalListenersRegistered = false;

export function captureSanitizedError(
  error: unknown,
  context: {
    componentHint?: string;
    operation?: string;
    eventType?: 'application_error' | 'unhandled_exception';
  } = {}
): void {
  try {
    if (error instanceof ApiClientError) {
      if (error.code === 'CANCELLED') return;
      trackAnalyticsEvent('api_connection_failed', {
        errorCategory: error.code,
        statusCode: error.status ?? 0,
        operation: scrubSensitiveText(context.operation ?? 'api_request', 64),
      });
      return;
    }

    const errObj = error instanceof Error ? error : new Error(String(error));
    const eventName = context.eventType ?? 'application_error';

    trackAnalyticsEvent(eventName, {
      errorCategory: errObj.name || 'Error',
      errorMessage: scrubSensitiveText(errObj.message, 180),
      stackSummary: sanitizeStackSummary(errObj.stack),
      ...(eventName === 'application_error'
        ? { componentHint: scrubSensitiveText(context.componentHint ?? 'ui', 64) }
        : { sourceType: scrubSensitiveText(context.componentHint ?? 'window', 64) }),
    });
  } catch {
    // Error tracking must never trigger recursive exceptions
  }
}

export function registerGlobalErrorHandlers(): () => void {
  if (typeof window === 'undefined' || globalListenersRegistered) {
    return () => {};
  }

  globalListenersRegistered = true;

  const handleWindowError = (event: ErrorEvent) => {
    captureSanitizedError(event.error ?? new Error(event.message || 'Window error'), {
      componentHint: 'window.onerror',
      eventType: 'unhandled_exception',
    });
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    captureSanitizedError(event.reason ?? new Error('Unhandled promise rejection'), {
      componentHint: 'unhandledrejection',
      eventType: 'unhandled_exception',
    });
  };

  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  return () => {
    window.removeEventListener('error', handleWindowError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    globalListenersRegistered = false;
  };
}
