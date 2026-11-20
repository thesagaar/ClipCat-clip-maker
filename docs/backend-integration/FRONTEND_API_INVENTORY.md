# ClipCat Frontend API Inventory

**Project:** ClipCat — AI Video Clipping Studio  
**Parent Brand:** Single Dimension Projects (SDP)  
**Target Python Backend:** FastAPI (`http://127.0.0.1:8000`, prefix `/api`)  
**Workspace Note:** Endpoints targeting `http://127.0.0.1:8000/api/*` (via `buildApiUrl()` / `apiRequest()` / `apiUpload()`) fall back to `src/api/mockAdapter.ts` only when `isMockApiEnabled()` returns `true` (explicitly blocked in `ENV.IS_PROD`). Separately, the workspace's Node/Express server (`server.ts`, port `3000`) hosts real local implementations of `/api/chatspike/*` and `/api/publishing/*` whose paths and payloads are documented below so Claude can mirror/port them into the standalone Windows Python/FastAPI backend.

---

## 1. Core API Transport & Runtime Controls (`src/api/client.ts`)

| # | Function Name | File Location | HTTP Method | Endpoint / Behavior | Request Structure | Expected Response / Return | Consumers | Uses Mock Data? | Real FastAPI Required? | Contract Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `apiRequest<T>` | `src/api/client.ts` | `GET\|POST\|PUT\|PATCH\|DELETE` | `buildApiUrl(path)` (`http://127.0.0.1:8000` + path) | `RequestOptions { method, body, headers, timeoutMs, signal }` + injects `Authorization: Bearer` when set | `Promise<T>` (`undefined` on `204`); throws `ApiClientError` | `system.ts`, `projects.ts`, `jobs.ts`, `clips.ts`, `captions.ts`, `settings.ts` | No | N/A (Transport) | Complete |
| 2 | `apiUpload<T>` | `src/api/client.ts` | `POST` (XHR) | `buildApiUrl(path)` | `UploadOptions { formData, onProgress, signal, timeoutMs }` + `Authorization: Bearer` | `Promise<T>` with byte upload progress callbacks | `uploadProjectVideo` (`src/api/projects.ts`) | No | N/A (Transport) | Complete |
| 3 | `setFastApiAuthToken` / `getFastApiAuthHeader` / `hasFastApiAuthToken` | `src/api/client.ts` | N/A | In-memory Phase 2 per-install Bearer token hook | `token: string \| null` | `{ Authorization: "Bearer <token>" }` or `{}` | `apiRequest`, `apiUpload`, `useAuthHandshake` (future) | No | Phase 2 Auth | Complete (Handshake endpoint TBD) |
| 4 | `isMockApiEnabled` / `setRuntimeMockMode` | `src/api/client.ts` | N/A | Mock isolation gate (blocked when `ENV.IS_PROD === true`) | `enabled: boolean \| null` | `boolean` | All FastAPI API modules, `uiStore.ts`, `AppShell.tsx` | Guard | No | Complete |
| 5 | `buildApiUrl` | `src/api/client.ts` | N/A | Resolves `getApiBaseUrl()` + normalized path | `path: string` | `string` (`http://127.0.0.1:8000/...`) | `apiRequest`, `apiUpload`, `getJobEventsUrl`, `clips.ts` | No | No | Complete |

---

## 2. System & Health (`src/api/system.ts`)

| # | Function Name | File Location | HTTP Method | URL / Endpoint | Request Structure | Expected Response | Consumers | Uses Mock Data? | Real FastAPI Required? | Contract Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 6 | `getSystemHealth` | `src/api/system.ts` | `GET` | `/api/system/health` | None | `SystemHealthResponse` | `useSystemHealthQuery` -> `AppShell`, `SettingsPage`, `SystemStatusPage` | When `isMockApiEnabled()` | Yes | Complete |
| 7 | `pingBackendServer` | `src/api/system.ts` | `GET` | `/api/system/health` | Timeout `5000ms` (bypasses mock toggle intentionally) | `BackendPingResult` | `SystemStatusPage` | Never | Yes | Complete |
| 8 | `getSystemDependencies` | `src/api/system.ts` | `GET` | `/api/system/dependencies` | None | `DependenciesResponse` (`ffmpeg`, `ffprobe`, `faster-whisper`, whisper models) | `useSystemDependenciesQuery` -> `SettingsPage`, `SystemStatusPage` | When `isMockApiEnabled()` | Yes | Complete |
| 9 | `getSystemStorage` | `src/api/system.ts` | `GET` | `/api/system/storage` | None | `StorageResponse` | `useSystemStorageQuery` -> `AppShell`, `DashboardPage`, `MobileDashboardPage`, `SettingsPage`, `SystemStatusPage` | When `isMockApiEnabled()` | Yes | Complete |

