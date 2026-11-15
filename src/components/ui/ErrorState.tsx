import { AlertTriangle, RefreshCw, ServerOff } from 'lucide-react';
import { ApiClientError } from '../../api/errors';
import { ENV } from '../../config/env';
import { Button } from './Button';

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  secondaryAction?: React.ReactNode;
}

export function ErrorState({
  error,
  title,
  onRetry,
  secondaryAction,
}: ErrorStateProps) {
  const isOffline =
    error instanceof ApiClientError ? error.isBackendOffline : false;
  const message =
    error instanceof Error
      ? error.message
      : 'Unable to complete request.';

  return (
    <div
      role="alert"
      className="rounded-xl bg-ios-surface border border-[var(--ios-red-border)] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start gap-4"
    >
      <div className="w-10 h-10 rounded-lg bg-[var(--ios-red-tint)] text-ios-red flex items-center justify-center shrink-0">
        {isOffline ? (
          <ServerOff className="w-5 h-5" />
        ) : (
          <AlertTriangle className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-display text-base font-bold text-ios-label">
          {title ?? (isOffline ? 'Local FastAPI Backend Unavailable' : 'Request Failed')}
        </h3>
        <p className="text-sm text-ios-secondary mt-1 leading-relaxed">{message}</p>
        {isOffline && (
          <p className="text-xs text-ios-secondary mt-2 font-mono break-all">
            Configured API URL: {ENV.API_BASE_URL}
          </p>
        )}
        {(onRetry || secondaryAction) && (
          <div className="flex flex-wrap items-center gap-3 mt-4">
            {onRetry && (
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={onRetry}
              >
                Retry Connection
              </Button>
            )}
            {secondaryAction}
          </div>
        )}
      </div>
    </div>
  );
}
