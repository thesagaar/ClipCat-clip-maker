export type DependencyStatus = 'operational' | 'warning' | 'not_installed' | 'unavailable';

export interface DependencyInfo {
  id: string;
  name: string;
  status: DependencyStatus;
  version: string | null;
  explanation: string;
  installInstructions?: string | null;
}

export interface SystemHealthResponse {
  status: 'operational' | 'degraded' | 'unavailable';
  backendVersion: string | null;
  uptimeSec: number | null;
  databaseStatus: DependencyStatus;
  activeJobsCount: number;
  cpuUsagePercent: number | null;
  ramUsedBytes: number | null;
  ramTotalBytes: number | null;
  checkedAt: string;
}

export interface DependenciesResponse {
  dependencies: DependencyInfo[];
  availableWhisperModels: string[];
  checkedAt: string;
}

export interface StorageResponse {
  totalUsedBytes: number;
  projectStorageBytes: number;
  exportStorageBytes: number;
  tempStorageBytes: number;
  availableDiskBytes: number | null;
  totalDiskBytes: number | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
  read: boolean;
  href?: string;
}
