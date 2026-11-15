import { create } from 'zustand';
import type { Clip, ClipCaptionOverride } from '../types/clip';
import type { AspectRatio, OutputResolution, VideoLayoutMode } from '../types/project';

interface EditorDraftState {
  clipId: string | null;
  title: string;
  description: string;
  startSec: number;
  endSec: number;
  aspectRatio: AspectRatio;
  layoutMode: VideoLayoutMode;
  resolution: OutputResolution;
  captionSettings: ClipCaptionOverride;
  playbackSpeed: number;
  isDirty: boolean;
  loadFromClip: (clip: Clip) => void;
  updateFields: (patch: Partial<Omit<EditorDraftState, 'loadFromClip' | 'updateFields' | 'updateCaptionSettings' | 'setPlaybackSpeed' | 'markSaved'>>) => void;
  updateCaptionSettings: (patch: Partial<ClipCaptionOverride>) => void;
  setPlaybackSpeed: (speed: number) => void;
  markSaved: () => void;
}

const defaultCaptions: ClipCaptionOverride = {
  enabled: true,
  presetId: 'minimal-white',
  fontSize: 'medium',
  position: 'bottom',
  highlightKeywords: true,
  wordByWordAnimation: true,
  speakerLabels: false,
};

export const useEditorStore = create<EditorDraftState>((set) => ({
  clipId: null,
  title: '',
  description: '',
  startSec: 0,
  endSec: 30,
  aspectRatio: '9:16',
  layoutMode: 'smart_face_tracking',
  resolution: '1080p',
  captionSettings: { ...defaultCaptions },
  playbackSpeed: 1,
  isDirty: false,

  loadFromClip: (clip) =>
    set({
      clipId: clip.id,
      title: clip.title,
      description: clip.description,
      startSec: clip.startSec,
      endSec: clip.endSec,
      aspectRatio: clip.aspectRatio,
      layoutMode: clip.layoutMode,
      resolution: clip.resolution,
      captionSettings: { ...clip.captionSettings },
      isDirty: false,
    }),

  updateFields: (patch) =>
    set((state) => ({
      ...state,
      ...patch,
      isDirty: true,
    })),

  updateCaptionSettings: (patch) =>
    set((state) => ({
      captionSettings: { ...state.captionSettings, ...patch },
      isDirty: true,
    })),

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  markSaved: () => set({ isDirty: false }),
}));
