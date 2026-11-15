import { useRef, useState, type ReactNode } from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';
import {
  computePullOffset,
  shouldTriggerPullRefresh,
} from '../../utils/gestures';

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  disabled?: boolean;
  children: ReactNode;
}

/**
 * Mobile (< 640px) touch pull-to-refresh wrapper.
 * Activates only when scrolled to the top of the page so normal scrolling
 * and desktop interaction remain completely unaffected.
 */
export function PullToRefresh({
  onRefresh,
  disabled = false,
  children,
}: PullToRefreshProps) {
  const startYRef = useRef<number | null>(null);
  const [pullOffset, setPullOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const readyToTrigger = shouldTriggerPullRefresh(pullOffset);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (
      disabled ||
      isRefreshing ||
      window.innerWidth >= 640 ||
      window.scrollY > 2 ||
      e.touches.length !== 1
    ) {
      startYRef.current = null;
      return;
    }
    startYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startYRef.current === null || isRefreshing || e.touches.length !== 1) {
      return;
    }
    const deltaY = e.touches[0].clientY - startYRef.current;
    const nextOffset = computePullOffset(deltaY, window.scrollY);
    setPullOffset(nextOffset);
  };

  const handleTouchEnd = async () => {
    if (startYRef.current === null) return;
    startYRef.current = null;

    if (!shouldTriggerPullRefresh(pullOffset)) {
      setPullOffset(0);
      return;
    }

    setIsRefreshing(true);
    setPullOffset(48);
    try {
      await Promise.all([
        Promise.resolve(onRefresh()),
        new Promise((resolve) => setTimeout(resolve, 350)),
      ]);
    } finally {
      setIsRefreshing(false);
      setPullOffset(0);
    }
  };

  const showIndicator = pullOffset > 8 || isRefreshing;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        startYRef.current = null;
        if (!isRefreshing) setPullOffset(0);
      }}
      className="relative"
    >
      <div
        role="status"
        aria-live="polite"
        aria-hidden={!showIndicator}
        className="sm:hidden overflow-hidden transition-[height,opacity] duration-200 flex items-center justify-center"
        style={{
          height: showIndicator ? `${Math.max(40, pullOffset)}px` : '0px',
          opacity: showIndicator ? 1 : 0,
        }}
      >
        <div className="inline-flex items-center gap-2 text-xs font-medium text-[#C8B9F1]">
          {isRefreshing ? (
            <>
              <Loader2 className="w-4 h-4 text-[#7040DC] motion-safe:animate-spin" />
              <span>Refreshing studio data...</span>
            </>
          ) : (
            <>
              <ArrowDown
                className={`w-4 h-4 transition-transform duration-150 ${
                  readyToTrigger ? 'rotate-180 text-[#7040DC]' : 'text-ios-secondary'
                }`}
              />
              <span>
                {readyToTrigger ? 'Release to refresh' : 'Pull down to refresh'}
              </span>
            </>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}
