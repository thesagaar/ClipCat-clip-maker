# ClipCat Backend Integration API Contract

**Project:** ClipCat — AI Video Clipping Studio  
**Parent Brand:** Single Dimension Projects (SDP)  
**Target Python Backend:** `http://127.0.0.1:8000` (API prefix `/api`)  
**Workspace Context Note:** None of the Python/FastAPI endpoints on `127.0.0.1:8000` are implemented in this repository yet (`BACKEND_NOT_IMPLEMENTED` / `READY_FOR_BACKEND`). Separately, the Vite/Express host server (`server.ts`, port `3000`) includes working local endpoints under `/api/chatspike/*` and `/api/publishing/*`; their schemas are documented in Sections J and K as canonical parity specifications for Claude's Python/FastAPI port. Never mark any Python/FastAPI endpoint as `IMPLEMENTED_AND_VERIFIED` until the Python service itself has been executed and verified.

---

## Status Label Legend

- `EXISTING_FRONTEND_API`: Typed client function + hooks already exist and call the documented endpoint when mock mode is off.
- `FRONTEND_MOCK_ONLY`: Endpoint only returns simulated responses inside `src/api/mockAdapter.ts` when dev mock preview is enabled; no FastAPI handler exists yet.
- `BACKEND_NOT_IMPLEMENTED`: No Python/FastAPI handler exists in this repo yet.
- `CONTRACT_REQUIRES_CONFIRMATION`: Endpoint shape or path alias needs final sign-off during backend implementation.
- `READY_FOR_BACKEND`: Request/response TypeScript types (`src/types/api/*`) and error normalization are complete and ready for FastAPI implementation.
- `IMPLEMENTED_AND_VERIFIED`: Reserved strictly for endpoints verified against the live Python/FastAPI server (not assigned anywhere in this document yet).

---

## Global Transport & Error Rules

- **Base URL:** `http://127.0.0.1:8000` (overridable in local dev via `VITE_API_BASE_URL` or Settings backend URL).
- **CORS Allowlist:** `http://localhost:3000`, `http://127.0.0.1:3000`, `tauri://localhost`, `http://tauri.localhost`. Never `allow_origins=["*"]` with credentials.
- **Auth Phase 1 vs Phase 2:**
  - *Phase 1 (Local Dev):* No mandatory FastAPI token on core `/api/*` routes unless enabled; Express routes `/api/chatspike/*` and `/api/publishing/*` use ephemeral `X-ClipCat-Token`.
  - *Phase 2 (Local Windows Install Hardening):* Per-install bearer token returned at desktop launch/handshake, injected automatically by `src/api/client.ts` (`setFastApiAuthToken`) as `Authorization: Bearer <token>`. Return HTTP `401`/`403` when missing/invalid (`ApiErrorCode = 'UNAUTHORIZED'`).
- **Standard Error Body:** `{ "detail": string | PydanticValidationErrorItem[], "code"?: string, "fieldErrors"?: Record<string, string> }`.
- **Progress Truthfulness:** Any unknown progress percentage or ETA MUST be `null` (never fake `0..100` ramps).

---

## Category A: System & Health

