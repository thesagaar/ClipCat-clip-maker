# Privacy Policy — ClipCat

**Product:** ClipCat (AI Video Clipping Studio)  
**Parent Brand:** Single Dimension Projects (SDP)  
**Version Covered:** ClipCat Frontend `0.1.0`  
**Status:** Draft Privacy Notice matching current frontend implementation — review with legal counsel before public commercial distribution.

> **Important Transparency Notice:** ClipCat is a local-first AI video clipping studio, **not** a zero-telemetry product. When optional analytics and diagnostic settings are configured and enabled with user consent, ClipCat transmits strictly sanitized product usage events and technical error diagnostics. ClipCat **never** collects or transmits your video/audio files, transcripts, captions, project titles, original filenames, local paths, or credentials through analytics.

---

## 1. Roles & Scope

This Privacy Policy describes how the **ClipCat** web and Windows desktop frontend (developed under **Single Dimension Projects**) handles:

1. **User-Generated Media & Workspace Content** (videos, audio, transcripts, captions, exports)
2. **Essential Browser Storage** (local configuration and UI preferences)
3. **Product Usage Analytics** (feature & funnel events, only with configuration + user consent)
4. **Error & Crash Diagnostics** (sanitized technical fault records, only with configuration + user consent)
5. **Planned Future Backend / Hosted Services** (marked clearly as future scope; no hosted SaaS backend is currently connected)

Single Dimension Projects has not published a registered corporate street address or DPO registration in this repository; public website and support channels configured in `src/config/env.ts` / `src/config/brand.ts` are listed in Section 10.

---

## 2. How ClipCat Processes Your Video, Audio, and Captions

ClipCat operates with a **local-first architecture**:

- **Video Uploads & URL Sources:** When you select a video file (`MP4`, `MOV`, `MKV`, `WEBM`) or submit a video URL on the New Project screen, the frontend sends that media or URL directly to your configured FastAPI backend server (default local development address: `http://127.0.0.1:8000` or your explicitly configured server URL).
- **Transcription, Smart Framing, & Rendering:** AI speech transcription (Whisper), FFmpeg segmentation, smart cropping, and burned-in/sidecar caption generation are designed to execute on your configured local or self-hosted FastAPI backend engine rather than uploading user media to Single Dimension Projects analytics servers.
- **No Analytics Access to User Content:** The ClipCat analytics module explicitly enforces an allowlist schema and forbidden-key blocker (`src/analytics/events.ts`, `src/analytics/sanitize.ts`) preventing any transmission of media bytes, frames, thumbnails, transcripts, SRT/VTT captions, notes, project names, original filenames, or raw source URLs.

---

## 3. Information Processed & Stored Locally in Your Browser

ClipCat stores essential application state locally using browser `localStorage` so the application functions reliably without third-party advertising cookies:

| Storage Key (`localStorage`) | Purpose | Essential? |
|---|---|---|
| `clipcat-theme-mode` | Remembers your Light or Dark theme preference | Essential |
| `clipcat-api-base-url` | Stores custom FastAPI backend URL override (e.g., LAN dev host) | Essential |
| `clipcat-consent-preferences` | Stores your consent choice (`hasResponded`, `analytics`, `diagnostics`, `consentVersion`, `updatedAt`) | Essential |
| `clipcat-sidebar-collapsed` | Remembers desktop sidebar expanded/collapsed state | Essential |
| `clipcat-project-draft` | Preserves in-progress project creation inputs if accidentally navigated away | Essential |
| `clipcat-mock-mode` | Development-only sample adapter flag (ignored in production builds unless explicitly enabled at build time) | Development-only |

- **Cookies:** ClipCat does **not** set third-party advertising, cross-site tracking, or marketing cookies. Consent preferences themselves are persisted in cookieless `localStorage` (`clipcat-consent-preferences`). If a future third-party analytics provider introduces HTTP cookies, this policy and the consent dialog must be updated before enabling that provider.

---

## 4. Product Usage Analytics (Optional — Consent & Config Gated)

ClipCat uses privacy-conscious product usage analytics to measure navigation flows, project creation funnel completion, upload formats/size buckets (not filenames), processing stage latency, export format usage, and viewport/runtime breakdown (`web` vs. `desktop`, `mobile` vs. `tablet` vs. `desktop`).

### Dual Activation Gate
Analytics events are **only** dispatched when **both** conditions are satisfied:
1. **Deployment Configuration:** `VITE_ANALYTICS_ENABLED=true` and a valid HTTPS `VITE_ANALYTICS_ENDPOINT` are configured at build/deployment time (default in `.env.example` is `false` / empty).
2. **User Consent:** You click **Accept Optional** or enable **Product Usage Analytics** inside **Customize / Privacy & Usage Preferences**.

