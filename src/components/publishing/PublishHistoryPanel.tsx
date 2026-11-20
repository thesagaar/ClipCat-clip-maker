import { ExternalLink, RefreshCw, ShieldAlert } from 'lucide-react';
import { useRetryPublishingMutation } from '../../hooks/usePublishingQueries';
import type { PublishHistoryItem } from '../../publishing/types';
import { useUiStore } from '../../stores/uiStore';
import { Button } from '../ui/Button';
import { StatusIndicator, type SemanticStatus } from '../ui/StatusIndicator';

interface PublishHistoryPanelProps {
  history: PublishHistoryItem[];
  onRetryStarted?: (jobId: string) => void;
}

function mapPublishStatus(status: PublishHistoryItem['status']): {
  semantic: SemanticStatus;
  label: string;
} {
  switch (status) {
    case 'published':
      return { semantic: 'completed', label: 'Published' };
    case 'preparing_media':
      return { semantic: 'processing', label: 'Preparing Media' };
    case 'validating_metadata':
      return { semantic: 'processing', label: 'Validating' };
    case 'uploading':
      return { semantic: 'processing', label: 'Uploading' };
    case 'processing_platform':
      return { semantic: 'processing', label: 'Verifying' };
    case 'requires_attention':
      return { semantic: 'needs_attention', label: 'Needs Attention' };
    case 'cancelled':
      return { semantic: 'cancelled', label: 'Cancelled' };
    case 'failed':
    default:
      return { semantic: 'failed', label: 'Failed' };
  }
}

export function PublishHistoryPanel({
  history,
  onRetryStarted,
}: PublishHistoryPanelProps) {
  const retryMutation = useRetryPublishingMutation();
  const { addToast } = useUiStore();

  const handleRetry = async (item: PublishHistoryItem) => {
    try {
      const job = await retryMutation.mutateAsync(item.id);
      onRetryStarted?.(job.id);
      addToast({
        variant: 'info',
        title: 'Retry Queued',
        description: `Re-attempting upload for "${item.clipTitle}".`,
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Retry Unavailable',
        description: err instanceof Error ? err.message : 'Unable to retry upload.',
      });
    }
  };

  return (
    <section
      aria-label="Publishing History"
      className="rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold text-ios-label">
            Publishing History
          </h3>
          <p className="text-xs text-ios-secondary mt-0.5">
            Track verified external uploads, attribution state, and recoverable failures. Local MP4 clips are never deleted if an upload fails.
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-ios-secondary">
          {history.length} record{history.length === 1 ? '' : 's'}
        </span>
      </div>

      {history.length === 0 ? (
        <p className="rounded-lg bg-ios-bg border border-ios-sep px-4 py-6 text-xs text-center text-ios-secondary">
          No publishing attempts recorded yet.
        </p>
      ) : (
        <div className="space-y-3">
          {history.map((item) => {
            const st = mapPublishStatus(item.status);
            const hasSafeHttpsUrl =
              typeof item.publishedUrl === 'string' &&
              item.publishedUrl.startsWith('https://');

            return (
              <article
                key={item.id}
                className="rounded-lg bg-ios-bg border border-ios-sep p-3.5 space-y-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold text-ios-label truncate">
                      {item.clipTitle}
                    </p>
                    <p className="text-xs text-ios-secondary font-mono tabular-nums">
                      {item.platform === 'youtube'
                        ? `YouTube (${item.format === 'short' ? 'Shorts' : 'Video'}${item.privacy ? ` · ${item.privacy}` : ''})`
                        : 'Instagram Reels'}
                      {item.accountName ? ` · ${item.accountName}` : ''}
                      {' · '}
                      {new Date(item.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <StatusIndicator status={st.semantic} customLabel={st.label} />
                </div>

                {hasSafeHttpsUrl && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <a
                      href={item.publishedUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-ios-blue hover:underline font-medium"
                    >
                      <span>Open Published Link</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {item.errorMessage && (
                  <div className="rounded-lg bg-[var(--ios-red-tint)] border border-[var(--ios-red-border)] p-2.5 text-xs text-ios-red flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p>{item.errorMessage}</p>
                        {item.clipAvailableLocally && (
                          <p className="text-[11px] text-ios-secondary mt-0.5">
                            Local rendered MP4 remains intact in ClipCat storage.
                          </p>
                        )}
                      </div>
                    </div>
                    {item.retryable && item.clipAvailableLocally && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={retryMutation.isPending}
                        icon={<RefreshCw className="w-3.5 h-3.5" />}
                        onClick={() => handleRetry(item)}
                      >
                        Retry Upload
                      </Button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
