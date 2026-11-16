import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'accent-warm'
  | 'accent-purple';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-ios-blue-fill hover:bg-[#0077ED] active:bg-[#0062CC] text-white border border-transparent shadow-sm',
  secondary:
    'bg-ios-tertiary hover:bg-ios-gray-4 active:bg-ios-surface text-ios-label border border-ios-sep',
  ghost:
    'bg-transparent hover:bg-ios-tertiary text-ios-secondary hover:text-ios-label border border-transparent',
  danger:
    'bg-[var(--ios-red-tint)] hover:bg-[var(--ios-red-tint-hover)] text-ios-red border border-[var(--ios-red-border)]',
  'accent-warm':
    'bg-ios-orange-fill hover:bg-[#FFA926] text-black font-semibold border border-transparent',
  'accent-purple':
    'bg-[#5856D6] hover:bg-[#6E6BFF] active:bg-[#4947B8] text-white border border-transparent shadow-sm',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 max-sm:min-h-[44px] px-3 text-xs gap-1.5 rounded-md',
  md: 'h-10 max-sm:min-h-[44px] px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 min-h-[44px] px-5 text-sm gap-2 rounded-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 motion-safe:animate-spin shrink-0" aria-hidden="true" />
      ) : icon ? (
        <span className="shrink-0 flex items-center" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