### Allowlisted Product Events (`src/analytics/events.ts`)
- `app_opened` (`themeMode`, `startupBehavior`)
- `page_viewed` (`pageGroup`, `themeMode`)
- `project_creation_started` (`inputMode`)
- `project_creation_completed` (`inputMode`, `aspectRatio`, `captionsEnabled`, `resolution`)
- `upload_started` (`fileExtension`, `sizeBucket`)
- `upload_validation_failed` (`reasonCode`)
- `processing_started` (`aspectRatio`, `resolution`, `captionsEnabled`, `desiredClipCount`)
- `processing_stage_completed` (`stage`, `durationMs`)
- `processing_failed` (`stage`, `errorCategory`)
- `export_started` (`exportFormat`, `clipCount`)
- `export_completed` (`exportFormat`, `clipCount`)
- `export_failed` (`exportFormat`, `errorCategory`)
- `settings_updated` (`section`, `themeMode`)

Dynamic route parameters are anonymized before dispatch (for example, `/projects/123/processing` becomes `/projects/:id/processing`), and query strings/hash fragments are stripped.

---

## 5. Technical Error & Crash Diagnostics (Optional — Consent & Config Gated)

When **Error & Crash Diagnostics** consent is granted alongside valid configuration (`VITE_ERROR_REPORTING_ENABLED=true` + endpoint), ClipCat collects sanitized technical fault signals to diagnose crashes, UI exceptions, and API connectivity issues:

- **Allowlisted Error Events:** `api_connection_failed`, `application_error`, `unhandled_exception`.
- **Sanitized Metadata Collected:** Error class/code (`errorCategory`), HTTP status code (for API failures), normalized operation/component hint, redacted error summary (`errorMessage`, capped at 180 chars), redacted top stack frames (`stackSummary`, max 4 lines), app version (`0.1.0`), runtime (`web` / `desktop`), viewport bucket, anonymized route pattern, and ISO timestamp.
- **Automatic Client-Side Redaction (`scrubSensitiveText`):** Before transmission, regex scrubbers redact `Bearer`/JWT/API keys (`sk-`, `AIza`, `ghp_`, etc.), `http://`/`https://` URLs, Windows (`C:\...`) and POSIX (`/Users/...`, `/home/...`) paths, email addresses, and local/private IPv4 addresses (`127.x`, `10.x`, `192.168.x`, `172.16-31.x`).

---

## 6. Strictly Excluded Information

ClipCat explicitly blocks (`FORBIDDEN_PROPERTY_KEYS` + event property allowlists) and **never collects or transmits** via analytics or diagnostics:

- Original video or audio files, streams, frames, screenshots, or thumbnails
- Speech transcripts, subtitles, SRT/VTT captions, or text notes
- User-entered project names, clip titles, or descriptions
- Original media filenames or local filesystem directory paths
- Full media import URLs, signed download URLs, query parameters, or fragments
- API keys, passwords, OAuth/JWT tokens, or authorization headers
- Email addresses, phone numbers, raw form values, clipboard contents, or keystrokes
- Raw HTTP request/response bodies, `localStorage` contents, or session-replay video recordings

---

## 7. Third-Party Providers

- **Current Build:** ClipCat routes optional telemetry through a provider-independent client transport (`src/analytics/client.ts`) using `navigator.sendBeacon` or credential-omitted `fetch(..., { credentials: 'omit' })` to an explicitly configured endpoint. No third-party tracking SDK (such as Google Analytics, Mixpanel, or Meta Pixel) is bundled by default.
- **Future Updates:** If Single Dimension Projects connects a self-hosted analytics backend (e.g., Plausible, PostHog self-hosted, Umami, or a first-party SDP ingestion API), that provider name and data-processing role will be added to this policy before enabling it in production.

---

## 8. Retention, Controls, & Withdrawal of Consent

- **Change or Withdraw Consent Anytime:** Open **Privacy Preferences** in the footer or **Settings -> Privacy, Analytics & Data Handling -> Privacy & Analytics Preferences** to toggle **Product Usage Analytics** or **Error & Crash Diagnostics** off, or choose **Reject Optional**. Future optional events stop immediately.
- **Clear Local Browser State:** Clearing site data / `localStorage` in your browser removes saved theme, draft state, custom backend URL, and consent records.
- **Clear Local Backend Cache:** You can remove temporary extracted WAV audio and frame caches stored on your local backend via **Settings -> Clear Temporary Files** (protected by a confirmation dialog).
- **Retention (Backend/Analytics Pending):** Because the analytics ingestion backend and cloud storage are not yet deployed, retention schedules for aggregated event logs (recommended: 90 days for diagnostic logs, 12–24 months aggregated metrics) must be finalized and enforced server-side before public production launch.

---

## 9. Planned Future Backend Capabilities (Not Yet Active)

The following capabilities are **planned for future releases** and are **not active in this frontend release**:
- Server-side analytics ingestion API and database retention controls
- Optional user accounts, authentication, or team workspaces (if introduced later)
- Hosted cloud media processing (if offered separately from local-first execution)

Before any hosted account or cloud-processing feature launches, this Privacy Policy will be updated with exact data-processing purposes, legal bases, sub-processors, and regional rights procedures.

---

## 10. Contact Information

For questions about ClipCat or this Privacy Policy:
- **Official Website:** https://single-dimension-projects.vercel.app
- **Support & Contact:** https://single-dimension-projects.vercel.app/contact
- **In-App Route:** `/privacy` (`Settings -> About ClipCat` and Footer `Privacy Policy`)
