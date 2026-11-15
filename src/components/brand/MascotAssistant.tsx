import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { BRAND } from '../../config/brand';
import { cn } from '../../utils/cn';
import { OptimizedImage } from '../ui/OptimizedImage';

interface MascotAssistantProps {
  message: string;
  submessage?: string;
  animate?: boolean;
  showSdpAttribution?: boolean;
  className?: string;
}

export function MascotAssistant({
  message,
  submessage,
  animate = false,
  showSdpAttribution = false,
  className,
}: MascotAssistantProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl bg-ios-surface border border-ios-sep p-4',
        className
      )}
    >
      <div
        className={cn(
          'w-16 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden',
          animate && 'animate-float-gentle'
        )}
      >
        {!imgError ? (
          <OptimizedImage
            src={BRAND.assets.clipcatMascot}
            webpSrc={BRAND.assets.clipcatMascotWebp}
            alt="ClipCat mascot assistant"
            width={64}
            height={46}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-contain"
          />
        ) : (
          <Sparkles className="w-6 h-6 text-[#7040DC]" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0">
        <p className="font-display text-sm font-bold text-ios-label">{message}</p>
        {submessage && (
          <p className="text-xs text-ios-secondary mt-1 leading-relaxed">{submessage}</p>
        )}
        {showSdpAttribution && (
          <p className="text-[11px] text-ios-tertiary-label mt-1.5">
            {BRAND.shortAttribution}
          </p>
        )}
      </div>
    </div>
  );
}
