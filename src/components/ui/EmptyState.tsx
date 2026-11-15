import { useState, type ReactNode } from 'react';
import { BRAND } from '../../config/brand';
import { OptimizedImage } from './OptimizedImage';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  showMascot?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  showMascot = true,
}: EmptyStateProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center text-center rounded-xl bg-ios-surface border border-ios-sep px-6 py-10 sm:py-12">
      {showMascot && !imgError ? (
        <div className="w-20 h-14 flex items-center justify-center mb-4 overflow-hidden animate-float-gentle">
          <OptimizedImage
            src={BRAND.assets.clipcatMascot}
            webpSrc={BRAND.assets.clipcatMascotWebp}
            alt=""
            aria-hidden="true"
            width={80}
            height={58}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-contain"
          />
        </div>
      ) : (
        <div className="w-12 h-12 rounded-xl bg-ios-tertiary border border-ios-sep flex items-center justify-center text-ios-secondary mb-4">
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg font-bold text-ios-label">{title}</h3>
      <p className="text-sm text-ios-secondary max-w-md mt-1.5 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
      <p className="text-[11px] text-ios-tertiary-label mt-4">
        {BRAND.productIdentity}
      </p>
    </div>
  );
}
