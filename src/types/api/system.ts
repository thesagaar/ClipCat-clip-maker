import type {
  DependenciesResponse,
  DependencyInfo,
  DependencyStatus,
  NotificationItem,
  StorageResponse,
  SystemHealthResponse,
} from '../system';

export type {
  DependenciesResponse,
  DependencyInfo,
  DependencyStatus,
  NotificationItem,
  StorageResponse,
  SystemHealthResponse,
};

/**
 * Expected FastAPI Pydantic models:
 * - SystemHealthResponse (GET /api/system/health)
 * - DependenciesResponse (GET /api/system/dependencies)
 * - StorageResponse (GET /api/system/storage)
 */
export interface BackendConnectionEnvelope {
  reachable: boolean;
  targetUrl: string;
  latencyMs: number;
  status: 'operational' | 'degraded' | 'unavailable';
  backendVersion: string | null;
  checkedAt: string;
  message: string;
}
