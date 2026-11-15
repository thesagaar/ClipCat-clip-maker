import type { AppSettings, ClearTempFilesResponse } from '../types/settings';
import { apiRequest, isMockApiEnabled } from './client';
import { DEFAULT_APP_SETTINGS, mockApiState, simulateMockLatency } from './mockAdapter';

export async function getSettings(): Promise<AppSettings> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    return structuredClone(mockApiState.settings);
  }
  return apiRequest<AppSettings>('/api/settings');
}

export async function updateSettings(settings: AppSettings): Promise<AppSettings> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    mockApiState.settings = structuredClone(settings);
    return structuredClone(mockApiState.settings);
  }
  return apiRequest<AppSettings>('/api/settings', {
    method: 'PUT',
    body: settings,
  });
}

export async function resetSettings(): Promise<AppSettings> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    mockApiState.settings = structuredClone(DEFAULT_APP_SETTINGS);
    return structuredClone(mockApiState.settings);
  }
  return apiRequest<AppSettings>('/api/settings/reset', {
    method: 'POST',
  });
}

export async function clearTemporaryFiles(): Promise<ClearTempFilesResponse> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    return {
      freedBytes: 43_000_000,
      message: '[Mock] Temporary cache cleared.',
    };
  }
  return apiRequest<ClearTempFilesResponse>('/api/settings/clear-temp', {
    method: 'POST',
  });
}
