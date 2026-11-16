import test from 'node:test';
import assert from 'node:assert/strict';
import type { Clip } from '../../types/clip';
import type { Project } from '../../types/project';
import {
  QUICK_START_DISMISSED_KEY,
  buildStudioActivityBreakdown,
  getRecentCompletedClips,
  isQuickStartVisible,
  markQuickStartDismissed,
} from './dashboardWidgetUtils';

const baseConfig: Project['config'] = {
  projectName: 'Sample',
  desiredClipCount: 5,
  minDurationSec: 15,
  preferredDurationSec: 45,
  maxDurationSec: 90,
  aspectRatio: '9:16',
  layoutMode: 'smart_face_tracking',
  captionsEnabled: true,
  captionPresetId: 'minimal',
  captionFontSize: 'medium',
  captionPosition: 'bottom',
  highlightKeywords: true,
  wordByWordAnimation: false,
  speakerLabels: false,
  outputFormat: 'mp4',
  videoCodec: 'h264',
  outputResolution: '1080p',
  outputFps: 30,
  autoProcess: true,
};

function makeProject(id: string, status: Project['status']): Project {
  return {
    id,
    name: `Project ${id}`,
    sourceType: 'upload',
    sourceFilename: 'sample.mp4',
    durationSec: 120,
    fileSizeBytes: 1024,
    clipCount: status === 'completed' ? 3 : 0,
    status,
    config: baseConfig,
    createdAt: '2026-11-15T00:00:00Z',
    updatedAt: '2026-11-15T00:00:00Z',
  };
}

function makeClip(
  id: string,
  projectId: string,
  status: Clip['status'] = 'completed',
  updatedAt = '2026-11-15T00:00:00Z'
): Clip {
  return {
    id,
    projectId,
    title: `Clip ${id}`,
    description: 'Sample clip',
    startSec: 0,
    endSec: 30,
    durationSec: 30,
    aiScore: 90,
    scoringBreakdown: {
      overallScore: 90,
      summary: 'Strong hook',
      disclaimer: 'Heuristic estimate',
      factors: [],
    },
    aspectRatio: '9:16',
    layoutMode: 'smart_face_tracking',
    resolution: '1080p',
    fileSizeBytes: 512,
    status,
    captionStatus: 'applied',
    exportStatus: 'ready',
    captionSettings: {
      enabled: true,
      presetId: 'minimal',
      fontSize: 'medium',
      position: 'bottom',
      highlightKeywords: true,
      wordByWordAnimation: false,
      speakerLabels: false,
    },
    createdAt: updatedAt,
    updatedAt,
  };
}

test('buildStudioActivityBreakdown aggregates processed videos vs total clips accurately', () => {
  const projects: Project[] = [
    makeProject('p1', 'completed'),
    makeProject('p2', 'completed'),
    makeProject('p3', 'processing'),
    makeProject('p4', 'failed'),
  ];
  const clips: Clip[] = [
    makeClip('c1', 'p1'),
    makeClip('c2', 'p1'),
    makeClip('c3', 'p1'),
    makeClip('c4', 'p2'),
    makeClip('c5', 'p2'),
  ];

  const summary = buildStudioActivityBreakdown(projects, clips);

  assert.equal(summary.processedVideosCount, 2);
  assert.equal(summary.totalClipsCount, 5);
  assert.equal(summary.totalProjectsCount, 4);
  assert.equal(summary.activeJobsCount, 1);
  assert.equal(summary.averageClipsPerVideo, 2.5);
  assert.equal(summary.hasActivity, true);
  assert.deepEqual(
    summary.chartData.map((d) => ({ key: d.key, count: d.count })),
    [
      { key: 'processed_videos', count: 2 },
      { key: 'clips_generated', count: 5 },
    ]
  );
});

test('buildStudioActivityBreakdown handles zero projects and zero clips safely', () => {
  const summary = buildStudioActivityBreakdown([], []);

  assert.equal(summary.processedVideosCount, 0);
  assert.equal(summary.totalClipsCount, 0);
  assert.equal(summary.averageClipsPerVideo, 0);
  assert.equal(summary.hasActivity, false);
});

test('getRecentCompletedClips filters to completed clips, sorts newest first, and limits to 5', () => {
  const clips: Clip[] = [
    makeClip('c1', 'p1', 'completed', '2026-11-10T10:00:00Z'),
    makeClip('c2', 'p1', 'rendering', '2026-11-15T12:00:00Z'),
    makeClip('c3', 'p1', 'completed', '2026-11-14T10:00:00Z'),
    makeClip('c4', 'p1', 'completed', '2026-11-15T10:00:00Z'),
    makeClip('c5', 'p1', 'completed', '2026-11-12T10:00:00Z'),
    makeClip('c6', 'p1', 'completed', '2026-11-13T10:00:00Z'),
    makeClip('c7', 'p1', 'completed', '2026-11-11T10:00:00Z'),
    makeClip('c8', 'p1', 'failed', '2026-11-16T00:00:00Z'),
  ];

  const recent = getRecentCompletedClips(clips, 5);

  assert.equal(recent.length, 5);
  assert.deepEqual(
    recent.map((c) => c.id),
    ['c4', 'c3', 'c6', 'c5', 'c7']
  );
});

test('Quick Start visibility stays true for first-time visitor and false once dismissed', () => {
  const mem = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };

  assert.equal(isQuickStartVisible(mockStorage), true);
  markQuickStartDismissed(mockStorage);
  assert.equal(mem.get(QUICK_START_DISMISSED_KEY), '1');
  assert.equal(isQuickStartVisible(mockStorage), false);
});
