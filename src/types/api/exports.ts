import type {
  BatchExportRequest,
  BatchExportResponse,
  ExportArtifactType,
} from '../clip';

export type { BatchExportRequest, BatchExportResponse, ExportArtifactType };

export interface DownloadVerificationResult {
  started: boolean;
  error?: string;
}