### `SYS-01` — `GET /api/system/health`
- **Purpose:** Backend health, DB availability, CPU/RAM metrics, active job count.
- **Request Headers:** `Accept: application/json`; Phase 2: `Authorization: Bearer <token>`.
- **Query / Body:** None.
- **Response Body (`200`):** `SystemHealthResponse` (`status`, `backendVersion`, `uptimeSec`, `databaseStatus`, `activeJobsCount`, `cpuUsagePercent`, `ramUsedBytes`, `ramTotalBytes`, `checkedAt`).
- **Error Responses:** `401` (`UNAUTHORIZED`), `503` (DB/runtime degraded).
- **Validation Rules:** `cpuUsagePercent` in `[0, 100]` or `null`; `activeJobsCount >= 0`.
- **Authentication:** Phase 1 optional / Phase 2 Bearer.
- **Expected Frontend Consumer:** `getSystemHealth`, `pingBackendServer` (`SystemStatusPage`, `AppShell`, `SettingsPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `SYS-02` — `GET /api/system/dependencies`
- **Purpose:** Report exact installed versions of `ffmpeg`, `ffprobe`, `faster-whisper`, CUDA/CPU runtime, and downloaded Whisper models.
- **Request Headers:** `Accept: application/json`; Phase 2: Bearer.
- **Query / Body:** None.
- **Response Body (`200`):** `DependenciesResponse` (`dependencies: DependencyInfo[]`, `availableWhisperModels: string[]`, `checkedAt`).
- **Error Responses:** `401`, `500`.
- **Validation Rules:** `status` in `['operational', 'warning', 'not_installed', 'unavailable']`.
- **Authentication:** Phase 1 optional / Phase 2 Bearer.
- **Expected Frontend Consumer:** `getSystemDependencies` (`SettingsPage`, `SystemStatusPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `SYS-03` — `GET /api/system/storage`
- **Purpose:** Disk usage summary inside `%LOCALAPPDATA%\ClipCat\ClipCatData` (without leaking sensitive OS user paths unless sanitized).
- **Request Headers:** `Accept: application/json`; Phase 2: Bearer.
- **Query / Body:** None.
- **Response Body (`200`):** `StorageResponse` (`totalUsedBytes`, `projectStorageBytes`, `exportStorageBytes`, `tempStorageBytes`, `availableDiskBytes`, `totalDiskBytes`).
- **Error Responses:** `401`, `500`.
- **Validation Rules:** Non-negative byte counts.
- **Authentication:** Phase 1 optional / Phase 2 Bearer.
- **Expected Frontend Consumer:** `getSystemStorage` (`AppShell`, `DashboardPage`, `MobileDashboardPage`, `SettingsPage`, `SystemStatusPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `SYS-04` — `POST /api/auth/handshake` *(Planned Phase 2)*
- **Purpose:** Issue ephemeral or per-install session Bearer token to authorized local frontend origin.
- **Request Headers / Body:** Desktop-supplied nonce or local origin challenge (`CONTRACT_REQUIRES_CONFIRMATION`).
- **Response Body (`200`):** `{ "token": string, "expiresInSec": number | null }`.
- **Error Responses:** `403`.
- **Expected Frontend Consumer:** Future `setFastApiAuthToken` bootstrap (`src/api/client.ts`).
- **Phase:** Phase 2.
- **Current Status:** `BACKEND_NOT_IMPLEMENTED` | `CONTRACT_REQUIRES_CONFIRMATION`

---

## Category B: Projects

### `PRJ-01` — `GET /api/projects`
- **Purpose:** List persisted ClipCat projects ordered newest first.
- **Response Body (`200`):** `Project[]`.
- **Error Responses:** `401`, `500`.
- **Validation Rules:** Valid `ProjectStatus` & ISO-8601 timestamps.
- **Authentication:** Phase 2 Bearer.
- **Expected Frontend Consumer:** `listProjects` -> `DashboardPage`, `MobileDashboardPage`, `ProjectsPage`.
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `PRJ-02` — `POST /api/projects`
- **Purpose:** Create a draft project before upload or processing.
- **Request Body:** `CreateProjectRequest` (`name`, `sourceType`, `sourceUrl?`, `config: ProcessingConfig`).
- **Response Body (`201`):** `Project`.
- **Error Responses:** `400`/`422` (`fieldErrors`).
- **Validation Rules:** `name` 1–120 chars without control characters; `desiredClipCount` 1..30; `5 <= minDurationSec <= preferredDurationSec <= maxDurationSec <= 300`.
- **Expected Frontend Consumer:** `createProject`.
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `PRJ-03` — `GET /api/projects/{projectId}`
- **Purpose:** Fetch single project details.
- **Response Body (`200`):** `Project`.
- **Error Responses:** `404` (`Project not found`).
- **Expected Frontend Consumer:** `getProject` (`ProcessingPage`, `ClipDiscoveryPage`, `PublishPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `PRJ-04` — `PATCH /api/projects/{projectId}`
- **Purpose:** Rename project (and update `config.projectName`).
- **Request Body:** `{ "name": string }`.
- **Response Body (`200`):** `Project`.
- **Error Responses:** `404`, `422`.
- **Expected Frontend Consumer:** `renameProject` (`ProjectsPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `PRJ-05` — `DELETE /api/projects/{projectId}`
- **Purpose:** Delete project, managed source media, thumbnails, transcripts, and clips.
- **Response Body:** `204 No Content`.
- **Error Responses:** `404`, `409` (cannot delete while active processing job holds lock unless cancelled).
- **Expected Frontend Consumer:** `deleteProject` (`ProjectsPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `PRJ-06` — `GET /api/projects/{projectId}/clips`
- **Purpose:** List generated clips for one project.
- **Response Body (`200`):** `Clip[]`.
- **Error Responses:** `404`.
- **Expected Frontend Consumer:** `getProjectClips` (`ClipDiscoveryPage`, `ProjectsPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `PRJ-07` — `POST /api/projects/{projectId}/process`
- **Purpose:** Enqueue & start local FFmpeg/faster-whisper job (enforcing 1 active processing job at a time).
- **Request Body:** `{ "config"?: ProcessingConfig }`.
- **Response Body (`202` or `200`):** `StartProcessingResponse` (`{ jobId, projectId, status: "queued" | "processing" }`).
- **Error Responses:** `404`, `409` (`ACTIVE_JOB_EXISTS`: another job is already running), `422`.
- **Expected Frontend Consumer:** `startProjectProcessing` (`NewProjectPage`, `QuickImportButton`, `ProcessingPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

---

## Category C: Media & Uploads

### `MED-01` — `POST /api/projects/upload`
- **Purpose:** Stream multipart video upload into sandboxed `%LOCALAPPDATA%\ClipCat\ClipCatData\projects\{id}\source`, probe via `ffprobe`, generate source thumbnail.
- **Request Headers:** `Content-Type: multipart/form-data`, `Accept: application/json`.
- **Request Body (`FormData`):** `file` (binary MP4/MOV/MKV/WEBM <= 8 GB), `name` (string), `config` (JSON string of `ProcessingConfig`).
- **Response Body (`201`):** `Project` (populated `durationSec`, `resolution`, `fileSizeBytes`, `thumbnailUrl`).
- **Error Responses:** `413` (too large), `422` (invalid container/codec via magic-bytes & `ffprobe`), `500`.
- **Expected Frontend Consumer:** `uploadProjectVideo` via `apiUpload` (`NewProjectPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `MED-02` — `POST /api/projects/from-url`
- **Purpose:** Validate direct media URL against SSRF rules, download into project directory, probe via `ffprobe`.
- **Request Body:** `CreateProjectFromUrlRequest` (`{ name, url, config }`).
- **Response Body (`201`):** `Project`.
- **Error Responses:** `422` (private/loopback host, non-media content-type, DRM/YouTube wall, timeout).
- **Validation Rules:** Block `localhost`, RFC1918, `169.254.0.0/16`, `100.64.0.0/10`, `fe80::/10` on initial DNS resolution AND HTTP redirects. Never bypass DRM/auth walls.
- **Expected Frontend Consumer:** `createProjectFromUrl` (`NewProjectPage`, `QuickImportButton`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `MED-03` — `GET /api/projects/{projectId}/thumbnail` & `GET /api/clips/{clipId}/thumbnail`
- **Purpose:** Serve JPEG/PNG thumbnail frame extracted via FFmpeg.
- **Response Body (`200`):** `image/jpeg` or `image/png`.
- **Error Responses:** `404`.
- **Authentication:** Phase 2: Signed HMAC URL or query-free Bearer fetch (`CONTRACT_REQUIRES_CONFIRMATION` for `<img src>` with Bearer auth).
- **Expected Frontend Consumer:** Thumbnail `<img>` URLs in `Project.thumbnailUrl` and `Clip.thumbnailUrl`.
- **Phase:** Phase 1 (open loopback) / Phase 2 (HMAC signed URLs).
- **Current Status:** `BACKEND_NOT_IMPLEMENTED` | `CONTRACT_REQUIRES_CONFIRMATION`

### `MED-04` — `GET /api/clips/{clipId}/preview`
- **Purpose:** Stream MP4 clip with HTTP `206 Partial Content` & `Accept-Ranges: bytes` for timeline seeking in `<video>`.
- **Request Headers:** Optional `Range: bytes=<start>-<end>`.
- **Response Body (`200` / `206`):** `video/mp4`.
- **Error Responses:** `404`, `416`.
- **Expected Frontend Consumer:** `getClipPreviewUrl` (`ClipEditorPage`, `PublishPage`, `ClipCard`).
- **Phase:** Phase 1 / Phase 2 HMAC URLs.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

---

## Category D: Transcription

### `TRN-01` — `GET /api/projects/{projectId}/transcript`
- **Purpose:** Return persisted Whisper transcript with word timestamps where available.
- **Response Body (`200`):** `Transcript` (`projectId`, `language`, `durationSec`, `modelUsed`, `segments[]`).
- **Error Responses:** `404` (not transcribed yet).
- **Expected Frontend Consumer:** `getProjectTranscript` (`useProjectTranscriptQuery`, `PublishPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

---

## Category E: Clip Detection

*(Clip detection runs as stages 5–6 inside `POST /api/projects/{projectId}/process`, returning scored clips via `GET /api/projects/{projectId}/clips`.)*

### `DET-01` — Candidate Approval/Rejection (`PATCH /api/clips/{clipId}` or ChatSpike candidate routes)
- **Purpose:** Update title, description, trim range, or candidate review fields.
- **Current Status:** `EXISTING_FRONTEND_API` (via `updateClip`) | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

---

## Category F: Rendering & Clip Mutations

### `RND-01` — `GET /api/clips` & `GET /api/clips/{clipId}`
- **Purpose:** List all clips across projects / fetch single clip details + scoring breakdown.
- **Response Body (`200`):** `Clip[]` / `Clip`.
- **Expected Frontend Consumer:** `listAllClips`, `getClip` (`DashboardPage`, `ClipLibraryPage`, `ExportManagerPage`, `ClipEditorPage`, `PublishPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `RND-02` — `PATCH /api/clips/{clipId}`
- **Purpose:** Save clip title, description, trim bounds, or draft caption overrides without full re-render.
- **Request Body:** `ClipUpdateRequest`.
- **Response Body (`200`):** Updated `Clip`.
- **Validation Rules:** `0 <= startSec < endSec` and `endSec - startSec >= 3`.
- **Expected Frontend Consumer:** `updateClip` (`ClipEditorPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `RND-03` — `POST /api/clips/{clipId}/render`
- **Purpose:** Re-render clip MP4 + SRT/VTT/metadata sidecars via FFmpeg using updated trim, aspect ratio, layout mode, resolution, and burned/sidecar caption config.
- **Request Body:** `ClipRenderRequest`.
- **Response Body (`200`):** Re-rendered `Clip`.
- **Error Responses:** `404`, `409` (worker busy), `422`.
- **Expected Frontend Consumer:** `renderClip` (`ClipEditorPage`, `ClipDiscoveryPage`, `ClipLibraryPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `RND-04` — `DELETE /api/clips/{clipId}`
- **Purpose:** Remove clip DB record and rendered artifacts cleanly.
- **Response Body:** `204 No Content`.
- **Expected Frontend Consumer:** `deleteClip` (`ClipDiscoveryPage`, `ClipLibraryPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

---

## Category G: Jobs

### `JOB-01` — `GET /api/jobs/{jobId}`
- **Purpose:** Poll active processing job progress, 10 ordered stages, and recent structured logs.
- **Response Body (`200`):** `ProcessingJob`.
- **Validation Rules:** `overallProgress` and `estimatedRemainingSec` MUST be real computed numbers or `null` (never fabricated).
- **Expected Frontend Consumer:** `getJob` via `useJobPollingQuery` (every `2000ms`) and `useActiveJobsQuery` (`2500ms`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `JOB-02` — `POST /api/jobs/{jobId}/cancel`
- **Purpose:** Terminate running FFmpeg/faster-whisper subprocess cleanly and release the single-active-job lock.
- **Response Body (`200`):** `ProcessingJob` (`status: "cancelled"`).
- **Expected Frontend Consumer:** `cancelJob` (`ProcessingPage`, `DashboardPage`, `MobileDashboardPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `JOB-03` — `GET /api/jobs/{jobId}/events` *(SSE Optional Phase 2)*
- **Purpose:** Stream Server-Sent Events for live job updates to replace polling.
- **Notes:** Native browser `EventSource` cannot send custom `Authorization: Bearer` headers; Phase 2 must use either `fetch()` streaming (`@microsoft/fetch-event-source`) or short-lived HMAC stream tickets.
- **Expected Frontend Consumer:** `getJobEventsUrl` (`src/api/jobs.ts`).
- **Phase:** Phase 2.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `CONTRACT_REQUIRES_CONFIRMATION`

---

## Category H: Export & Downloads

### `EXP-01` — `HEAD` & `GET /api/clips/{clipId}/download`
- **Purpose:** Verify artifact availability (`HEAD`) and download rendered MP4 (`Content-Disposition: attachment`). Also applies to `srtUrl`, `vttUrl`, `metadataUrl`.
- **Error Responses:** `404`.
- **Expected Frontend Consumer:** `getClipDownloadUrl` (`ExportManagerPage`, `ClipLibraryPage`, `ClipDiscoveryPage`, `ClipEditorPage`, `PublishPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `EXP-02` — `POST /api/clips/batch-export`
- **Purpose:** Bundle selected clips + selected sidecars (`mp4`, `srt`, `vtt`, `json`, `thumbnail`) into a downloadable `.zip` archive.
- **Request Body:** `BatchExportRequest` (`{ clipIds, formats }`).
- **Response Body (`200`):** `BatchExportResponse` (`{ archiveUrl, exportedCount, message }`).
- **Expected Frontend Consumer:** `batchExportClips` (`ProjectsPage`, `ClipDiscoveryPage`, `ClipLibraryPage`, `ExportManagerPage`).
- **Phase:** Phase 1.
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

---

## Category I: Settings & Caption Presets

### `SET-01` — Caption Presets CRUD
- `GET /api/caption-presets` -> `CaptionPreset[]` (`listCaptionPresets`)
- `POST /api/caption-presets` -> `CaptionPreset` (`createCaptionPreset`)
- `PUT /api/caption-presets/{presetId}` -> `CaptionPreset` (`updateCaptionPreset`)
- `DELETE /api/caption-presets/{presetId}` (`400` if `isDefault === true`) (`deleteCaptionPreset`)
- `POST /api/caption-presets/restore-defaults` -> `CaptionPreset[]` (`restoreDefaultCaptionPresets`)
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

### `SET-02` — Application Settings & Cache Cleanup
- `GET /api/settings` -> `AppSettings` (`getSettings`)
- `PUT /api/settings` -> `AppSettings` (`updateSettings`) — server MUST reject directory traversal outside whitelisted base roots.
- `POST /api/settings/reset` -> `AppSettings` (`resetSettings`)
- `POST /api/settings/clear-temp` -> `ClearTempFilesResponse` (`clearTemporaryFiles`)
- **Current Status:** `EXISTING_FRONTEND_API` | `BACKEND_NOT_IMPLEMENTED` | `READY_FOR_BACKEND`

---

## Category J: Direct Social Media Publishing (`/api/publishing/*`)

> **Important Reconciliation Note:** During direct publishing implementation on this workspace, `src/api/publishing.ts` and `server/publishing/publishingRouter.ts` were built with the canonical paths below (currently served live on the workspace Express server on port `3000`, NOT yet implemented on Python/FastAPI port `8000`). If the standalone Python/FastAPI backend hosts publishing on port `8000`, either mount these exact paths directly (recommended — zero frontend delta) or update `src/api/publishing.ts` base URL routing via `buildApiUrl()`.

| ID | Method & Active Frontend Path | Proposed Spec Alias | Request Body / Params | Response Body | Auth | Consumers | FastAPI Status |
|---|---|---|---|---|---|---|---|
| `PUB-01` | `POST /api/publishing/session` | Per-install Bearer handshake | None | `{ token: string }` | Open localhost | `ensurePublishingSessionToken` | `BACKEND_NOT_IMPLEMENTED` |
| `PUB-02` | `GET /api/publishing/accounts` | Same | `X-ClipCat-Token` | `{ accounts: ConnectedAccount[], activeJob }` | Session/Bearer | `getPublishingAccounts` -> `PublishPage` | `BACKEND_NOT_IMPLEMENTED` |
| `PUB-03` | `POST /api/publishing/oauth/{platform}/start` | `GET .../connect` alias optional | Path: `youtube \| instagram` | `{ authUrl, redirectUri, state }` | Session/Bearer | `startPublishingOAuth` -> `ConnectedAccountsPanel` | `BACKEND_NOT_IMPLEMENTED` |
| `PUB-04` | `GET /api/publishing/oauth/{platform}/callback` | Same | Query: `code, state, error` | HTML `postMessage` bridge (`CLIPCAT_PUBLISH_OAUTH`) | OAuth state + PKCE | Browser OAuth popup | `BACKEND_NOT_IMPLEMENTED` |
| `PUB-05` | `POST /api/publishing/accounts/{platform}/disconnect` | `DELETE /accounts/{platform}` alias optional | Path: `platform` | `{ account: ConnectedAccount }` | Session/Bearer | `disconnectPublishingAccount` | `BACKEND_NOT_IMPLEMENTED` |
| `PUB-06` | `POST /api/publishing/metadata/generate` | Same | `MetadataGenerateRequestInput` | `{ package: PublishMetadataPackage, localMediaAvailable }` | Session/Bearer | `generatePublishingMetadata` -> `PublishPage` | `BACKEND_NOT_IMPLEMENTED` |
| `PUB-07` | `POST /api/publishing/validate` | Same | Pre-publish payload | `{ validation: PublishValidationResult, package }` | Session/Bearer | `validatePublishingPackage` -> `PublishPage` | `BACKEND_NOT_IMPLEMENTED` |
| `PUB-08` | `POST /api/publishing/start` | `POST .../youtube` / `.../instagram` unified | `PublishStartRequest` (`userConfirmedPublish: true` mandatory) | `PublishJobRecord` | Session/Bearer | `startPublishingJob` -> `PublishPage` | `BACKEND_NOT_IMPLEMENTED` |
| `PUB-09` | `GET /api/publishing/jobs/{jobId}` | Same | Path: `jobId` | `PublishJobRecord` (`progressPercent` byte-real or `null`) | Session/Bearer | `getPublishingJob` | `BACKEND_NOT_IMPLEMENTED` |
| `PUB-10` | `POST /api/publishing/jobs/{jobId}/retry` | Same | Path: `jobId` | `PublishJobRecord` | Session/Bearer | `retryPublishingJob` -> `PublishHistoryPanel` | `BACKEND_NOT_IMPLEMENTED` |
| `PUB-11` | `POST /api/publishing/jobs/{jobId}/cancel` | Same | Path: `jobId` | `PublishJobRecord` | Session/Bearer | `cancelPublishingJob` -> `PublishPage` | `BACKEND_NOT_IMPLEMENTED` |
| `PUB-12` | `GET /api/publishing/history` | Same | None | `{ history: PublishHistoryItem[] }` | Session/Bearer | `getPublishingHistory` -> `PublishPage` | `BACKEND_NOT_IMPLEMENTED` |
| `PUB-13` | `POST /api/publishing/manual-share-package` | New fallback export | `{ clip, pkg, platform }` | JSON download bundle | Session/Bearer | `downloadManualSharePackage` -> `MetadataPackagePreview` | `BACKEND_NOT_IMPLEMENTED` |

### Platform & Compliance Constraints for Category J
1. **Attribution Honesty:** Never auto-generate or guess creator names/handles. Use explicit `AttributionStatus` (`verified` / `user_provided` / `ATTRIBUTION_UNVERIFIED`) mapped cleanly to canonical `AttributionVerificationState` (`VERIFIED`, `USER_PROVIDED`, `UNVERIFIED`, `NOT_AVAILABLE`, `REQUIRES_REVIEW`).
2. **YouTube Tag vs Hashtag Separation:** Tags array (`snippet.tags`) strictly `<= 500` combined characters without `#` prefix; `#hashtags` stay inside description text (`#Shorts` auto-added for YouTube Shorts).
3. **Instagram Direct Publish Reality:** Meta Graph API requires Business/Creator IG linked to a Facebook Page AND a publicly reachable HTTPS `video_url`. When `CLIPCAT_PUBLIC_MEDIA_BASE_URL` is absent on local Windows installs, advertise `instagramMediaTransferMode: "manual_export_fallback"` and offer `PUB-13` instead of claiming one-click upload.

---

## Category K: ChatSpike Engine Endpoints (`/api/chatspike/*`)

Implemented in Express `server/chatspikeRouter.ts` as local reference; target Python/FastAPI endpoints when porting the ChatSpike VOD heatmap pipeline to the standalone Windows backend (`BACKEND_NOT_IMPLEMENTED` in FastAPI):
- `POST /api/chatspike/session` (`CSP-01`)
- `GET /api/chatspike/capabilities` (`CSP-02`)
- `POST /api/chatspike/jobs` (`CSP-03`)
- `GET /api/chatspike/jobs/{jobId}` (`CSP-04`)
- `POST /api/chatspike/jobs/{jobId}/video` (Raw `application/octet-stream` + `X-ClipCat-Filename`) (`CSP-05`)
- `POST /api/chatspike/jobs/{jobId}/chat` (`CSP-06`)
- `PATCH /api/chatspike/jobs/{jobId}/config` (`CSP-07`)
- `POST /api/chatspike/jobs/{jobId}/process` (`CSP-08`)
- `POST /api/chatspike/jobs/{jobId}/cancel` (`CSP-09`)
- `PATCH /api/chatspike/jobs/{jobId}/candidates/{candidateId}` (`CSP-10`)
- `POST /api/chatspike/jobs/{jobId}/candidates/{candidateId}/regenerate` (`CSP-11`)
- `POST /api/chatspike/jobs/{jobId}/candidates/merge` (`CSP-12`)
- `POST /api/chatspike/jobs/{jobId}/save-to-library` (`CSP-13`)
- `GET /api/chatspike/library` (`CSP-14`)
- `PATCH/POST/DELETE /api/chatspike/library/clips/{clipId}...` & `POST /api/chatspike/library/batch-export` (`CSP-15`)
