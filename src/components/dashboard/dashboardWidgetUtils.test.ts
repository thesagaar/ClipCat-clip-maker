import test from 'node:test';
import assert from 'node:assert/strict';
import type { Clip } from '../../types/clip';
import type { Project } from '../../types/project';
import { buildStudioActivityBreakdown } from './dashboardWidgetUtils';

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

function makeClip(id: string, projectId: string): Clip {
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
    status: 'completed',
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
    createdAt: '2026-11-15T00:00:00Z',
    updatedAt: '2026-11-15T00:00:00Z',
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
