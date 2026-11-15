# ClipCat Frontend–Backend Integration Contract

This document defines the exact HTTP API contract expected by the ClipCat React frontend when integrating with the local Python **FastAPI** backend (`http://127.0.0.1:8000` by default).

---

## 1. Base Configuration & Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | Base URL for FastAPI server (no trailing slash). |
| `VITE_USE_MOCK_API` | `false` | Must be `false` in production/integration builds. |
| `VITE_APP_VERSION` | `0.1.0` | Displayed in sidebar and diagnostics. |

CORS on FastAPI must allow the Vite dev origin (`http://localhost:3000`) and future Tauri 2 origins (`tauri://localhost`, `http://tauri.localhost`).

---

## 2. Standard Error Response Format

For any non-2xx HTTP status (`400`, `404`, `409`, `422`, `500`), return JSON matching FastAPI conventions:

```json
{
  "detail": "Unsupported video codec or corrupted container.",
  "code": "VALIDATION_ERROR",
  "fieldErrors": {
    "desiredClipCount": "Must be between 1 and 30."
  }
}
```

FastAPI Pydantic `422` validation arrays (`detail: [{ loc: [...], msg: "..." }]`) are also automatically normalized by `src/api/errors.ts`.

---

## 3. Projects Endpoints

### `GET /api/projects`
Returns `Project[]`.

```json
[
  {
    "id": "proj-01",
    "name": "Founder Product Deep Dive",
    "sourceType": "upload",
    "sourceFilename": "deep_dive.mp4",
    "sourceUrl": null,
    "thumbnailUrl": "/api/projects/proj-01/thumbnail",
    "durationSec": 2840,
    "resolution": "1920x1080",
    "fileSizeBytes": 1482000000,
    "clipCount": 5,
    "status": "completed",
    "activeJobId": "job-01",
    "config": {
      "projectName": "Founder Product Deep Dive",
      "outputDirectory": "",
      "desiredClipCount": 5,
      "minDurationSec": 15,
      "preferredDurationSec": 45,
      "maxDurationSec": 90,
      "aspectRatio": "9:16",
      "layoutMode": "smart_face_tracking",
      "captionsEnabled": true,
      "captionPresetId": "minimal-white",
      "captionFontSize": "medium",
      "captionPosition": "bottom",
      "highlightKeywords": true,
      "wordByWordAnimation": true,
      "speakerLabels": false,
      "outputFormat": "mp4",
      "videoCodec": "h264",
      "outputResolution": "1080p",
      "outputFps": 30,
      "autoProcess": true
    },
    "createdAt": "2026-11-12T14:20:00Z",
    "updatedAt": "2026-11-12T14:32:00Z",
    "completedAt": "2026-11-12T14:32:00Z",
    "processingDurationSec": 418,
    "errorMessage": null
  }
]
```

**Valid `ProjectStatus` values:**
`"draft" | "uploaded" | "queued" | "processing" | "completed" | "failed" | "cancelled"`

### `POST /api/projects`
Creates a draft project metadata record. Request: `CreateProjectRequest`. Response: `Project`.

### `POST /api/projects/upload`
Multipart form upload (`multipart/form-data`):
- `file`: Binary video file (`MP4`, `MOV`, `MKV`, `WEBM`)
- `name`: String
- `config`: JSON-serialized `ProcessingConfig`

Frontend uses `XMLHttpRequest` to report real upload progress percentages. Response: `Project`.

### `POST /api/projects/from-url`
Request:
```json
{
  "name": "Walkthrough Video",
  "url": "https://example.com/media/walkthrough.mp4",
  "config": { "...": "..." }
}
```
Response: `Project`. If the URL cannot be downloaded (e.g., DRM, auth wall, or restricted stream), return `422` with a clear `detail` message explaining why.

### `GET /api/projects/{id}`
Returns `Project`.

### `PATCH /api/projects/{id}`
Request: `{ "name": "Updated Title" }`. Response: `Project`.

### `DELETE /api/projects/{id}`
Deletes project, source media (if managed), and generated clips. Returns `204 No Content`.

### `POST /api/projects/{id}/process`
Starts the async processing pipeline. Optional body `{ "config": ProcessingConfig }`.
Response:
```json
{
  "jobId": "job-123",
  "projectId": "proj-01",
  "status": "processing"
}
```

### `GET /api/projects/{id}/transcript`
Returns `Transcript`:
```json
{
  "projectId": "proj-01",
  "language": "en",
  "durationSec": 2840,
  "modelUsed": "small",
  "segments": [
    {
      "id": "seg-1",
      "speaker": "Speaker 1",
      "startSec": 214.0,
      "endSec": 230.2,
      "text": "When transcription and FFmpeg rendering stay local..."
    }
  ]
}
```

### `GET /api/projects/{id}/clips`
Returns `Clip[]` belonging to the project.

---

## 4. Processing Jobs & Polling Contract

Frontend polls `GET /api/jobs/{id}` every `2000ms` while status is `"queued"` or `"running"`.

