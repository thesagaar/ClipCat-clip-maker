# ClipCat Frontend Mock vs Real Integration Status Matrix

**Project:** ClipCat — AI Video Clipping Studio  
**Parent Brand:** Single Dimension Projects (SDP)  
**Target Python Backend:** `http://127.0.0.1:8000/api/*` (Not Yet Built)

---

## Classification Labels Used

- `BACKEND_NOT_CONNECTED`: Production/default client calls `http://127.0.0.1:8000`, which is currently unimplemented / unreachable unless a local Python/FastAPI server is running.
- `FEATURE_NOT_IMPLEMENTED`: Planned capability has no runnable local Python backend handler or relies on future phase work.
- `MOCK_DATA`: UI can populate deterministic demo records **only** in dev builds via explicit `mock=1` / Settings dev toggle (`src/api/mockAdapter.ts`); completely blocked when `ENV.IS_PROD === true`.
- `UPLOAD_NOT_AVAILABLE`: Real multipart upload to FastAPI fails when `127.0.0.1:8000` is down (note: ChatSpike local Express upload on port `3000` IS active locally).
- `PUBLISHING_NOT_AVAILABLE`: Python FastAPI publishing endpoints on `127.0.0.1:8000` do not exist yet, OR direct Instagram Reels HTTP media transfer is gated until a public HTTPS media relay URL + Meta Business/Creator credentials exist.

---

## Screen & Capability Classification Table

