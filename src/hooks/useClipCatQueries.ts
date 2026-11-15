import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelJob,
  clearTemporaryFiles,
  createCaptionPreset,
  deleteCaptionPreset,
  deleteClip,
  deleteProject,
  getClip,
  getJob,
  getProject,
  getProjectClips,
  getProjectTranscript,
  getSettings,
  getSystemDependencies,
  getSystemHealth,
  getSystemStorage,
  listAllClips,
  listCaptionPresets,
  listProjects,
  renameProject,
  renderClip,
  resetSettings,
  restoreDefaultCaptionPresets,
  startProjectProcessing,
  updateCaptionPreset,
  updateClip,
  updateSettings,
} from '../api';
import type {
  AppSettings,
  ClipRenderRequest,
  ClipUpdateRequest,
  CreateCaptionPresetRequest,
  ProcessingConfig,
  UpdateCaptionPresetRequest,
} from '../types';

export const queryKeys = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  projectClips: (id: string) => ['projects', id, 'clips'] as const,
  projectTranscript: (id: string) => ['projects', id, 'transcript'] as const,
  clips: ['clips'] as const,
  clip: (id: string) => ['clips', id] as const,
  job: (id: string) => ['jobs', id] as const,
  presets: ['caption-presets'] as const,
  settings: ['settings'] as const,
  health: ['system', 'health'] as const,
  dependencies: ['system', 'dependencies'] as const,
  storage: ['system', 'storage'] as const,
};

export function useProjectsQuery() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: listProjects,
    retry: 1,
  });
}

export function useProjectQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project(projectId ?? ''),
    queryFn: () => getProject(projectId!),
    enabled: Boolean(projectId),
    retry: 1,
  });
}

export function useProjectClipsQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projectClips(projectId ?? ''),
    queryFn: () => getProjectClips(projectId!),
    enabled: Boolean(projectId),
    retry: 1,
  });
}

export function useProjectTranscriptQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projectTranscript(projectId ?? ''),
    queryFn: () => getProjectTranscript(projectId!),
    enabled: Boolean(projectId),
    retry: 1,
  });
}

export function useAllClipsQuery() {
  return useQuery({
    queryKey: queryKeys.clips,
    queryFn: listAllClips,
    retry: 1,
  });
}

export function useClipQuery(clipId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.clip(clipId ?? ''),
    queryFn: () => getClip(clipId!),
    enabled: Boolean(clipId),
    retry: 1,
  });
}

export function useJobPollingQuery(jobId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.job(jobId ?? ''),
    queryFn: () => getJob(jobId!),
    enabled: Boolean(jobId) && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        return false;
      }
      return 2000;
    },
    retry: 1,
  });
}

export function useCaptionPresetsQuery() {
  return useQuery({
    queryKey: queryKeys.presets,
    queryFn: listCaptionPresets,
    retry: 1,
  });
}

export function useSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: getSettings,
    retry: 1,
  });
}

export function useSystemHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: getSystemHealth,
    refetchInterval: 30000,
    retry: false,
  });
}

export function useSystemDependenciesQuery() {
  return useQuery({
    queryKey: queryKeys.dependencies,
    queryFn: getSystemDependencies,
    retry: false,
  });
}

export function useSystemStorageQuery() {
  return useQuery({
    queryKey: queryKeys.storage,
    queryFn: getSystemStorage,
    retry: false,
  });
}

export function useRenameProjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) =>
      renameProject(projectId, name),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.projects });
      qc.invalidateQueries({ queryKey: queryKeys.project(vars.projectId) });
    },
  });
}

export function useDeleteProjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects });
      qc.invalidateQueries({ queryKey: queryKeys.clips });
      qc.invalidateQueries({ queryKey: queryKeys.storage });
    },
  });
}

export function useStartProcessingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      config,
    }: {
      projectId: string;
      config?: ProcessingConfig;
    }) => startProjectProcessing(projectId, config),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.projects });
      qc.invalidateQueries({ queryKey: queryKeys.project(vars.projectId) });
    },
  });
}

export function useCancelJobMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => cancelJob(jobId),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.job(data.id), data);
      qc.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useUpdateClipMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clipId, payload }: { clipId: string; payload: ClipUpdateRequest }) =>
      updateClip(clipId, payload),
    onSuccess: (clip) => {
      qc.setQueryData(queryKeys.clip(clip.id), clip);
      qc.invalidateQueries({ queryKey: queryKeys.projectClips(clip.projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.clips });
    },
  });
}

export function useRenderClipMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clipId, payload }: { clipId: string; payload: ClipRenderRequest }) =>
      renderClip(clipId, payload),
    onSuccess: (clip) => {
      qc.setQueryData(queryKeys.clip(clip.id), clip);
      qc.invalidateQueries({ queryKey: queryKeys.projectClips(clip.projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.clips });
    },
  });
}

export function useDeleteClipMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clipId: string) => deleteClip(clipId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clips });
      qc.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useCreateCaptionPresetMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCaptionPresetRequest) => createCaptionPreset(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.presets }),
  });
}

export function useUpdateCaptionPresetMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      presetId,
      payload,
    }: {
      presetId: string;
      payload: UpdateCaptionPresetRequest;
    }) => updateCaptionPreset(presetId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.presets }),
  });
}

export function useDeleteCaptionPresetMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (presetId: string) => deleteCaptionPreset(presetId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.presets }),
  });
}

export function useRestoreDefaultPresetsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: restoreDefaultCaptionPresets,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.presets }),
  });
}

export function useUpdateSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: AppSettings) => updateSettings(settings),
    onSuccess: (data) => qc.setQueryData(queryKeys.settings, data),
  });
}

export function useResetSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: resetSettings,
    onSuccess: (data) => qc.setQueryData(queryKeys.settings, data),
  });
}

export function useClearTempFilesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clearTemporaryFiles,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.storage }),
  });
}
