# Detailed Findings — ClipCat Pre-Backend Frontend Security Assessment

All findings below are strictly grounded in source inspection, build artifact inspection, and live browser/CLI testing executed on `2026-11-15` at `/app/applet`. Per engagement rules (Section 2 Rule 5 & Section 11), no original source files were altered during this discovery phase; all confirmed findings remain **Open**.

---

## 1. Classification Key

- **Confirmed Vulnerability (`CC-FE-001`..`CC-FE-007`):** Directly observed in source code, build output (`dist/`), HTTP responses, or browser runtime.
- **Security Design Gap (`CC-FE-GAP-001`..`CC-FE-GAP-004`):** Missing preventative architecture, policy, or hardening control.
- **Backend-Dependent Risk (Unverified):** Controls requiring server-side inspection once FastAPI is implemented (documented in `BACKEND_SECURITY_REQUIREMENTS.md`).

> **CVSS 4.0 Policy:** CVSS 4.0 scores are included only where an exploitation path exists purely within the evaluated frontend/static-hosting boundary and all metric assumptions are stated explicitly.

---

## 2. Confirmed Vulnerabilities

### CC-FE-001 — Unintended Exposure of Internal Documents & Personal Mobile Screenshot in Public Web Root and Production Build
- **Classification:** Confirmed Vulnerability
- **Severity:** **Medium**
- **CVSS 4.0:** `5.3` (`CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:N/VA:N/SC:N/SI:N/SA:N`) — *Assumes built `dist/` bundle is served over HTTP/LAN/web hosting where unauthenticated requests can fetch `/assets/aistudio/*` directly.*
- **CWE:** CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor), CWE-538 (Insertion of Sensitive Information into Externally-Accessible File or Directory)
- **Affected Files & Evidence:**
  - `public/assets/aistudio/ClipCat_Pre_Backend_Frontend_Security_Assessment_Prompt_674f8152.txt` (`27,840` bytes)
  - `public/assets/aistudio/Screenshot_2026-11-15-13-58-40-15_96b26121e545231a3c569311a54cda96_2a5e2f04.jpg` (`445 KB`)
  - `public/assets/aistudio/file_0000000028208211a1476a6e85d366f5_426bfd4b.png` (`1.6 MB`), `public/assets/aistudio/clipcat_ai__logo_01f48970.png` (`1.3 MB`)
  - `src/config/brand.ts:54` (`sdpLogo: '/assets/aistudio/sdp-logo-mark_5f38d36d.svg'`)
  - Build & HTTP Evidence: `security-assessment/EVIDENCE/04_typecheck_build.txt:66-70`, `security-assessment/EVIDENCE/08_http_headers.txt:13-24`
- **Relevant Snippet (`src/config/brand.ts:53-56`):**
```ts
  assets: {
    sdpLogo: '/assets/aistudio/sdp-logo-mark_5f38d36d.svg',
    sdpLogoPng: '/brand/sdp-logo.png',
```
- **Preconditions & Attack Surface:** Any user or network peer able to reach the served Vite dev server or production static bundle (`dist/`). Vite copies all files inside `public/` verbatim into `dist/`.
- **Reproduction Steps:**
  1. Run `npm run build` and inspect `dist/assets/aistudio/`.
  2. Request `curl -sSI http://localhost:3000/assets/aistudio/ClipCat_Pre_Backend_Frontend_Security_Assessment_Prompt_674f8152.txt`.
