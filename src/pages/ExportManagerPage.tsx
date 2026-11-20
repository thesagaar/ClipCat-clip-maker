import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  FileCode2,
  FileText,
  Film,
  FolderOpen,
  Image as ImageIcon,
} from 'lucide-react';
import { trackAnalyticsEvent } from '../analytics/client';
import { batchExportClips, getClipDownloadUrl, resolveClipAssetUrl } from '../api';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { useAllClipsQuery, useSettingsQuery } from '../hooks/useClipCatQueries';
import { useUiStore } from '../stores/uiStore';
import type { Clip } from '../types/clip';
import { openOutputFolder, triggerVerifiedDownload } from '../utils/desktop';
import { formatBytes } from '../utils/format';

export function ExportManagerPage() {
  const clipsQuery = useAllClipsQuery();
  const settingsQuery = useSettingsQuery();
  const { addToast } = useUiStore();
  const [exportingAll, setExportingAll] = useState(false);

  const clips = clipsQuery.data ?? [];
  const exportDir = settingsQuery.data?.storage.exportDirectory ?? '~/ClipCat/exports';

  const handleOpenFolder = async () => {
    const res = await openOutputFolder(exportDir);
    addToast({
      variant: res.supported ? 'info' : 'warning',
      title: res.supported ? 'Output Folder' : 'Desktop Action Required',
      description: res.message,
    });
  };

  const handleDownloadArtifact = async (
    url: string | null | undefined,
    filename: string,
    label: string
  ) => {
    if (!url) {
      addToast({
        variant: 'warning',
        title: `${label} Unavailable`,
        description:
          'This file is not present on the backend yet. Connect FastAPI and render the clip first.',
      });
      return;
    }
    const fullUrl = resolveClipAssetUrl(url);
    const fmt = label.toLowerCase().includes('srt')
      ? 'srt'
      : label.toLowerCase().includes('vtt')
        ? 'vtt'
        : label.toLowerCase().includes('json')
          ? 'json'
          : 'mp4';
    trackAnalyticsEvent('export_started', { exportFormat: fmt, clipCount: 1 });
    const res = await triggerVerifiedDownload(fullUrl, filename);
    if (!res.started) {
      trackAnalyticsEvent('export_failed', { exportFormat: fmt, errorCategory: 'download_failed' });
      addToast({
        variant: 'error',
        title: `${label} Download Failed`,
        description: res.error,
      });
    } else {
      trackAnalyticsEvent('export_completed', { exportFormat: fmt, clipCount: 1 });
      addToast({
        variant: 'success',
        title: `${label} Download Started`,
        description: `Saving ${filename}`,
      });
    }
  };

  const handleDownloadAll = async () => {
    if (clips.length === 0 || exportingAll) return;
    setExportingAll(true);
    trackAnalyticsEvent('export_started', { exportFormat: 'zip', clipCount: clips.length });
    try {
      const resp = await batchExportClips({
        clipIds: clips.map((c) => c.id),
        formats: ['mp4', 'srt', 'vtt', 'json'],
      });
      if (resp.archiveUrl) {
        const res = await triggerVerifiedDownload(
          resolveClipAssetUrl(resp.archiveUrl),
          'clipcat_all_exports.zip'
        );
        if (res.started) {
          trackAnalyticsEvent('export_completed', { exportFormat: 'zip', clipCount: clips.length });
        } else {
          trackAnalyticsEvent('export_failed', { exportFormat: 'zip', errorCategory: 'download_failed' });
        }
      } else {
        addToast({
          variant: 'info',
          title: 'Batch Export Notice',
          description: resp.message,
        });
      }
    } catch (err) {
      trackAnalyticsEvent('export_failed', { exportFormat: 'zip', errorCategory: 'batch_api_error' });
      addToast({
        variant: 'error',
        title: 'Batch Export Failed',
        description: err instanceof Error ? err.message : 'Unable to package exports.',
      });
    } finally {
      setExportingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold text-ios-label">
            Export Manager
          </h2>
          <p className="text-sm text-ios-secondary mt-1">
            Download verified MP4 renders, SRT/VTT subtitle files, metadata JSON, and clip thumbnails.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Button
            variant="secondary"
            icon={<FolderOpen className="w-4 h-4" />}
            onClick={handleOpenFolder}
          >
            Open Output Folder
          </Button>
          <Button
            loading={exportingAll}
            disabled={clips.length === 0}
            icon={<Download className="w-4 h-4" />}
            onClick={handleDownloadAll}
          >
            Download All Clips
          </Button>
        </div>
      </div>

      {clipsQuery.isError && (
        <ErrorState error={clipsQuery.error} onRetry={() => clipsQuery.refetch()} />
      )}

      {clipsQuery.isLoading ? (
        <Skeleton className="h-72" />
      ) : clips.length === 0 ? (
        <EmptyState
          icon={<Download className="w-6 h-6" />}
          title="No exports available yet"
          description="Once a video project finishes rendering clips, all MP4 videos and subtitle sidecar files appear here."
          action={
            <Link to="/projects/new">
              <Button>Create New Project</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Mobile Touch Cards (< md) */}
          <div className="md:hidden space-y-3">
            {clips.map((clip: Clip) => {
              const baseSlug = clip.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
              return (
                <article
                  key={clip.id}
                  className="rounded-xl bg-ios-surface border border-ios-sep p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-12 rounded-lg bg-ios-bg border border-ios-sep flex items-center justify-center overflow-hidden shrink-0">
                      {clip.thumbnailUrl ? (
                        <img
                          src={clip.thumbnailUrl}
                          alt={clip.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Film className="w-4 h-4 text-ios-secondary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-display text-sm font-bold text-ios-label truncate">
                        {clip.title}
                      </p>
                      <p className="text-xs font-mono text-ios-secondary truncate">
                        MP4 · {clip.resolution} ({clip.aspectRatio}) ·{' '}
                        {formatBytes(clip.fileSizeBytes)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <StatusIndicator status={clip.exportStatus} />
                        <span aria-hidden="true" className="text-ios-secondary">·</span>
                        <StatusIndicator status={clip.captionStatus} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-ios-sep">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Download className="w-3.5 h-3.5" />}
                      onClick={() =>
                        handleDownloadArtifact(
                          getClipDownloadUrl(clip),
                          `${baseSlug}.mp4`,
                          'MP4 Video'
                        )
                      }
                    >
                      Download MP4
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<FileText className="w-3.5 h-3.5" />}
                      onClick={() =>
                        handleDownloadArtifact(
                          clip.srtUrl,
                          `${baseSlug}.srt`,
                          'SRT Subtitles'
                        )
                      }
                    >
                      SRT Subtitles
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<FileText className="w-3.5 h-3.5" />}
                      onClick={() =>
                        handleDownloadArtifact(
                          clip.vttUrl,
                          `${baseSlug}.vtt`,
                          'VTT Subtitles'
                        )
                      }
                    >
                      VTT Subtitles
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<FileCode2 className="w-3.5 h-3.5" />}
                      onClick={() =>
                        handleDownloadArtifact(
                          clip.metadataUrl,
                          `${baseSlug}.json`,
                          'Metadata JSON'
                        )
                      }
                    >
                      Metadata JSON
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Desktop & Tablet Export Table (>= md) */}
          <div className="hidden md:block w-full min-w-0 rounded-xl bg-ios-surface border border-ios-sep overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ios-sep text-xs text-ios-secondary">
                <tr>
                  <th className="py-3 px-4 font-medium">Clip</th>
                  <th className="py-3 px-4 font-medium">Format</th>
                  <th className="hidden lg:table-cell py-3 px-4 font-medium">Resolution</th>
                  <th className="py-3 px-4 font-medium">File Size</th>
                  <th className="py-3 px-4 font-medium">Export Status</th>
                  <th className="py-3 px-4 font-medium text-right">Export Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ios-sep">
                {clips.map((clip: Clip) => {
                  const baseSlug = clip.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                  return (
                    <tr key={clip.id} className="hover:bg-ios-tertiary/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 h-9 rounded bg-ios-bg border border-ios-sep flex items-center justify-center overflow-hidden shrink-0">
                            {clip.thumbnailUrl ? (
                              <img
                                src={clip.thumbnailUrl}
                                alt={clip.title}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Film className="w-4 h-4 text-ios-secondary" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-ios-label truncate max-w-[240px]">
                              {clip.title}
                            </p>
                            <p className="text-xs font-mono text-ios-secondary truncate max-w-[240px]">
                              {baseSlug}.mp4
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-ios-label">
                        MP4 · H.264
                      </td>
                      <td className="hidden lg:table-cell py-3 px-4 text-xs font-mono text-ios-secondary">
                        {clip.resolution} ({clip.aspectRatio})
                      </td>
                      <td className="py-3 px-4 text-xs font-mono tabular-nums text-ios-label">
                        {formatBytes(clip.fileSizeBytes)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusIndicator status={clip.exportStatus} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Download className="w-3.5 h-3.5" />}
                            onClick={() =>
                              handleDownloadArtifact(
                                getClipDownloadUrl(clip),
                                `${baseSlug}.mp4`,
                                'MP4 Video'
                              )
                            }
                          >
                            MP4
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<FileText className="w-3.5 h-3.5" />}
                            onClick={() =>
                              handleDownloadArtifact(
                                clip.srtUrl,
                                `${baseSlug}.srt`,
                                'SRT Subtitles'
                              )
                            }
                          >
                            SRT
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<FileText className="w-3.5 h-3.5" />}
                            onClick={() =>
                              handleDownloadArtifact(
                                clip.vttUrl,
                                `${baseSlug}.vtt`,
                                'VTT Subtitles'
                              )
                            }
                          >
                            VTT
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Export JSON metadata for ${clip.title}`}
                            title="Export Metadata JSON"
                            icon={<FileCode2 className="w-3.5 h-3.5" />}
                            onClick={() =>
                              handleDownloadArtifact(
                                clip.metadataUrl,
                                `${baseSlug}.json`,
                                'Metadata JSON'
                              )
                            }
                          >
                            JSON
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Export thumbnail for ${clip.title}`}
                            title="Export Thumbnail"
                            icon={<ImageIcon className="w-3.5 h-3.5" />}
                            onClick={() =>
                              handleDownloadArtifact(
                                clip.thumbnailUrl,
                                `${baseSlug}.jpg`,
                                'Thumbnail'
                              )
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
