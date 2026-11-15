# Product Analytics & Sanitized Error Tracking — ClipCat

**Product:** ClipCat — AI Video Clipping Studio  
**Parent Brand:** Single Dimension Projects (SDP)  
**Modules:** `src/analytics/events.ts`, `src/analytics/sanitize.ts`, `src/analytics/consentStore.ts`, `src/analytics/client.ts`, `src/analytics/errorAdapter.ts`, `src/components/legal/ConsentBanner.tsx`

---

## 1. Architecture & Privacy-By-Design Principles

ClipCat is designed to use **privacy-conscious usage analytics and sanitized technical error diagnostics** once configured and consented—never raw content tracking or zero-visibility claims.

### Dual Gate Before Any Transmission (`canDispatchAnalyticsEvent`)
Every call to `trackAnalyticsEvent()` must pass **both** checks before any network request is attempted:
1. **Explicit Environment Config:** `ENV.ANALYTICS_ENABLED === true` AND a valid `ENV.ANALYTICS_ENDPOINT` URL (plus `ENV.ERROR_REPORTING_ENABLED === true` for diagnostic events).
2. **Explicit User Consent:** Persisted in `localStorage['clipcat-consent-preferences']` (`hasResponded === true` and `analytics === true` for usage events, or `diagnostics === true` for error events).

### Resilience & Duplicate Burst Control
- Per-key cooldown (`2000ms` for usage events, `5000ms` for error events) prevents UI loops or React re-renders from flooding telemetry endpoints.
- Transport uses `navigator.sendBeacon` with fallback to `fetch(..., { credentials: 'omit', keepalive: true })` wrapped in `try/catch` + `.catch(() => {})` so offline endpoints or blocked requests **never break user workflows**.

---

## 2. Complete Allowlisted Event Catalog (`src/analytics/events.ts`)

| Category | Event Name | Allowed Properties | Trigger Location |
|---|---|---|---|
| Usage | `app_opened` | `themeMode`, `startupBehavior` | `src/App.tsx` |
| Usage | `page_viewed` | `pageGroup`, `themeMode` | `src/components/seo/RouteMeta.tsx` |
| Usage | `project_creation_started` | `inputMode` | `src/pages/NewProjectPage.tsx` |
| Usage | `project_creation_completed` | `inputMode`, `aspectRatio`, `captionsEnabled`, `resolution` | `src/pages/NewProjectPage.tsx` |
| Usage | `upload_started` | `fileExtension`, `sizeBucket` | `src/pages/NewProjectPage.tsx` |
| Usage | `upload_validation_failed` | `reasonCode` | `src/pages/NewProjectPage.tsx` |
| Usage | `processing_started` | `aspectRatio`, `resolution`, `captionsEnabled`, `desiredClipCount` | `src/pages/ProcessingPage.tsx` |
| Usage | `processing_stage_completed` | `stage`, `durationMs` | `src/pages/ProcessingPage.tsx` |
| Usage | `processing_failed` | `stage`, `errorCategory` | `src/pages/ProcessingPage.tsx` |
| Usage | `export_started` | `exportFormat`, `clipCount` | `src/pages/ExportManagerPage.tsx` |
| Usage | `export_completed` | `exportFormat`, `clipCount` | `src/pages/ExportManagerPage.tsx` |
| Usage | `export_failed` | `exportFormat`, `errorCategory` | `src/pages/ExportManagerPage.tsx` |
| Usage | `settings_updated` | `section`, `themeMode` | `src/pages/SettingsPage.tsx` |
| Diagnostic | `api_connection_failed` | `errorCategory`, `statusCode`, `operation` | `src/api/client.ts` via `errorAdapter.ts` |
| Diagnostic | `application_error` | `errorCategory`, `errorMessage`, `stackSummary`, `componentHint` | `src/components/ui/ErrorBoundary.tsx` |
| Diagnostic | `unhandled_exception` | `errorCategory`, `errorMessage`, `stackSummary`, `sourceType` | `window.onerror` / `unhandledrejection` |

---

## 3. Excluded Data Categories & Key Blocklist

### Excluded Categories (`EXCLUDED_DATA_CATEGORIES`)
1. Video and audio file contents, streams, and thumbnails/frames
2. Speech transcripts, edited captions, SRT/VTT files, and clip descriptions
3. Project titles, clip titles, notes, and original media filenames
4. Local filesystem paths (`C:\...`, `/Users/...`, `/home/...`, `/tmp/...`, etc.)
5. Full media URLs, query parameters, hash fragments, and LAN/private IP addresses
6. API keys, OAuth/JWT tokens, passwords, and authorization headers
7. User emails, phone numbers, raw form values, clipboard contents, keystrokes, and session-replay recordings
8. Raw HTTP request/response bodies and `localStorage` contents

