export type ProcessingStageId =
  | 'video_validation'
  | 'media_inspection'
  | 'audio_extraction'
  | 'speech_transcription'
  | 'ai_moment_detection'
  | 'clip_scoring'
  | 'smart_cropping'
  | 'caption_generation'
  | 'video_rendering'
  | 'export_validation';

export type StageStatus =
  | 'waiting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type JobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ProcessingStage {
  id: ProcessingStageId;
  order: number;
  label: string;
  status: StageStatus;
  progressPercent: number | null;
  detail?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface JobLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  stageId?: ProcessingStageId;
  message: string;
}

export interface ProcessingJob {
  id: string;
  projectId: string;
  projectName: string;
  status: JobStatus;
  overallProgress: number | null; // null indicates indeterminate progress from backend
  currentStageId: ProcessingStageId | null;
  currentTask: string;
  elapsedSec: number;
  estimatedRemainingSec: number | null;
  stages: ProcessingStage[];
  logs: JobLogEntry[];
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}
