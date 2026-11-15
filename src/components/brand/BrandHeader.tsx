import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '../../config/brand';
import { cn } from '../../utils/cn';
import { OptimizedImage } from '../ui/OptimizedImage';
import { SdpLogo } from './SdpLogo';

export interface BrandHeaderProps {
  /** Compact size for drawer/mobile cards or standard footer size */
  size?: 'sm' | 'md';
  /** Optional eyebrow label above the title (e.g. greeting) */
  eyebrow?: ReactNode;
  /** Optional heading override (defaults to BRAND.productName) */
  title?: string;
  /** Optional click handler for links (e.g. closing drawer) */
  onNavigate?: () => void;
  /** Optional trailing action slot rendered beside the SDP logo on Row 1 (e.g. drawer close button) */
  trailingAction?: ReactNode;
  /** Extra classes on the root wrapper */
  className?: string;
  /** Attribution line text class override */
  attributionClassName?: string;
}

/**
 * Responsive two-row brand header:
 * - Row 1: ClipCat mascot/logo + title on the left, SDP parent logo (and optional action) on the right.
 * - Row 2: Full-width unobstructed "A product by Single Dimension Projects" row beneath Row 1 so it
 *   never truncates, clips, or overlaps on narrow viewports.
 */
export function BrandHeader({
  size = 'md',
  eyebrow,
  title = BRAND.productName,
  onNavigate,
  trailingAction,
  className,
  attributionClassName,
}: BrandHeaderProps) {
  const [logoError, setLogoError] = useState(false);

  const logoBoxClass = size === 'sm' ? 'w-11 h-11' : 'w-12 h-12';
  const logoPx = size === 'sm' ? 44 : 48;
  const fallbackFontClass = size === 'sm' ? 'text-[11px]' : 'text-xs';
  const titleClass =
    size === 'sm'
      ? 'font-display text-lg font-extrabold text-ios-label tracking-tight leading-tight'
      : 'font-display text-lg font-extrabold text-ios-label tracking-tight leading-none';

  return (
    <div className={cn('w-full space-y-2', className)} data-testid="mobile-brand-header">
      {/* Row 1: ClipCat mascot/logo + title on left; SDP logo (+ optional trailing control) right */}
      <div className="flex items-center justify-between gap-3 w-full">
        <Link
          to="/"
          onClick={onNavigate}
          aria-label="ClipCat Home"
          className="flex items-center gap-3 min-w-0 group"
        >
          {!logoError ? (
            <OptimizedImage
              src={size === 'sm' ? BRAND.assets.clipcatLogo : BRAND.assets.clipcatLogoSmall}
              webpSrc={size === 'sm' ? BRAND.assets.clipcatLogoWebp : BRAND.assets.clipcatLogoSmallWebp}
              alt="ClipCat mascot logo"
              width={logoPx}
              height={logoPx}
              loading="eager"
              onError={() => setLogoError(true)}
              className={cn(
                logoBoxClass,
                'object-contain shrink-0 rounded-xl transition-transform duration-200 group-hover:scale-[1.03]'
              )}
            />
          ) : (
            <div
              className={cn(
                logoBoxClass,
                fallbackFontClass,
                'rounded-xl bg-[#30194E] border border-[#7040DC]/50 flex items-center justify-center shrink-0 font-bold text-white'
              )}
            >
              CC
            </div>
          )}

          <div className="min-w-0 flex flex-col">
            {eyebrow && (
              <span className="text-xs font-semibold text-[#AF52DE] leading-tight">
                {eyebrow}
              </span>
            )}
            <span className={titleClass}>{title}</span>
          </div>
        </Link>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            to="/settings#about"
            onClick={onNavigate}
            aria-label={BRAND.parentBrandName}
            title={BRAND.developedByStatement}
            className="shrink-0 rounded-xl p-1 hover:bg-ios-tertiary/60 transition-colors"
          >
            <SdpLogo size={size === 'sm' ? 'xs' : 'sm'} />
          </Link>
          {trailingAction}
        </div>
      </div>

      {/* Row 2: Full-width unobstructed attribution row beneath logo and title */}
      <p
        data-testid="sdp-attribution"
        className={cn(
          'w-full text-[13.5px] sm:text-sm font-normal leading-[1.4] text-ios-secondary whitespace-normal break-words',
          attributionClassName
        )}
      >
        A product by {BRAND.parentBrandName}
      </p>
    </div>
  );
}
