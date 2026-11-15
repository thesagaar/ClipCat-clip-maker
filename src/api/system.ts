import type {
  DependenciesResponse,
  StorageResponse,
  SystemHealthResponse,
} from '../types/system';
import { buildApiUrl, apiRequest, isMockApiEnabled } from './client';
import { mockApiState, simulateMockLatency } from './mockAdapter';

export interface BackendPingResult {
  reachable: boolean;
  targetUrl: string;
  latencyMs: number;
  status: 'operational' | 'degraded' | 'unavailable';
  backendVersion: string | null;
  checkedAt: string;
  message: string;
}

export async function getSystemHealth(): Promise<SystemHealthResponse> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    return mockApiState.getHealth();
  }
  return apiRequest<SystemHealthResponse>('/api/system/health');
}

export async function pingBackendServer(): Promise<BackendPingResult> {
  const targetUrl = buildApiUrl('/api/system/health');
  const startedAt = performance.now();

  try {
    // Always test the real configured FastAPI server, even if mock preview mode is active
    const health = await apiRequest<SystemHealthResponse>('/api/system/health', {
      timeoutMs: 5000,
    });
    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
    return {
      reachable: true,
      targetUrl,
      latencyMs,
      status: health.status === 'degraded' ? 'degraded' : 'operational',
      backendVersion: health.backendVersion ?? null,
      checkedAt: new Date().toISOString(),
      message: `Connected to FastAPI backend (${latencyMs} ms).`,
    };
  } catch (err) {
    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
    return {
      reachable: false,
      targetUrl,
      latencyMs,
      status: 'unavailable',
      backendVersion: null,
      checkedAt: new Date().toISOString(),
      message:
        err instanceof Error
          ? err.message
          : 'Unable to reach the configured FastAPI server.',
    };
  }
}

export async function getSystemDependencies(): Promise<DependenciesResponse> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    return mockApiState.getDependencies();
  }
  return apiRequest<DependenciesResponse>('/api/system/dependencies');
}

export async function getSystemStorage(): Promise<StorageResponse> {
  if (isMockApiEnabled()) {
    await simulateMockLatency();
    return mockApiState.getStorage();
  }
  return apiRequest<StorageResponse>('/api/system/storage');
}