- **Actual Result:** Server responds `HTTP/1.1 200 OK` (`Content-Length: 27840`, `Content-Type: text/plain`) serving the full security assessment engagement brief. Production `dist/assets/aistudio/` also ships the user's personal Android status-bar/ChatGPT UI screenshot (`Screenshot_2026-11-15-13-58-40-15_...jpg`, showing time `1:58`, battery `59%`, 5G signal, and ChatGPT conversation UI) and unused multi-megabyte PNGs.
- **Expected Result:** Static public web root (`public/`) contains strictly production runtime assets (`public/brand/*`). Working prompts, screenshots, and security briefs never enter `public/` or `dist/`.
- **Security Impact & Abuse Scenario:** Exposes internal specifications, engagement methodology, redundant assets (`+3.3 MB` dead weight), and personal device/session screenshots to anyone accessing the hosted frontend or unpacking a distributed desktop package.
- **Root Cause:** Uploaded chat attachments remained inside `public/assets/aistudio/` and `src/config/brand.ts:54` references one file inside that directory rather than `/brand/sdp-logo.svg` (which already exists identically in `dist/brand/sdp-logo.svg`).
- **Remediation:** Update `src/config/brand.ts:54` to `/brand/sdp-logo.svg` (after verifying SVG byte parity with `/public/brand/sdp-logo.svg`), delete non-runtime files from `public/assets/aistudio/`, and add a CI/build verification check ensuring no `.txt` or `Screenshot_*` files exist in `dist/`.
- **Regression Test & Retest Status:** Assert `ls dist/assets/aistudio` does not exist and HTTP `GET /assets/aistudio/...` returns 404/SPA fallback without text/image disclosure. **Status: Open (Read-Only Assessment).**

---

### CC-FE-002 — File Upload Validator Ignores Disallowed MIME Types When Filename Has Video Extension
- **Classification:** Confirmed Vulnerability
- **Severity:** **Medium**
- **CWE:** CWE-434 (Unrestricted Upload of File with Dangerous Type), CWE-20 (Improper Input Validation)
- **Affected Files & Evidence:**
  - `src/utils/validation.ts:13-56` (`validateVideoFileInput`)
  - `src/pages/NewProjectPage.tsx:71-118` (`handleFileSelection` creates `URL.createObjectURL(file)` and loads `<video>` metadata + allows form submission)
  - Dynamic Evidence: `security-assessment/EVIDENCE/09_dynamic_tests.txt:2,48-60`
- **Relevant Code (`src/utils/validation.ts:22-42`):**
```ts
  const lower = file.name.toLowerCase();
  const hasSupportedExt = SUPPORTED_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
  const mime = file.type?.toLowerCase();
  const hasSupportedMime =
    !mime ||
    SUPPORTED_VIDEO_MIME_TYPES.some((allowed) => allowed === mime) ||
    mime.startsWith('video/');

  if (!hasSupportedExt && !hasSupportedMime) {
    return {
      valid: false,
      error: 'Unsupported format. Please select an MP4, MOV, MKV, or WEBM video file.',
    };
  }

  if (!hasSupportedExt) {
    return {
      valid: false,
      error: 'Unsupported file extension. Supported formats: MP4, MOV, MKV, WEBM.',
    };
  }
```
- **Preconditions & Attack Surface:** File picker and drag-and-drop upload zone on `/projects/new`.
- **Reproduction Steps:**
  1. Navigate to `http://localhost:3000/projects/new`.
  2. Supply a file with `name: "fake_<b>xss</b>_clip.mp4"`, `mimeType: "text/html"`, and HTML/script contents (`<html><script>window.__xss=1</script></html>`).
