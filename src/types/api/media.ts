import type {
  SourceVideoMetadata,
  UrlSourceCategory,
  UrlValidationResult,
} from '../project';

export type { SourceVideoMetadata, UrlSourceCategory, UrlValidationResult };

export interface MediaUploadProgress {
  percent: number;
  loadedBytes: number;
  totalBytes: number;
}

export interface MediaProbeResponse {
  originalFilename: string;
  fileSizeBytes: number;
  durationSec: number;
  width: number;
  height: number;
  fps: number | null;
  codec: string | null;
  hasAudio: boolean;
}
