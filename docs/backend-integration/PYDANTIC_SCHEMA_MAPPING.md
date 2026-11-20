# ClipCat TypeScript <-> Pydantic v2 Schema Mapping

**Project:** ClipCat — AI Video Clipping Studio  
**Source TypeScript Modules:** `src/types/*.ts`, `src/types/api/*.ts`, `src/publishing/types.ts`  
**Target Python Version:** Python 3.11+ with **Pydantic v2** (`pydantic >= 2.7`)

---

## 1. Serialization & Naming Convention (Critical)

All ClipCat frontend TypeScript types use **camelCase** (`createdAt`, `desiredClipCount`, `startSec`, `aiScore`, `progressPercent`, `userConfirmedPublish`).

Configure every Pydantic v2 base schema with `to_camel` aliasing so Python code stays PEP-8 `snake_case` while FastAPI emits and accepts exact camelCase JSON:

```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ClipCatSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        str_strip_whitespace=True,
    )
```

> **Rule:** FastAPI route handlers returning SQLAlchemy models or `ClipCatSchema` instances should return JSON with camelCase keys (`response_model_by_alias=True`, which is Pydantic/FastAPI default when `alias_generator=to_camel`). Never use raw `snake_case` JSON responses for fields typed as camelCase in `src/types/`.

---

## 2. Standard Error & Validation Models (`src/types/api/common.ts`)

| TypeScript Interface | Pydantic v2 Model |
|---|---|
| `PydanticValidationErrorItem` | Built into FastAPI `RequestValidationError` (`loc`, `msg`, `type`) |
| `ApiErrorResponse` | `ErrorResponse(detail: str \| list[dict], code: str \| None = None, field_errors: dict[str, str] \| None = None)` |
| `OperationStatusResponse` | `OperationStatusResponse(ok: bool, message: str)` |

```python
class ErrorResponse(ClipCatSchema):
    detail: str | list[dict]
    code: str | None = None
    field_errors: dict[str, str] | None = None
```

---

## 3. System & Health Models (`src/types/system.ts` & `src/types/api/system.ts`)

| TS Type / Field | Pydantic v2 Field & Type | Constraints / Notes |
|---|---|---|
| `DependencyStatus` | `Literal['operational', 'warning', 'not_installed', 'unavailable']` | Used across DB, FFmpeg, faster-whisper |
| `DependencyInfo` | `id: str, name: str, status: DependencyStatus, version: str \| None, explanation: str, install_instructions: str \| None = None` | `version` null if not installed |
| `SystemHealthResponse` | `status: Literal['operational', 'degraded', 'unavailable'], backend_version: str \| None, uptime_sec: int \| None, database_status: DependencyStatus, active_jobs_count: int, cpu_usage_percent: float \| None, ram_used_bytes: int \| None, ram_total_bytes: int \| None, checked_at: datetime` | `active_jobs_count` in `{0, 1}` for single-job Phase 1 |
| `DependenciesResponse` | `dependencies: list[DependencyInfo], available_whisper_models: list[str], checked_at: datetime` | Models e.g. `['tiny', 'base', 'small', 'medium', 'large-v3']` |
| `StorageResponse` | `total_used_bytes: int, project_storage_bytes: int, export_storage_bytes: int, temp_storage_bytes: int, available_disk_bytes: int \| None, total_disk_bytes: int \| None` | All ints `ge=0` |

---

## 4. Projects & Configuration Models (`src/types/project.ts` & `src/types/api/projects.ts`)

```python
ProjectStatus = Literal['draft', 'uploaded', 'queued', 'processing', 'completed', 'failed', 'cancelled']
ProjectSourceType = Literal['upload', 'url']
AspectRatio = Literal['9:16', '16:9', '1:1']
VideoLayoutMode = Literal['smart_face_tracking', 'center_crop', 'blurred_background', 'split_screen']
OutputResolution = Literal['720p', '1080p']
CaptionFontSizeOption = Literal['small', 'medium', 'large']
CaptionPositionOption = Literal['top', 'center', 'bottom']


class ProcessingConfigSchema(ClipCatSchema):
    project_name: str = Field(min_length=1, max_length=120)
    output_directory: str | None = None
    desired_clip_count: int = Field(ge=1, le=30, default=5)
    min_duration_sec: float = Field(ge=5, le=300, default=15)
    preferred_duration_sec: float = Field(ge=5, le=300, default=45)
    max_duration_sec: float = Field(ge=5, le=300, default=90)
    aspect_ratio: AspectRatio = '9:16'
    layout_mode: VideoLayoutMode = 'smart_face_tracking'
    captions_enabled: bool = True
    caption_preset_id: str = 'minimal-white'
    caption_font_size: CaptionFontSizeOption = 'medium'
    caption_position: CaptionPositionOption = 'bottom'
    highlight_keywords: bool = True
    word_by_word_animation: bool = True
    speaker_labels: bool = False
    output_format: Literal['mp4'] = 'mp4'
    video_codec: Literal['h264'] = 'h264'
    output_resolution: OutputResolution = '1080p'
    output_fps: Literal[30, 60] = 30
    auto_process: bool = True
```

