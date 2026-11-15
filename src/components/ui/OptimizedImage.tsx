import type { ImgHTMLAttributes } from 'react';

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  webpSrc?: string;
  alt: string;
  width?: number;
  height?: number;
}

/**
 * Renders WebP when supported with an automatic fallback to PNG/source format,
 * explicit dimensions for zero layout shift (CLS), and async image decoding.
 */
export function OptimizedImage({
  src,
  webpSrc,
  alt,
  width,
  height,
  loading = 'eager',
  decoding = 'async',
  className,
  ...rest
}: OptimizedImageProps) {
  if (!webpSrc) {
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding={decoding}
        className={className}
        {...rest}
      />
    );
  }

  return (
    <picture className="contents">
      <source srcSet={webpSrc} type="image/webp" />
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding={decoding}
        className={className}
        {...rest}
      />
    </picture>
  );
}