### `GET /api/jobs/{id}`
```json
{
  "id": "job-123",
  "projectId": "proj-01",
  "projectName": "Founder Product Deep Dive",
  "status": "running",
  "overallProgress": 42,
  "currentStageId": "speech_transcription",
  "currentTask": "Transcribing audio segments with Whisper (small)...",
  "elapsedSec": 74,
  "estimatedRemainingSec": 102,
  "stages": [
    {
      "id": "video_validation",
      "order": 1,
      "label": "Video validation",
      "status": "completed",
      "progressPercent": 100,
      "detail": "MP4 container verified"
    }
  ],
  "logs": [
    {
      "id": "log-1",
      "timestamp": "2026-11-14T20:10:02Z",
      "level": "info",
      "stageId": "video_validation",
      "message": "Validated source stream."
    }
  ],
  "errorMessage": null,
  "createdAt": "2026-11-14T20:10:00Z",
  "updatedAt": "2026-11-14T20:11:16Z"
}
```

**Note on Indeterminate Progress:** If exact progress or ETA is unknown, return `null` for `overallProgress` and/or `estimatedRemainingSec`. The frontend will display an indeterminate indicator rather than fabricating percentages.

**Valid `ProcessingStageId` values (ordered 1–10):**
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

**Valid `StageStatus` values:**
`"waiting" | "running" | "completed" | "failed" | "cancelled"`

### `POST /api/jobs/{id}/cancel`
Signals the worker to abort cleanly. Returns updated `ProcessingJob` with `status: "cancelled"`.

---

## 5. Clips, Preview Streaming & Downloads

### `GET /api/clips`
Returns `Clip[]` across all projects (used by Clip Library & Export Manager).

### `GET /api/clips/{id}`
Returns `Clip`:
```json
{
  "id": "clip-01",
  "projectId": "proj-01",
  "projectName": "Founder Product Deep Dive",
  "title": "Why Local-First Tools Beat Cloud Latency",
  "description": "Speaker explains local transcription advantages.",
  "startSec": 214,
  "endSec": 262,
  "durationSec": 48,
  "aiScore": 89,
  "scoringBreakdown": {
    "overallScore": 89,
    "summary": "Strong opening hook and self-contained takeaway.",
    "disclaimer": "AI score reflects transcript coherence and pacing—it does not guarantee virality.",
    "factors": [
      {
        "label": "Hook Clarity",
        "score": 23,
        "maxScore": 25,
        "explanation": "Opens with a direct thesis in the first 3 seconds."
      }
    ]
  },
  "thumbnailUrl": "/api/clips/clip-01/thumbnail",
  "previewVideoUrl": "/api/clips/clip-01/preview",
  "downloadUrl": "/api/clips/clip-01/download",
  "srtUrl": "/api/clips/clip-01/subtitles.srt",
  "vttUrl": "/api/clips/clip-01/subtitles.vtt",
  "metadataUrl": "/api/clips/clip-01/metadata.json",
  "aspectRatio": "9:16",
  "layoutMode": "smart_face_tracking",
  "resolution": "1080p",
  "fileSizeBytes": 18400000,
  "status": "completed",
  "captionStatus": "applied",
  "exportStatus": "ready",
  "captionSettings": {
    "enabled": true,
    "presetId": "minimal-white",
    "fontSize": "medium",
    "position": "bottom",
    "highlightKeywords": true,
    "wordByWordAnimation": true,
    "speakerLabels": false
  },
  "createdAt": "2026-11-12T14:30:00Z",
  "updatedAt": "2026-11-12T14:31:00Z"
}
```

### `GET /api/clips/{id}/preview`
Must stream MP4 video with HTTP `206 Partial Content` (`Accept-Ranges: bytes`) support for HTML5 `<video>` seeking.

### `GET /api/clips/{id}/download`
Must support both `HEAD` (used by frontend to verify file existence before starting download) and `GET` with `Content-Disposition: attachment; filename="..."`.

### `PATCH /api/clips/{id}`
Updates clip metadata/draft settings (`ClipUpdateRequest`). Returns updated `Clip`.

### `POST /api/clips/{id}/render`
Triggers FFmpeg re-render with updated trim/layout/caption settings (`ClipRenderRequest`). Returns updated `Clip`.

### `DELETE /api/clips/{id}`
Deletes rendered clip and sidecars. Returns `204 No Content`.

### `POST /api/clips/batch-export`
Request: `{ "clipIds": ["clip-01"], "formats": ["mp4", "srt"] }`.
Response: `{ "archiveUrl": "/api/exports/bundle-123.zip", "exportedCount": 1, "message": "Bundle ready." }`.

---

## 6. Caption Presets

- `GET /api/caption-presets` -> `CaptionPreset[]`
- `POST /api/caption-presets` -> `CaptionPreset`
- `PUT /api/caption-presets/{id}` -> `CaptionPreset`
- `DELETE /api/caption-presets/{id}` -> `204 No Content`
- `POST /api/caption-presets/restore-defaults` -> `CaptionPreset[]`

---

## 7. Settings & System Health

- `GET /api/settings` -> `AppSettings`
- `PUT /api/settings` -> `AppSettings`
- `POST /api/settings/reset` -> `AppSettings`
- `POST /api/settings/clear-temp` -> `{ "freedBytes": 43000000, "message": "Temporary files cleared." }`
- `GET /api/system/health` -> `SystemHealthResponse`
- `GET /api/system/dependencies` -> `DependenciesResponse`
- `GET /api/system/storage` -> `StorageResponse`
