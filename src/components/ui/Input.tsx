import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export function Input({
  label,
  helperText,
  error,
  id,
  className,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-ios-label"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className={cn(
          'h-10 w-full rounded-lg bg-ios-input px-3 text-sm text-ios-label placeholder:text-ios-tertiary-label border transition-colors focus:outline-none',
          error
            ? 'border-ios-red focus:border-ios-red'
            : 'border-ios-sep focus:border-ios-blue',
          className
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-ios-red">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-ios-secondary">{helperText}</p>
      ) : null}
    </div>
  );
}
