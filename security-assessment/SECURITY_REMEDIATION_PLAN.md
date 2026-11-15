# Security Remediation Plan — ClipCat Pre-Backend Frontend

- **Assessment Date:** `2026-11-15`
- **Status of All Items:** **Open (Read-Only Assessment Phase)** — Per engagement rules (Section 2 Rule 5 & Section 11), no original source files were edited during discovery. Fixes must be implemented in a dedicated remediation commit/branch and individually retested before marking closed.

---

## Ordered Pre-Backend Frontend Fixes

### 1. [P0 / Immediate] Remove Exposed Assessment Prompt, Mobile Screenshot, & Unused Upload Files (`CC-FE-001`)
- **Root Cause:** Working attachments in `public/assets/aistudio/` are copied directly into `dist/assets/aistudio/` by Vite and served over HTTP (`200 OK`); `src/config/brand.ts:54` references `/assets/aistudio/sdp-logo-mark_5f38d36d.svg` instead of `/brand/sdp-logo.svg`.
- **Smallest Safe Change:** Verify `/public/brand/sdp-logo.svg` matches `/public/assets/aistudio/sdp-logo-mark_5f38d36d.svg`, update `src/config/brand.ts:54` to `sdpLogo: '/brand/sdp-logo.svg'`, and delete `public/assets/aistudio/`.
- **Owner / Layer:** Frontend (`src/config/brand.ts`, `public/`).
- **Regression Risk:** Low — check `SdpLogo` component renders cleanly after path switch.
- **Regression Test:** Run `npm run build`, verify `dist/assets/aistudio` does not exist, verify `SdpLogo` loads `/brand/sdp-logo.svg` (`200 OK`), and confirm `GET /assets/aistudio/...txt` returns SPA fallback/404.
- **Retest Status:** Open.

### 2. [P1 / Pre-Backend] Fix Upload MIME Validation Logic & Filename Hygiene (`CC-FE-002`)
- **Root Cause:** `src/utils/validation.ts:30` uses `!hasSupportedExt && !hasSupportedMime`, allowing any `.mp4`-named file with `text/html` or `application/javascript` MIME type to pass validation cleanly. Filenames are not bounded or sanitized for path/control characters.
- **Smallest Safe Change:** Reject any file where `mime` is non-empty and not in `SUPPORTED_VIDEO_MIME_TYPES` (or optionally allow `application/octet-stream` only with explicit warning); reject filenames containing `/`, `\`, `..`, ASCII control chars, or length `> 255`.
- **Owner / Layer:** Frontend (`src/utils/validation.ts`, `src/utils/validation.test.ts`). Note: Backend magic-byte check remains mandatory (`BACKEND_SECURITY_REQUIREMENTS.md` §6).
- **Regression Risk:** Low — some Linux/browser environments report empty `file.type` (`""`) for `.mkv`; keep `!mime` fallback strictly for empty `file.type` while rejecting explicit non-video MIME types like `text/html`.
- **Regression Test:** Unit test `validateVideoFileInput({ name: 'fake.mp4', size: 120, type: 'text/html' })` returns `{ valid: false }`; `{ name: '../../evil.mp4', size: 120, type: 'video/mp4' }` returns `{ valid: false }`; `{ name: 'clip.mkv', size: 120, type: '' }` continues to pass UX check.
- **Retest Status:** Open.

### 3. [P1 / Pre-Backend] Harden Client Media URL Preflight Against SSRF Targets, Credentials, & Unbounded Length (`CC-FE-003`)
- **Root Cause:** `classifyAndValidateVideoUrl` (`src/utils/validation.ts:58-157`) only enforces `http:`/`https:` and extension check, marking `169.254.169.254`, `admin:secret@127.0.0.1`, `[::1]`, `localhost`, and 2 KB+ URLs as `"ready for backend retrieval"`.
- **Smallest Safe Change:** Enforce max length (`<= 2048`), reject `parsed.username || parsed.password`, and reject `localhost`, `*.local`, `*.internal`, IPv4 loopback/private/link-local (`127.*`, `10.*`, `172.16-31.*`, `192.168.*`, `169.254.*`, `0.0.0.0`), and IPv6 loopback/ULA/link-local literals (`[::1]`, `[fe80:...]`, `[fc...]`, `[fd...]`).
- **Owner / Layer:** Frontend (`src/utils/validation.ts`). Note: Backend SSRF controls remain mandatory (`BACKEND_SECURITY_REQUIREMENTS.md` §5).
- **Regression Risk:** Low — if local developer testing ever requires importing a URL from LAN/localhost, support only via explicit developer flag or upload file directly.
- **Regression Test:** Unit & Playwright test verifying all 5 probes from `09_dynamic_tests.txt` return `{ valid: false, canAutoDownload: false }`.
- **Retest Status:** Open.

### 4. [P1 / Pre-Release] Self-Host Typography Assets to Honor Local-First Privacy Claims (`CC-FE-004`)
- **Root Cause:** `index.html:15-20` loads `Inter`, `Nunito`, and `JetBrains Mono` from `https://fonts.googleapis.com` and `https://fonts.gstatic.com`, causing undisclosed third-party network requests on every page load.
- **Smallest Safe Change:** Install or bundle static `.woff2` font files in `public/fonts/` with `@font-face` declarations in `src/index.css`, and remove external Google Fonts `<link>` tags from `index.html`.
- **Owner / Layer:** Frontend (`index.html`, `src/index.css`, `public/fonts/`).
- **Regression Risk:** Low — verify computed `fontFamily` renders identical typography offline.
- **Regression Test:** Load `http://localhost:3000/` in Playwright and verify `performance.getEntriesByType('resource')` shows zero external font host requests.
- **Retest Status:** Open.

