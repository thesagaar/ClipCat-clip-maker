export const MOBILE_SWIPE_ROUTES = [
  '/',
  '/projects',
  '/projects/new',
  '/clips',
  '/settings',
] as const;

export type MobileSwipeRoute = (typeof MOBILE_SWIPE_ROUTES)[number];

export interface SwipeResolutionInput {
  currentPath: string;
  deltaX: number;
  deltaY: number;
  viewportWidth: number;
  velocityX?: number;
  swipeX?: number;
  shouldIgnoreTarget?: boolean;
  minHorizontalDistancePx?: number;
}

export function isPrimarySwipeRoute(path: string): path is MobileSwipeRoute {
  return MOBILE_SWIPE_ROUTES.includes(path as MobileSwipeRoute);
}

export function getAdjacentSwipeRoutes(currentPath: string): {
  prev: MobileSwipeRoute | null;
  next: MobileSwipeRoute | null;
} {
  const idx = MOBILE_SWIPE_ROUTES.indexOf(currentPath as MobileSwipeRoute);
  if (idx === -1) {
    return { prev: null, next: null };
  }
  return {
    prev: idx > 0 ? MOBILE_SWIPE_ROUTES[idx - 1] : null,
    next: idx < MOBILE_SWIPE_ROUTES.length - 1 ? MOBILE_SWIPE_ROUTES[idx + 1] : null,
  };
}

/**
 * Resolves the target route for a horizontal swipe gesture between primary mobile views.
 * Compatible with `@use-gesture/react` `useDrag` state (movement, velocity, swipe).
 * - Swiping left (negative deltaX / swipeX === -1) advances forward.
 * - Swiping right (positive deltaX / swipeX === 1) navigates back.
 * - Fast flicks (>= 0.45 px/ms velocity with >= 36px travel) also trigger navigation.
 */
export function resolveSwipeTargetRoute({
  currentPath,
  deltaX,
  deltaY,
  viewportWidth,
  velocityX = 0,
  swipeX = 0,
  shouldIgnoreTarget = false,
  minHorizontalDistancePx = 68,
}: SwipeResolutionInput): MobileSwipeRoute | null {
  if (viewportWidth >= 640 || shouldIgnoreTarget) {
    return null;
  }

  const currentIndex = MOBILE_SWIPE_ROUTES.indexOf(currentPath as MobileSwipeRoute);
  if (currentIndex === -1) {
    return null;
  }

  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  const isFastFlick = absX >= 36 && Math.abs(velocityX) >= 0.45 && absX > absY * 1.2;
  const isLibrarySwipe = swipeX !== 0 && absX >= 28;
  const isFullDrag = absX >= minHorizontalDistancePx && absX >= absY * 1.5;

  if (!isFastFlick && !isLibrarySwipe && !isFullDrag) {
    return null;
  }

  const movingLeft = swipeX !== 0 ? swipeX < 0 : deltaX < 0;
  const nextIndex = movingLeft ? currentIndex + 1 : currentIndex - 1;
  if (nextIndex < 0 || nextIndex >= MOBILE_SWIPE_ROUTES.length) {
    return null;
  }

  return MOBILE_SWIPE_ROUTES[nextIndex];
}

/**
 * Computes damped horizontal visual drag preview offset (clamped at bounds).
 */
export function computeDragPreviewOffset(
  movementX: number,
  currentPath: string,
  maxPreviewPx = 44
): number {
  const { prev, next } = getAdjacentSwipeRoutes(currentPath);
  if (movementX > 0 && !prev) {
    return Math.min(14, Math.round(movementX * 0.12));
  }
  if (movementX < 0 && !next) {
    return Math.max(-14, Math.round(movementX * 0.12));
  }
  const damped = movementX * 0.35;
  return Math.max(-maxPreviewPx, Math.min(maxPreviewPx, Math.round(damped)));
}

/**
 * Computes damped pull-to-refresh indicator offset when pulling downward from top of scroll.
 */
export function computePullOffset(
  rawDeltaY: number,
  scrollTop: number,
  maxOffset = 84
): number {
  if (scrollTop > 2 || rawDeltaY <= 0) {
    return 0;
  }
  const damped = rawDeltaY * 0.48;
  return Math.min(maxOffset, Math.round(damped));
}

export function shouldTriggerPullRefresh(
  pullOffsetPx: number,
  thresholdPx = 56
): boolean {
  return pullOffsetPx >= thresholdPx;
}
