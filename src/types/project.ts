export type ProjectStatus =
  | 'draft'
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ProjectSourceType = 'upload' | 'url';

export type AspectRatio = '9:16' | '16:9' | '1:1';

export type VideoLayoutMode =
  | 'smart_face_tracking'
  | 'center_crop'
  | 'blurred_background'
  | 'split_screen';

export type OutputResolution = '720p' | '1080p';

export type CaptionFontSizeOption = 'small' | 'medium' | 'large';
export type CaptionPositionOption = 'top' | 'center' | 'bottom';

export interface ProcessingConfig {
  projectName: string;
  outputDirectory?: string;
  desiredClipCount: number;
  minDurationSec: number;
  preferredDurationSec: number;
  maxDurationSec: number;
  aspectRatio: AspectRatio;
  layoutMode: VideoLayoutMode;
  captionsEnabled: boolean;
  captionPresetId: string;
  captionFontSize: CaptionFontSizeOption;
  captionPosition: CaptionPositionOption;
  highlightKeywords: boolean;
  wordByWordAnimation: boolean;
  speakerLabels: boolean;
  outputFormat: 'mp4';
  videoCodec: 'h264';
  outputResolution: OutputResolution;
  outputFps: 30 | 60;
  autoProcess: boolean;
}

export interface SourceVideoMetadata {
  fileName: string;
  fileSizeBytes: number;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  fps?: number | null;
  codec?: string | null;
  sourceUrl?: string;
}

export interface Project {
  id: string;
  name: string;
  sourceType: ProjectSourceType;
  sourceFilename: string;
  sourceUrl?: string | null;
  thumbnailUrl?: string | null;
  durationSec: number | null;
  resolution?: string | null;
  fileSizeBytes: number | null;
  clipCount: number;
  status: ProjectStatus;
  activeJobId?: string | null;
  config: ProcessingConfig;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  processingDurationSec?: number | null;
  errorMessage?: string | null;
}

export interface CreateProjectRequest {
  name: string;
  sourceType: ProjectSourceType;
  sourceUrl?: string;
  config: ProcessingConfig;
}

export interface CreateProjectFromUrlRequest {
  name: string;
  url: string;
  config: ProcessingConfig;
}

export type UrlSourceCategory =
  | 'direct_mp4'
  | 'authorized_media'
  | 'youtube'
  | 'unsupported'
  | 'invalid';

export interface UrlValidationResult {
  valid: boolean;
  canAutoDownload: boolean;
  category: UrlSourceCategory;
  hostname: string | null;
  detectedFilename: string | null;
  message: string;
  restrictionReason?: string;
}

export interface StartProcessingResponse {
  jobId: string;
  projectId: string;
  status: 'queued' | 'processing';
}
