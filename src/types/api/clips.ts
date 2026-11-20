import type {
  CaptionRenderStatus,
  Clip,
  ClipCaptionOverride,
  ClipScoringBreakdown,
  ClipScoringFactor,
  ClipStatus,
  ClipUpdateRequest,
  ExportStatus,
} from '../clip';

export type {
  CaptionRenderStatus,
  Clip,
  ClipCaptionOverride,
  ClipScoringBreakdown,
  ClipScoringFactor,
  ClipStatus,
  ClipUpdateRequest,
  ExportStatus,
};

export interface ClipDetectRequest {
  desiredClipCount: number;
  minDurationSec: number;
  preferredDurationSec: number;
  maxDurationSec: number;
}
