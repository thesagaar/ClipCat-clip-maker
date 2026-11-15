import type {
  AspectRatio,
  CaptionFontSizeOption,
  CaptionPositionOption,
  OutputResolution,
  VideoLayoutMode,
} from './project';

export type ClipStatus = 'completed' | 'rendering' | 'failed' | 'needs_attention';
export type CaptionRenderStatus = 'applied' | 'disabled' | 'pending' | 'failed';
export type ExportStatus = 'ready' | 'not_exported' | 'exporting' | 'failed';

export interface ClipScoringFactor {
  label: string;
  score: number;
  maxScore: number;
  explanation: string;
}

export interface ClipScoringBreakdown {
  overallScore: number; // 0-100
  summary: string;
  disclaimer: string;
  factors: ClipScoringFactor[];
}

export interface ClipCaptionOverride {
  enabled: boolean;
  presetId: string;
  fontSize: CaptionFontSizeOption;
  position: CaptionPositionOption;
  highlightKeywords: boolean;
  wordByWordAnimation: boolean;
  speakerLabels: boolean;
}

export interface Clip {
  id: string;
  projectId: string;
  projectName?: string;
  title: string;
  description: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  aiScore: number; // 0-100
  scoringBreakdown: ClipScoringBreakdown;
  thumbnailUrl?: string | null;
  previewVideoUrl?: string | null;
  downloadUrl?: string | null;
  srtUrl?: string | null;
  vttUrl?: string | null;
  metadataUrl?: string | null;
  aspectRatio: AspectRatio;
  layoutMode: VideoLayoutMode;
  resolution: OutputResolution;
  fileSizeBytes: number | null;
  status: ClipStatus;
  captionStatus: CaptionRenderStatus;
  exportStatus: ExportStatus;
  captionSettings: ClipCaptionOverride;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string | null;
}

export interface ClipUpdateRequest {
  title?: string;
  description?: string;
  startSec?: number;
  endSec?: number;
  aspectRatio?: AspectRatio;
  layoutMode?: VideoLayoutMode;
  resolution?: OutputResolution;
  captionSettings?: Partial<ClipCaptionOverride>;
}

export interface ClipRenderRequest {
  startSec: number;
  endSec: number;
  aspectRatio: AspectRatio;
  layoutMode: VideoLayoutMode;
  resolution: OutputResolution;
  captionSettings: ClipCaptionOverride;
}

export type ExportArtifactType = 'mp4' | 'srt' | 'vtt' | 'json' | 'thumbnail';

export interface BatchExportRequest {
  clipIds: string[];
  formats: ExportArtifactType[];
}

export interface BatchExportResponse {
  archiveUrl: string | null;
  exportedCount: number;
  message: string;
}
