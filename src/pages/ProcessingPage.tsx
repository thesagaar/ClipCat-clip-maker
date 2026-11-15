import { useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  MinusCircle,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { MascotAssistant } from '../components/brand/MascotAssistant';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import {
  useCancelJobMutation,
  useJobPollingQuery,
  useProjectQuery,
  useStartProcessingMutation,
} from '../hooks/useClipCatQueries';
import { useUiStore } from '../stores/uiStore';
import type { ProcessingStage, ProcessingStageId, StageStatus } from '../types/job';
import { formatElapsedVerbose, formatTimeShort } from '../utils/format';

const DEFAULT_PIPELINE_STAGES: Array<{ id: ProcessingStageId; order: number; label: string }> = [
  { id: 'video_validation', order: 1, label: 'Video validation' },
  { id: 'media_inspection', order: 2, label: 'Media inspection' },
  { id: 'audio_extraction', order: 3, label: 'Audio extraction' },
  { id: 'speech_transcription', order: 4, label: 'Speech transcription' },
  { id: 'ai_moment_detection', order: 5, label: 'AI moment detection' },
  { id: 'clip_scoring', order: 6, label: 'Clip scoring' },
  { id: 'smart_cropping', order: 7, label: 'Smart cropping' },
  { id: 'caption_generation', order: 8, label: 'Caption generation' },
  { id: 'video_rendering', order: 9, label: 'Video rendering' },
  { id: 'export_validation', order: 10, label: 'Export validation' },
];

function getMascotMessageForStage(stageId: ProcessingStageId | null, status?: string): string {
  if (status === 'completed') return 'Your clips are ready to review!';
  if (status === 'failed') return 'Processing hit a snag. Review the log below.';
  if (status === 'cancelled') return 'Processing was cancelled.';
  switch (stageId) {
    case 'audio_extraction':
    case 'speech_transcription':
      return 'Listening to your video...';
    case 'ai_moment_detection':
    case 'clip_scoring':
      return 'Finding interesting moments...';
    case 'caption_generation':
      return 'Adding captions...';
    case 'video_rendering':
    case 'export_validation':
      return 'Your clips are almost ready!';
    default:
      return 'Preparing your local video pipeline...';
  }
}

function StageRowIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-5 h-5 text-ios-green shrink-0" />;
    case 'running':
      return <Loader2 className="w-5 h-5 text-ios-blue motion-safe:animate-spin shrink-0" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-ios-red shrink-0" />;
    case 'cancelled':
      return <MinusCircle className="w-5 h-5 text-ios-secondary shrink-0" />;
    case 'waiting':
    default:
      return <Clock className="w-5 h-5 text-ios-secondary shrink-0" />;
  }
}