- **Actual Result:** Because `hasSupportedExt` is `true` (ends with `.mp4`), `!hasSupportedExt && !hasSupportedMime` evaluates to `false` even though `mime` is `text/html`. The UI displays `"Valid format"`, attaches a `blob:http://localhost:3000/...` `<video>` element, and permits upload submission once project settings are valid. Additionally, filenames are not checked for path separators (`/` / `\`), null/control characters, double extensions (`payload.html.mp4`), or max filename length.
- **Expected Result:** When a browser provides a non-empty `file.type`, any non-video MIME type (`text/html`, `application/javascript`, `image/svg+xml`, `application/x-msdownload`) should be immediately rejected even if the extension is `.mp4`, accompanied by clear UI notice that client-side header checks do not replace backend magic-byte verification.
- **Security Impact & Abuse Scenario:** Actively misleading client validation allows polyglot/disguised HTML/SVG/executable files renamed with `.mp4` to pass preflight checks cleanly and reach the upload endpoint. (Note: Server-side content/signature verification remains mandatory backend work regardless.)
- **Root Cause:** Boolean conjunction error on line 30 (`!hasSupportedExt && !hasSupportedMime`), which causes `hasSupportedMime` to be completely dead code whenever `hasSupportedExt` is true.
- **Remediation:** Reject whenever `mime && !SUPPORTED_VIDEO_MIME_TYPES.includes(mime) && mime !== 'application/octet-stream'` (or strict allowlist of `SUPPORTED_VIDEO_MIME_TYPES`), enforce filename length (`<= 255`) and sanitize path/control characters before display/submission, and optionally inspect leading magic bytes (`ftyp`, `1A 45 DF A3`, etc.) as best-effort UX preflight while explicitly documenting backend magic-byte enforcement.
- **Regression Test & Retest Status:** Add unit test in `src/utils/validation.test.ts` verifying `{ name: 'evil.mp4', size: 100, type: 'text/html' }` returns `{ valid: false }`. **Status: Open (Read-Only Assessment).**

---

### CC-FE-003 — Media URL Validator Accepts Loopback, Metadata (`169.254.169.254`), Embedded Credentials, & Unbounded URLs
- **Classification:** Confirmed Vulnerability (Frontend Validation Defect; Backend SSRF Potential)
- **Severity:** **Medium**
- **CWE:** CWE-918 (Server-Side Request Forgery enabler), CWE-20 (Improper Input Validation), CWE-598 (Use of Credentials in URL)
- **Affected Files & Evidence:**
  - `src/utils/validation.ts:58-157` (`classifyAndValidateVideoUrl`)
  - `src/pages/NewProjectPage.tsx:120-137, 179-184` (sends validated `sourceUrl` to `createProjectFromUrl`)
  - Dynamic Evidence: `security-assessment/EVIDENCE/09_dynamic_tests.txt:2,22-46`, `security-assessment/EVIDENCE/sec-03-url-ssrf-accepted.png`
- **Relevant Code (`src/utils/validation.ts:85-130`):**
```ts
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    ...
  }
  const hostname = parsed.hostname.toLowerCase();
  ...
  if (lowerPath.endsWith('.mp4')) {
    return {
      valid: true,
      canAutoDownload: true,
      category: 'direct_mp4',
      hostname,
      detectedFilename: lastSegment,
      message: 'Direct MP4 media URL detected and ready for backend retrieval.',
    };
  }
```
- **Preconditions & Attack Surface:** `"From URL"` tab on `/projects/new?mode=url`.
- **Reproduction Steps:** Submit the following inputs and click `"Validate URL"`:
  1. `http://169.254.169.254/latest/meta-data/clip.mp4`
  2. `http://admin:secret@127.0.0.1:8000/video.mp4`
  3. `http://[::1]:8000/clip.mp4`
  4. `http://localhost:3000/video.mp4`
  5. `https://example.com/` + `a`.repeat(2048) + `.mp4` (`2,072` chars)
- **Actual Result:** While `javascript:alert(1)`, `data:text/html,<b>hi</b>`, and `file:///etc/passwd` are properly rejected, **all 5 SSRF/credential/length probes passed** with green banner `"Direct MP4 media URL detected and ready for backend retrieval"` and `"Start Clipping"` enabled (`startClippingDisabled: false`). `admin:secret` credentials are also accepted silently without warning or rejection.
- **Expected Result:** Client preflight validation rejects URLs with `parsed.username || parsed.password`, rejects URLs exceeding a safe max length (e.g., `2048` chars), and blocks loopback (`localhost`, `127.0.0.0/8`, `::1`), link-local/metadata (`169.254.0.0/16`), RFC1918 private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and non-standard ports unless explicitly authorized.
- **Security Impact & Abuse Scenario:** When the FastAPI backend is connected, `"Import from URL"` submits `sourceUrl` to `/api/projects/from-url`. Untrusted project imports or tricking a local/hosted user into pasting a URL targeting cloud metadata (`169.254.169.254`), internal routers, or localhost services creates an immediate SSRF vector—and the UI explicitly reassures the user that these unsafe URLs are *"ready for backend retrieval"*. (Frontend checks cannot prevent SSRF alone; backend DNS/IP/redirect controls are mandatory.)
- **Root Cause:** `classifyAndValidateVideoUrl` checks only `protocol` (`http:` / `https:`), YouTube domain strings, and pathname suffix (`.mp4`/`.mov`/`.webm`/`.mkv`), omitting credential checks, length bounds, hostname/IP validation, and IPv6 literal checks.
- **Remediation:** Add credential rejection (`parsed.username || parsed.password`), max URL length enforcement (`<= 2048`), and private/loopback/link-local IP/hostname rejection in `classifyAndValidateVideoUrl`—**plus** implement mandatory server-side SSRF mitigation in FastAPI (`BACKEND_SECURITY_REQUIREMENTS.md` §7).
- **Regression Test & Retest Status:** Add unit tests covering metadata IP, loopback IPv4/IPv6, RFC1918, `user:pass@`, and >2048-char URLs. **Status: Open (Read-Only Assessment).**

