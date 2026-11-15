import { Link } from 'react-router-dom';
import {
  Clock,
  Film,
  FolderKanban,
  HardDrive,
  Link2,
  Play,
  Plus,
  Scissors,
  Upload,
  XCircle,
} from 'lucide-react';
import { MascotAssistant } from '../components/brand/MascotAssistant';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import {
  useAllClipsQuery,
  useCancelJobMutation,
  useProjectsQuery,
  useSystemStorageQuery,
} from '../hooks/useClipCatQueries';
import { useUiStore } from '../stores/uiStore';
import {
  formatBytes,
  formatDateShort,
  formatDuration,
  formatElapsedVerbose,
} from '../utils/format';

export function DashboardPage() {
  const projectsQuery = useProjectsQuery();
  const clipsQuery = useAllClipsQuery();
  const storageQuery = useSystemStorageQuery();
  const cancelJobMutation = useCancelJobMutation();
  const { mockModeEnabled, setMockModeEnabled, addToast } = useUiStore();

  const projects = projectsQuery.data ?? [];
  const clips = clipsQuery.data ?? [];

  const completedProjects = projects.filter((p) => p.status === 'completed');
  const activeProjects = projects.filter(
    (p) => p.status === 'processing' || p.status === 'queued'
  );
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const totalProcessingTimeSec = projects.reduce(
    (sum, p) => sum + (p.processingDurationSec ?? 0),
    0
  );

  const latestProject = recentProjects[0] ?? null;

  const handleCancelActiveJob = async (jobId: string, projectName: string) => {
    try {
      await cancelJobMutation.mutateAsync(jobId);
      addToast({
        variant: 'info',
        title: 'Processing Cancelled',
        description: `Cancellation requested for "${projectName}".`,
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Cancel Failed',
        description: err instanceof Error ? err.message : 'Unable to cancel job.',
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Studio Hero Header */}
      <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-2 max-w-2xl min-w-0">
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-ios-label text-balance">
            Welcome to ClipCat
          </h2>
          <p className="text-sm sm:text-base text-ios-secondary">
            Turn your long videos into scroll-stopping moments. Local-first transcription, smart framing, and burned-in captions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link to="/projects/new">
            <Button size="lg" icon={<Plus className="w-4 h-4" />}>
              Create New Project
            </Button>
          </Link>
        </div>
      </section>

      {/* Backend Offline Notice */}
      {projectsQuery.isError && (
        <ErrorState
          error={projectsQuery.error}
          onRetry={() => {
            projectsQuery.refetch();
            clipsQuery.refetch();
            storageQuery.refetch();
          }}
          secondaryAction={
            !mockModeEnabled ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMockModeEnabled(true)}
              >
                Preview with Mock Sample Data
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Real Statistics (derived solely from backend data) */}
      <section aria-label="Workspace statistics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-1">
          <p className="text-xs font-medium text-ios-secondary">Total Projects</p>
          {projectsQuery.isLoading ? (
            <Skeleton className="h-8 w-20 mt-1" />
          ) : (
            <p className="font-display text-2xl font-bold text-ios-label tabular-nums">
              {projectsQuery.isError ? '—' : projects.length}
            </p>
          )}
        </div>

        <div className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-1">
          <p className="text-xs font-medium text-ios-secondary">Videos Processed</p>
          {projectsQuery.isLoading ? (
            <Skeleton className="h-8 w-20 mt-1" />
          ) : (
            <p className="font-display text-2xl font-bold text-ios-label tabular-nums">
              {projectsQuery.isError ? '—' : completedProjects.length}
            </p>
          )}
        </div>

        <div className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-1">
          <p className="text-xs font-medium text-ios-secondary">Clips Generated</p>
          {clipsQuery.isLoading ? (
            <Skeleton className="h-8 w-20 mt-1" />
          ) : (
            <p className="font-display text-2xl font-bold text-ios-label tabular-nums">
              {clipsQuery.isError ? '—' : clips.length}
            </p>
          )}
        </div>

        <div className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-1">
          <p className="text-xs font-medium text-ios-secondary">Total Processing Time</p>
          {projectsQuery.isLoading ? (
            <Skeleton className="h-8 w-24 mt-1" />
          ) : (
            <p className="font-display text-2xl font-bold text-ios-label tabular-nums">
              {projectsQuery.isError ? '—' : formatElapsedVerbose(totalProcessingTimeSec)}
            </p>
          )}
        </div>
      </section>

      {/* Quick Actions */}
      <section aria-label="Quick actions" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/projects/new?mode=upload"
          className="min-w-0 group rounded-xl bg-ios-surface border border-ios-sep hover:border-ios-blue p-5 flex items-center gap-4 transition-colors"
        >
          <div className="w-11 h-11 rounded-lg bg-[var(--ios-blue-tint)] border border-[var(--ios-blue-border)] text-ios-blue flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-ios-label">
              Upload Video
            </p>
            <p className="text-xs text-ios-secondary mt-0.5 truncate">
              MP4, MOV, MKV, or WEBM from disk
            </p>
          </div>
        </Link>

        <Link
          to="/projects/new?mode=url"
          className="min-w-0 group rounded-xl bg-ios-surface border border-ios-sep hover:border-ios-cyan p-5 flex items-center gap-4 transition-colors"
        >
          <div className="w-11 h-11 rounded-lg bg-[var(--ios-blue-tint)] border border-[var(--ios-blue-border)] text-ios-cyan flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-ios-label">
              Paste Video Link
            </p>
            <p className="text-xs text-ios-secondary mt-0.5 truncate">
              Direct media URLs & source check
            </p>
          </div>
        </Link>

        {latestProject ? (
          <Link
            to={
              latestProject.status === 'processing' || latestProject.status === 'queued'
                ? `/projects/${latestProject.id}/processing`
                : `/projects/${latestProject.id}/clips`
            }
            className="min-w-0 group rounded-xl bg-ios-surface border border-ios-sep hover:border-ios-orange p-5 flex items-center gap-4 transition-colors"
          >
            <div className="w-11 h-11 rounded-lg bg-[var(--ios-orange-tint)] border border-[var(--ios-orange-border)] text-ios-orange flex items-center justify-center shrink-0">
              <Play className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-ios-label truncate">
                Open Recent Project
              </p>
              <p className="text-xs text-ios-secondary mt-0.5 truncate">
                {latestProject.name}
              </p>
            </div>
          </Link>
        ) : (
          <div className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-ios-tertiary border border-ios-sep text-ios-secondary flex items-center justify-center shrink-0">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-ios-label">
                Open Recent Project
              </p>
              <p className="text-xs text-ios-secondary mt-0.5 truncate">
                No recent projects yet
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Active Processing */}
      {activeProjects.length > 0 && (
        <section aria-label="Active processing jobs" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-ios-label">
              Active Processing
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {activeProjects.map((project) => (
              <div
                key={project.id}
                className="min-w-0 rounded-xl bg-ios-surface border border-[var(--ios-blue-border)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusIndicator status={project.status} />
                    <span className="text-xs text-ios-secondary truncate max-w-full">
                      {project.sourceFilename}
                    </span>
                  </div>
                  <p className="font-display text-base font-bold text-ios-label truncate">
                    {project.name}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link to={`/projects/${project.id}/processing`}>
                    <Button variant="secondary" size="sm">
                      View Pipeline
                    </Button>
                  </Link>
                  {project.activeJobId && (
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<XCircle className="w-3.5 h-3.5" />}
                      loading={cancelJobMutation.isPending}
                      onClick={() =>
                        handleCancelActiveJob(project.activeJobId!, project.name)
                      }
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Lower Grid: Recent Projects + Storage & Onboarding */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <section className="xl:col-span-2 min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-lg font-bold text-ios-label">
              Recent Projects
            </h3>
            <Link
              to="/projects"
              className="text-xs font-medium text-ios-blue hover:underline whitespace-nowrap"
            >
              View All Projects
            </Link>
          </div>

          {projectsQuery.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-44" />
              <Skeleton className="h-44" />
            </div>
          ) : recentProjects.length === 0 ? (
            <EmptyState
              icon={<Scissors className="w-6 h-6" />}
              title="No clipping projects yet"
              description="Upload a long-form video or submit a direct media URL to transcribe speech, score standout moments, and render vertical short clips."
              action={
                <Link to="/projects/new">
                  <Button icon={<Plus className="w-4 h-4" />}>
                    Create First Project
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentProjects.map((project) => (
                <article
                  key={project.id}
                  className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep overflow-hidden flex flex-col justify-between"
                >
                  <div className="aspect-video bg-ios-bg border-b border-ios-sep relative flex items-center justify-center overflow-hidden">
                    {project.thumbnailUrl ? (
                      <img
                        src={project.thumbnailUrl}
                        alt={project.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-ios-secondary px-4 max-w-full">
                        <Film className="w-8 h-8" />
                        <span className="text-xs font-mono truncate max-w-full">
                          {project.sourceFilename}
                        </span>
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[11px] font-mono tabular-nums text-white">
                      {formatDuration(project.durationSec)}
                    </div>
                  </div>

                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between min-w-0">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StatusIndicator status={project.status} />
                        <span className="text-xs text-ios-secondary tabular-nums">
                          {formatDateShort(project.createdAt)}
                        </span>
                      </div>
                      <h4 className="font-display text-sm font-bold text-ios-label line-clamp-1">
                        {project.name}
                      </h4>
                      <p className="text-xs text-ios-secondary tabular-nums truncate">
                        {project.clipCount} clip{project.clipCount === 1 ? '' : 's'}
                        <span aria-hidden="true"> · </span>
                        {project.resolution ?? 'Source pending'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-ios-sep flex items-center justify-end">
                      <Link
                        to={
                          project.status === 'processing' || project.status === 'queued'
                            ? `/projects/${project.id}/processing`
                            : `/projects/${project.id}/clips`
                        }
                      >
                        <Button variant="secondary" size="sm">
                          Open Project
                        </Button>
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Storage Overview & Getting Started */}
        <aside className="min-w-0 space-y-6">
          <div className="rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-ios-label">
                Storage Overview
              </h3>
              <HardDrive className="w-4 h-4 text-ios-blue" aria-hidden="true" />
            </div>

            {storageQuery.isLoading ? (
              <Skeleton className="h-24" />
            ) : storageQuery.data ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ios-secondary">Total Studio Used</span>
                  <span className="font-mono tabular-nums text-ios-label font-medium">
                    {formatBytes(storageQuery.data.totalUsedBytes)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ios-secondary">Project Sources</span>
                  <span className="font-mono tabular-nums text-ios-label">
                    {formatBytes(storageQuery.data.projectStorageBytes)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ios-secondary">Rendered Exports</span>
                  <span className="font-mono tabular-nums text-ios-label">
                    {formatBytes(storageQuery.data.exportStorageBytes)}
                  </span>
                </div>
                <div className="pt-2 border-t border-ios-sep flex items-center justify-between gap-2">
                  <span className="text-ios-secondary">Available Disk Space</span>
                  <span className="font-mono tabular-nums text-ios-green">
                    {formatBytes(storageQuery.data.availableDiskBytes)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ios-secondary">
                Storage telemetry will appear once the local FastAPI backend is reachable.
              </p>
            )}
          </div>

          <MascotAssistant
            message="Getting Started with ClipCat"
            submessage="1. Upload an MP4, MOV, MKV, or WEBM video. 2. Choose 9:16 framing and a caption preset. 3. Review scored clips and export MP4 + SRT files."
          />

          <div className="rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-display font-bold text-ios-label">
              <Clock className="w-4 h-4 text-ios-orange shrink-0" aria-hidden="true" />
              <span>Local-First Workflow</span>
            </div>
            <p className="text-xs text-ios-secondary leading-relaxed">
              Long videos. Short attention. Perfect clips. All transcription, AI moment scoring, and FFmpeg rendering execute locally on your machine via Python FastAPI.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
