# ClipCat — Python/FastAPI Backend Architecture & Claude Handoff Guide

**Project:** ClipCat — AI Video Clipping Studio  
**Parent Brand:** Single Dimension Projects (SDP)  
**Target Runtime:** Local Windows 10/11 Desktop (`http://127.0.0.1:8000`)  
**Companion Documents:**
- `docs/backend-integration/API_CONTRACT.md`
- `docs/backend-integration/FRONTEND_API_INVENTORY.md`
- `docs/backend-integration/PYDANTIC_SCHEMA_MAPPING.md`
- `docs/backend-integration/MOCK_VS_REAL_STATUS.md`
- `docs/backend-integration/OPEN_API.yaml`

---

## 1. Non-Negotiable Architecture Stack

Build the standalone local backend in Python with these exact components:
- **Framework:** FastAPI (`uvicorn 127.0.0.1:8000`)
- **Validation:** Pydantic v2 (`alias_generator=to_camel`, `populate_by_name=True`)
- **Database & ORM:** SQLite (`WAL` mode enabled) + SQLAlchemy 2.x
- **Media Engine:** `ffmpeg` & `ffprobe` via `subprocess` (never shell=True)
- **Speech Transcription:** `faster-whisper` (CPU `int8` fallback / CUDA `float16` if available)
- **Local App Data Root (Windows):**
  `%LOCALAPPDATA%\ClipCat\ClipCatData`
  Subdirectories:
  - `db/clipcat.db`
  - `projects/{project_id}/source/`
  - `projects/{project_id}/thumbs/`
  - `projects/{project_id}/transcripts/`
  - `clips/{clip_id}/`
  - `exports/`
  - `temp/`
  - `publishing/` (encrypted OAuth vault if not using Windows Credential Manager via `keyring`)
- **Concurrency Limit:** **Exactly ONE active heavy job at a time** (covering video processing pipelines and active upload/publishing workers). Return HTTP `409 Conflict` (`ACTIVE_JOB_EXISTS`) if a second job is triggered concurrently.

---

## 2. Recommended Backend Project Layout

```text
clipcat-backend/
  pyproject.toml
  app/
    main.py                 # FastAPI app, CORS, lifespan (init DB + dirs), router mounts
    config.py               # ClipCatData path resolution, limits, env config
    database.py             # SQLAlchemy engine, SQLite WAL pragma, SessionLocal
    security.py             # Path sandbox canonicalization, SSRF validator, bearer auth (Phase 2)
    models/                 # SQLAlchemy ORM tables: Project, Job, JobStage, JobLog, Clip, Transcript, CaptionPreset, AppSettings, PublishJob, ConnectedAccount
    schemas/                # Pydantic v2 ClipCatSchema camelCase models matching OPEN_API.yaml
    services/
      job_lock.py           # Process-wide asyncio/threading single-active-job coordinator
      ffmpeg_service.py     # ffprobe metadata/streams, thumbnail capture, trim/crop/burn-in render
      whisper_service.py    # faster-whisper word-level transcription
      moment_detector.py    # Transcript + audio energy + chat spike scoring (10 stages)
      storage_service.py    # Safe %LOCALAPPDATA%\ClipCat\ClipCatData read/write/temp cleanup
      publishing_service.py # YouTube Data API v3 OAuth+PKCE+resumable upload, IG Graph API gating, metadata generator
    routers/
      system.py             # /api/system/*
      projects.py           # /api/projects/*
      jobs.py               # /api/jobs/*
      clips.py              # /api/clips/*
      captions.py           # /api/caption-presets/*
      settings.py           # /api/settings/*
      publishing.py         # /api/publishing/*
      chatspike.py          # /api/chatspike/* (parity with Express reference in server/)
  tests/
    test_api_contract.py
    test_ssrf_and_paths.py
    test_ffmpeg_pipeline.py
    test_publishing_validation.py
```

---

## 3. Core Implementation Requirements

### A. CORS & Security Boundaries
1. Allow explicit origins: `http://localhost:3000`, `http://127.0.0.1:3000`, `tauri://localhost`, `http://tauri.localhost`. Never allow `*` with credentials.
2. **Upload Verification (`POST /api/projects/upload`):** Stream multipart upload to `temp/` up to `8 GB`, check magic bytes + run `ffprobe` to verify an actual video stream exists, reject corrupted/non-video uploads with `422`.
3. **SSRF Defense (`POST /api/projects/from-url`):** Parse URL (`http`/`https` only, no userinfo), resolve DNS IPs, block loopback/RFC1918/link-local/CGNAT before connecting **and on every HTTP redirect**, enforce max content-length & timeout. Return clear `422` when DRM/YouTube anti-bot blocks direct fetch—never bypass authentication or DRM.
4. **Path Containment:** Canonicalize (`Path.resolve()`) all storage reads/writes and user-editable directories against permitted roots; never pass client-supplied filenames unsanitized into `ffmpeg`.