---

## 3. Projects & Media (`src/api/projects.ts`)

| # | Function Name | File Location | HTTP Method | URL / Endpoint | Request Structure | Expected Response | Consumers | Uses Mock Data? | Real FastAPI Required? | Contract Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | `listProjects` | `src/api/projects.ts` | `GET` | `/api/projects` (+ merges Express `/api/chatspike/library`) | None | `Project[]` | `useProjectsQuery` -> `DashboardPage`, `MobileDashboardPage`, `ProjectsPage` | When `isMockApiEnabled()` | Yes | Complete |
| 11 | `getProject` | `src/api/projects.ts` | `GET` | `/api/projects/{projectId}` (or ChatSpike lib for `chatspike-proj-*`) | Path param `projectId` | `Project` | `useProjectQuery` -> `ProcessingPage`, `ClipDiscoveryPage`; direct call in `PublishPage` | When `isMockApiEnabled()` | Yes | Complete |
| 12 | `createProject` | `src/api/projects.ts` | `POST` | `/api/projects` | `CreateProjectRequest` | `Project` | Available in barrel (`src/api/index.ts`), reserved for draft creation | When `isMockApiEnabled()` | Yes | Complete |
| 13 | `uploadProjectVideo` | `src/api/projects.ts` | `POST` (`multipart/form-data`) | `/api/projects/upload` | `FormData`: `file`, `name`, `config` (JSON string) | `Project` | `NewProjectPage` | When `isMockApiEnabled()` | Yes | Complete |
| 14 | `createProjectFromUrl` | `src/api/projects.ts` | `POST` | `/api/projects/from-url` | `CreateProjectFromUrlRequest` (`{ name, url, config }`) | `Project` | `NewProjectPage`, `QuickImportButton` | When `isMockApiEnabled()` | Yes | Complete (SSRF + download limits apply) |
| 15 | `renameProject` | `src/api/projects.ts` | `PATCH` | `/api/projects/{projectId}` | `{ name: string }` | `Project` | `useRenameProjectMutation` -> `ProjectsPage` | When `isMockApiEnabled()` | Yes | Complete |
| 16 | `deleteProject` | `src/api/projects.ts` | `DELETE` | `/api/projects/{projectId}` | Path param `projectId` | `204 No Content` (`void`) | `useDeleteProjectMutation` -> `ProjectsPage` | When `isMockApiEnabled()` | Yes | Complete |
| 17 | `startProjectProcessing` | `src/api/projects.ts` | `POST` | `/api/projects/{projectId}/process` | Optional `{ config?: ProcessingConfig }` | `StartProcessingResponse` (`{ jobId, projectId, status }`) | `useStartProcessingMutation` -> `ProcessingPage`; direct call in `NewProjectPage`, `QuickImportButton` | When `isMockApiEnabled()` | Yes | Complete (`409` on active job) |
| 18 | `getProjectTranscript` | `src/api/projects.ts` | `GET` | `/api/projects/{projectId}/transcript` | Path param `projectId` | `Transcript` | `useProjectTranscriptQuery` (`src/hooks/useClipCatQueries.ts`); direct call in `PublishPage` | When `isMockApiEnabled()` | Yes | Complete |
| 19 | `getProjectClips` | `src/api/projects.ts` | `GET` | `/api/projects/{projectId}/clips` (or ChatSpike lib) | Path param `projectId` | `Clip[]` | `useProjectClipsQuery` -> `ClipDiscoveryPage`; direct call in `ProjectsPage` | When `isMockApiEnabled()` | Yes | Complete |

---

## 4. Processing Jobs (`src/api/jobs.ts`)

