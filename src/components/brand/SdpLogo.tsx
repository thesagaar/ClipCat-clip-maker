import { useState } from 'react';
import { BRAND } from '../../config/brand';
import { cn } from '../../utils/cn';

interface SdpLogoProps {
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const sizeClasses: Record<NonNullable<SdpLogoProps['size']>, string> = {
  xs: 'h-7 px-2 py-1 rounded-md',
  sm: 'h-9 px-2.5 py-1.5 rounded-lg',
  md: 'h-12 px-3 py-2 rounded-xl',
};

const imgSizeClasses: Record<NonNullable<SdpLogoProps['size']>, string> = {
  xs: 'h-4 w-auto',
  sm: 'h-5 w-auto',
  md: 'h-8 w-auto',
};

const imgDimensions: Record<NonNullable<SdpLogoProps['size']>, { w: number; h: number }> = {
  xs: { w: 20, h: 16 },
  sm: { w: 25, h: 20 },
  md: { w: 39, h: 32 },
};

/**
 * Displays the untouched Single Dimension Projects (SDP) official logo asset
 * inside a neutral dark container so the white mark remains legible across both
 * Dark and Light themes without modifying the logo artwork or proportions.
 */
export function SdpLogo({ size = 'sm', className }: SdpLogoProps) {
  const [fallbackPng, setFallbackPng] = useState(false);
  const { w, h } = imgDimensions[size];

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center bg-[#141418] border border-ios-sep shrink-0 select-none',
        sizeClasses[size],
        className
      )}
    >
      {fallbackPng ? (
        <picture className="contents">
          <source srcSet={BRAND.assets.sdpLogoWebp} type="image/webp" />
          <img
            src={BRAND.assets.sdpLogoPng}
            alt={`${BRAND.parentBrandName} (${BRAND.parentBrandAbbreviation})`}
            width={w}
            height={h}
            loading="eager"
            decoding="async"
            className={cn('object-contain aspect-[785/640]', imgSizeClasses[size])}
          />
        </picture>
      ) : (
        <img
          src={BRAND.assets.sdpLogo}
          alt={`${BRAND.parentBrandName} (${BRAND.parentBrandAbbreviation})`}
          width={w}
          height={h}
          loading="eager"
          decoding="async"
          onError={() => setFallbackPng(true)}
          className={cn('object-contain aspect-[785/640]', imgSizeClasses[size])}
        />
      )}
    </span>
  );
}
