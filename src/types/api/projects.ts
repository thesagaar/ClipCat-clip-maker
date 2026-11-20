import type {
  AspectRatio,
  CaptionFontSizeOption,
  CaptionPositionOption,
  CreateProjectFromUrlRequest,
  CreateProjectRequest,
  OutputResolution,
  ProcessingConfig,
  Project,
  ProjectSourceType,
  ProjectStatus,
  StartProcessingResponse,
  VideoLayoutMode,
} from '../project';

export type {
  AspectRatio,
  CaptionFontSizeOption,
  CaptionPositionOption,
  CreateProjectFromUrlRequest,
  CreateProjectRequest,
  OutputResolution,
  ProcessingConfig,
  Project,
  ProjectSourceType,
  ProjectStatus,
  StartProcessingResponse,
  VideoLayoutMode,
};

export interface RenameProjectRequest {
  name: string;
}