| # | Function Name | File Location | HTTP Method | URL / Endpoint | Request Structure | Expected Response | Consumers | Uses Mock Data? | Real FastAPI Required? | Contract Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 20 | `getJob` | `src/api/jobs.ts` | `GET` | `/api/jobs/{jobId}` | Path param `jobId` | `ProcessingJob` | `useJobPollingQuery` (`ProcessingPage`), `useActiveJobsQuery` (`DashboardPage`, `MobileDashboardPage`) | When `isMockApiEnabled()` | Yes | Complete |
| 21 | `cancelJob` | `src/api/jobs.ts` | `POST` | `/api/jobs/{jobId}/cancel` | Path param `jobId` | `ProcessingJob` (`status: 'cancelled'`) | `useCancelJobMutation` -> `ProcessingPage`, `DashboardPage`, `MobileDashboardPage` | When `isMockApiEnabled()` | Yes | Complete |
| 22 | `getJobEventsUrl` | `src/api/jobs.ts` | `GET` (SSE URL builder) | `/api/jobs/{jobId}/events` | Path param `jobId` | SSE stream URL (`string`) | Unused by live hooks today (frontend uses 2000–2500ms polling); prepared for Phase 2 SSE | No | Optional (Phase 2) | Requires SSE auth confirmation |

---

## 5. Clips, Preview, Rendering & Batch Exports (`src/api/clips.ts`)

| # | Function Name | File Location | HTTP Method | URL / Endpoint | Request Structure | Expected Response | Consumers | Uses Mock Data? | Real FastAPI Required? | Contract Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 23 | `resolveClipAssetUrl` | `src/api/clips.ts` | N/A | Resolves absolute, `/api/chatspike/*`, or FastAPI path | `rawUrl: string` | `string` | `getClipPreviewUrl`, `getClipDownloadUrl`, `ExportManagerPage` | No | No | Complete |
| 24 | `listAllClips` | `src/api/clips.ts` | `GET` | `/api/clips` (+ merges Express `/api/chatspike/library`) | None | `Clip[]` | `useAllClipsQuery` -> `DashboardPage`, `MobileDashboardPage`, `ClipLibraryPage`, `ExportManagerPage`, `PublishPage` | When `isMockApiEnabled()` | Yes | Complete |
| 25 | `getClip` | `src/api/clips.ts` | `GET` | `/api/clips/{clipId}` (or ChatSpike lib) | Path param `clipId` | `Clip` | `useClipQuery` -> `ClipEditorPage`, `PublishPage` | When `isMockApiEnabled()` | Yes | Complete |
| 26 | `getClipPreviewUrl` | `src/api/clips.ts` | `GET` (`<video>` src) | `clip.previewVideoUrl` or `/api/clips/{clipId}/preview` | Range header (`206 Partial Content`) | MP4 byte stream or `null` in mock | `ClipEditorPage`, `PublishPage`, `ClipCard` | Returns `null` in mock | Yes | Complete |
| 27 | `getClipDownloadUrl` | `src/api/clips.ts` | `HEAD`/`GET` | `clip.downloadUrl` or `/api/clips/{clipId}/download` | Path param `clipId` | `Content-Disposition: attachment` MP4 binary | `ClipDiscoveryPage`, `ClipLibraryPage`, `ClipEditorPage`, `ExportManagerPage`, `PublishPage` | Returns `null` in mock | Yes | Complete |
| 28 | `updateClip` | `src/api/clips.ts` | `PATCH` | `/api/clips/{clipId}` (or ChatSpike lib) | `ClipUpdateRequest` | `Clip` | `useUpdateClipMutation` -> `ClipEditorPage` | When `isMockApiEnabled()` | Yes | Complete |
| 29 | `renderClip` | `src/api/clips.ts` | `POST` | `/api/clips/{clipId}/render` (or ChatSpike lib) | `ClipRenderRequest` | `Clip` | `useRenderClipMutation` -> `ClipDiscoveryPage`, `ClipLibraryPage`, `ClipEditorPage` | When `isMockApiEnabled()` | Yes | Complete |
| 30 | `deleteClip` | `src/api/clips.ts` | `DELETE` | `/api/clips/{clipId}` (or ChatSpike lib) | Path param `clipId` | `204 No Content` | `useDeleteClipMutation` -> `ClipDiscoveryPage`, `ClipLibraryPage` | When `isMockApiEnabled()` | Yes | Complete |
| 31 | `batchExportClips` | `src/api/clips.ts` | `POST` | `/api/clips/batch-export` (or ChatSpike lib) | `BatchExportRequest` (`{ clipIds, formats }`) | `BatchExportResponse` (`{ archiveUrl, exportedCount, message }`) | `ProjectsPage`, `ClipDiscoveryPage`, `ClipLibraryPage`, `ExportManagerPage` | Returns empty mock info | Yes | Complete |

