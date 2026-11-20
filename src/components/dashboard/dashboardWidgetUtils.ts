import type { Clip } from '../../types/clip';
import type { ProcessingJob, ProcessingStageId } from '../../types/job';
import type { AspectRatio, Project } from '../../types/project';

export const QUICK_START_DISMISSED_KEY = 'clipcat-quickstart-dismissed';

export interface SmartFramingOption {
  value: AspectRatio;
  label: string;
  shortLabel: string;
  description: string;
}

export const SMART_FRAMING_OPTIONS: readonly SmartFramingOption[] = [
  {
    value: '9:16',
    label: 'Vertical',
    shortLabel: '9:16',
    description: 'Shorts, Reels & TikTok',
  },
  {
    value: '1:1',
    label: 'Square',
    shortLabel: '1:1',
    description: 'LinkedIn & Instagram Feed',
  },
  {
    value: '16:9',
    label: 'Horizontal',
    shortLabel: '16:9',
    description: 'YouTube & Widescreen',
  },
];

export function normalizeSmartFramingAspectRatio(value: unknown): AspectRatio {
  if (value === '9:16' || value === '1:1' || value === '16:9') {
    return value;
  }
  return '9:16';
}

const RENDERING_STAGE_IDS = new Set<ProcessingStageId>([
  'smart_cropping',
  'caption_generation',
  'video_rendering',
  'export_validation',
]);

export interface ActiveQueueProjectItem {
  projectId: string;
  projectName: string;
  clipCount: number;
  phase: 'transcribing' | 'rendering' | 'queued';
  progressPercent: number;
  currentTask: string;
}

export interface ProcessingQueueSummary {
  totalActiveClipsCount: number;
  transcribingClipsCount: number;
  renderingClipsCount: number;
  activeProjectsCount: number;
  progressPercent: number;
  hasActiveQueue: boolean;
  activeProjectItems: ActiveQueueProjectItem[];
}

export function buildProcessingQueueSummary(
  projects: readonly Project[],
  clips: readonly Clip[],
  activeJobs: readonly ProcessingJob[] = []
): ProcessingQueueSummary {
  const activeProjects = projects.filter(
    (p) => p.status === 'processing' || p.status === 'queued'
  );
  const activeProjectIdSet = new Set(activeProjects.map((p) => p.id));

  const jobByProjectId = new Map<string, ProcessingJob>();
  const jobById = new Map<string, ProcessingJob>();
  for (const job of activeJobs) {
    jobByProjectId.set(job.projectId, job);
    jobById.set(job.id, job);
  }

  let transcribingClipsCount = 0;
  let renderingClipsCount = 0;
  let weightedProgressSum = 0;
  let weightedClipDenom = 0;
  const activeProjectItems: ActiveQueueProjectItem[] = [];

  for (const project of activeProjects) {
    const job =
      (project.activeJobId ? jobById.get(project.activeJobId) : undefined) ??
      jobByProjectId.get(project.id);
    const clipCount = Math.max(1, project.config?.desiredClipCount || 0);

    let phase: ActiveQueueProjectItem['phase'] = 'transcribing';
    if (project.status === 'queued' || job?.status === 'queued') {
      phase = 'queued';
      transcribingClipsCount += clipCount;
    } else if (job?.currentStageId && RENDERING_STAGE_IDS.has(job.currentStageId)) {
      phase = 'rendering';
      renderingClipsCount += clipCount;
    } else {
      phase = 'transcribing';
      transcribingClipsCount += clipCount;
    }

    const rawProgress =
      typeof job?.overallProgress === 'number' && Number.isFinite(job.overallProgress)
        ? Math.min(100, Math.max(0, Math.round(job.overallProgress)))
        : project.status === 'queued'
          ? 0
          : 10;

    weightedProgressSum += rawProgress * clipCount;
    weightedClipDenom += clipCount;

    activeProjectItems.push({
      projectId: project.id,
      projectName: project.name,
      clipCount,
      phase,
      progressPercent: rawProgress,
      currentTask:
        job?.currentTask ||
        (phase === 'queued'
          ? 'Queued for transcription and clipping'
          : 'Transcribing and analyzing segments'),
    });
  }

  // Include individual clips explicitly in rendering state for projects not already counted above
  const standaloneRenderingClips = clips.filter(
    (clip) => clip.status === 'rendering' && !activeProjectIdSet.has(clip.projectId)
  ).length;

  if (standaloneRenderingClips > 0) {
    renderingClipsCount += standaloneRenderingClips;
    weightedProgressSum += 50 * standaloneRenderingClips;
    weightedClipDenom += standaloneRenderingClips;
  }

  const totalActiveClipsCount = transcribingClipsCount + renderingClipsCount;
  const progressPercent =
    totalActiveClipsCount > 0 && weightedClipDenom > 0
      ? Math.min(100, Math.max(0, Math.round(weightedProgressSum / weightedClipDenom)))
      : 0;

  return {
    totalActiveClipsCount,
    transcribingClipsCount,
    renderingClipsCount,
    activeProjectsCount: activeProjects.length,
    progressPercent,
    hasActiveQueue: totalActiveClipsCount > 0,
    activeProjectItems,
  };
}

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
