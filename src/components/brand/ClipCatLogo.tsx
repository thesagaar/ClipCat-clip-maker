import { useState } from 'react';
import { Scissors } from 'lucide-react';
import { BRAND } from '../../config/brand';
import { cn } from '../../utils/cn';
import { OptimizedImage } from '../ui/OptimizedImage';

interface ClipCatLogoProps {
  collapsed?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'auto' | 'full' | 'mascot';
  showSubtitle?: boolean;
  showSdpAttribution?: boolean;
  className?: string;
}

const SIZE_MAP: Record<NonNullable<ClipCatLogoProps['size']>, { px: number; cls: string }> = {
  xs: { px: 32, cls: 'w-8 h-8' },
  sm: { px: 36, cls: 'w-9 h-9' },
  md: { px: 44, cls: 'w-11 h-11' },
  lg: { px: 56, cls: 'w-14 h-14' },
};

export function ClipCatLogo({
  collapsed = false,
  size = 'md',
  variant = 'auto',
  showSubtitle = false,
  showSdpAttribution = false,
  className,
}: ClipCatLogoProps) {
  const [imgError, setImgError] = useState(false);

  const effectiveSize = collapsed ? 'md' : size;
  const { px, cls } = SIZE_MAP[effectiveSize];

  const useMascotOnly =
    variant === 'mascot' ||
    (variant === 'auto' && (collapsed || size === 'xs' || size === 'sm'));

  const imageSrc = useMascotOnly
    ? BRAND.assets.clipcatIcon
    : size === 'lg'
      ? BRAND.assets.clipcatLogo
      : BRAND.assets.clipcatLogoSmall;

  const webpSrc = useMascotOnly
    ? BRAND.assets.clipcatIconWebp
    : size === 'lg'
      ? BRAND.assets.clipcatLogoWebp
      : BRAND.assets.clipcatLogoSmallWebp;

  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', className)}>
      {!imgError ? (
        <div
          className={cn(
            'flex items-center justify-center shrink-0 overflow-hidden rounded-xl transition-transform duration-200 hover:scale-[1.03]',
            cls
          )}
        >
          <OptimizedImage
            src={imageSrc}
            webpSrc={webpSrc}
            alt="ClipCat mascot logo"
            width={px}
            height={px}
            loading="eager"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-contain"
          />
        </div>
      ) : (
        <div
          className={cn(
            'bg-[#30194E] border border-[#7040DC]/50 rounded-xl flex items-center justify-center shrink-0 text-[#C8B9F1]',
            cls
          )}
        >
          <Scissors className="w-4 h-4" aria-hidden="true" />
        </div>
      )}
      {!collapsed && (
        <div className="min-w-0 flex flex-col">
          <span
            className={cn(
              'font-display font-extrabold tracking-tight text-ios-label whitespace-nowrap leading-none',
              size === 'xs' || size === 'sm'
                ? 'text-base'
                : size === 'lg'
                  ? 'text-xl'
                  : 'text-lg'
            )}
          >
            {BRAND.productName}
          </span>
          {showSubtitle && (
            <span className="text-[11px] font-medium text-ios-secondary whitespace-normal leading-snug mt-0.5">
              {showSdpAttribution ? BRAND.shortAttribution : BRAND.productCategory}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