---

### CC-FE-004 — External Third-Party Google Fonts Requests Expose Network Metadata & Contradict Strict Local-First Privacy Claims
- **Classification:** Confirmed Vulnerability (Privacy & External Dependency Exposure)
- **Severity:** **Medium**
- **CVSS 4.0:** Not scored (Privacy / Policy-to-Implementation discrepancy; no confidentiality breach of stored files, but leaks client IP, User-Agent, and origin/timing metadata on every load).
- **CWE:** CWE-359 (Exposure of Private Personal Information to an Unauthorized Actor), CWE-829 (Inclusion of Functionality from Untrusted Control Sphere)
- **Affected Files & Evidence:**
  - `index.html:15-20`
  - `src/components/layout/Footer.tsx:235-238` (`Local-first · Zero analytics or telemetry collected`)
  - `src/pages/SettingsPage.tsx:726-731` (`ClipCat runs strictly local-first.`)
  - Dynamic Evidence: `security-assessment/EVIDENCE/09_dynamic_tests.txt:2` (`externalResourcesOnLoad` records live `link` request to `https://fonts.googleapis.com/css2?family=Inter...`)
- **Relevant Code (`index.html:15-20`):**
```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Nunito:wght@600;700;800&display=swap"
      rel="stylesheet"
    />
```
- **Preconditions & Attack Surface:** Every page load in any browser or webview (including offline or restricted environments).
- **Reproduction Steps:** Load `http://localhost:3000/` in Playwright and inspect `performance.getEntriesByType('resource')`.
- **Actual Result:** Browser immediately initiates TLS/HTTP requests to `https://fonts.googleapis.com` and `https://fonts.gstatic.com` without user consent or disclosure in the Privacy section (`SettingsPage.tsx:726-731`), exposing visitor IP address, browser User-Agent, HTTP Referer/Origin, and usage timestamps to external servers. This directly contradicts the product's *"strictly local-first"* offline framing and forces CSP `style-src` / `font-src` exceptions for external origins.
- **Expected Result:** Local-first privacy claims match actual network behavior: bundle WOFF2 font files locally under `public/fonts/` (or `@fontsource/*`) with `font-src 'self'`, or explicitly disclose external CDN usage in Settings Privacy copy if kept.
- **Security Impact & Abuse Scenario:** Breaks air-gapped/offline usage guarantees, introduces third-party CSS/font supply-chain reliance (and widens required CSP surface), and leaks user network metadata inconsistent with UI privacy assurances.
- **Root Cause:** Template Google Fonts CDN `<link>` tags in `index.html` were retained while building a local-first desktop/LAN studio.
- **Remediation:** Self-host `Inter`, `Nunito`, and `JetBrains Mono` locally in `public/fonts/` with `@font-face` rules in `src/index.css` and remove `fonts.googleapis.com` / `fonts.gstatic.com` from `index.html`.
- **Regression Test & Retest Status:** Assert `performance.getEntriesByType('resource')` on `/` contains zero third-party hosts (`!== location.origin` and `!== configured API`). **Status: Open (Read-Only Assessment).**

---

### CC-FE-005 — Production-Exposed `?mock=1` Query Switch & Unconstrained `localStorage` Backend Endpoint Override
- **Classification:** Confirmed Vulnerability
- **Severity:** **Medium**
- **CWE:** CWE-639 / CWE-345 (Insufficient Verification of Data Authenticity), CWE-319 (Cleartext Transmission), CWE-472 (External Control of Assumed-Immutable Web Parameter)
- **Affected Files & Evidence:**
  - `src/api/client.ts:29-38` (`isMockApiEnabled` checks `window.location.search` `'mock' === '1'` in all builds)
  - `src/stores/uiStore.ts:43-46` (`mockModeEnabled` reads `window.location.search`)
  - `src/config/env.ts:24-52` (`getApiBaseUrl` / `setRuntimeApiBaseUrl` stores any `http(s)://` URL in `localStorage['clipcat-api-base-url']`)
  - `src/pages/SettingsPage.tsx:130-148` (`handleApplyBackendUrl`)
  - Dynamic Evidence: `security-assessment/EVIDENCE/09_dynamic_tests.txt:2,76-106`, `security-assessment/EVIDENCE/sec-02-mock-query-bypass.png`
