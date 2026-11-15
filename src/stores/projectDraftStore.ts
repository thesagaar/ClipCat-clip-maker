import { create } from 'zustand';
import { DEFAULT_PROCESSING_CONFIG } from '../config/env';
import type {
  ProcessingConfig,
  ProjectSourceType,
  SourceVideoMetadata,
  UrlValidationResult,
} from '../types/project';

interface ProjectDraftState {
  inputMode: ProjectSourceType;
  selectedFile: File | null;
  previewObjectUrl: string | null;
  fileMetadata: SourceVideoMetadata | null;
  videoUrlInput: string;
  urlValidation: UrlValidationResult | null;
  config: ProcessingConfig;
  setInputMode: (mode: ProjectSourceType) => void;
  setSelectedFile: (file: File | null, metadata?: SourceVideoMetadata | null, objectUrl?: string | null) => void;
  setFileMetadata: (metadata: SourceVideoMetadata | null) => void;
  setVideoUrlInput: (url: string) => void;
  setUrlValidation: (result: UrlValidationResult | null) => void;
  updateConfig: (patch: Partial<ProcessingConfig>) => void;
  applyTemplateConfig: (patch: Partial<ProcessingConfig>) => void;
  resetDraft: () => void;
}

const initialConfig: ProcessingConfig = {
  projectName: '',
  outputDirectory: '',
  ...DEFAULT_PROCESSING_CONFIG,
};

export const useProjectDraftStore = create<ProjectDraftState>((set, get) => ({
  inputMode: 'upload',
  selectedFile: null,
  previewObjectUrl: null,
  fileMetadata: null,
  videoUrlInput: '',
  urlValidation: null,
  config: { ...initialConfig },

  setInputMode: (mode) => set({ inputMode: mode }),

  setSelectedFile: (file, metadata = null, objectUrl = null) => {
    const prevUrl = get().previewObjectUrl;
    if (prevUrl && prevUrl !== objectUrl) {
      URL.revokeObjectURL(prevUrl);
    }
    const baseName = file
      ? file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim()
      : '';

    set((state) => ({
      selectedFile: file,
      previewObjectUrl: objectUrl,
      fileMetadata: metadata,
      config: {
        ...state.config,
        projectName: state.config.projectName || baseName,
      },
    }));
  },

  setFileMetadata: (metadata) => set({ fileMetadata: metadata }),

  setVideoUrlInput: (url) => set({ videoUrlInput: url }),

  setUrlValidation: (result) =>
    set((state) => {
      const suggestedName =
        result?.detectedFilename?.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || '';
      return {
        urlValidation: result,
        config: {
          ...state.config,
          projectName: state.config.projectName || suggestedName,
        },
      };
    }),

  updateConfig: (patch) =>
    set((state) => ({
      config: { ...state.config, ...patch },
    })),

  applyTemplateConfig: (patch) =>
    set((state) => ({
      config: { ...state.config, ...patch },
    })),

  resetDraft: () => {
    const prevUrl = get().previewObjectUrl;
    if (prevUrl) {
      URL.revokeObjectURL(prevUrl);
    }
    set({
      selectedFile: null,
      previewObjectUrl: null,
      fileMetadata: null,
      videoUrlInput: '',
      urlValidation: null,
      config: { ...initialConfig },
    });
  },
}));
