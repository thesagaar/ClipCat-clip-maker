import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Scissors,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import { isQuickStartVisible, markQuickStartDismissed } from './dashboardWidgetUtils';

interface QuickStartStep {
  id: string;
  stepNumber: number;
  title: string;
  summary: string;
  tip: string;
  icon: typeof Upload;
  accentClass: string;
  actionLabel?: string;
  actionTo?: string;
}

const QUICK_START_STEPS: readonly QuickStartStep[] = [
  {
    id: 'source',
    stepNumber: 1,
    title: 'Add a Long-Form Video or URL',
    summary:
      'Upload an MP4, MOV, MKV, or WEBM file from disk, or paste a direct downloadable video URL via Quick Import.',
    tip: 'Source media stays between your browser and your configured FastAPI engine.',
    icon: Upload,
    accentClass: 'bg-[var(--ios-blue-tint)] border-[var(--ios-blue-border)] text-ios-blue',
    actionLabel: 'New Project',
    actionTo: '/projects/new',
  },
  {
    id: 'ai-pipeline',
    stepNumber: 2,
    title: 'Local Transcription & Moment Scoring',
    summary:
      'Whisper transcribes spoken audio while ClipCat scores high-retention hooks and standalone moments automatically.',
    tip: 'Monitor every stage live on the Processing pipeline view and cancel anytime.',
    icon: Sparkles,
    accentClass: 'bg-[rgba(112,64,220,0.16)] border-[rgba(112,64,220,0.4)] text-[#C8B9F1]',
  },
  {
    id: 'frame-captions',
    stepNumber: 3,
    title: 'Smart 9:16 Framing & Captions',
    summary:
      'Refine start/end trim points, pick smart face tracking or split-screen framing, and customize burned-in captions.',
    tip: 'Save reusable styles under Caption Presets for instant consistency.',
    icon: Scissors,
    accentClass: 'bg-[var(--ios-orange-tint)] border-[var(--ios-orange-border)] text-ios-orange',
    actionLabel: 'Browse Presets',
    actionTo: '/presets',
  },
  {
    id: 'export',
    stepNumber: 4,
    title: 'Export Clips, Subtitles & Bundles',
    summary:
      'Download individual MP4 clips, SRT/VTT subtitle sidecars, or batch-export finished projects in Export Manager.',
    tip: 'All generated clips appear right inside Clip Library and Recent Clips.',
    icon: Download,
    accentClass: 'bg-[var(--ios-green-tint)] border-[var(--ios-green-border)] text-ios-green',
    actionLabel: 'Start First Project',
    actionTo: '/projects/new',
  },
];

interface QuickStartCarouselProps {
  compact?: boolean;
  className?: string;
}

/**
 * First-time visitor workflow guide carousel on the Dashboard.
 * Automatically hidden after dismissal or completion via localStorage.
 */
export function QuickStartCarousel({
  compact = false,
  className,
}: QuickStartCarouselProps) {
  const [visible, setVisible] = useState(() => isQuickStartVisible());
  const [activeIndex, setActiveIndex] = useState(0);

  if (!visible) return null;

  const current = QUICK_START_STEPS[activeIndex] ?? QUICK_START_STEPS[0];
  const Icon = current.icon;
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === QUICK_START_STEPS.length - 1;

  const handleDismiss = () => {
    markQuickStartDismissed();
    setVisible(false);
  };

  return (
    <section
      aria-label="Quick Start workflow guide"
      data-testid="quick-start-carousel"
      className={cn(
        'rounded-xl bg-ios-surface border border-[rgba(112,64,220,0.4)] relative overflow-hidden',
        compact ? 'p-4 space-y-3.5' : 'p-5 sm:p-6 space-y-4',
        className
      )}
    >
      {/* Top Bar */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#C8B9F1]">
              Quick Start Guide
            </span>
            <span className="text-[11px] font-mono text-ios-secondary tabular-nums">
              · Step {current.stepNumber} of {QUICK_START_STEPS.length}
            </span>
          </div>
          <h3 className="font-display text-base sm:text-lg font-bold text-ios-label">
            Video-to-Clip Workflow
          </h3>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss Quick Start guide"
          className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1.5 rounded-lg text-ios-secondary hover:text-ios-label hover:bg-ios-tertiary transition-colors cursor-pointer shrink-0 flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Active Slide Body */}
      <div className="rounded-xl bg-ios-bg/70 border border-ios-sep p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={cn(
              'w-11 h-11 rounded-xl border flex items-center justify-center shrink-0',
              current.accentClass
            )}
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>

          <div className="min-w-0 space-y-1">
            <h4 className="font-display text-sm sm:text-base font-bold text-ios-label">
              {current.stepNumber}. {current.title}
            </h4>
            <p className="text-xs sm:text-sm text-ios-secondary leading-relaxed">
              {current.summary}
            </p>
            <p className="text-[11px] text-ios-tertiary-label pt-0.5">{current.tip}</p>
          </div>
        </div>

        {current.actionTo && current.actionLabel && (
          <Link to={current.actionTo} className="shrink-0 self-start sm:self-center">
            <Button variant="secondary" size="sm">
              {current.actionLabel}
            </Button>
          </Link>
        )}
      </div>

      {/* Controls & Step Dots */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Quick Start steps">
          {QUICK_START_STEPS.map((step, idx) => {
            const active = idx === activeIndex;
            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`Step ${step.stepNumber}: ${step.title}`}
                onClick={() => setActiveIndex(idx)}
                className={cn(
                  'h-2 rounded-full transition-all cursor-pointer',
                  active ? 'w-6 bg-[#7040DC]' : 'w-2 bg-ios-sep-strong hover:bg-ios-secondary'
                )}
              />
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
          >
            Skip
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isFirst}
            onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
            icon={<ChevronLeft className="w-3.5 h-3.5" />}
            aria-label="Previous Quick Start step"
          >
            Back
          </Button>
          {isLast ? (
            <Button
              variant="accent-purple"
              size="sm"
              onClick={handleDismiss}
            >
              Done
            </Button>
          ) : (
            <Button
              variant="accent-purple"
              size="sm"
              onClick={() =>
                setActiveIndex((prev) => Math.min(QUICK_START_STEPS.length - 1, prev + 1))
              }
              aria-label="Next Quick Start step"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
