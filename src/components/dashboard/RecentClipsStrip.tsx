import { Link } from 'react-router-dom';
import { Film, Play, Scissors } from 'lucide-react';
import type { Clip } from '../../types/clip';
import { cn } from '../../utils/cn';
import { formatDuration } from '../../utils/format';
import { Skeleton } from '../ui/Skeleton';
import { getRecentCompletedClips } from './dashboardWidgetUtils';

interface RecentClipsStripProps {
  clips: readonly Clip[];
  isLoading?: boolean;
  isError?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Horizontal scrollable strip displaying up to the 5 most recently finished clips
 * with aspect thumbnails, duration overlay, and direct preview/edit links.
 */
export function RecentClipsStrip({
  clips,
  isLoading = false,
  isError = false,
  compact = false,
  className,
}: RecentClipsStripProps) {
  const recentClips = getRecentCompletedClips(clips, 5);

  return (
    <section
      aria-label="Recent finished clips"
      data-testid="recent-clips-section"
      className={cn('space-y-3 min-w-0', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3
            className={cn(
              'font-display font-bold text-ios-label',
              compact ? 'text-base' : 'text-lg'
            )}
          >
            Recent Clips
          </h3>
          {!compact && (
            <p className="text-xs text-ios-secondary">
              Latest 5 finished clips ready to preview, caption, or export
            </p>
          )}
        </div>
        <Link
          to="/clips"
          className="text-xs font-medium text-ios-blue hover:underline whitespace-nowrap shrink-0"
        >
          View Clip Library
        </Link>
      </div>

      {isLoading ? (
        <div className="flex gap-3.5 overflow-x-auto pb-2 no-scrollbar">
          {[0, 1, 2].map((idx) => (
            <Skeleton
              key={idx}
              className="w-[210px] sm:w-[232px] h-[200px] shrink-0 rounded-xl"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl bg-ios-surface border border-ios-sep p-4 text-xs text-ios-secondary">
          Recent finished clips will appear once the FastAPI backend is reachable or sample preview data is loaded.
        </div>
      ) : recentClips.length === 0 ? (
        <div className="rounded-xl bg-ios-surface border border-ios-sep p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[rgba(112,64,220,0.14)] border border-[rgba(112,64,220,0.35)] text-[#C8B9F1] flex items-center justify-center shrink-0">
              <Scissors className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ios-label">
                No finished clips yet
              </p>
              <p className="text-xs text-ios-secondary">
                Create or quick-import a project to see your latest finished clips here.
              </p>
            </div>
          </div>
          <Link
            to="/projects/new"
            className="text-xs font-semibold text-ios-blue hover:underline whitespace-nowrap shrink-0"
          >
            Create New Project
          </Link>
        </div>
      ) : (
        <div
          className="flex gap-3.5 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
          role="list"
          aria-label="5 most recently finished clips"
        >
          {recentClips.map((clip) => (
            <Link
              key={clip.id}
              role="listitem"
              to={`/clips/${clip.id}/edit`}
              data-testid="recent-clip-card"
              className="group w-[210px] sm:w-[232px] shrink-0 snap-start rounded-xl bg-ios-surface border border-ios-sep hover:border-ios-blue transition-colors overflow-hidden flex flex-col"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-ios-bg border-b border-ios-sep relative flex items-center justify-center overflow-hidden">
                {clip.thumbnailUrl ? (
                  <img
                    src={clip.thumbnailUrl}
                    alt={clip.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-ios-secondary px-3 text-center">
                    <Film className="w-6 h-6" aria-hidden="true" />
                    <span className="text-[11px] font-mono">
                      {clip.aspectRatio} · {clip.resolution}
                    </span>
                  </div>
                )}

                <span className="w-9 h-9 rounded-full bg-black/70 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center opacity-90 group-hover:opacity-100 group-hover:border-ios-blue transition-all">
                  <Play className="w-3.5 h-3.5 ml-0.5" aria-hidden="true" />
                </span>

                <span
                  data-testid="recent-clip-duration"
                  className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[11px] font-mono tabular-nums text-white"
                >
                  {formatDuration(clip.durationSec)}
                </span>
              </div>

              {/* Card Body */}
              <div className="p-3 space-y-1 min-w-0">
                <p className="font-display text-xs sm:text-sm font-bold text-ios-label line-clamp-1">
                  {clip.title}
                </p>
                <div className="flex items-center justify-between gap-2 text-[11px] text-ios-secondary">
                  <span className="truncate">
                    {clip.projectName ?? 'ClipCat Studio'}
                  </span>
                  <span className="font-mono tabular-nums shrink-0 text-[#64D2FF]">
                    {clip.aiScore}/100
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
