import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Film, Info, Plus } from 'lucide-react';
import { batchExportClips, getClipDownloadUrl } from '../api';
import { ClipCard } from '../components/clips/ClipCard';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { ConfirmDialog } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import {
  useDeleteClipMutation,
  useProjectClipsQuery,
  useProjectQuery,
  useRenderClipMutation,
} from '../hooks/useClipCatQueries';
import { useUiStore } from '../stores/uiStore';
import type { Clip } from '../types/clip';
import { triggerVerifiedDownload } from '../utils/desktop';
import {
  calculateClipSummary,
  filterAndSortClips,
  type ClipFilterOption,
  type ClipSortOption,
} from '../utils/filters';
import { formatDuration, formatElapsedVerbose } from '../utils/format';

export function ClipDiscoveryPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const projectQuery = useProjectQuery(projectId);
  const clipsQuery = useProjectClipsQuery(projectId);
  const renderMutation = useRenderClipMutation();
  const deleteMutation = useDeleteClipMutation();
  const { addToast } = useUiStore();

  const [sortBy, setSortBy] = useState<ClipSortOption>('highest_score');
  const [statusFilter, setStatusFilter] = useState<ClipFilterOption>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clipToDelete, setClipToDelete] = useState<Clip | null>(null);
  const [rerenderingId, setRerenderingId] = useState<string | null>(null);
  const [batchExporting, setBatchExporting] = useState(false);

  const clips = clipsQuery.data ?? [];
  const summary = useMemo(() => calculateClipSummary(clips), [clips]);
  const visibleClips = useMemo(
    () =>
      filterAndSortClips(clips, {
        statusFilter,
        sortBy,
      }),
    [clips, statusFilter, sortBy]
  );

  const toggleSelect = (clipId: string) => {
    setSelectedIds((prev) =>
      prev.includes(clipId) ? prev.filter((id) => id !== clipId) : [...prev, clipId]
    );
  };

  const handleDownload = async (clip: Clip) => {
    const url = getClipDownloadUrl(clip);
    if (!url) {
      addToast({
        variant: 'warning',
        title: 'Export Not Available Yet',
        description:
          'No backend download URL exists in this mode. Connect FastAPI to download rendered MP4 files.',
      });
      return;
    }
    const res = await triggerVerifiedDownload(url, `${clip.title.replace(/\s+/g, '_')}.mp4`);
    if (!res.started) {
      addToast({
        variant: 'error',
        title: 'Download Failed',
        description: res.error,
      });
    }
  };

  const handleRerender = async (clip: Clip) => {
    setRerenderingId(clip.id);
    try {
      await renderMutation.mutateAsync({
        clipId: clip.id,
        payload: {
          startSec: clip.startSec,
          endSec: clip.endSec,
          aspectRatio: clip.aspectRatio,
          layoutMode: clip.layoutMode,
          resolution: clip.resolution,
          captionSettings: clip.captionSettings,
        },
      });
      addToast({
        variant: 'success',
        title: 'Clip Re-rendered',
        description: `"${clip.title}" updated.`,
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Re-render Failed',
        description: err instanceof Error ? err.message : 'Unable to trigger re-render.',
      });
    } finally {
      setRerenderingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!clipToDelete) return;
    try {
      await deleteMutation.mutateAsync(clipToDelete.id);
      setSelectedIds((prev) => prev.filter((id) => id !== clipToDelete.id));
      addToast({
        variant: 'info',
        title: 'Clip Deleted',
        description: `"${clipToDelete.title}" was removed.`,
      });
      setClipToDelete(null);
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'Could not delete clip.',
      });
    }
  };

  const handleBatchExport = async () => {
    if (selectedIds.length === 0) return;
    setBatchExporting(true);
    try {
      const resp = await batchExportClips({
        clipIds: selectedIds,
        formats: ['mp4', 'srt'],
      });
      if (resp.archiveUrl) {
        await triggerVerifiedDownload(resp.archiveUrl, 'clipcat_export_bundle.zip');
      } else {
        addToast({
          variant: 'info',
          title: 'Batch Export Notice',
          description: resp.message,
        });
      }
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Batch Export Failed',
        description: err instanceof Error ? err.message : 'Could not export selected clips.',
      });
    } finally {
      setBatchExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold text-ios-label">
              Your Clips Are Ready!
            </h2>
            <p className="text-sm text-ios-secondary mt-1 truncate">
              {projectQuery.data?.name ?? 'Generated short-form clip candidates'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link to="/exports">
              <Button variant="secondary" icon={<Download className="w-4 h-4" />}>
                Export Manager
              </Button>
            </Link>
            <Link to="/projects/new">
              <Button icon={<Plus className="w-4 h-4" />}>New Project</Button>
            </Link>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-ios-sep">
          <div className="min-w-0">
            <p className="text-xs text-ios-secondary">Total Clips</p>
            <p className="font-display text-xl font-bold text-ios-label tabular-nums mt-0.5">
              {summary.totalClips}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-ios-secondary">Average Duration</p>
            <p className="font-display text-xl font-bold text-ios-label tabular-nums mt-0.5">
              {formatDuration(summary.averageDurationSec)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-ios-secondary">Best-Scoring Clip</p>
            <p className="font-display text-xl font-bold text-ios-blue tabular-nums mt-0.5">
              {summary.bestScoringClip ? `${summary.bestScoringClip.aiScore}/100` : '—'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-ios-secondary">Processing Time</p>
            <p className="font-display text-xl font-bold text-ios-label tabular-nums mt-0.5">
              {projectQuery.data?.processingDurationSec
                ? formatElapsedVerbose(projectQuery.data.processingDurationSec)
                : '—'}
            </p>
          </div>
        </div>

        <p className="text-xs text-ios-secondary flex items-start sm:items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-ios-blue shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
          <span>
            AI scores reflect transcript hook clarity, completeness, and pacing—they are guidance metrics and do not guarantee social media virality.
          </span>
        </p>
      </section>

      {clipsQuery.isError && (
        <ErrorState error={clipsQuery.error} onRetry={() => clipsQuery.refetch()} />
      )}

      {/* Filter, Sort & Batch Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div
          role="group"
          aria-label="Filter clips by status"
          className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-ios-surface border border-ios-sep w-full sm:w-auto max-w-full"
        >
          {(
            [
              { value: 'all', label: 'All' },
              { value: 'completed', label: 'Completed' },
              { value: 'needs_attention', label: 'Needs Attention' },
              { value: 'failed', label: 'Failed' },
            ] as Array<{ value: ClipFilterOption; label: string }>
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === tab.value
                  ? 'bg-ios-blue-fill text-white'
                  : 'text-ios-secondary hover:text-ios-label'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {selectedIds.length > 0 && (
            <Button
              variant="accent-warm"
              size="sm"
              loading={batchExporting}
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleBatchExport}
            >
              Export Selected ({selectedIds.length})
            </Button>
          )}
          <div className="w-full sm:w-48">
            <Select
              aria-label="Sort clips"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ClipSortOption)}
              options={[
                { value: 'highest_score', label: 'Sort: Highest AI Score' },
                { value: 'shortest', label: 'Sort: Shortest Duration' },
                { value: 'longest', label: 'Sort: Longest Duration' },
                { value: 'newest', label: 'Sort: Newest' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Clip Grid */}
      {clipsQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : visibleClips.length === 0 ? (
        <EmptyState
          icon={<Film className="w-6 h-6" />}
          title="No clips match this view"
          description="Either processing has not produced clips yet, or no clips match the selected filter."
          action={
            statusFilter !== 'all' ? (
              <Button variant="secondary" onClick={() => setStatusFilter('all')}>
                Clear Filter
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {visibleClips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              selected={selectedIds.includes(clip.id)}
              onToggleSelect={toggleSelect}
              onDownload={handleDownload}
              onRerender={handleRerender}
              onDeleteRequest={setClipToDelete}
              rerendering={rerenderingId === clip.id}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(clipToDelete)}
        onClose={() => setClipToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Clip"
        message={`Are you sure you want to delete "${clipToDelete?.title}"? This removes the rendered clip and metadata from the backend.`}
        confirmLabel="Delete Clip"
        danger
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
