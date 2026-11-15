import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  Download,
  Film,
  FolderKanban,
  HardDrive,
  Link2,
  Plus,
  Scissors,
  Upload,
  XCircle,
} from 'lucide-react';
import { BrandHeader } from '../components/brand/BrandHeader';
import { PullToRefresh } from '../components/mobile/PullToRefresh';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { BRAND } from '../config/brand';
import {
  useAllClipsQuery,
  useCancelJobMutation,
  useProjectsQuery,
  useSystemStorageQuery,
} from '../hooks/useClipCatQueries';
import { useUiStore } from '../stores/uiStore';
import { formatBytes, formatDateShort, formatDuration } from '../utils/format';

function getWarmGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Dedicated mobile dashboard rendered for viewports below 640px (sm:hidden).
 * Prioritizes project creation while keeping recent activity, active jobs,
 * and storage overview compact and touch-friendly.
 */
export function MobileDashboardPage() {
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
    .slice(0, 4);
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

  const handlePullRefresh = async () => {
    await Promise.all([
      projectsQuery.refetch(),
      clipsQuery.refetch(),
      storageQuery.refetch(),
    ]);
  };

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
      <div className="space-y-5">
        {/* Warm Greeting + Official Two-Row Mobile Brand Header */}
        <section className="rounded-2xl bg-ios-surface border border-ios-sep p-4 space-y-3.5">
          <BrandHeader
            size="sm"
            eyebrow={getWarmGreeting()}
            title={`Welcome to ${BRAND.productName}`}
          />

          <p className="text-xs text-ios-secondary leading-snug">
            {BRAND.productTagline}
          </p>

          {/* Prioritized Primary Create Action */}
          <Link to="/projects/new" className="block pt-0.5">
            <Button
              variant="accent-purple"
              size="lg"
              className="w-full shadow-md"
              icon={<Plus className="w-5 h-5" />}
            >
              New Project
            </Button>
          </Link>
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

      {/* Compact Grid of Actionable Cards: Creation Flow & Recent Activity */}
      <section aria-label="Quick creation and activity" className="grid grid-cols-2 gap-3">
        <Link
          to="/projects/new?mode=upload"
          className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep active:scale-[0.98] transition-all p-3.5 flex flex-col justify-between gap-2.5 min-h-[104px]"
        >
          <div className="w-9 h-9 rounded-lg bg-[#5856D6]/15 border border-[#5856D6]/35 text-[#AF52DE] flex items-center justify-center">
            <Upload className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-ios-label truncate">
              Upload Video
            </p>
            <p className="text-[11px] text-ios-secondary truncate">
              MP4, MOV, MKV, WEBM
            </p>
          </div>
        </Link>

        <Link
          to="/projects/new?mode=url"
          className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep active:scale-[0.98] transition-all p-3.5 flex flex-col justify-between gap-2.5 min-h-[104px]"
        >
          <div className="w-9 h-9 rounded-lg bg-[var(--ios-blue-tint)] border border-[var(--ios-blue-border)] text-ios-cyan flex items-center justify-center">
            <Link2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-ios-label truncate">
              Paste Video URL
            </p>
            <p className="text-[11px] text-ios-secondary truncate">
              Direct link import
            </p>
          </div>
        </Link>

        <Link
          to={
            latestProject
              ? latestProject.status === 'processing' || latestProject.status === 'queued'
                ? `/projects/${latestProject.id}/processing`
                : `/projects/${latestProject.id}/clips`
              : '/projects'
          }
          className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep active:scale-[0.98] transition-all p-3.5 flex flex-col justify-between gap-2.5 min-h-[104px]"
        >
          <div className="w-9 h-9 rounded-lg bg-[var(--ios-orange-tint)] border border-[var(--ios-orange-border)] text-ios-orange flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-ios-label truncate">
              Recent Activity
            </p>
            <p className="text-[11px] text-ios-secondary truncate">
              {latestProject ? latestProject.name : 'View all projects'}
            </p>
          </div>
        </Link>

        <Link
          to="/exports"
          className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep active:scale-[0.98] transition-all p-3.5 flex flex-col justify-between gap-2.5 min-h-[104px]"
        >
          <div className="w-9 h-9 rounded-lg bg-[var(--ios-green-tint)] border border-[var(--ios-green-border)] text-ios-green flex items-center justify-center">
            <Download className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-ios-label truncate">
              Exports Ready
            </p>
            <p className="text-[11px] text-ios-secondary truncate">
              MP4 &amp; SRT files
            </p>
          </div>
        </Link>
      </section>

      {/* Focused Mobile Metrics */}
      <section aria-label="Compact workspace statistics" className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-ios-surface border border-ios-sep p-3.5 space-y-0.5">
          <p className="text-[11px] font-medium text-ios-secondary truncate">
            Projects Processed
          </p>
          {projectsQuery.isLoading ? (
            <Skeleton className="h-7 w-14 mt-1" />
          ) : (
            <p className="font-display text-xl font-bold text-ios-label tabular-nums">
              {projectsQuery.isError ? '—' : completedProjects.length}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-ios-surface border border-ios-sep p-3.5 space-y-0.5">
          <p className="text-[11px] font-medium text-ios-secondary truncate">
            Clips Generated
          </p>
          {clipsQuery.isLoading ? (
            <Skeleton className="h-7 w-14 mt-1" />
          ) : (
            <p className="font-display text-xl font-bold text-ios-label tabular-nums">
              {clipsQuery.isError ? '—' : clips.length}
            </p>
          )}
        </div>
      </section>

      {/* Active Jobs */}
      {activeProjects.length > 0 && (
        <section aria-label="Active processing jobs" className="space-y-2.5">
          <h3 className="font-display text-base font-bold text-ios-label">
            Active Jobs
          </h3>
          <div className="space-y-2.5">
            {activeProjects.map((project) => (
              <div
                key={project.id}
                className="rounded-xl bg-ios-surface border border-[var(--ios-blue-border)] p-3.5 space-y-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <StatusIndicator status={project.status} />
                    <span className="text-[11px] font-mono text-ios-secondary truncate">
                      {project.sourceFilename}
                    </span>
                  </div>
                  <p className="font-display text-sm font-bold text-ios-label truncate">
                    {project.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={`/projects/${project.id}/processing`} className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full">
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

      {/* Recent Projects */}
      <section aria-label="Recent projects" className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ios-label">
            Recent Projects
          </h3>
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-xs font-medium text-ios-blue min-h-[44px] px-1"
          >
            <span>All Projects</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {projectsQuery.isLoading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : recentProjects.length === 0 ? (
          <EmptyState
            icon={<Scissors className="w-5 h-5" />}
            title="No clipping projects yet"
            description="Tap New Project above to upload a video and generate short clips."
          />
        ) : (
          <div className="space-y-2.5">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                to={
                  project.status === 'processing' || project.status === 'queued'
                    ? `/projects/${project.id}/processing`
                    : `/projects/${project.id}/clips`
                }
                className="flex items-center gap-3 rounded-xl bg-ios-surface border border-ios-sep p-3 active:scale-[0.99] transition-transform"
              >
                <div className="w-16 h-12 rounded-lg bg-ios-bg border border-ios-sep flex items-center justify-center overflow-hidden shrink-0">
                  {project.thumbnailUrl ? (
                    <img
                      src={project.thumbnailUrl}
                      alt={project.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Film className="w-5 h-5 text-ios-secondary" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <StatusIndicator status={project.status} />
                    <span className="text-[11px] font-mono text-ios-secondary tabular-nums">
                      {formatDuration(project.durationSec)}
                    </span>
                  </div>
                  <p className="font-display text-sm font-bold text-ios-label truncate">
                    {project.name}
                  </p>
                  <p className="text-[11px] text-ios-secondary truncate tabular-nums">
                    {project.clipCount} clip{project.clipCount === 1 ? '' : 's'} ·{' '}
                    {formatDateShort(project.createdAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Compact Storage Card */}
      <section className="rounded-xl bg-ios-surface border border-ios-sep p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-ios-blue" aria-hidden="true" />
            <h3 className="font-display text-sm font-bold text-ios-label">
              Studio Storage
            </h3>
          </div>
          <Link to="/settings" className="text-xs text-ios-blue font-medium">
            Manage
          </Link>
        </div>
        {storageQuery.isLoading ? (
          <Skeleton className="h-10" />
        ) : storageQuery.data ? (
          <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div>
              <p className="text-[11px] text-ios-secondary">ClipCat Used</p>
              <p className="font-mono font-semibold text-ios-label tabular-nums">
                {formatBytes(storageQuery.data.totalUsedBytes)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-ios-secondary">Disk Free</p>
              <p className="font-mono font-semibold text-ios-green tabular-nums">
                {formatBytes(storageQuery.data.availableDiskBytes)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-ios-secondary">
            Connect FastAPI to inspect local studio storage usage.
          </p>
        )}
      </section>
      </div>
    </PullToRefresh>
  );
}
