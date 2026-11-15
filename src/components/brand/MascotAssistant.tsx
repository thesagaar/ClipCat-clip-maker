import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn';

interface MascotAssistantProps {
  message: string;
  submessage?: string;
  animate?: boolean;
  className?: string;
}

export function MascotAssistant({
  message,
  submessage,
  animate = false,
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
          'w-14 h-14 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden border border-ios-sep',
          animate && 'transition-transform duration-500'
        )}
      >
        {!imgError ? (
          <img
            src="/brand/clipcat-mascot.png"
            alt="ClipCat AI editing cat mascot"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-contain"
          />
        ) : (
          <Sparkles className="w-6 h-6 text-ios-blue" />
        )}
      </div>
      <div className="min-w-0">
        <p className="font-display text-sm font-bold text-ios-label">{message}</p>
        {submessage && (
          <p className="text-xs text-ios-secondary mt-1 leading-relaxed">{submessage}</p>
        )}
      </div>
    </div>
  );
}
