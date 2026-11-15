import { useRef, useState } from 'react';
import { useDrag } from '@use-gesture/react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  computeDragPreviewOffset,
  isPrimarySwipeRoute,
  resolveSwipeTargetRoute,
} from '../utils/gestures';

function hasHorizontalScrollAncestor(element: HTMLElement | null): boolean {
  let node: HTMLElement | null = element;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const overflowX = style.overflowX;
    if (
      (overflowX === 'auto' || overflowX === 'scroll') &&
      node.scrollWidth > node.clientWidth + 4
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

export function shouldIgnoreSwipeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  if (
    target.closest(
      'input, textarea, select, video, audio, [contenteditable="true"], [role="slider"], [role="dialog"], [data-no-swipe="true"]'
    )
  ) {
    return true;
  }

  return hasHorizontalScrollAncestor(target);
}

function isTouchInputEvent(event: unknown): boolean {
  if (!event || typeof event !== 'object') return false;
  if ('pointerType' in event) {
    return (event as PointerEvent).pointerType !== 'mouse';
  }
  return typeof TouchEvent !== 'undefined' && event instanceof TouchEvent;
}

/**
 * Powered by `@use-gesture/react` (`useDrag`) for smooth horizontal swipe-to-navigate
 * switching between primary mobile views (`/` ↔ `/projects` ↔ `/projects/new` ↔ `/clips` ↔ `/settings`).
 */
export function useSwipeNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const ignoredRef = useRef(false);

  const canSwipe = isPrimarySwipeRoute(location.pathname);

  const bind = useDrag(
    ({
      first,
      active,
      movement: [mx, my],
      velocity: [vx],
      swipe: [swipeX],
      event,
      cancel,
    }) => {
      if (typeof window === 'undefined' || window.innerWidth >= 640 || !canSwipe) {
        if (isSwiping) {
          setIsSwiping(false);
          setDragOffsetX(0);
        }
        return;
      }

      if (first) {
        ignoredRef.current =
          !isTouchInputEvent(event) || shouldIgnoreSwipeTarget(event?.target ?? null);
        if (ignoredRef.current) {
          cancel();
          return;
        }
      }

      if (ignoredRef.current) {
        return;
      }

      if (active) {
        setIsSwiping(true);
        setDragOffsetX(computeDragPreviewOffset(mx, location.pathname));
        return;
      }

      setIsSwiping(false);
      setDragOffsetX(0);

      const nextRoute = resolveSwipeTargetRoute({
        currentPath: location.pathname,
        deltaX: mx,
        deltaY: my,
        velocityX: vx,
        swipeX,
        viewportWidth: window.innerWidth,
        shouldIgnoreTarget: ignoredRef.current,
      });

      if (nextRoute && nextRoute !== location.pathname) {
        navigate(nextRoute);
      }
    },
    {
      axis: 'x',
      filterTaps: true,
      threshold: 12,
      pointer: {
        capture: false,
      },
      swipe: {
        distance: 56,
        velocity: 0.4,
      },
    }
  );

  return {
    bind,
    dragOffsetX,
    isSwiping,
    canSwipe,
  };
}
