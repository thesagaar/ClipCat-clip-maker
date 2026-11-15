import type { CaptionPositionOption } from './project';

export interface CaptionPreset {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  fontFamily: string;
  fontSizePx: number;
  primaryColor: string;
  highlightColor: string;
  outlineColor: string;
  outlineWidthPx: number;
  shadowEnabled: boolean;
  shadowColor: string;
  backgroundColor: string | null;
  position: CaptionPositionOption;
  wordsPerLine: number;
  uppercase: boolean;
  wordByWordHighlight: boolean;
}

export interface CreateCaptionPresetRequest {
  name: string;
  description: string;
  fontFamily: string;
  fontSizePx: number;
  primaryColor: string;
  highlightColor: string;
  outlineColor: string;
  outlineWidthPx: number;
  shadowEnabled: boolean;
  shadowColor: string;
  backgroundColor: string | null;
  position: CaptionPositionOption;
  wordsPerLine: number;
  uppercase: boolean;
  wordByWordHighlight: boolean;
}

export type UpdateCaptionPresetRequest = Partial<CreateCaptionPresetRequest>;
