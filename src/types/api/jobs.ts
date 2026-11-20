import type {
  JobLogEntry,
  JobStatus,
  ProcessingJob,
  ProcessingStage,
  ProcessingStageId,
  StageStatus,
} from '../job';

export type {
  JobLogEntry,
  JobStatus,
  ProcessingJob,
  ProcessingStage,
  ProcessingStageId,
  StageStatus,
};

export interface ProcessingQueueProjectItem {
  projectId: string;
  projectName: string;
  phase: 'transcribing' | 'rendering' | 'queued';
  clipCount: number;
  progressPercent: number;
}

export interface ProcessingQueueSummary {
  totalActiveClipsCount: number;
  transcribingClipsCount: number;
  renderingClipsCount: number;
  activeProjectsCount: number;
  progressPercent: number;
  hasActiveQueue: boolean;
  activeProjectItems: ProcessingQueueProjectItem[];
}