### 5. [P1 / Pre-Backend] Disable `?mock=1` in Production Builds & Validate Runtime Backend URL Overrides (`CC-FE-005`)
- **Root Cause:** `src/api/client.ts:33-36` & `src/stores/uiStore.ts:43-46` read `?mock=1` unconditionally without checking `import.meta.env.DEV`; `setRuntimeApiBaseUrl` (`src/config/env.ts:38-52`) persists any `http(s)://` string verbatim in `localStorage`.
- **Smallest Safe Change:** Gate `?mock=1` query override with `import.meta.env.DEV && params.get('mock') === '1'`; parse `setRuntimeApiBaseUrl` via `new URL()`, reject embedded credentials (`username`/`password`) and query/hash fragments, normalize to `parsed.origin`, and display a persistent warning indicator whenever a non-HTTPS non-loopback backend URL is active.
- **Owner / Layer:** Frontend (`src/api/client.ts`, `src/stores/uiStore.ts`, `src/config/env.ts`, `src/pages/SettingsPage.tsx`).
- **Regression Risk:** Low — confirm `npm run dev` local demo testing with `?mock=1` still works during development while production builds (`vite build` / `vite preview`) ignore `?mock=1`.
- **Regression Test:** Unit & preview-build Playwright check confirming `vite preview` ignores `?mock=1` and `setRuntimeApiBaseUrl('http://user:pass@10.0.0.1:8000/bad?x=1')` is rejected.
- **Retest Status:** Open.

### 6. [P2 / Defense-in-Depth] Lock Backend Download/Preview/Archive URLs to Configured API Origin & Unify Filename Sanitizer (`CC-FE-006`)
- **Root Cause:** `getClipDownloadUrl`, `getClipPreviewUrl`, and `batchExportClips` callers accept arbitrary external `http*` URLs returned by API responses without verifying origin parity with `getApiBaseUrl()`, and 3 pages skip safe filename sanitization.
- **Smallest Safe Change:** Resolve relative/absolute download URLs against `getApiBaseUrl()`, reject `downloadUrl` / `archiveUrl` whose `origin !== new URL(getApiBaseUrl()).origin`, and extract a shared `sanitizeExportFilename(title, ext)` helper used by `ClipEditorPage`, `ClipDiscoveryPage`, `ClipLibraryPage`, and `ExportManagerPage`.
- **Owner / Layer:** Frontend (`src/utils/desktop.ts`, `src/api/clips.ts`, `src/pages/*`).
- **Regression Risk:** Low — ensure future FastAPI returns same-origin download URLs (`/api/clips/{id}/download`).
- **Regression Test:** Unit test confirming cross-origin `archiveUrl` (`https://evil.example/a.zip`) is blocked cleanly and `../../clip:name?.mp4` sanitizes to safe characters.
- **Retest Status:** Open.

### 7. [P2 / Resilience] Add Top-Level React `ErrorBoundary` & Defensive API Shape Guards (`CC-FE-007`)
- **Root Cause:** `src/App.tsx` lacks a React `ErrorBoundary`, and `src/api/client.ts:124` casts untrusted JSON `as T` with zero runtime shape checks. Also, opening `/` immediately sends multi-endpoint queries to port `8000` without verifying `/api/system/health` first.
- **Smallest Safe Change:** Wrap `<Routes>` in an `AppErrorBoundary` component displaying a safe reload fallback (no stack trace in DOM), and add lightweight runtime validation checks on critical array/object API responses (`listProjects`, `listAllClips`, `getSettings`).
- **Owner / Layer:** Frontend (`src/App.tsx`, `src/components/ui/ErrorBoundary.tsx`, `src/api/*`).
- **Regression Risk:** Low.
- **Regression Test:** Render test injecting an array-expected endpoint returning `{}` verifying fallback UI renders without uncaught white screen.
- **Retest Status:** Open.

---

## Design Gap Remediation Roadmap (`CC-FE-GAP-*`)

| Gap ID | Fix Summary | Owner / Layer | Retest Status |
|---|---|---|---|
| **CC-FE-GAP-001** | Uninstall unused `@google/genai`, `express`, `dotenv`, `@types/express`; move Vite/Tailwind plugins to `devDependencies`; remove `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` from `metadata.json`; commit `package-lock.json` (or align `README.md` to `bun`). | Frontend / DevOps | Open |
| **CC-FE-GAP-002** | Add deployment security headers config (`vercel.json` / reverse-proxy headers: `CSP`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`) compatible with self-hosted fonts (`'self'`). | Hosting / DevOps | Open |
| **CC-FE-GAP-003** | Design & implement FastAPI bearer-token/session auth + strict CORS + ownership checks prior to LAN or multi-user exposure (`BACKEND_SECURITY_REQUIREMENTS.md`). | Full-Stack / Backend | Open |
| **CC-FE-GAP-004** | Guard `Clear Temporary Files` (`SettingsPage.tsx:479-487`) with `ConfirmDialog`, add keyboard focus trapping to `Modal.tsx`, and enforce backend directory path allowlists on `storage.*`. | Frontend + Backend | Open |
