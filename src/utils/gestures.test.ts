import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDragPreviewOffset,
  computePullOffset,
  getAdjacentSwipeRoutes,
  MOBILE_SWIPE_ROUTES,
  resolveSwipeTargetRoute,
  shouldTriggerPullRefresh,
} from './gestures';

test('MOBILE_SWIPE_ROUTES matches the five primary mobile navigation routes in order', () => {
  assert.deepEqual(MOBILE_SWIPE_ROUTES, [
    '/',
    '/projects',
    '/projects/new',
    '/clips',
    '/settings',
  ]);
});

test('resolveSwipeTargetRoute advances forward on left swipe and backward on right swipe', () => {
  assert.equal(
    resolveSwipeTargetRoute({
      currentPath: '/',
      deltaX: -110,
      deltaY: 12,
      viewportWidth: 390,
    }),
    '/projects'
  );

  assert.equal(
    resolveSwipeTargetRoute({
      currentPath: '/projects',
      deltaX: 115,
      deltaY: -10,
      viewportWidth: 390,
    }),
    '/'
  );
});

test('resolveSwipeTargetRoute supports high-velocity short flicks and library swipe state', () => {
  assert.equal(
    resolveSwipeTargetRoute({
      currentPath: '/projects',
      deltaX: -42,
      deltaY: 5,
      velocityX: 0.65,
      viewportWidth: 390,
    }),
    '/projects/new'
  );

  assert.equal(
    resolveSwipeTargetRoute({
      currentPath: '/clips',
      deltaX: 35,
      deltaY: 4,
      swipeX: 1,
      viewportWidth: 390,
    }),
    '/projects/new'
  );
});

test('resolveSwipeTargetRoute respects boundaries and non-primary subroutes', () => {
  assert.equal(
    resolveSwipeTargetRoute({
      currentPath: '/',
      deltaX: 120,
      deltaY: 0,
      viewportWidth: 390,
    }),
    null
  );

  assert.equal(
    resolveSwipeTargetRoute({
      currentPath: '/settings',
      deltaX: -120,
      deltaY: 0,
      viewportWidth: 390,
    }),
    null
  );

  assert.equal(
    resolveSwipeTargetRoute({
      currentPath: '/clips/clip-1/edit',
      deltaX: 120,
      deltaY: 0,
      viewportWidth: 390,
    }),
    null
  );
});

test('resolveSwipeTargetRoute ignores desktop widths, diagonal/vertical scrolls, and interactive controls', () => {
  assert.equal(
    resolveSwipeTargetRoute({
      currentPath: '/',
      deltaX: -120,
      deltaY: 0,
      viewportWidth: 1024,
    }),
    null
  );

  assert.equal(
    resolveSwipeTargetRoute({
      currentPath: '/',
      deltaX: -80,
      deltaY: 75,
      viewportWidth: 390,
    }),
    null
  );

  assert.equal(
    resolveSwipeTargetRoute({
      currentPath: '/',
      deltaX: -120,
      deltaY: 0,
      viewportWidth: 390,
      shouldIgnoreTarget: true,
    }),
    null
  );
});

test('computeDragPreviewOffset damps and applies rubber-band resistance at boundaries', () => {
  assert.deepEqual(getAdjacentSwipeRoutes('/'), { prev: null, next: '/projects' });
  assert.equal(computeDragPreviewOffset(200, '/'), 14);
  assert.equal(computeDragPreviewOffset(-200, '/'), -44);
  assert.equal(computeDragPreviewOffset(-200, '/settings'), -14);
});

test('computePullOffset and shouldTriggerPullRefresh clamp safely', () => {
  assert.equal(computePullOffset(80, 10), 0);
  assert.equal(computePullOffset(-20, 0), 0);
  assert.equal(computePullOffset(100, 0), 48);
  assert.equal(computePullOffset(400, 0), 84);
  assert.equal(shouldTriggerPullRefresh(48), false);
  assert.equal(shouldTriggerPullRefresh(56), true);
});