---

## 6. Caption Presets (`src/api/captions.ts`)

| # | Function Name | File Location | HTTP Method | URL / Endpoint | Request Structure | Expected Response | Consumers | Uses Mock Data? | Real FastAPI Required? | Contract Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 32 | `listCaptionPresets` | `src/api/captions.ts` | `GET` | `/api/caption-presets` | None | `CaptionPreset[]` | `useCaptionPresetsQuery` -> `CaptionPresetsPage`, `ClipEditorPage`, `SettingsPage`, `ProcessingConfigPanel` | When `isMockApiEnabled()` | Yes | Complete |
| 33 | `createCaptionPreset` | `src/api/captions.ts` | `POST` | `/api/caption-presets` | `CreateCaptionPresetRequest` | `CaptionPreset` | `useCreateCaptionPresetMutation` -> `CaptionPresetsPage` | When `isMockApiEnabled()` | Yes | Complete |
| 34 | `updateCaptionPreset` | `src/api/captions.ts` | `PUT` | `/api/caption-presets/{presetId}` | `UpdateCaptionPresetRequest` | `CaptionPreset` | `useUpdateCaptionPresetMutation` -> `CaptionPresetsPage` | When `isMockApiEnabled()` | Yes | Complete |
| 35 | `deleteCaptionPreset` | `src/api/captions.ts` | `DELETE` | `/api/caption-presets/{presetId}` | Path param `presetId` | `204 No Content` | `useDeleteCaptionPresetMutation` -> `CaptionPresetsPage` | When `isMockApiEnabled()` | Yes | Complete |
| 36 | `restoreDefaultCaptionPresets` | `src/api/captions.ts` | `POST` | `/api/caption-presets/restore-defaults` | None | `CaptionPreset[]` | `useRestoreDefaultPresetsMutation` -> `CaptionPresetsPage` | When `isMockApiEnabled()` | Yes | Complete |

---

## 7. Settings (`src/api/settings.ts`)

| # | Function Name | File Location | HTTP Method | URL / Endpoint | Request Structure | Expected Response | Consumers | Uses Mock Data? | Real FastAPI Required? | Contract Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 37 | `getSettings` | `src/api/settings.ts` | `GET` | `/api/settings` | None | `AppSettings` | `useSettingsQuery` -> `SettingsPage`, `ExportManagerPage` | When `isMockApiEnabled()` | Yes | Complete |
| 38 | `updateSettings` | `src/api/settings.ts` | `PUT` | `/api/settings` | `AppSettings` | `AppSettings` | `useUpdateSettingsMutation` -> `SettingsPage` | When `isMockApiEnabled()` | Yes | Complete |
| 39 | `resetSettings` | `src/api/settings.ts` | `POST` | `/api/settings/reset` | None | `AppSettings` | `useResetSettingsMutation` -> `SettingsPage` | When `isMockApiEnabled()` | Yes | Complete |
| 40 | `clearTemporaryFiles` | `src/api/settings.ts` | `POST` | `/api/settings/clear-temp` | None | `ClearTempFilesResponse` | `useClearTempFilesMutation` -> `SettingsPage` | When `isMockApiEnabled()` | Yes | Complete |

---

## 8. ChatSpike Local Engine (`src/api/chatspike.ts` -> Node/Express Port `3000`, Port Target for FastAPI)