- **Relevant Code (`src/api/client.ts:29-38` & `src/config/env.ts:24-30`):**
```ts
export function isMockApiEnabled(): boolean {
  if (mockModeRuntimeOverride !== null) {
    return mockModeRuntimeOverride;
  }
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mock') === '1') return true;
  }
  return ENV.USE_MOCK_API;
}
```
```ts
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const override = normalizeBaseUrl(window.localStorage.getItem(API_BASE_STORAGE_KEY));
      if (override && /^https?:\/\//i.test(override)) {
        return override;
      }
```
- **Preconditions & Attack Surface:** Any shared link containing `?mock=1`, or any user/extension writing to `Settings -> FastAPI Backend Server URL` (`localStorage['clipcat-api-base-url']`).
- **Reproduction Steps:**
  1. Visit `http://localhost:3000/?mock=1` in production build (`vite preview`) or dev mode.
  2. Visit `/settings`, enter `http://10.0.0.99:9000/untrusted`, click `Apply Server URL`, and inspect `localStorage.getItem('clipcat-api-base-url')`.
- **Actual Result:** `?mock=1` silently swaps all API calls to simulated in-memory state in production bundles without developer opt-in gating (`import.meta.env.DEV`), and `SettingsPage` persists arbitrary plaintext `http://` external servers (`http://10.0.0.99:9000/untrusted` or embedded-credential URLs) into `localStorage` so subsequent file uploads (`NewProjectPage`) and API calls transmit video uploads and settings to an untrusted host.
- **Expected Result:** `?mock=1` and runtime mock switching are restricted to development builds (`import.meta.env.DEV` or explicit compile flag) or strictly non-bypassable in production; runtime backend URL overrides require URL validation (no embedded credentials, no path/query injection, explicit warning when non-loopback HTTP is used) and clear visual indicator in the persistent header when targeting non-default hosts.
- **Security Impact & Abuse Scenario:** Phishing/deception via a `?mock=1` link can mislead operators into believing processing succeeded locally when nothing reached the backend, while an arbitrary or persistent misconfigured `clipcat-api-base-url` routes full video uploads (`POST /api/projects/upload`) and settings over unencrypted HTTP to an attacker-controlled server if a user or malicious local process modifies the URL.
- **Root Cause:** Query-string mock activation lacks `import.meta.env.DEV` gating, and `setRuntimeApiBaseUrl` validates only `/^https?:\/\//i` without `new URL()` canonicalization (`origin` extraction), credential rejection, or plaintext-remote warnings.
- **Remediation:** Gate `?mock=1` behind `import.meta.env.DEV || ENV.USE_MOCK_API`, parse `setRuntimeApiBaseUrl` with `new URL()`, reject embedded credentials/non-empty hash/query strings, retain origin only (`parsed.origin`), and display a prominent non-dismissible warning banner whenever `getApiBaseUrl()` targets a non-loopback `http://` host.
- **Regression Test & Retest Status:** Test that `http://localhost:3000/?mock=1` does not activate mock mode when `PROD === true` and `setRuntimeApiBaseUrl('http://user:pass@evil.example/api')` is rejected. **Status: Open (Read-Only Assessment).**

---

### CC-FE-006 — Unvalidated Backend-Supplied Download/Archive URLs & Inconsistent Download Filename Sanitization
- **Classification:** Confirmed Vulnerability (Defense-in-Depth Weakness / Untrusted Backend Response Trust)
- **Severity:** **Low**
- **CWE:** CWE-601 (URL Redirection to Untrusted Site), CWE-22 (Improper Limitation of a Pathname to a Restricted Directory — Filename Hygiene)
- **Affected Files & Evidence:**
  - `src/utils/desktop.ts:52-80` (`triggerVerifiedDownload`)
  - `src/api/clips.ts:36-58` (`getClipPreviewUrl`, `getClipDownloadUrl`)
  - `src/pages/ExportManagerPage.tsx:55-82` (`handleDownloadArtifact`, `handleDownloadAll`)
  - `src/pages/ClipEditorPage.tsx:232`, `src/pages/ClipDiscoveryPage.tsx:72`, `src/pages/ClipLibraryPage.tsx:68`
