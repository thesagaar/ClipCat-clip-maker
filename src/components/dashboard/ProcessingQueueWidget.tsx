import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Layers } from 'lucide-react';
import type { Clip } from '../../types/clip';
import type { ProcessingJob } from '../../types/job';
import type { Project } from '../../types/project';
import { cn } from '../../utils/cn';
import { Skeleton } from '../ui/Skeleton';
import { buildProcessingQueueSummary } from './dashboardWidgetUtils';

interface ProcessingQueueWidgetProps {
  projects: readonly Project[];
  clips: readonly Clip[];
  activeJobs: readonly ProcessingJob[];
  isLoading?: boolean;
  isError?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Dashboard widget displaying a live progress bar for the total number of clips
 * currently being rendered or transcribed across all active projects.
 */
export function ProcessingQueueWidget({
  projects,
  clips,
  activeJobs,
  isLoading = false,
  isError = false,
  compact = false,
  className,
}: ProcessingQueueWidgetProps) {
  const summary = buildProcessingQueueSummary(projects, clips, activeJobs);

  return (
    <section
      aria-label="Processing Queue"
      data-testid="processing-queue-widget"
      className={cn(
        'rounded-xl bg-ios-surface border border-ios-sep min-w-0',
        compact ? 'p-4 space-y-3' : 'p-5 sm:p-6 space-y-4',
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <Layers
              className={cn(
                'w-4 h-4 shrink-0',
                summary.hasActiveQueue ? 'text-ios-blue' : 'text-ios-secondary'
              )}
              aria-hidden="true"
            />
            <h3
              className={cn(
                'font-display font-bold text-ios-label',
                compact ? 'text-sm' : 'text-base sm:text-lg'
              )}
            >
              Processing Queue
            </h3>
          </div>
          <p className="text-xs text-ios-secondary">
            Total clips currently being rendered or transcribed across active projects
          </p>
        </div>

        {!isLoading && !isError && (
          <div className="text-right shrink-0 space-y-0.5">
            <p
              data-testid="processing-queue-count"
              className="font-display text-lg sm:text-xl font-bold text-ios-label tabular-nums leading-tight"
            >
              {summary.totalActiveClipsCount}{' '}
              <span className="text-xs sm:text-sm font-medium text-ios-secondary">
                {summary.totalActiveClipsCount === 1 ? 'clip in queue' : 'clips in queue'}
              </span>
            </p>
          </div>
        )}
      </div>

      {isLoading ? (
        <Skeleton className={compact ? 'h-16 w-full' : 'h-20 w-full'} />
      ) : isError ? (
        <p className="text-xs text-ios-secondary">
          Processing queue telemetry will appear once the backend is connected or sample mode is active.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Progress Bar Row */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-ios-secondary tabular-nums">
                <span>
                  Transcribing:{' '}
                  <strong className="font-mono text-ios-label">
                    {summary.transcribingClipsCount}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Rendering:{' '}
                  <strong className="font-mono text-ios-label">
                    {summary.renderingClipsCount}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Active projects:{' '}
                  <strong className="font-mono text-ios-label">
                    {summary.activeProjectsCount}
                  </strong>
                </span>
              </div>

              <span
                data-testid="processing-queue-percent"
                className="font-mono font-bold text-ios-label tabular-nums"
              >
                {summary.progressPercent}%
              </span>
            </div>

            <div
              role="progressbar"
              data-testid="processing-queue-progress"
              aria-label="Active clips processing queue progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={summary.progressPercent}
              className="h-2.5 w-full rounded-full bg-ios-bg border border-ios-sep overflow-hidden"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  summary.hasActiveQueue ? 'bg-[#7040DC]' : 'bg-ios-tertiary'
                )}
                style={{ width: `${summary.progressPercent}%` }}
              />
            </div>
          </div>

          {/* Active Project Items or Idle Line */}
          {summary.activeProjectItems.length > 0 ? (
            <div className="divide-y divide-ios-sep rounded-lg bg-ios-bg/70 border border-ios-sep">
              {summary.activeProjectItems.map((item) => (
                <div
                  key={item.projectId}
                  className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="font-medium text-ios-label truncate">{item.projectName}</p>
                    <p className="text-[11px] text-ios-secondary truncate tabular-nums">
                      {item.clipCount} clip{item.clipCount === 1 ? '' : 's'} ·{' '}
                      {item.phase === 'rendering'
                        ? 'Rendering'
                        : item.phase === 'queued'
                          ? 'Queued'
                          : 'Transcribing'}{' '}
                      ({item.progressPercent}%)
                    </p>
                  </div>
                  <Link
                    to={`/projects/${item.projectId}/processing`}
                    className="inline-flex items-center gap-1 text-ios-blue hover:underline font-medium whitespace-nowrap shrink-0 min-h-[36px] sm:min-h-0"
                  >
                    <span>Pipeline</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>
              ))}
            </div>
          ) : !summary.hasActiveQueue ? (
            <div className="flex items-center gap-2 text-xs text-ios-secondary">
              <CheckCircle2 className="w-4 h-4 text-ios-green shrink-0" aria-hidden="true" />
              <span>All queued clips are finished. Start a new project or Quick Import to enqueue more.</span>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