| # | Function Name | File Location | HTTP Method | URL / Endpoint | Request Structure | Expected Response | Consumers | Uses Mock Data? | Real FastAPI Required? | Contract Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 41 | `ensureChatSpikeSessionToken` | `src/api/chatspike.ts` | `POST` | `/api/chatspike/session` | None | `{ token: string }` | `csRequest`, `uploadChatSpikeVideo` | No | Express real / FastAPI parity | Complete |
| 42 | `getChatSpikeCapabilities` | `src/api/chatspike.ts` | `GET` | `/api/chatspike/capabilities` | Header `X-ClipCat-Token` | `ChatSpikeCapabilities` | `ChatSpikePage` | No | Express real / FastAPI parity | Complete |
| 43 | `createChatSpikeJob` | `src/api/chatspike.ts` | `POST` | `/api/chatspike/jobs` | `{ projectName, config? }` | `ChatSpikeJob` | `ChatSpikePage` | No | Express real / FastAPI parity | Complete |
| 44 | `getChatSpikeJob` | `src/api/chatspike.ts` | `GET` | `/api/chatspike/jobs/{jobId}` | Path param `jobId` | `ChatSpikeJob` | `ChatSpikePage` | No | Express real / FastAPI parity | Complete |
| 45 | `uploadChatSpikeVideo` | `src/api/chatspike.ts` | `POST` (XHR binary) | `/api/chatspike/jobs/{jobId}/video` | Binary stream + `X-ClipCat-Filename` | `ChatSpikeJob` | `ChatSpikePage` | No | Express real / FastAPI parity | Complete |
| 46 | `uploadChatSpikeLog` | `src/api/chatspike.ts` | `POST` | `/api/chatspike/jobs/{jobId}/chat` | `{ filename, content, format? }` | `ChatSpikeJob` | `ChatSpikePage` | No | Express real / FastAPI parity | Complete |
| 47 | `updateChatSpikeConfig` | `src/api/chatspike.ts` | `PATCH` | `/api/chatspike/jobs/{jobId}/config` | `{ projectName?, config? }` | `ChatSpikeJob` | `ChatSpikePage` | No | Express real / FastAPI parity | Complete |
| 48 | `startChatSpikeProcessing` | `src/api/chatspike.ts` | `POST` | `/api/chatspike/jobs/{jobId}/process` | `{ config? }` | `ChatSpikeJob` | `ChatSpikePage` | No | Express real / FastAPI parity | Complete |
| 49 | `cancelChatSpikeJob` | `src/api/chatspike.ts` | `POST` | `/api/chatspike/jobs/{jobId}/cancel` | None | `ChatSpikeJob` | `ChatSpikePage` | No | Express real / FastAPI parity | Complete |
| 50 | `updateChatSpikeCandidate` | `src/api/chatspike.ts` | `PATCH` | `/api/chatspike/jobs/{jobId}/candidates/{candidateId}` | Candidate patch JSON | `ChatSpikeJob` | `ChatSpikePage` | No | Express real / FastAPI parity | Complete |
| 51 | `regenerateChatSpikeCandidate` | `src/api/chatspike.ts` | `POST` | `/api/chatspike/jobs/{jobId}/candidates/{candidateId}/regenerate` | Range/aspect/resolution overrides | `ChatSpikeJob` | `ChatSpikePage` | No | Express real / FastAPI parity | Complete |
| 52 | `mergeChatSpikeCandidates` | `src/api/chatspike.ts` | `POST` | `/api/chatspike/jobs/{jobId}/candidates/merge` | `{ candidateIds: string[] }` | `ChatSpikeJob` | `ChatSpikePage` | No | Express real / FastAPI parity | Complete |
| 53 | `saveChatSpikeToLibrary` | `src/api/chatspike.ts` | `POST` | `/api/chatspike/jobs/{jobId}/save-to-library` | `{ candidateIds? }` | `{ project, clips }` | `ChatSpikePage` | No | Express real / FastAPI parity | Complete |
| 54 | `getChatSpikeLibrary` | `src/api/chatspike.ts` | `GET` | `/api/chatspike/library` | None | `{ projects, clips }` | `projects.ts`, `clips.ts` | No | Express real / FastAPI parity | Complete |
| 55 | `updateChatSpikeLibraryClip` / `renderChatSpikeLibraryClip` / `deleteChatSpikeLibraryClip` / `batchExportChatSpikeClips` | `src/api/chatspike.ts` | `PATCH\|POST\|DELETE` | `/api/chatspike/library/clips/...`, `/api/chatspike/library/batch-export` | Clip payloads / `BatchExportRequest` | `Clip` / `void` / `BatchExportResponse` | `clips.ts` routing when `isChatSpikeEntityId(id)` | No | Express real / FastAPI parity | Complete |

