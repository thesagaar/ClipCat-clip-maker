import type {
  CaptionPreset,
  CreateCaptionPresetRequest,
  UpdateCaptionPresetRequest,
} from '../types/caption';
import { apiRequest, isMockApiEnabled } from './client';
import { ApiClientError } from './errors';
import { DEFAULT_CAPTION_PRESETS, mockApiState, simulateMockLatency } from './mockAdapter';

export async function listCaptionPresets(): Promise<CaptionPreset[]> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    return structuredClone(mockApiState.presets);
  }
  return apiRequest<CaptionPreset[]>('/api/caption-presets');
}

export async function createCaptionPreset(
  payload: CreateCaptionPresetRequest
): Promise<CaptionPreset> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    const created: CaptionPreset = {
      ...payload,
      id: `preset-${Date.now()}`,
      isDefault: false,
    };
    mockApiState.presets.push(created);
    return structuredClone(created);
  }
  return apiRequest<CaptionPreset>('/api/caption-presets', {
    method: 'POST',
    body: payload,
  });
}

export async function updateCaptionPreset(
  presetId: string,
  payload: UpdateCaptionPresetRequest
): Promise<CaptionPreset> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    const index = mockApiState.presets.findIndex((p) => p.id === presetId);
    if (index === -1) {
      throw new ApiClientError({
        message: 'Caption preset not found',
        code: 'NOT_FOUND',
        status: 404,
      });
    }
    mockApiState.presets[index] = {
      ...mockApiState.presets[index],
      ...payload,
    };
    return structuredClone(mockApiState.presets[index]);
  }
  return apiRequest<CaptionPreset>(`/api/caption-presets/${encodeURIComponent(presetId)}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function deleteCaptionPreset(presetId: string): Promise<void> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    const target = mockApiState.presets.find((p) => p.id === presetId);
    if (target?.isDefault) {
      throw new ApiClientError({
        message: 'Default caption presets cannot be deleted.',
        code: 'VALIDATION_ERROR',
        status: 400,
      });
    }
    mockApiState.presets = mockApiState.presets.filter((p) => p.id !== presetId);
    return;
  }
  await apiRequest<void>(`/api/caption-presets/${encodeURIComponent(presetId)}`, {
    method: 'DELETE',
  });
}

export async function restoreDefaultCaptionPresets(): Promise<CaptionPreset[]> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    mockApiState.presets = structuredClone(DEFAULT_CAPTION_PRESETS);
    return structuredClone(mockApiState.presets);
  }
  return apiRequest<CaptionPreset[]>('/api/caption-presets/restore-defaults', {
    method: 'POST',
  });
}
