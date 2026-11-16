import type { Clip } from '../../types/clip';
import type { Project } from '../../types/project';

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