### Explicit Code-Enforced Forbidden Keys (`FORBIDDEN_PROPERTY_KEYS`)
Any property matching these keys (case-insensitive) is stripped unconditionally even if mistakenly passed:
`video`, `audio`, `frame`, `frames`, `screenshot`, `screenshots`, `thumbnail`, `transcript`, `transcripts`, `caption`, `captions`, `subtitle`, `subtitles`, `note`, `notes`, `description`, `projectname`, `title`, `filename`, `sourcefilename`, `originalname`, `filepath`, `path`, `directory`, `projectdirectory`, `exportdirectory`, `tempdirectory`, `url`, `sourceurl`, `videourl`, `downloadurl`, `previewvideourl`, `archiveurl`, `apikey`, `token`, `accesstoken`, `refreshtoken`, `authorization`, `password`, `secret`, `credential`, `credentials`, `email`, `phone`, `ip`, `ipaddress`, `clipboard`, `keystroke`, `keystrokes`, `body`, `requestbody`, `responsebody`, `storage`, `localstorage`, `payload`, `cookie`, `cookies`, `user`, `username`.

### Route Anonymization (`sanitizeRouteIdentifier`)
- `/projects/proj_9a82b/processing?token=abc` -> `/projects/:id/processing`
- `/projects/proj_9a82b/clips#clip-1` -> `/projects/:id/clips`
- `/clips/clip_71/edit` -> `/clips/:id/edit`
- Unknown arbitrary paths -> `/unknown`

---

## 4. Sample Sanitized Payloads (Verified by `src/analytics/sanitize.test.ts`)

### Sample 1 — `page_viewed`
```json
{
  "eventId": "evt_mh0k9x_ab12cd",
  "event": "page_viewed",
  "category": "usage",
  "timestamp": "2026-11-15T11:38:00.000Z",
  "appVersion": "0.1.0",
  "route": "/projects/:id/processing",
  "runtime": "web",
  "viewportBucket": "mobile",
  "properties": {
    "pageGroup": "workspace",
    "themeMode": "dark"
  }
}
```
*(Notice: original query string, dynamic project ID, `filename`, `projectName`, and `transcript` keys are completely excluded.)*

### Sample 2 — `upload_started`
```json
{
  "eventId": "evt_mh0ka4_ef34gh",
  "event": "upload_started",
  "category": "usage",
  "timestamp": "2026-11-15T11:38:15.000Z",
  "appVersion": "0.1.0",
  "route": "/projects/new",
  "runtime": "desktop",
  "viewportBucket": "desktop",
  "properties": {
    "fileExtension": "mp4",
    "sizeBucket": "100MB-500MB"
  }
}
```

### Sample 3 — `api_connection_failed`
```json
{
  "eventId": "evt_mh0kah_ij56kl",
  "event": "api_connection_failed",
  "category": "diagnostic",
  "timestamp": "2026-11-15T11:38:22.000Z",
  "appVersion": "0.1.0",
  "route": "/settings",
  "runtime": "web",
  "viewportBucket": "desktop",
  "properties": {
    "errorCategory": "NETWORK_UNREACHABLE",
    "statusCode": 0,
    "operation": "api_request"
  }
}
```

### Sample 4 — `application_error` (Post-Scrubbing)
Raw exception input: `Failed reading C:\Users\alice\secret_clip.mp4 from https://user:pw@192.168.1.40:8000/api?token=eyJhbGciOiJIUzI1NiJ9.payload.sig`
```json
{
  "eventId": "evt_mh0kay_mn78op",
  "event": "application_error",
  "category": "diagnostic",
  "timestamp": "2026-11-15T11:38:30.000Z",
  "appVersion": "0.1.0",
  "route": "/clips/:id/edit",
  "runtime": "web",
  "viewportBucket": "desktop",
  "properties": {
    "errorCategory": "Error",
    "errorMessage": "Failed reading [REDACTED_PATH] from [REDACTED_URL]",
    "stackSummary": "Error: Failed reading [REDACTED_PATH] | at renderClip (src/pages/ClipEditorPage.tsx:104:12)",
    "componentHint": "ClipEditorPage"
  }
}
```

---

## 5. Recommended Provider & Future Activation Steps

To minimize third-party cookies and vendor lock-in while staying within free/self-hostable tiers:
- **Recommended Options:**
  1. **Self-hosted PostHog / Plausible CE / Umami**, or
  2. **First-party SDP Ingestion Endpoint** (`POST /api/telemetry/events` on a hardened FastAPI / Edge Worker ingestor) accepting the exact `SanitizedAnalyticsEnvelope` schema above, plus **Sentry (with `beforeSend` scrubbing & replay disabled)** if rich JS symbolication is desired later.
- **Activation Env Vars:**
  ```bash
  VITE_ANALYTICS_ENABLED=true
  VITE_ANALYTICS_PROVIDER=custom_endpoint
  VITE_ANALYTICS_ENDPOINT=https://<your-telemetry-ingestor>/events
  VITE_ERROR_REPORTING_ENABLED=true
  ```
- **Verification Completed:** Unit tests (`src/analytics/sanitize.test.ts` — 6 tests passing) verify dual gating, forbidden key removal, route ID stripping, file size bucketing, exception scrubbing, cooldown deduplication, and fail-safe transport error handling. Chromium network verification confirmed **0 telemetry requests** sent when disabled or before user consent.
