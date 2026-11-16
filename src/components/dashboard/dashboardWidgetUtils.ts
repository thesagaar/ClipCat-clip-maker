import type { Clip } from '../../types/clip';
import type { Project } from '../../types/project';

export const QUICK_START_DISMISSED_KEY = 'clipcat-quickstart-dismissed';

export interface ActivityMetricDatum {
  key: 'processed_videos' | 'clips_generated';
  label: string;
  shortLabel: string;
  count: number;
  fill: string;
  description: string;
}

export interface StudioActivitySummary {
  processedVideosCount: number;
  totalClipsCount: number;
  totalProjectsCount: number;
  activeJobsCount: number;
  averageClipsPerVideo: number;
  hasActivity: boolean;
  chartData: ActivityMetricDatum[];
}

export function buildStudioActivityBreakdown(
  projects: readonly Project[],
  clips: readonly Clip[]
): StudioActivitySummary {
  const processedVideosCount = projects.filter((p) => p.status === 'completed').length;
  const activeJobsCount = projects.filter(
    (p) => p.status === 'processing' || p.status === 'queued'
  ).length;
  const totalClipsCount = clips.length;
  const totalProjectsCount = projects.length;
  const averageClipsPerVideo =
    processedVideosCount > 0
      ? Math.round((totalClipsCount / processedVideosCount) * 10) / 10
      : 0;

  return {
    processedVideosCount,
    totalClipsCount,
    totalProjectsCount,
    activeJobsCount,
    averageClipsPerVideo,
    hasActivity: processedVideosCount > 0 || totalClipsCount > 0,
    chartData: [
      {
        key: 'processed_videos',
        label: 'Processed Videos',
        shortLabel: 'Videos',
        count: processedVideosCount,
        fill: '#0A84FF',
        description: 'Completed source videos processed cleanly',
      },
      {
        key: 'clips_generated',
        label: 'Clips Generated',
        shortLabel: 'Clips',
        count: totalClipsCount,
        fill: '#7040DC',
        description: 'Total short clips extracted across studio projects',
      },
    ],
  };
}

/**
 * Returns the most recently finished clips (status === 'completed'),
 * sorted newest-first and capped cleanly to the requested limit (default 5).
 */
export function getRecentCompletedClips(clips: readonly Clip[], limit = 5): Clip[] {
  if (!Array.isArray(clips) || clips.length === 0 || limit <= 0) {
    return [];
  }

  return clips
    .filter((clip) => clip.status === 'completed')
    .slice()
    .sort((a, b) => {
      const timeB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
      const timeA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
      return timeB - timeA;
    })
    .slice(0, limit);
}

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export function isQuickStartVisible(storage?: StorageLike | null): boolean {
  try {
    const store =
      storage !== undefined
        ? storage
        : typeof window !== 'undefined'
          ? window.localStorage
          : null;
    if (!store) return false;
    return store.getItem(QUICK_START_DISMISSED_KEY) !== '1';
  } catch {
    return false;
  }
}

export function markQuickStartDismissed(storage?: StorageLike | null): void {
  try {
    const store =
      storage !== undefined
        ? storage
        : typeof window !== 'undefined'
          ? window.localStorage
          : null;
    store?.setItem(QUICK_START_DISMISSED_KEY, '1');
  } catch {
    // Ignore storage quota/security exceptions in restricted environments
  }
}
