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

/**
 * Displays the untouched Single Dimension Projects (SDP) official logo asset
 * inside a neutral dark container so the white mark remains legible across both
 * Dark and Light themes without modifying the logo artwork or proportions.
 */
export function SdpLogo({ size = 'sm', className }: SdpLogoProps) {
  const [fallbackPng, setFallbackPng] = useState(false);

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center bg-[#141418] border border-ios-sep shrink-0 select-none',
        sizeClasses[size],
        className
      )}
    >
      <img
        src={fallbackPng ? BRAND.assets.sdpLogoPng : BRAND.assets.sdpLogo}
        alt={`${BRAND.parentBrandName} (${BRAND.parentBrandAbbreviation})`}
        onError={() => {
          if (!fallbackPng) setFallbackPng(true);
        }}
        className={cn('object-contain aspect-[785/640]', imgSizeClasses[size])}
      />
    </span>
  );
}
