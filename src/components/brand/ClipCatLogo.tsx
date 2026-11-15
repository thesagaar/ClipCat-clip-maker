import { useState } from 'react';
import { Scissors } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ClipCatLogoProps {
  collapsed?: boolean;
  className?: string;
}

export function ClipCatLogo({ collapsed = false, className }: ClipCatLogoProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', className)}>
      {!imgError ? (
        <div className="w-9 h-9 rounded-lg bg-white p-0.5 flex items-center justify-center shrink-0 overflow-hidden border border-ios-sep">
          <img
            src="/brand/clipcat-logo.png"
            alt="ClipCat AI mascot logo"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-contain"
          />
        </div>
      ) : (
        <div className="w-9 h-9 rounded-lg bg-ios-tertiary border border-ios-sep flex items-center justify-center shrink-0 text-ios-orange">
          <Scissors className="w-4 h-4" />
        </div>
      )}
      {!collapsed && (
        <span className="font-display text-lg font-extrabold tracking-tight text-ios-label whitespace-nowrap shrink-0">
          ClipCat
        </span>
      )}
    </div>
  );
}
