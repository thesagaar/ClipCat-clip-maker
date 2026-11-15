import type { Clip } from '../types/clip';
import type {
  CreateProjectFromUrlRequest,
  CreateProjectRequest,
  ProcessingConfig,
  Project,
  StartProcessingResponse,
} from '../types/project';
import type { Transcript } from '../types/transcript';
import { apiRequest, apiUpload, isMockApiEnabled } from './client';
import { ApiClientError } from './errors';
import { mockApiState, simulateMockLatency } from './mockAdapter';

export async function listProjects(): Promise<Project[]> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    return structuredClone(mockApiState.projects);
  }
  return apiRequest<Project[]>('/api/projects');
}

export async function getProject(projectId: string): Promise<Project> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    const found = mockApiState.projects.find((p) => p.id === projectId);
    if (!found) {
      throw new ApiClientError({
        message: `Project ${projectId} not found`,
        code: 'NOT_FOUND',
        status: 404,
      });
    }
    return structuredClone(found);
  }
  return apiRequest<Project>(`/api/projects/${encodeURIComponent(projectId)}`);
}

export async function createProject(payload: CreateProjectRequest): Promise<Project> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    const now = new Date().toISOString();
    const created: Project = {
      id: `proj-${Date.now()}`,
      name: payload.name,
      sourceType: payload.sourceType,
      sourceFilename: payload.sourceUrl ? 'remote_video.mp4' : 'untitled.mp4',
      sourceUrl: payload.sourceUrl ?? null,
      thumbnailUrl: null,
      durationSec: null,
      resolution: null,
      fileSizeBytes: null,
      clipCount: 0,
      status: 'draft',
      activeJobId: null,
      config: payload.config,
      createdAt: now,
      updatedAt: now,
    };
    mockApiState.projects.unshift(created);
    return structuredClone(created);
  }
  return apiRequest<Project>('/api/projects', {
    method: 'POST',
    body: payload,
  });
}

export async function uploadProjectVideo(params: {
  file: File;
  config: ProcessingConfig;
  durationSec?: number | null;
  resolution?: string | null;
  onProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
}): Promise<Project> {
  if (isMockApiEnabled()) {
    if (params.onProgress) {
      params.onProgress(35, Math.round(params.file.size * 0.35), params.file.size);
      await simulateMockLatency(120);
      params.onProgress(100, params.file.size, params.file.size);
    }
    const now = new Date().toISOString();
    const project: Project = {
      id: `proj-${Date.now()}`,
      name: params.config.projectName,
      sourceType: 'upload',
      sourceFilename: params.file.name,
      sourceUrl: null,
      thumbnailUrl: null,
      durationSec: params.durationSec ?? null,
      resolution: params.resolution ?? null,
      fileSizeBytes: params.file.size,
      clipCount: 0,
      status: 'uploaded',
      activeJobId: null,
      config: params.config,
      createdAt: now,
      updatedAt: now,
    };
    mockApiState.projects.unshift(project);
    return structuredClone(project);
  }

  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('name', params.config.projectName);
  formData.append('config', JSON.stringify(params.config));

  return apiUpload<Project>('/api/projects/upload', {
    formData,
    onProgress: params.onProgress,
    signal: params.signal,
  });
}

export async function createProjectFromUrl(
  payload: CreateProjectFromUrlRequest
): Promise<Project> {
  if (isMockApiEnabled()) {
    await simulateMockLatency(160);
    const now = new Date().toISOString();
    const filename = payload.url.split('/').pop()?.split('?')[0] || 'remote_video.mp4';
    const project: Project = {
      id: `proj-${Date.now()}`,
      name: payload.name,
      sourceType: 'url',
      sourceFilename: filename,
      sourceUrl: payload.url,
      thumbnailUrl: null,
      durationSec: null,
      resolution: null,
      fileSizeBytes: null,
      clipCount: 0,
      status: 'uploaded',
      activeJobId: null,
      config: payload.config,
      createdAt: now,
      updatedAt: now,
    };
    mockApiState.projects.unshift(project);
    return structuredClone(project);
  }

  return apiRequest<Project>('/api/projects/from-url', {
    method: 'POST',
    body: payload,
  });
}

export async function renameProject(projectId: string, name: string): Promise<Project> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    const found = mockApiState.projects.find((p) => p.id === projectId);
    if (!found) {
      throw new ApiClientError({ message: 'Project not found', code: 'NOT_FOUND', status: 404 });
    }
    found.name = name;
    found.config.projectName = name;
    found.updatedAt = new Date().toISOString();
    return structuredClone(found);
  }

  return apiRequest<Project>(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    body: { name },
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    mockApiState.projects = mockApiState.projects.filter((p) => p.id !== projectId);
    mockApiState.clips = mockApiState.clips.filter((c) => c.projectId !== projectId);
    return;
  }

  await apiRequest<void>(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
}

export async function startProjectProcessing(
  projectId: string,
  config?: ProcessingConfig
): Promise<StartProcessingResponse> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    const project = mockApiState.projects.find((p) => p.id === projectId);
    if (!project) {
      throw new ApiClientError({ message: 'Project not found', code: 'NOT_FOUND', status: 404 });
    }
    const jobId = `job-${Date.now()}`;
    project.status = 'processing';
    project.activeJobId = jobId;
    project.updatedAt = new Date().toISOString();
    mockApiState.jobs[jobId] = {
      id: jobId,
      projectId,
      projectName: project.name,
      status: 'running',
      overallProgress: 12,
      currentStageId: 'media_inspection',
      currentTask: '[Mock] Inspecting video streams with FFprobe...',
      elapsedSec: 4,
      estimatedRemainingSec: null,
      stages: [
        { id: 'video_validation', order: 1, label: 'Video validation', status: 'completed', progressPercent: 100 },
        { id: 'media_inspection', order: 2, label: 'Media inspection', status: 'running', progressPercent: 40 },
        { id: 'audio_extraction', order: 3, label: 'Audio extraction', status: 'waiting', progressPercent: null },
        { id: 'speech_transcription', order: 4, label: 'Speech transcription', status: 'waiting', progressPercent: null },
        { id: 'ai_moment_detection', order: 5, label: 'AI moment detection', status: 'waiting', progressPercent: null },
        { id: 'clip_scoring', order: 6, label: 'Clip scoring', status: 'waiting', progressPercent: null },
        { id: 'smart_cropping', order: 7, label: 'Smart cropping', status: 'waiting', progressPercent: null },
        { id: 'caption_generation', order: 8, label: 'Caption generation', status: 'waiting', progressPercent: null },
        { id: 'video_rendering', order: 9, label: 'Video rendering', status: 'waiting', progressPercent: null },
        { id: 'export_validation', order: 10, label: 'Export validation', status: 'waiting', progressPercent: null },
      ],
      logs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'info',
          stageId: 'video_validation',
          message: '[Mock] Project queued and media container validated.',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return { jobId, projectId, status: 'processing' };
  }

  return apiRequest<StartProcessingResponse>(
    `/api/projects/${encodeURIComponent(projectId)}/process`,
    {
      method: 'POST',
      body: config ? { config } : undefined,
    }
  );
}

export async function getProjectTranscript(projectId: string): Promise<Transcript> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    return mockApiState.getTranscript(projectId);
  }
  return apiRequest<Transcript>(
    `/api/projects/${encodeURIComponent(projectId)}/transcript`
  );
}

export async function getProjectClips(projectId: string): Promise<Clip[]> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    return structuredClone(mockApiState.clips.filter((c) => c.projectId === projectId));
  }
  return apiRequest<Clip[]>(`/api/projects/${encodeURIComponent(projectId)}/clips`);
}
