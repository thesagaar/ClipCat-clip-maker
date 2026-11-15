import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROCESSING_CONFIG } from '../config/env';
import type { Clip } from '../types/clip';
import type { Project } from '../types/project';
import {
  calculateClipSummary,
  filterAndSortClips,
  filterAndSortProjects,
} from './filters';

const sampleProjects: Project[] = [
  {
    id: 'p1',
    name: 'Alpha Interview',
    sourceType: 'upload',
    sourceFilename: 'alpha.mp4',
    durationSec: 600,
    fileSizeBytes: 1000,
    clipCount: 2,
    status: 'completed',
    config: { ...DEFAULT_PROCESSING_CONFIG, projectName: 'Alpha Interview' },
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:10:00Z',
  },
  {
    id: 'p2',
    name: 'Beta Stream',
    sourceType: 'url',
    sourceFilename: 'beta_stream.mp4',
    durationSec: 1200,
    fileSizeBytes: 2000,
    clipCount: 6,
    status: 'processing',
    config: { ...DEFAULT_PROCESSING_CONFIG, projectName: 'Beta Stream' },
    createdAt: '2026-11-12T10:00:00Z',
    updatedAt: '2026-11-12T10:10:00Z',
  },
];

const baseClip = {
  projectId: 'p1',
  description: 'Desc',
  startSec: 10,
  endSec: 40,
  scoringBreakdown: {
    overallScore: 80,
    summary: 'Summary',
    disclaimer: 'Does not guarantee virality',
    factors: [],
  },
  aspectRatio: '9:16' as const,
  layoutMode: 'smart_face_tracking' as const,
  resolution: '1080p' as const,
  fileSizeBytes: 5000,
  captionStatus: 'applied' as const,
  exportStatus: 'ready' as const,
  captionSettings: {
    enabled: true,
    presetId: 'minimal-white',
    fontSize: 'medium' as const,
    position: 'bottom' as const,
    highlightKeywords: true,
    wordByWordAnimation: true,
    speakerLabels: false,
  },
};

const sampleClips: Clip[] = [
  {
    ...baseClip,
    id: 'c1',
    title: 'Short Hook',
    durationSec: 20,
    aiScore: 76,
    status: 'needs_attention',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
  },
  {
    ...baseClip,
    id: 'c2',
    title: 'Deep Explanation',
    durationSec: 50,
    aiScore: 92,
    status: 'completed',
    createdAt: '2026-11-11T10:00:00Z',
    updatedAt: '2026-11-11T10:00:00Z',
  },
];

test('filterAndSortProjects filters by query and status and sorts accurately', () => {
  const onlyCompleted = filterAndSortProjects(sampleProjects, {
    searchQuery: '',
    statusFilter: 'completed',
    sortBy: 'newest',
  });
  assert.equal(onlyCompleted.length, 1);
  assert.equal(onlyCompleted[0].id, 'p1');

  const searchBeta = filterAndSortProjects(sampleProjects, {
    searchQuery: 'beta',
    statusFilter: 'all',
    sortBy: 'newest',
  });
  assert.equal(searchBeta.length, 1);
  assert.equal(searchBeta[0].id, 'p2');

  const sortedByClips = filterAndSortProjects(sampleProjects, {
    searchQuery: '',
    statusFilter: 'all',
    sortBy: 'most_clips',
  });
  assert.equal(sortedByClips[0].id, 'p2');
});

test('filterAndSortClips and calculateClipSummary handle scoring and duration sorts', () => {
  const byScore = filterAndSortClips(sampleClips, {
    statusFilter: 'all',
    sortBy: 'highest_score',
  });
  assert.equal(byScore[0].id, 'c2');

  const byShortest = filterAndSortClips(sampleClips, {
    statusFilter: 'all',
    sortBy: 'shortest',
  });
  assert.equal(byShortest[0].id, 'c1');

  const summary = calculateClipSummary(sampleClips);
  assert.equal(summary.totalClips, 2);
  assert.equal(summary.averageDurationSec, 35);
  assert.equal(summary.bestScoringClip?.id, 'c2');
});
