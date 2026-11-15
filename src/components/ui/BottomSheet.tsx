import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative z-10 w-full sm:max-w-lg max-h-[85dvh] flex flex-col bg-ios-elevated border-t sm:border border-ios-sep rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden pb-safe',
          className
        )}
      >
        {/* Mobile drag handle visual indicator */}
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-ios-sep-strong" />
        </div>

        <div className="flex items-start justify-between gap-4 px-5 py-3.5 border-b border-ios-sep shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-bold text-ios-label">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-ios-secondary mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 rounded-lg text-ios-secondary hover:text-ios-label hover:bg-ios-tertiary transition-colors cursor-pointer flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {children}
        </div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-3 px-5 py-3.5 bg-ios-surface border-t border-ios-sep shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
