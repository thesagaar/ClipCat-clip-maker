import { useId } from 'react';
import { cn } from '../../utils/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: ToggleProps) {
  const id = useId();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col min-w-0">
        <label
          htmlFor={id}
          className="text-sm font-medium text-ios-label cursor-pointer"
        >
          {label}
        </label>
        {description && (
          <span className="text-xs text-ios-secondary mt-0.5">{description}</span>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
          checked
            ? 'bg-ios-green border-ios-green'
            : 'bg-ios-tertiary border-ios-sep'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150',
            checked ? 'translate-x-5.5' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}
