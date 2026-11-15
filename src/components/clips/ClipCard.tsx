import { Link } from 'react-router-dom';
import {
  CheckSquare,
  Download,
  Edit3,
  Film,
  Play,
  RefreshCw,
  Square,
  Trash2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { StatusIndicator } from '../ui/StatusIndicator';
import type { Clip } from '../../types/clip';
import { formatDuration } from '../../utils/format';

interface ClipCardProps {
  clip: Clip;
  selected: boolean;
  onToggleSelect: (clipId: string) => void;
  onDownload: (clip: Clip) => void;
  onRerender: (clip: Clip) => void;
  onDeleteRequest: (clip: Clip) => void;
  rerendering?: boolean;
}

export function ClipCard({
  clip,
  selected,
  onToggleSelect,
  onDownload,
  onRerender,
  onDeleteRequest,
  rerendering = false,
}: ClipCardProps) {
  return (
    <article className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep overflow-hidden flex flex-col justify-between">
      {/* Thumbnail Preview */}
      <div className="relative aspect-[16/10] bg-ios-bg border-b border-ios-sep flex items-center justify-center overflow-hidden">
        {clip.thumbnailUrl ? (
          <img
            src={clip.thumbnailUrl}
            alt={clip.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-ios-secondary px-3 text-center">
            <Film className="w-8 h-8" />
            <span className="text-[11px] font-mono">
              {clip.aspectRatio} · {clip.resolution}
            </span>
          </div>
        )}

        {/* Batch selection checkbox */}
        <button
          type="button"
          onClick={() => onToggleSelect(clip.id)}
          aria-label={selected ? `Deselect ${clip.title}` : `Select ${clip.title}`}
          aria-pressed={selected}
          className="absolute top-2.5 left-2.5 p-1.5 rounded-lg bg-black/75 backdrop-blur-md border border-white/15 text-white hover:border-ios-blue cursor-pointer"
        >
          {selected ? (
            <CheckSquare className="w-4 h-4 text-ios-blue" />
          ) : (
            <Square className="w-4 h-4 text-white/80" />
          )}
        </button>

        {/* Center Play / Preview CTA */}
        <Link
          to={`/clips/${clip.id}/edit`}
          aria-label={`Preview ${clip.title}`}
          className="w-11 h-11 rounded-full bg-black/75 backdrop-blur-md border border-white/20 hover:border-ios-blue text-white flex items-center justify-center transition-colors"
        >
          <Play className="w-4 h-4 ml-0.5" />
        </Link>

        {/* Duration & AI Score overlays */}
        <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[11px] font-mono tabular-nums text-white">
          {formatDuration(clip.durationSec)}
        </div>
        <div
          className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[11px] font-mono tabular-nums text-[#64D2FF]"
          title={clip.scoringBreakdown.summary}
        >
          Score {clip.aiScore}/100
        </div>
      </div>

      {/* Metadata & Description */}
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between min-w-0">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ios-secondary font-mono tabular-nums">
            <span>
              {formatDuration(clip.startSec)} – {formatDuration(clip.endSec)}
            </span>
            <StatusIndicator status={clip.status} />
          </div>

          <h3 className="font-display text-sm font-bold text-ios-label line-clamp-2">
            {clip.title}
          </h3>

          <p className="text-xs text-ios-secondary line-clamp-2 leading-relaxed">
            {clip.description}
          </p>

          {/* Unboxed metadata row (zero-pill discipline) */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ios-secondary pt-1">
            <StatusIndicator status={clip.captionStatus} />
            <span aria-hidden="true">·</span>
            <StatusIndicator status={clip.exportStatus} />
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-ios-sep flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link to={`/clips/${clip.id}/edit`}>
              <Button variant="secondary" size="sm" icon={<Edit3 className="w-3.5 h-3.5" />}>
                Edit
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={() => onDownload(clip)}
            >
              Download
            </Button>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              loading={rerendering}
              aria-label={`Re-render ${clip.title}`}
              title="Re-render clip"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => onRerender(clip)}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Delete ${clip.title}`}
              title="Delete clip"
              icon={<Trash2 className="w-3.5 h-3.5 text-ios-red" />}
              onClick={() => onDeleteRequest(clip)}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