| Screen / Feature | Route / Module | Default Classification (FastAPI `127.0.0.1:8000`) | Dev Mock Mode Behavior | Workspace Express (`server.ts:3000`) Reality |
|---|---|---|---|---|
| **Dashboard Studio Activity & Storage** | `/` (`DashboardPage.tsx`, `MobileDashboardPage.tsx`) | `BACKEND_NOT_CONNECTED` | `MOCK_DATA` (synthetic projects/clips/storage) | Merges real ChatSpike library items if saved on port `3000` |
| **Quick Import Modal (URL Import)** | `QuickImportButton.tsx` | `BACKEND_NOT_CONNECTED` | `MOCK_DATA` | Requires real FastAPI `POST /api/projects/from-url` |
| **Smart Framing Header Toggle** | `SmartFramingToggle.tsx`, `uiStore.ts` | Client preference persisted locally (`READY` in UI); processing effect requires backend | Client preference persisted | Passed into `ProcessingConfig.aspectRatio` (`9:16`, `1:1`, `16:9`) |
| **New Project Video Upload** | `/projects/new` (`NewProjectPage.tsx`) | `UPLOAD_NOT_AVAILABLE` / `BACKEND_NOT_CONNECTED` | `MOCK_DATA` (simulated progress only in explicit dev mock) | Not hosted on Express; requires FastAPI `POST /api/projects/upload` |
| **Projects Manager** | `/projects` (`ProjectsPage.tsx`) | `BACKEND_NOT_CONNECTED` | `MOCK_DATA` | Merges saved `chatspike-proj-*` records |
| **Processing Queue & Live Job Progress** | `/projects/:id/processing` (`ProcessingPage.tsx`) | `BACKEND_NOT_CONNECTED` | `MOCK_DATA` (synthetic 10-stage log view) | Real single-job lock lives on Express for ChatSpike/Publishing only |
| **ChatSpike Heatmap & VOD Clipping** | `/chatspike` (`ChatSpikePage.tsx`) | `FEATURE_NOT_IMPLEMENTED` on FastAPI (`8000`) | Real Express server (`server.ts:3000`), not mock | **Implemented locally on Express (`3000`)** using FFmpeg + binary upload + SQLite-ready JSON store; port needed for Windows FastAPI |
| **AI Transcript (faster-whisper)** | `/projects/:id/clips`, `PublishPage.tsx` | `FEATURE_NOT_IMPLEMENTED` / `BACKEND_NOT_CONNECTED` | `MOCK_DATA` static transcript fixture | Not implemented in Express either (`fasterWhisperAvailable: false` capability reported honestly) |
| **Smart Face Tracking Layout** | `smart_face_tracking` mode | `FEATURE_NOT_IMPLEMENTED` (requires Python vision pipeline) | UI selection stored in config | Currently falls back to center aspect crop when rendered locally; honest capability label required |
| **Clip Discovery & Library** | `/projects/:id/clips`, `/clips` | `BACKEND_NOT_CONNECTED` | `MOCK_DATA` (note: preview/download URLs stay `null` in mock) | Real `chatspike-clip-*` MP4 playback & downloads work via Express (`3000`) |
| **Clip Editor (Trim & Burn-In Render)** | `/clips/:id/edit` (`ClipEditorPage.tsx`) | `BACKEND_NOT_CONNECTED` | `MOCK_DATA` metadata patch only (no fake `<video>`) | Real FFmpeg trim/re-render works for `chatspike-clip-*` on Express (`3000`) |
| **Export Manager & ZIP Bundles** | `/exports` (`ExportManagerPage.tsx`) | `BACKEND_NOT_CONNECTED` | `MOCK_DATA` (`batchExportClips` returns explicit unavailable message) | Real bundle manifest/download works for `chatspike-clip-*` on Express (`3000`) |
| **Direct Publishing & Metadata Prep** | `/publish`, `/publish/:id` (`PublishPage.tsx`) | `PUBLISHING_NOT_AVAILABLE` on FastAPI (`8000`) | Uses live Express `/api/publishing/*` + optional mock clip fallback in dev | **Implemented locally on Express (`3000`)**: zero-typing metadata generator, non-fabricated attribution, AES-256-GCM token vault, YouTube OAuth+PKCE+resumable upload, manual IG share bundle. Requires `YOUTUBE_CLIENT_ID`/`SECRET` & HTTPS relay for Instagram IG API |
| **Instagram Reels Direct Publish** | `ConnectedAccountsPanel`, `PublishPage` | `PUBLISHING_NOT_AVAILABLE` without Meta Business account + HTTPS public relay | Explicitly warns & provides `Download Manual Share Package` | Graph API blocked on plain `http://localhost` without `CLIPCAT_PUBLIC_MEDIA_BASE_URL` |
| **Caption Presets & App Settings** | `/presets`, `/settings` | `BACKEND_NOT_CONNECTED` | `MOCK_DATA` defaults | Needs SQLite persistence in FastAPI |
| **System Health & Dependency Probe** | `/system` (`SystemStatusPage.tsx`) | `BACKEND_NOT_CONNECTED` | `pingBackendServer()` ALWAYS hits real `127.0.0.1:8000` even in mock mode | Express does not mock `/api/system/*` on port `8000` |
| **Per-Install Bearer Token Auth** | `setFastApiAuthToken` (`src/api/client.ts`) | `FEATURE_NOT_IMPLEMENTED` (Phase 2 backend handshake) | Token stays `null` until handshake wired | Express uses ephemeral session `X-ClipCat-Token` |
| **HMAC Signed Short-Lived Media URLs** | Media `<video>` / `<img src>` URLs | `FEATURE_NOT_IMPLEMENTED` (Later Phase) | Plain path resolution | Direct Express static clip streaming with token header/session |

---

## Verification Rules Enforced in Code

1. **`ENV.IS_PROD` Mock Guard (`src/api/client.ts` & `src/stores/uiStore.ts`):** Mock adapter cannot be activated via `uiStore`, `?mock=1`, or `SettingsPage` when compiled for production.
2. **No Fake Video Streams (`src/api/clips.ts`):** `getClipPreviewUrl()` and `getClipDownloadUrl()` return `null` when mock mode is active.
3. **No Fake Upload or Processing Progress:** `apiUpload` reports strict XHR `loaded / total` bytes; `ProcessingJob.overallProgress` and `PublishJobRecord.progressPercent` allow `null` (indeterminate) rather than fabricated timers.
4. **Honest Publishing & Attribution:** Unverified clips stay `ATTRIBUTION_UNVERIFIED`; Instagram direct upload stays gated behind Business/Creator + HTTPS relay verification with a clean local export bundle alternative.