---

## 9. Direct Publishing, OAuth & Attribution (`src/api/publishing.ts` -> Node/Express Port `3000`, Port Target for FastAPI)

| # | Function Name | File Location | HTTP Method | URL / Endpoint | Request Structure | Expected Response | Consumers | Uses Mock Data? | Real FastAPI Required? | Contract Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 56 | `ensurePublishingSessionToken` | `src/api/publishing.ts` | `POST` | `/api/publishing/session` | None | `{ token: string }` | `pubRequest`, `downloadManualSharePackage` | No | Express real / FastAPI Phase 2 | Complete |
| 57 | `getPublishingAccounts` | `src/api/publishing.ts` | `GET` | `/api/publishing/accounts` | Header `X-ClipCat-Token` | `PublishingAccountsResponse` | `usePublishingAccountsQuery` -> `PublishPage` | No | Express real / FastAPI parity | Complete |
| 58 | `startPublishingOAuth` | `src/api/publishing.ts` | `POST` | `/api/publishing/oauth/{platform}/start` | Path `platform` (`youtube\|instagram`) | `{ authUrl, redirectUri, state }` | `ConnectedAccountsPanel` | No | Express real / FastAPI parity | Complete |
| 59 | `disconnectPublishingAccount` | `src/api/publishing.ts` | `POST` | `/api/publishing/accounts/{platform}/disconnect` | Path `platform` | `{ account: ConnectedAccount }` | `useDisconnectPublishingAccountMutation` -> `ConnectedAccountsPanel` | No | Express real / FastAPI parity | Complete |
| 60 | `generatePublishingMetadata` | `src/api/publishing.ts` | `POST` | `/api/publishing/metadata/generate` | `MetadataGenerateRequestInput` | `{ package, localMediaAvailable }` | `PublishPage` | No | Express real / FastAPI parity | Complete |
| 61 | `validatePublishingPackage` | `src/api/publishing.ts` | `POST` | `/api/publishing/validate` | Package/platform/overrides without confirm | `{ validation, package }` | `PublishPage` | No | Express real / FastAPI parity | Complete |
| 62 | `startPublishingJob` | `src/api/publishing.ts` | `POST` | `/api/publishing/start` | `PublishStartRequest` (`userConfirmedPublish: true` required) | `PublishJobRecord` | `useStartPublishingMutation` -> `PublishPage` | No | Express real / FastAPI parity | Complete |
| 63 | `getPublishingJob` | `src/api/publishing.ts` | `GET` | `/api/publishing/jobs/{jobId}` | Path `jobId` | `PublishJobRecord` | `usePublishingJobPollingQuery` -> `PublishPage` | No | Express real / FastAPI parity | Complete |
| 64 | `retryPublishingJob` | `src/api/publishing.ts` | `POST` | `/api/publishing/jobs/{jobId}/retry` | Path `jobId` | `PublishJobRecord` | `useRetryPublishingMutation` -> `PublishHistoryPanel` | No | Express real / FastAPI parity | Complete |
| 65 | `cancelPublishingJob` | `src/api/publishing.ts` | `POST` | `/api/publishing/jobs/{jobId}/cancel` | Path `jobId` | `PublishJobRecord` | `useCancelPublishingMutation` -> `PublishPage` | No | Express real / FastAPI parity | Complete |
| 66 | `getPublishingHistory` | `src/api/publishing.ts` | `GET` | `/api/publishing/history` | None | `PublishHistoryItem[]` | `usePublishingHistoryQuery` -> `PublishPage` | No | Express real / FastAPI parity | Complete |
| 67 | `downloadManualSharePackage` | `src/api/publishing.ts` | `POST` | `/api/publishing/manual-share-package` | `{ clip, pkg, platform }` | JSON file blob download | `MetadataPackagePreview` | No | Express real / FastAPI parity | Complete |
