import { useProjectDraftStore } from '../../stores/projectDraftStore';
import { useUiStore } from '../../stores/uiStore';
import type { AspectRatio } from '../../types/project';
import { cn } from '../../utils/cn';
import { SMART_FRAMING_OPTIONS } from './dashboardWidgetUtils';

interface SmartFramingToggleProps {
  compact?: boolean;
  className?: string;
}

function AspectRatioFrameIcon({
  ratio,
  active,
}: {
  ratio: AspectRatio;
  active: boolean;
}) {
  const frameClass =
    ratio === '9:16'
      ? 'w-2.5 h-3.5'
      : ratio === '1:1'
        ? 'w-3 h-3'
        : 'w-4 h-2.5';

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block rounded-[2px] border-[1.5px] shrink-0 transition-colors',
        frameClass,
        active ? 'border-white' : 'border-current'
      )}
    />
  );
}

/**
 * Segmented toggle for choosing the studio's default Smart Framing aspect ratio
 * (9:16 Vertical, 1:1 Square, or 16:9 Horizontal) for Quick Import & new projects.
 */
export function SmartFramingToggle({
  compact = false,
  className,
}: SmartFramingToggleProps) {
  const smartFramingAspectRatio = useUiStore((s) => s.smartFramingAspectRatio);
  const setSmartFramingAspectRatio = useUiStore((s) => s.setSmartFramingAspectRatio);
  const updateDraftConfig = useProjectDraftStore((s) => s.updateConfig);

  const activeOption =
    SMART_FRAMING_OPTIONS.find((opt) => opt.value === smartFramingAspectRatio) ??
    SMART_FRAMING_OPTIONS[0];

  const handleSelect = (ratio: AspectRatio) => {
    setSmartFramingAspectRatio(ratio);
    updateDraftConfig({ aspectRatio: ratio });
  };

  return (
    <div
      data-testid="smart-framing-toggle"
      className={cn('space-y-1.5', compact ? 'w-full' : 'w-full sm:w-auto', className)}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-ios-secondary">Smart Framing</span>
        <span
          data-testid="smart-framing-active-label"
          className="font-mono tabular-nums text-ios-label"
        >
          {activeOption.label} ({activeOption.shortLabel})
        </span>
      </div>

      <div
        role="group"
        aria-label="Smart Framing aspect ratio preference"
        className={cn(
          'grid grid-cols-3 gap-1 rounded-lg bg-ios-bg border border-ios-sep p-1',
          !compact && 'sm:inline-grid sm:grid-cols-3'
        )}
      >
        {SMART_FRAMING_OPTIONS.map((option) => {
          const isActive = smartFramingAspectRatio === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              aria-label={`${option.label} (${option.shortLabel}) — ${option.description}`}
              title={`${option.label} (${option.shortLabel}): ${option.description}`}
              data-testid={`smart-framing-option-${option.value}`}
              onClick={() => handleSelect(option.value)}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 sm:px-3 text-xs font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0',
                'min-h-[44px] sm:min-h-[34px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7040DC]',
                isActive
                  ? 'bg-[#7040DC] text-white shadow-xs'
                  : 'text-ios-secondary hover:text-ios-label hover:bg-ios-tertiary/70'
              )}
            >
              <AspectRatioFrameIcon ratio={option.value} active={isActive} />
              <span className="font-mono tabular-nums">{option.shortLabel}</span>
              {!compact && (
                <span className="hidden md:inline font-sans text-[11px] opacity-90">
                  {option.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
