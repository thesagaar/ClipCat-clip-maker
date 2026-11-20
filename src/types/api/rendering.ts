import type { ClipRenderRequest } from '../clip';
import type { AspectRatio, OutputResolution, VideoLayoutMode } from '../project';

export type { AspectRatio, ClipRenderRequest, OutputResolution, VideoLayoutMode };

export interface SmartFramingPreference {
  aspectRatio: AspectRatio;
  layoutMode: VideoLayoutMode;
  subjectTrackingSupportedByBackend: boolean;
}

export interface RenderStatusResponse {
  clipId: string;
  status: 'queued' | 'rendering' | 'completed' | 'failed';
  progressPercent: number | null;
  outputResolution: OutputResolution;
  aspectRatio: AspectRatio;
  errorMessage: string | null;
}
