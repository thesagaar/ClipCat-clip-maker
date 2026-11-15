import type {
  BatchExportRequest,
  BatchExportResponse,
  Clip,
  ClipRenderRequest,
  ClipUpdateRequest,
} from '../types/clip';
import { apiRequest, buildApiUrl, isMockApiEnabled } from './client';
import { ApiClientError } from './errors';
import { mockApiState, simulateMockLatency } from './mockAdapter';

export async function listAllClips(): Promise<Clip[]> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    return structuredClone(mockApiState.clips);
  }
  return apiRequest<Clip[]>('/api/clips');
}

export async function getClip(clipId: string): Promise<Clip> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    const clip = mockApiState.clips.find((c) => c.id === clipId);
    if (!clip) {
      throw new ApiClientError({
        message: `Clip ${clipId} not found.`,
        code: 'NOT_FOUND',
        status: 404,
      });
    }
    return structuredClone(clip);
  }
  return apiRequest<Clip>(`/api/clips/${encodeURIComponent(clipId)}`);
}

export function getClipPreviewUrl(clip: Clip): string | null {
  if (clip.previewVideoUrl) {
    return clip.previewVideoUrl.startsWith('http')
      ? clip.previewVideoUrl
      : buildApiUrl(clip.previewVideoUrl);
  }
  if (isMockApiEnabled()) {
    return null; // Mock mode explicitly has no fake video streams
  }
  return buildApiUrl(`/api/clips/${encodeURIComponent(clip.id)}/preview`);
}

export function getClipDownloadUrl(clip: Clip): string | null {
  if (clip.downloadUrl) {
    return clip.downloadUrl.startsWith('http')
      ? clip.downloadUrl
      : buildApiUrl(clip.downloadUrl);
  }
  if (isMockApiEnabled()) {
    return null;
  }
  return buildApiUrl(`/api/clips/${encodeURIComponent(clip.id)}/download`);
}

export async function updateClip(
  clipId: string,
  payload: ClipUpdateRequest
): Promise<Clip> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    const index = mockApiState.clips.findIndex((c) => c.id === clipId);
    if (index === -1) {
      throw new ApiClientError({ message: 'Clip not found', code: 'NOT_FOUND', status: 404 });
    }
    const existing = mockApiState.clips[index];
    const startSec = payload.startSec ?? existing.startSec;
    const endSec = payload.endSec ?? existing.endSec;
    const updated: Clip = {
      ...existing,
      ...payload,
      startSec,
      endSec,
      durationSec: Math.max(0, endSec - startSec),
      captionSettings: {
        ...existing.captionSettings,
        ...(payload.captionSettings ?? {}),
      },
      updatedAt: new Date().toISOString(),
    };
    mockApiState.clips[index] = updated;
    return structuredClone(updated);
  }

  return apiRequest<Clip>(`/api/clips/${encodeURIComponent(clipId)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function renderClip(
  clipId: string,
  payload: ClipRenderRequest
): Promise<Clip> {
  if (isMockApiEnabled()) {
    await simulateMockLatency(240);
    const index = mockApiState.clips.findIndex((c) => c.id === clipId);
    if (index === -1) {
      throw new ApiClientError({ message: 'Clip not found', code: 'NOT_FOUND', status: 404 });
    }
    const existing = mockApiState.clips[index];
    const updated: Clip = {
      ...existing,
      startSec: payload.startSec,
      endSec: payload.endSec,
      durationSec: Math.max(0, payload.endSec - payload.startSec),
      aspectRatio: payload.aspectRatio,
      layoutMode: payload.layoutMode,
      resolution: payload.resolution,
      captionSettings: payload.captionSettings,
      captionStatus: payload.captionSettings.enabled ? 'applied' : 'disabled',
      status: 'completed',
      exportStatus: 'ready',
      updatedAt: new Date().toISOString(),
    };
    mockApiState.clips[index] = updated;
    return structuredClone(updated);
  }

  return apiRequest<Clip>(`/api/clips/${encodeURIComponent(clipId)}/render`, {
    method: 'POST',
    body: payload,
  });
}

export async function deleteClip(clipId: string): Promise<void> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    mockApiState.clips = mockApiState.clips.filter((c) => c.id !== clipId);
    return;
  }
  await apiRequest<void>(`/api/clips/${encodeURIComponent(clipId)}`, {
    method: 'DELETE',
  });
}

export async function batchExportClips(
  payload: BatchExportRequest
): Promise<BatchExportResponse> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    return {
      archiveUrl: null,
      exportedCount: 0,
      message:
        'Mock Adapter active: actual MP4/SRT/VTT archives require the Python FastAPI backend.',
    };
  }
  return apiRequest<BatchExportResponse>('/api/clips/batch-export', {
    method: 'POST',
    body: payload,
  });
}