### B. Single Active Job Pipeline (10 Ordered Stages)
The frontend expects these exact ordered `ProcessingStageId` values inside `ProcessingJob.stages`:
1. `video_validation`
2. `media_inspection`
3. `audio_extraction`
4. `speech_transcription`
5. `ai_moment_detection`
6. `clip_scoring`
7. `smart_cropping`
8. `caption_generation`
9. `video_rendering`
10. `export_validation`

Report real `progressPercent` (0–100) only when measurable (e.g. Whisper segment time or FFmpeg `-progress pipe:1` `out_time_ms / duration_ms`); return `null` whenever indeterminate.

### C. Polling vs Server-Sent Events (SSE) Recommendation
- **Phase 1 Recommendation:** Keep **HTTP polling (`GET /api/jobs/{jobId}` every `2000ms`)**, which is already wired in `useJobPollingQuery` and `useActiveJobsQuery`. It survives Windows WebView reconnects, avoids browser `EventSource` custom-header auth limitations, and keeps single-job SQLite reads trivial.
- **Phase 2 Option (`GET /api/jobs/{jobId}/events`):** Only enable SSE once `EventSource` header auth is solved via short-lived HMAC stream tickets or `fetch()` ReadableStream parsing.

### D. Phase 2 Per-Install Bearer Auth & Later-Phase Signed Media URLs
- `src/api/client.ts` already provides `setFastApiAuthToken(token)` and attaches `Authorization: Bearer <token>` on every Fetch (`apiRequest`) and XHR (`apiUpload`) call, mapping `401`/`403` to `ApiErrorCode = 'UNAUTHORIZED'`.
- For `<video src>` / `<img src>` elements (`getClipPreviewUrl`, thumbnail URLs) where custom `Authorization` headers cannot be set natively by browser media tags, use short-lived HMAC-SHA256 query signatures (`?exp=...&sig=...`) scoped strictly to `clip_id` + `GET`/`HEAD` in Phase 2+.

### E. Direct Publishing Parity (`server/publishing/` Reference)
Port the workspace's working Express publishing engine (`server/publishing/`) directly into FastAPI:
1. Store OAuth refresh/access tokens in Windows Credential Manager (`keyring` crate/package) or AES-256-GCM DPAPI-protected vault inside `%LOCALAPPDATA%\ClipCat\ClipCatData\publishing\`. Never send tokens or secrets in any API response.
2. YouTube: OAuth 2.0 + PKCE (`S256`), scope `https://www.googleapis.com/auth/youtube.upload` + `youtube.readonly`, resumable 1 MB chunked upload (`progressPercent = round(bytes_uploaded / total_bytes * 100)`), optional `.srt` track upload (`youtube.captions.insert`), separate `tags` (`<= 500` chars total, no `#`) vs description `#hashtags`.
3. Instagram Reels: Require Meta Business/Creator Instagram account linked to a Facebook Page AND a configured public HTTPS media relay URL. When unavailable on local Windows loopback, report `instagramMediaTransferMode: "manual_export_fallback"` and serve `POST /api/publishing/manual-share-package`.
4. Attribution & Confirmation: Never invent/guess creator names; preserve `ATTRIBUTION_UNVERIFIED` / `AttributionVerificationState` and enforce `userConfirmedPublish === True` server-side.

---

## 4. Open Engineering Decisions Requiring Confirmation Before Implementation

1. **Auth Handshake Bootstrap (`SYS-04`):** Confirm whether the Tauri/Windows desktop launcher passes the per-install Bearer token into the frontend via launch env/IPC (`window.__CLIPCAT_INSTALL_TOKEN__`) or via a local loopback `POST /api/auth/handshake` endpoint.
2. **Unified Port vs Dual Server:** Decide whether `ChatSpike` (`/api/chatspike/*`) and `Publishing` (`/api/publishing/*`) will be ported 100% into FastAPI (`127.0.0.1:8000`) so `src/api/chatspike.ts` and `src/api/publishing.ts` switch to `buildApiUrl()`, retiring Express in desktop builds.
3. **Smart Face Tracking Implementation:** Confirm whether Phase 1 ships with lightweight OpenCV/MediaPipe face-centroid crop tracking or explicitly marks `smart_face_tracking` as `"planned / center-crop fallback"` in `/api/system/dependencies` until a Python vision model is bundled.

---

## 5. Recommended `pytest` Test Suite for Claude's Backend

- `test_schema_camel_case.py`: Round-trip every Pydantic v2 model against OpenAPI JSON fixtures to assert camelCase keys & enum string parity.
- `test_single_active_job_lock.py`: Assert concurrent `POST /api/projects/{id}/process` or publishing starts return HTTP `409 Conflict` until completion/cancel.
- `test_upload_and_ssrf.py`: Verify fake `.mp4` (HTML payload), oversized files (`413`), and loopback/RFC1918 redirect URLs (`422`) are rejected.
- `test_clip_stream_ranges.py`: Assert `GET /api/clips/{id}/preview` returns `206 Partial Content` with valid `Content-Range` and `HEAD /api/clips/{id}/download` returns `Content-Length`.
- `test_publishing_safety.py`: Assert `POST /api/publishing/start` rejects `userConfirmedPublish=false` (`422`), blocks unverified rights, never leaks tokens, and refuses Instagram direct upload without HTTPS relay.
