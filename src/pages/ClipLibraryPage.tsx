import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Film, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { batchExportClips, getClipDownloadUrl } from '../api';
import { ClipCard } from '../components/clips/ClipCard';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { ConfirmDialog } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import {
  useAllClipsQuery,
  useDeleteClipMutation,
  useRenderClipMutation,
} from '../hooks/useClipCatQueries';
import { useUiStore } from '../stores/uiStore';
import type { Clip } from '../types/clip';
import { triggerVerifiedDownload } from '../utils/desktop';
import {
  filterAndSortClips,
  type ClipFilterOption,
  type ClipSortOption,
} from '../utils/filters';

export function ClipLibraryPage() {
  const clipsQuery = useAllClipsQuery();
  const renderMutation = useRenderClipMutation();
  const deleteMutation = useDeleteClipMutation();
  const { addToast } = useUiStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClipFilterOption>('all');
  const [sortBy, setSortBy] = useState<ClipSortOption>('highest_score');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clipToDelete, setClipToDelete] = useState<Clip | null>(null);
  const [rerenderingId, setRerenderingId] = useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const clips = clipsQuery.data ?? [];
  const filteredClips = useMemo(
    () =>
      filterAndSortClips(clips, {
        searchQuery,
        statusFilter,
        sortBy,
      }),
    [clips, searchQuery, statusFilter, sortBy]
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
        title: 'Export Unavailable',
        description: 'Connect the FastAPI backend to download rendered MP4 files.',
      });
      return;
    }
    const res = await triggerVerifiedDownload(url, `${clip.title.replace(/\s+/g, '_')}.mp4`);
    if (!res.started) {
      addToast({ variant: 'error', title: 'Download Failed', description: res.error });
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
      addToast({ variant: 'success', title: 'Clip Re-rendered', description: clip.title });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Re-render Failed',
        description: err instanceof Error ? err.message : 'Unable to re-render clip.',
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
      setClipToDelete(null);
      addToast({ variant: 'info', title: 'Clip Deleted', description: clipToDelete.title });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'Failed to delete clip.',
      });
    }
  };

  const handleBatchExport = async () => {
    if (selectedIds.length === 0) return;
    try {
      const resp = await batchExportClips({ clipIds: selectedIds, formats: ['mp4', 'srt'] });
      if (resp.archiveUrl) {
        await triggerVerifiedDownload(resp.archiveUrl, 'clipcat_clips.zip');
      } else {
        addToast({ variant: 'info', title: 'Batch Export', description: resp.message });
      }
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Batch Export Failed',
        description: err instanceof Error ? err.message : 'Failed to export clips.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold text-ios-label">
            Generated Clip Library
          </h2>
          <p className="text-sm text-ios-secondary mt-1">
            Browse, edit, score-check, and export clips across all projects.
          </p>
        </div>
        <Link to="/projects/new" className="shrink-0">
          <Button icon={<Plus className="w-4 h-4" />}>New Project</Button>
        </Link>
      </div>

      {clipsQuery.isError && (
        <ErrorState error={clipsQuery.error} onRetry={() => clipsQuery.refetch()} />
      )}

      {/* Search & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative w-full min-w-0 lg:flex-1 lg:max-w-md">
          <Search
            className="w-4 h-4 text-ios-tertiary-label absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search generated clips"
            placeholder="Search clips"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-lg bg-ios-surface border border-ios-sep pl-9 pr-3 text-sm text-ios-label placeholder:text-ios-tertiary-label focus:border-ios-blue focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {selectedIds.length > 0 && (
            <Button
              variant="accent-warm"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleBatchExport}
            >
              Export Selected ({selectedIds.length})
            </Button>
          )}

          {/* Mobile BottomSheet Trigger */}
          <Button
            variant="secondary"
            size="sm"
            className="sm:hidden"
            icon={<SlidersHorizontal className="w-4 h-4" />}
            onClick={() => setFilterSheetOpen(true)}
          >
            Filter &amp; Sort
          </Button>

          <div className="hidden sm:block w-44">
            <Select
              aria-label="Filter clips by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ClipFilterOption)}
              options={[
                { value: 'all', label: 'Status: All' },
                { value: 'completed', label: 'Completed' },
                { value: 'needs_attention', label: 'Needs Attention' },
                { value: 'failed', label: 'Failed' },
              ]}
            />
          </div>

          <div className="hidden sm:block w-48">
            <Select
              aria-label="Sort clips"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ClipSortOption)}
              options={[
                { value: 'highest_score', label: 'Sort: Highest Score' },
                { value: 'newest', label: 'Sort: Newest' },
                { value: 'shortest', label: 'Sort: Shortest' },
                { value: 'longest', label: 'Sort: Longest' },
              ]}
            />
          </div>
        </div>
      </div>

      {clipsQuery.isLoading ? (
        <div className="grid grid-cols-1 min-[410px]:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : filteredClips.length === 0 ? (
        <EmptyState
          icon={<Film className="w-6 h-6" />}
          title="No generated clips found"
          description="Create a project and run the clipping pipeline to populate your Clip Library."
          action={
            <Link to="/projects/new">
              <Button icon={<Plus className="w-4 h-4" />}>Create New Project</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 min-[410px]:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filteredClips.map((clip) => (
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

      <BottomSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Filter & Sort Clips"
        description="Narrow or order generated clips."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setStatusFilter('all');
                setSortBy('highest_score');
                setFilterSheetOpen(false);
              }}
            >
              Reset
            </Button>
            <Button onClick={() => setFilterSheetOpen(false)}>Done</Button>
          </>
        }
      >
        <Select
          label="Clip Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ClipFilterOption)}
          options={[
            { value: 'all', label: 'All Clips' },
            { value: 'completed', label: 'Completed' },
            { value: 'needs_attention', label: 'Needs Attention' },
            { value: 'failed', label: 'Failed' },
          ]}
        />
        <Select
          label="Sort Order"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as ClipSortOption)}
          options={[
            { value: 'highest_score', label: 'Highest AI Score' },
            { value: 'newest', label: 'Newest First' },
            { value: 'shortest', label: 'Shortest Duration' },
            { value: 'longest', label: 'Longest Duration' },
          ]}
        />
      </BottomSheet>

      <ConfirmDialog
        open={Boolean(clipToDelete)}
        onClose={() => setClipToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Clip"
        message={`Delete "${clipToDelete?.title}" permanently?`}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