export function ProcessingPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useUiStore();

  const projectQuery = useProjectQuery(projectId);
  const jobId = searchParams.get('jobId') || projectQuery.data?.activeJobId || undefined;
  const jobQuery = useJobPollingQuery(jobId, Boolean(jobId));
  const cancelMutation = useCancelJobMutation();
  const restartMutation = useStartProcessingMutation();

  const job = jobQuery.data;
  const project = projectQuery.data;

  useEffect(() => {
    if (job?.status === 'completed' && projectId) {
      addToast({
        variant: 'success',
        title: 'Clips Ready',
        description: `"${job.projectName}" finished processing.`,
      });
    }
  }, [job?.status, job?.projectName, projectId, addToast]);

  const stages: ProcessingStage[] =
    job?.stages && job.stages.length > 0
      ? job.stages
      : DEFAULT_PIPELINE_STAGES.map((s) => ({
          ...s,
          status: 'waiting',
          progressPercent: null,
        }));

  const handleCancel = async () => {
    if (!jobId) return;
    try {
      await cancelMutation.mutateAsync(jobId);
      addToast({
        variant: 'info',
        title: 'Job Cancelled',
        description: 'Processing stopped cleanly.',
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Cancel Failed',
        description: err instanceof Error ? err.message : 'Could not cancel job.',
      });
    }
  };

  const handleRestart = async () => {
    if (!projectId) return;
    try {
      const resp = await restartMutation.mutateAsync({ projectId });
      navigate(`/projects/${projectId}/processing?jobId=${resp.jobId}`, {
        replace: true,
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Restart Failed',
        description: err instanceof Error ? err.message : 'Could not restart processing.',
      });
    }
  };

  if (projectQuery.isLoading && !job) {
    return (
      <div className="space-y-6 w-full">
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header Summary Card */}
      <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <StatusIndicator
                status={job?.status ?? project?.status ?? 'waiting'}
              />
              {jobId && (
                <span className="text-xs font-mono text-ios-secondary break-all">
                  Job {jobId}
                </span>
              )}
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-ios-label truncate">
              {job?.projectName ?? project?.name ?? 'AI Processing Pipeline'}
            </h2>
            <p className="text-sm text-ios-secondary">
              {job?.currentTask ??
                (jobId
                  ? 'Waiting for progress update from FastAPI worker...'
                  : 'No active job ID found for this project.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {job?.status === 'completed' && projectId && (
              <Link to={`/projects/${projectId}/clips`}>
                <Button icon={<ArrowRight className="w-4 h-4" />}>
                  View Generated Clips
                </Button>
              </Link>
            )}

            {(job?.status === 'running' || job?.status === 'queued') && (
              <Button
                variant="danger"
                loading={cancelMutation.isPending}
                icon={<XCircle className="w-4 h-4" />}
                onClick={handleCancel}
              >
                Cancel Processing
              </Button>
            )}

            {(job?.status === 'failed' || job?.status === 'cancelled') && (
              <Button
                variant="primary"
                loading={restartMutation.isPending}
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={handleRestart}
              >
                Retry Processing
              </Button>
            )}
          </div>
        </div>

        {/* Real Progress Bar or Honest Indeterminate State */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            <span className="text-ios-secondary">
              Overall Progress:{' '}
              <strong className="font-mono tabular-nums text-ios-label">
                {job?.overallProgress !== null && job?.overallProgress !== undefined
                  ? `${job.overallProgress}%`
                  : job?.status === 'completed'
                    ? '100%'
                    : 'Indeterminate (awaiting stage telemetry)'}
              </strong>
            </span>
            <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums text-ios-secondary">
              <span>Elapsed: {formatElapsedVerbose(job?.elapsedSec ?? 0)}</span>
              {job?.estimatedRemainingSec !== null &&
                job?.estimatedRemainingSec !== undefined && (
                  <span>ETA: {formatElapsedVerbose(job.estimatedRemainingSec)}</span>
                )}
            </div>
          </div>

          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={job?.overallProgress ?? undefined}
            className="h-2.5 w-full rounded-full bg-ios-bg border border-ios-sep overflow-hidden"
          >
            {job?.overallProgress !== null && job?.overallProgress !== undefined ? (
              <div
                className="h-full bg-ios-blue-fill transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, job.overallProgress))}%` }}
              />
            ) : job?.status === 'running' || job?.status === 'queued' ? (
              <div className="h-full w-1/3 bg-ios-blue motion-safe:animate-pulse rounded-full" />
            ) : null}
          </div>
        </div>
      </section>

      {/* Network / Backend Unavailable Error */}
      {(projectQuery.isError || jobQuery.isError) && (
        <ErrorState
          error={jobQuery.error ?? projectQuery.error}
          title="Connection Interrupted During Processing"
          onRetry={() => {
            projectQuery.refetch();
            jobQuery.refetch();
          }}
        />
      )}

      {job?.errorMessage && (
        <div
          role="alert"
          className="rounded-xl bg-[var(--ios-red-tint)] border border-[var(--ios-red-border)] p-4 text-sm text-ios-red"
        >
          <strong>Pipeline Error:</strong> {job.errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Animated Mascot (ordered first on mobile, top-right on desktop) */}
        <div className="min-w-0 lg:col-start-3 lg:row-start-1">
          <MascotAssistant
            showSdpAttribution
            animate={job?.status === 'running'}
            message={getMascotMessageForStage(job?.currentStageId ?? null, job?.status)}
            submessage="ClipCat polls FastAPI telemetry every 2 seconds. You can safely navigate elsewhere—processing continues on your backend."
          />
        </div>

        {/* 10-Stage Vertical Pipeline */}
        <section className="lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:row-span-2 min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-ios-label">
              Processing Pipeline
            </h3>
            <button
              type="button"
              onClick={() => jobQuery.refetch()}
              className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 px-2 inline-flex items-center justify-center gap-1.5 text-xs text-ios-secondary hover:text-ios-label cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <ol className="divide-y divide-ios-sep">
            {stages.map((stage) => (
              <li
                key={stage.id}
                className="py-3.5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StageRowIcon status={stage.status} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ios-label">
                      <span className="font-mono text-xs text-ios-secondary mr-2 tabular-nums">
                        {String(stage.order).padStart(2, '0')}.
                      </span>
                      {stage.label}
                    </p>
                    {stage.detail && (
                      <p className="text-xs text-ios-secondary mt-0.5 line-clamp-2 sm:truncate">
                        {stage.detail}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {stage.progressPercent !== null &&
                    stage.progressPercent !== undefined && (
                      <span className="text-xs font-mono tabular-nums text-ios-secondary">
                        {stage.progressPercent}%
                      </span>
                    )}
                  <StatusIndicator status={stage.status} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Processing Logs */}
        <aside className="min-w-0 lg:col-start-3 lg:row-start-2">
          <div className="rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-3">
            <h3 className="font-display text-base font-bold text-ios-label">
              Processing Logs
            </h3>
            <div className="max-h-80 overflow-y-auto space-y-2 rounded-lg bg-ios-bg border border-ios-sep p-3 font-mono text-xs break-words">
              {!job || job.logs.length === 0 ? (
                <p className="text-ios-secondary">No log entries reported yet.</p>
              ) : (
                job.logs.map((entry) => (
                  <div key={entry.id} className="space-y-0.5">
                    <span className="text-ios-secondary">
                      [{formatTimeShort(entry.timestamp)}]
                    </span>{' '}
                    <span
                      className={
                        entry.level === 'error'
                          ? 'text-ios-red'
                          : entry.level === 'warning'
                            ? 'text-ios-orange'
                            : 'text-ios-label'
                      }
                    >
                      {entry.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