> **Cross-field Validator (`@model_validator(mode='after')`):** Enforce `min_duration_sec <= preferred_duration_sec <= max_duration_sec`.

---

## 5. Processing Job & Transcript Models (`src/types/job.ts` & `src/types/transcript.ts`)

```python
ProcessingStageId = Literal[
    'video_validation',
    'media_inspection',
    'audio_extraction',
    'speech_transcription',
    'ai_moment_detection',
    'clip_scoring',
    'smart_cropping',
    'caption_generation',
    'video_rendering',
    'export_validation',
]
StageStatus = Literal['waiting', 'running', 'completed', 'failed', 'cancelled']
JobStatus = Literal['queued', 'running', 'completed', 'failed', 'cancelled']


class ProcessingStageSchema(ClipCatSchema):
    id: ProcessingStageId
    order: int = Field(ge=1, le=10)
    label: str
    status: StageStatus
    progress_percent: float | None = Field(default=None, ge=0, le=100)
    detail: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class ProcessingJobSchema(ClipCatSchema):
    id: str
    project_id: str
    project_name: str
    status: JobStatus
    overall_progress: float | None = Field(default=None, ge=0, le=100)
    current_stage_id: ProcessingStageId | None = None
    current_task: str
    elapsed_sec: float = Field(ge=0)
    estimated_remaining_sec: float | None = Field(default=None, ge=0)
    stages: list[ProcessingStageSchema]
    logs: list[JobLogEntrySchema]
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime
```

---

## 6. Clips, Rendering, Batch Exports & Caption Presets (`src/types/clip.ts`, `src/types/caption.ts`)

| TS Type | Pydantic Model Summary | Key Validations |
|---|---|---|
| `Clip` | `ClipSchema` | `ai_score: float` `0..100`; `duration_sec = end_sec - start_sec >= 3`; optional `thumbnail_url`, `preview_video_url`, `download_url`, `srt_url`, `vtt_url`, `metadata_url` |
| `ClipUpdateRequest` | `ClipUpdateRequestSchema` | All fields optional; validate `end_sec - start_sec >= 3` when timestamps supplied |
| `ClipRenderRequest` | `ClipRenderRequestSchema` | Required `start_sec`, `end_sec`, `aspect_ratio`, `layout_mode`, `resolution`, `caption_settings` |
| `BatchExportRequest` | `BatchExportRequestSchema` | `clip_ids: list[str]` (`min_length=1`), `formats: list[Literal['mp4', 'srt', 'vtt', 'json', 'thumbnail']]` (`min_length=1`) |
| `BatchExportResponse` | `BatchExportResponseSchema` | `archive_url: str \| None`, `exported_count: int`, `message: str` |
| `CaptionPreset` | `CaptionPresetSchema` | Hex color strings, `font_size_px: int`, `outline_width_px: int`, `words_per_line: int` |
| `AppSettings` | `AppSettingsSchema` | Nested `general`, `processing`, `captions`, `storage` objects; validate storage directories server-side |

---

## 7. Direct Publishing, Metadata & Canonical Attribution (`src/publishing/types.ts` & `src/types/api/publishing.ts`)

| TS Type | Pydantic v2 Mapping | Critical Rules |
|---|---|---|
| `PublishPlatform` | `Literal['youtube', 'instagram']` | Official APIs only |
| `AttributionStatus` | `Literal['verified', 'user_provided', 'ATTRIBUTION_UNVERIFIED']` | Never synthesize missing credits |
| `AttributionVerificationState` | `Literal['VERIFIED', 'USER_PROVIDED', 'UNVERIFIED', 'NOT_AVAILABLE', 'REQUIRES_REVIEW']` | Canonical cross-backend state computed by `mapAttributionToVerificationState` |
| `RightsStatus` | `Literal['owner_confirmed', 'licensed_or_permitted', 'requires_user_confirmation', 'restricted_or_unverified']` | Gates publishing checklist |
| `YouTubePlatformPackage` | `tags: list[str]` (`<= 500` combined chars, no `#` prefix), `hashtags: list[str]`, `title` (`<= 100`), `description` (`<= 5000`), `made_for_kids: bool`, `privacy: Literal['private', 'unlisted', 'public']` | Separate YouTube tags from description hashtags |
| `InstagramPlatformPackage` | `caption` (`<= 2200`), `hashtags` (`<= 5` recommended), `direct_publish_supported: bool`, `media_transfer_note: str` | Set `direct_publish_supported=False` unless HTTPS signed media relay is configured |
| `PublishStartRequest` | `user_confirmed_publish: bool` + `idempotency_key: str` + `platform` + `clip` + `overrides` | Server MUST return `422` if `user_confirmed_publish is not True` |
| `PublishJobRecord` | `progress_percent: float \| None`, `bytes_uploaded: int`, `total_bytes: int` | Set `progress_percent` strictly from `bytes_uploaded / total_bytes`, never simulated |
