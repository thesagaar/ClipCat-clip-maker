/**
 * Standard FastAPI / Pydantic v2 error & status shapes expected by ClipCat.
 */

export type FeatureIntegrationStatus =
  | 'BACKEND_NOT_CONNECTED'
  | 'FEATURE_NOT_IMPLEMENTED'
  | 'MOCK_DATA'
  | 'UPLOAD_NOT_AVAILABLE'
  | 'PUBLISHING_NOT_AVAILABLE'
  | 'READY';

export type EndpointContractStatus =
  | 'EXISTING_FRONTEND_API'
  | 'FRONTEND_MOCK_ONLY'
  | 'BACKEND_NOT_IMPLEMENTED'
  | 'CONTRACT_REQUIRES_CONFIRMATION'
  | 'READY_FOR_BACKEND'
  | 'IMPLEMENTED_AND_VERIFIED';

export interface PydanticValidationErrorItem {
  loc: Array<string | number>;
  msg: string;
  type: string;
}

export interface ApiErrorResponse {
  detail: string | PydanticValidationErrorItem[];
  message?: string | null;
  code?: string | null;
  fieldErrors?: Record<string, string> | null;
}

export interface OperationStatusResponse {
  ok: boolean;
  message: string;
}
