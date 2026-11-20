import test from 'node:test';
import assert from 'node:assert/strict';
import type { Clip } from '../../types/clip';
import type { ProcessingJob } from '../../types/job';
import type { Project } from '../../types/project';
import {
  QUICK_START_DISMISSED_KEY,
  buildProcessingQueueSummary,
  buildStudioActivityBreakdown,
  getRecentCompletedClips,
  isQuickStartVisible,
  markQuickStartDismissed,
  normalizeSmartFramingAspectRatio,
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

function makeProject(
  id: string,
  status: Project['status'],
  desiredClipCount = 5,
  activeJobId?: string
): Project {
  return {
    id,
    name: `Project ${id}`,
    sourceType: 'upload',
    sourceFilename: 'sample.mp4',
    durationSec: 120,
    fileSizeBytes: 1024,
    clipCount: status === 'completed' ? 3 : 0,
    status,
    activeJobId: activeJobId ?? null,
    config: {
      ...baseConfig,
      desiredClipCount,
    },
    createdAt: '2026-11-15T00:00:00Z',
    updatedAt: '2026-11-15T00:00:00Z',
  };
}

function makeJob(
  id: string,
  projectId: string,
  currentStageId: ProcessingJob['currentStageId'],
  overallProgress: number | null,
  status: ProcessingJob['status'] = 'running'
): ProcessingJob {
  return {
    id,
    projectId,
    projectName: `Project ${projectId}`,
    status,
    overallProgress,
    currentStageId,
    currentTask: `Running ${currentStageId}`,
    elapsedSec: 25,
    estimatedRemainingSec: 40,
    stages: [],
    logs: [],
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

test('normalizeSmartFramingAspectRatio accepts 9:16, 1:1, 16:9 and falls back to 9:16', () => {
  assert.equal(normalizeSmartFramingAspectRatio('9:16'), '9:16');
  assert.equal(normalizeSmartFramingAspectRatio('1:1'), '1:1');
  assert.equal(normalizeSmartFramingAspectRatio('16:9'), '16:9');
  assert.equal(normalizeSmartFramingAspectRatio('4:5'), '9:16');
  assert.equal(normalizeSmartFramingAspectRatio(undefined), '9:16');
});

test('buildProcessingQueueSummary aggregates transcribing and rendering clips across active projects and standalone clip renders', () => {
  const projects: Project[] = [
    makeProject('p1', 'processing', 4, 'j1'),
    makeProject('p2', 'processing', 6, 'j2'),
    makeProject('p3', 'completed', 5),
  ];
  const jobs: ProcessingJob[] = [
    makeJob('j1', 'p1', 'speech_transcription', 40),
    makeJob('j2', 'p2', 'video_rendering', 80),
  ];
  const clips: Clip[] = [
    // Belongs to already-active project p2 -> must not double count
    makeClip('c1', 'p2', 'rendering'),
    // Standalone re-render on completed project p3 -> must be counted as rendering
    makeClip('c2', 'p3', 'rendering'),
    makeClip('c3', 'p3', 'completed'),
  ];

  const summary = buildProcessingQueueSummary(projects, clips, jobs);

  assert.equal(summary.transcribingClipsCount, 4);
  assert.equal(summary.renderingClipsCount, 7); // 6 from p2 + 1 standalone c2
  assert.equal(summary.totalActiveClipsCount, 11);
  assert.equal(summary.activeProjectsCount, 2);
  // Weighted avg uses only real reported progress: (40*4 + 80*6) / 10 = 64
  assert.equal(summary.progressPercent, 64);
  assert.equal(summary.hasActiveQueue, true);
  assert.equal(summary.activeProjectItems.length, 2);
});

test('buildProcessingQueueSummary keeps progressPercent null instead of fabricating percentages when backend reports null', () => {
  const summary = buildProcessingQueueSummary(
    [makeProject('p1', 'processing', 3, 'j1')],
    [],
    [makeJob('j1', 'p1', 'speech_transcription', null)]
  );

  assert.equal(summary.totalActiveClipsCount, 3);
  assert.equal(summary.progressPercent, null);
  assert.equal(summary.activeProjectItems[0]?.progressPercent, null);
});

test('buildProcessingQueueSummary returns clean idle state when nothing is queued or rendering', () => {
  const summary = buildProcessingQueueSummary(
    [makeProject('p1', 'completed', 5)],
    [makeClip('c1', 'p1', 'completed')],
    []
  );

  assert.equal(summary.totalActiveClipsCount, 0);
  assert.equal(summary.transcribingClipsCount, 0);
  assert.equal(summary.renderingClipsCount, 0);
  assert.equal(summary.activeProjectsCount, 0);
  assert.equal(summary.progressPercent, 0);
  assert.equal(summary.hasActiveQueue, false);
});
