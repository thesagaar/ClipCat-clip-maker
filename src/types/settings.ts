import type { CaptionFontSizeOption, CaptionPositionOption } from './project';

export type WhisperModelSize = 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';
export type StartupBehavior = 'dashboard' | 'new_project' | 'last_project';

export interface GeneralSettings {
  applicationName: string;
  theme: 'dark' | 'light' | 'system';
  language: string;
  startupBehavior: StartupBehavior;
}

export interface ProcessingSettings {
  whisperModel: WhisperModelSize;
  cpuThreads: number;
  defaultClipCount: number;
  defaultMinDurationSec: number;
  defaultPreferredDurationSec: number;
  defaultMaxDurationSec: number;
  concurrentJobs: number;
  cleanupTempFilesOnComplete: boolean;
}

export interface CaptionDefaultSettings {
  defaultPresetId: string;
  fontSize: CaptionFontSizeOption;
  highlightColor: string;
  position: CaptionPositionOption;
}

export interface StorageSettings {
  projectDirectory: string;
  exportDirectory: string;
  tempDirectory: string;
}

export interface AppSettings {
  general: GeneralSettings;
  processing: ProcessingSettings;
  captions: CaptionDefaultSettings;
  storage: StorageSettings;
}

export interface ClearTempFilesResponse {
  freedBytes: number;
  message: string;
}
