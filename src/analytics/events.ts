export const ANALYTICS_EVENT_NAMES = [
  'app_opened',
  'page_viewed',
  'project_creation_started',
  'project_creation_completed',
  'upload_started',
  'upload_validation_failed',
  'processing_started',
  'processing_stage_completed',
  'processing_failed',
  'export_started',
  'export_completed',
  'export_failed',
  'api_connection_failed',
  'settings_updated',
  'application_error',
  'unhandled_exception',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const DIAGNOSTIC_EVENT_NAMES: ReadonlySet<AnalyticsEventName> = new Set([
  'api_connection_failed',
  'application_error',
  'unhandled_exception',
]);

export interface SanitizedAnalyticsEnvelope {
  eventId: string;
  event: AnalyticsEventName;
  category: 'usage' | 'diagnostic';
  timestamp: string;
  appVersion: string;
  route: string;
  runtime: 'web' | 'desktop';
  viewportBucket: 'mobile' | 'tablet' | 'desktop';
  properties: Record<string, string | number | boolean>;
}

export const ALLOWED_PROPERTY_KEYS_BY_EVENT: Record<
  AnalyticsEventName,
  readonly string[]
> = {
  app_opened: ['themeMode', 'startupBehavior'],
  page_viewed: ['pageGroup', 'themeMode'],
  project_creation_started: ['inputMode'],
  project_creation_completed: ['inputMode', 'aspectRatio', 'captionsEnabled', 'resolution'],
  upload_started: ['fileExtension', 'sizeBucket'],
  upload_validation_failed: ['reasonCode'],
  processing_started: ['aspectRatio', 'resolution', 'captionsEnabled', 'desiredClipCount'],
  processing_stage_completed: ['stage', 'durationMs'],
  processing_failed: ['stage', 'errorCategory'],
  export_started: ['exportFormat', 'clipCount'],
  export_completed: ['exportFormat', 'clipCount'],
  export_failed: ['exportFormat', 'errorCategory'],
  api_connection_failed: ['errorCategory', 'statusCode', 'operation'],
  settings_updated: ['section', 'themeMode'],
  application_error: ['errorCategory', 'errorMessage', 'stackSummary', 'componentHint'],
  unhandled_exception: ['errorCategory', 'errorMessage', 'stackSummary', 'sourceType'],
};

export const EXCLUDED_DATA_CATEGORIES = [
  'Video and audio file contents, streams, and thumbnails/frames',
  'Speech transcripts, edited captions, SRT/VTT files, and clip descriptions',
  'Project titles, clip titles, notes, and original media filenames',
  'Local filesystem paths (Windows C:\\... or POSIX /Users/... /home/...)',
  'Full media URLs, query parameters, fragments, and configured LAN IP addresses',
  'API keys, OAuth/JWT tokens, passwords, and authentication headers',
  'User emails, form values, clipboard contents, keystrokes, and session replay recordings',
  'Raw HTTP request/response bodies and localStorage contents',
] as const;
