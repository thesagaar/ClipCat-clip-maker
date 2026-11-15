import type { SelectHTMLAttributes } from 'react';
import { useId } from 'react';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  helperText?: string;
}

export function Select({
  label,
  options,
  helperText,
  id,
  className,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-ios-label">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'h-10 w-full rounded-lg bg-ios-input px-3 text-sm text-ios-label border border-ios-sep focus:border-ios-blue focus:outline-none cursor-pointer',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-ios-surface text-ios-label">
            {opt.label}
          </option>
        ))}
      </select>
      {helperText && <p className="text-xs text-ios-secondary">{helperText}</p>}
    </div>
  );
}