- **Relevant Code (`src/utils/desktop.ts:58-73` & `src/api/clips.ts:48-52`):**
```ts
export function getClipDownloadUrl(clip: Clip): string | null {
  if (clip.downloadUrl) {
    return clip.downloadUrl.startsWith('http')
      ? clip.downloadUrl
      : buildApiUrl(clip.downloadUrl);
  }
```
```ts
    const headResponse = await fetch(downloadUrl, { method: 'HEAD' });
    if (!headResponse.ok) { ... }
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.rel = 'noopener noreferrer';
```
- **Preconditions & Attack Surface:** Compromised, buggy, or untrusted backend server returning `clip.downloadUrl`, `clip.previewVideoUrl`, or `resp.archiveUrl`, or clips whose `title` contains path separators / reserved OS characters (`../`, `/`, `\`, `:`, `<`, `>`).
- **Reproduction Steps:** Inspect `getClipDownloadUrl`, `ExportManagerPage.tsx:80-81`, and `ClipEditorPage.tsx:232`.
- **Actual Result:**
  1. `startsWith('http')` checks only prefix string match—it does not verify same-origin with `getApiBaseUrl()` or reject redirects to external domains. `batchExportClips` passes `resp.archiveUrl` directly into `triggerVerifiedDownload(resp.archiveUrl, ...)` without even checking `http(s):` or relative path prefix (`data:` or `javascript:` URLs would fail `HEAD`, or external `https://evil.example/...` would be fetched and downloaded).
  2. `ClipEditorPage.tsx:232`, `ClipDiscoveryPage.tsx:72`, and `ClipLibraryPage.tsx:68` build filenames via `${clip.title.replace(/\s+/g, '_')}.mp4` without stripping `/`, `\`, `..`, control characters, or OS reserved symbols (unlike `ExportManagerPage` which strips non-alphanumeric chars via `replace(/[^a-z0-9]/gi, '_')`).
- **Expected Result:** Validate all backend-returned asset/download URLs (`previewVideoUrl`, `downloadUrl`, `archiveUrl`, `thumbnailUrl`, `srtUrl`, `vttUrl`) against `http:`/`https:` AND the configured API origin (`new URL(url, getApiBaseUrl()).origin === new URL(getApiBaseUrl()).origin`), and centralize a safe filename sanitizer across all download callers.
- **Security Impact & Abuse Scenario:** If a compromised remote/LAN backend injects an external `archiveUrl` or `downloadUrl`, the client silently triggers downloads from an arbitrary third-party domain; unsanitized titles create awkward/problematic local filenames (`..`, `:`, `|`).
- **Root Cause:** Implicit trust in backend string URLs and duplicated ad-hoc filename formatting instead of a single helper.
- **Remediation:** Enforce origin-locked URL resolution in `desktop.ts` / `clips.ts` and extract a shared `sanitizeDownloadFilename(title, ext)` helper used by `ClipEditorPage`, `ClipDiscoveryPage`, `ClipLibraryPage`, and `ExportManagerPage`.
- **Regression Test & Retest Status:** Unit tests rejecting cross-origin `archiveUrl` and stripping `/\:*?"<>|` from clip titles. **Status: Open (Read-Only Assessment).**

---

### CC-FE-007 — Absence of React `ErrorBoundary`, Unchecked Runtime API JSON Casts, & Unauthenticated Startup Probes to Default `127.0.0.1:8000`
- **Classification:** Confirmed Vulnerability (Resilience & Unexpected Local Service Interaction)
- **Severity:** **Low**
- **CWE:** CWE-755 (Improper Handling of Exceptional Conditions), CWE-20 (Improper Input Validation)
- **Affected Files & Evidence:**
  - `src/App.tsx:66-92` (zero `ErrorBoundary` wrappers; static scan `06_static_sink_scan.txt:38-39` confirms zero matches)
  - `src/api/client.ts:119-125` (`return (await response.json()) as T;` — compile-time TypeScript cast with zero runtime schema verification)
  - `src/config/env.ts:10`, `src/hooks/useClipCatQueries.ts` (`DashboardPage` immediately fires 4–6 fetch calls to `http://127.0.0.1:8000/api/*` on load)
  - Evidence: `security-assessment/EVIDENCE/06_static_sink_scan.txt:38-39`, `09_dynamic_tests.txt:2`
- **Preconditions & Attack Surface:** Any malformed JSON payload returned by a backend (e.g., `projects` returned as `{}` instead of `Project[]`, triggering `.map`/`.filter` TypeError inside JSX) or any unrelated service listening locally on `127.0.0.1:8000`.
- **Reproduction Steps:** Inspect `src/App.tsx` and load `http://localhost:3000/` cleanly in a sandbox where an unrelated service listens on port `8000`.
- **Actual Result:**
  1. An unhandled runtime render exception crashes the entire React root to a blank screen (no `ErrorBoundary` fallback exists).
  2. Every JSON API response is blindly cast `as T` with zero structural runtime validation.
  3. On initial page load (`/`), the browser automatically issued `fetch` calls to `http://127.0.0.1:8000/api/projects`, `/api/clips`, `/api/system/storage`, and `/api/system/health` (and during verification in this sandbox, collided with an unrelated container listener on port `8000` that returned `401` without CORS headers).
- **Expected Result:** Wrap routes inside a React `ErrorBoundary` showing safe user recovery (without stack traces in UI), validate critical API response shapes (e.g., `Array.isArray(...)` or `zod` schemas) before storing/rendering, and consider probing `/api/system/health` first or surfacing clearer connection gating rather than assuming port `8000` belongs to ClipCat.
- **Security Impact & Abuse Scenario:** Malformed or partial backend JSON crashes the entire UI cleanly into a white screen (client DoS), and blind multi-endpoint requests to `127.0.0.1:8000` can unintentionally hit unrelated local developer services sharing port `8000`.
- **Root Cause:** Relying solely on compile-time TypeScript interfaces (`as T`) without runtime guards or React render-phase recovery.
- **Remediation:** Add an `AppErrorBoundary` around `<Routes>` in `src/App.tsx` and lightweight runtime validators (or `zod`) in `src/api/*.ts`.
- **Regression Test & Retest Status:** Render-crash unit/Playwright test with malformed mock response confirming fallback card renders instead of empty root. **Status: Open (Read-Only Assessment).**

---

## 3. Security Design Gaps (`CC-FE-GAP-*`)

| Gap ID | Category | Summary & Evidence | Recommended Owner |
|---|---|---|---|
| **CC-FE-GAP-001** | Supply Chain & Manifest Hygiene | Unused dependencies (`@google/genai@2.32.0`, `express@4.22.3`, `dotenv@17.4.2`, `@types/express@4.17.25`) remain in `package.json:14,19,20,38`; `metadata.json:5` declares `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` despite zero `@google/genai` imports (`06_static_sink_scan.txt:35-36`); `package-lock.json` is missing while `README.md` documents `npm install` (`01_env_baseline.txt`, `02_npm_audit.txt`). | Frontend / DevOps |
| **CC-FE-GAP-002** | Browser Security Headers & CSP | Zero deployment header configs (`vercel.json`, `nginx.conf`, `_headers`) exist; `curl -sSI http://localhost:3000/` (`08_http_headers.txt`) returns no CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`. | Deployment / Hosting |
| **CC-FE-GAP-003** | Authentication, Session & CSRF | No authentication, bearer token, session cookie, or role model exists (`client.ts` sends unauthenticated requests without `credentials`). Recommended `http://192.168.1.25:8000` LAN access (`SettingsPage.tsx:552`) exposes plaintext HTTP control over processing, deletion, and directory paths unless authenticated before LAN use. | Full-Stack Architecture |
| **CC-FE-GAP-004** | Security UX & Path Configuration | `Clear Temporary Files` (`SettingsPage.tsx:479-487`) triggers immediately without `ConfirmDialog`; `Modal.tsx` handles `Escape` but lacks keyboard focus trapping (`Tab`); `SettingsPage.tsx:491-520` accepts arbitrary OS strings for `projectDirectory`, `exportDirectory`, and `tempDirectory` with no backend path-jail specification yet. | Frontend + Backend |
