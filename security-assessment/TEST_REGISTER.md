# Frontend Security Test Register — ClipCat

- **Assessment Date:** `2026-11-15`
- **Target:** ClipCat Frontend (`/app/applet`)
- **Status Legend:** `PASS` | `FAIL` | `NOT APPLICABLE` | `NOT TESTABLE` | `NOT RUN`
- **Engagement Rule:** All failed, partial, and backend-blocked tests are recorded explicitly. Passing frontend tests do **not** validate absent server-side controls.

---

## Baseline & Static Discovery Summary

| Test ID | Cat | Test Name | Files / Routes | Method | Expected Result | Actual Result | Status | Evidence | Limitations / Confidence |
|---|---|---|---|---|---|---|---|---|---|
| `BL-01` | Baseline | Environment & Lockfile Consistency | `package.json`, `bun.lock`, `.env.example` | `node -v`, `npm -v`, `bun -v`, `ls` | Consistent lockfile matching documented `npm` flow | `bun.lock` (`71.8 KB`) present; no `package-lock.json`; no `.git`; no `.env` | `FAIL` | `01_env_baseline.txt` | High confidence; `npm audit` blocked (`ENOLOCK`). |
| `BL-02` | Baseline | TypeScript Type-Check & Vite Production Build | All TS/TSX modules | `npx tsc --noEmit && npm run build` | Clean type-check & production build | Both exited `0`; `dist/assets/index-BnTMaKV7.js` (`716.02 kB` > 500 KB limit) | `PASS` | `04_typecheck_build.txt:1-63` | Build success ≠ security; chunk warning noted. |
| `BL-03` | Baseline | Unit Test Suite Execution | `src/**/*.test.ts` (5 files) | `npx --yes tsx --test` | All tests pass cleanly | `22/22` tests passed (548ms) | `PASS` | `05_unit_tests.txt` | High confidence; unit coverage excludes UI components. |
| `BL-04` | Baseline | Backend-Absent Runtime Resilience | `http://localhost:3000/` | Browser navigation (Playwright) | App runs & degrades safely without backend | Renders UI cleanly with clear `Backend Unavailable` state | `PASS` | `sec-01-dashboard-offline.png` | High confidence. |

---

## Category A — Input Validation & Output Encoding

| Test ID | Test Name | Files / Routes | Method & Input | Expected Result | Actual Result | Status | Evidence | Limitations |
|---|---|---|---|---|---|---|---|---|
| `A-01` | Dangerous DOM/String-to-HTML Sink Scan | All `src/**/*.{ts,tsx}` | `grep -rnE` (`dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function`) | 0 matches | 0 matches | `PASS` | `06_static_sink_scan.txt:1-2` | High confidence. |
| `A-02` | Project Name Rename XSS Rendering | `/projects?mock=1` (`ProjectsPage.tsx`) | Inject `<b>TestXSS</b><img src=x onerror="window.__xss=1">` | Escaped literal text; `window.__xss === null` | Literal string rendered; `window.__xss === null` | `PASS` | `09_dynamic_tests.txt:2,76-86`, `sec-04-xss-escaped-projects.png` | Mock mode only. |
| `A-03` | Clip Description XSS Rendering | `/clips/clip-sample-01/edit?mock=1` (`ClipEditorPage.tsx`) | Inject `<svg onload="window.__xss=1">Desc</svg>` and click Save | Escaped text, no SVG execution | Draft saved cleanly; `window.__xss === null` | `PASS` | `09_dynamic_tests.txt:2,89-97` | Mock mode only. |
| `A-04` | Processing Config Range & Regex Safety | `src/utils/validation.ts:165-189`, `src/pages/ExportManagerPage.tsx` | Inspect all regexes (`validation.ts`, `env.ts`, `filters.ts`, `ExportManagerPage.tsx`) | Bounded input checks, no ReDoS-prone nested quantifiers | No exponential backtracking regexes; config validates ranges (5–300s, 1–30 clips, <=120 chars name) | `PASS` | `validation.ts:165-212`, `05_unit_tests.txt:128-138` | Client-only; server Pydantic schema still required. |
| `A-05` | Backend Storage Directory Path Hygiene | `SettingsPage.tsx:491-520` (`storage.*`) | Source inspection of directory `<Input>` fields | Path validation / server allowlist enforcement | Arbitrary OS paths accepted; server validation absent | `NOT TESTABLE` | `SettingsPage.tsx:491-520` | Backend absent (`CC-FE-GAP-004`). |

---

## Category B — XSS & DOM Security

| Test ID | Test Name | Files / Routes | Method & Input | Expected Result | Actual Result | Status | Evidence | Limitations |
|---|---|---|---|---|---|---|---|---|
| `B-01` | External `target="_blank"` Anchor Hardening | `Footer.tsx:43-47`, `SettingsPage.tsx:680-697` | Static grep for `target="_blank"` + code review | All external new-tab links include `rel="noopener noreferrer"` | 100% include `rel="noopener noreferrer"` | `PASS` | `06_static_sink_scan.txt:14-21` | High confidence. |
| `B-02` | DOM-Based XSS via Malformed Route Path | `/unknown-path/%3Cscript%3Ealert(1)%3C/script%3E` | Browser navigation & `window.__xss` check | Safe fallback redirect to `/` without script execution | Redirected cleanly to `/`; `window.__xss === null` | `PASS` | `09_dynamic_tests.txt`, `App.tsx:85` | High confidence. |
| `B-03` | User/Server HTML & SVG Content Isolation | `NewProjectPage.tsx`, `ClipDiscoveryPage.tsx`, `ClipCard.tsx` | Inspect all JSX components rendering metadata/filenames/transcripts | Pure React text nodes; zero raw HTML/Markdown parsers | Zero raw HTML/SVG injection sinks | `PASS` | `06_static_sink_scan.txt:1-2` | High confidence. |

---

## Category C — File Upload & Media Input UI

| Test ID | Test Name | Files / Routes | Method & Input | Expected Result | Actual Result | Status | Evidence | Limitations |
|---|---|---|---|---|---|---|---|---|
| `C-01` | Disallowed MIME Type With `.mp4` Extension | `src/utils/validation.ts:13-43`, `/projects/new` | Upload buffer `<html>...</html>` with `name: "fake_<b>xss</b>_clip.mp4"`, `mimeType: "text/html"` | Rejected due to non-video MIME `text/html` | **Accepted as `"Valid format"`** & attached `<video src="blob:...">` | `FAIL` | `09_dynamic_tests.txt:2,49-59`, `validation.ts:24-35` | `CC-FE-002`; frontend preflight only. |
| `C-02` | Traversal-Like Filename With Valid `video/mp4` MIME | `src/utils/validation.ts:13-43`, `/projects/new` | Upload `name: "../../etc/passwd.html"`, `mimeType: "video/mp4"` | Rejected due to unsupported extension & traversal chars | Rejected with `"Unsupported file extension..."` (`role="alert"`) | `PASS` (Partial) | `09_dynamic_tests.txt:2,68-74` | Traversal chars inside `evil/../../foo.mp4` would still pass extension check (`CC-FE-002`). |
| `C-03` | Object URL Creation & Cleanup on Remove | `NewProjectPage.tsx`, `projectDraftStore.ts` | Select file then click `Remove selected file` | `<video>` removed and `blob:` object URL revoked | `hasBrowseFiles: true`, `videoElementCount: 0` | `PASS` | `09_dynamic_tests.txt:2,61-66` | Memory pressure beyond browser session not benchmarked at 8 GB. |
| `C-04` | Server-Side Magic Bytes, Size Caps & Media Sandboxing | FastAPI `/api/projects/upload` (absent) | Source & environment inspection | Backend magic-byte check, FFmpeg sandbox, upload streaming cap | Backend does not exist | `NOT TESTABLE` | `docs/FRONTEND_BACKEND_CONTRACT.md` | Must verify once backend exists. |

---

## Category D — URL Input & External Navigation

| Test ID | Test Name | Files / Routes | Method & Input | Expected Result | Actual Result | Status | Evidence | Limitations |
|---|---|---|---|---|---|---|---|---|
| `D-01` | Dangerous URI Schemes in Media URL Input | `src/utils/validation.ts:85-94`, `/projects/new?mode=url` | Submit `javascript:alert(1)`, `data:text/html,<b>hi</b>`, `file:///etc/passwd` | Rejected; `Start Clipping` disabled | Rejected (`Only HTTP and HTTPS media URLs are supported.`); button disabled | `PASS` | `09_dynamic_tests.txt:2,25-27` | High confidence. |
| `D-02` | Internal/Metadata SSRFTargets, Embedded Credentials & Long URLs | `src/utils/validation.ts:96-130`, `/projects/new?mode=url` | Submit `http://169.254.169.254/latest/meta-data/clip.mp4`, `http://admin:secret@127.0.0.1:8000/video.mp4`, `http://[::1]:8000/clip.mp4`, `http://localhost:3000/video.mp4`, 2,072-char URL | Reject or block internal/metadata/credential/oversized URLs | **All 5 accepted** (`Direct MP4 media URL detected and ready for backend retrieval`, button enabled) | `FAIL` | `09_dynamic_tests.txt:2,28-33`, `sec-03-url-ssrf-accepted.png` | `CC-FE-003`; backend SSRF enforcement still mandatory. |
| `D-03` | Backend-Supplied Asset & Archive Download URLs | `src/utils/desktop.ts:52-80`, `src/api/clips.ts:36-58`, `ExportManagerPage.tsx:80-81` | Code review of download/preview URL resolution & filename sanitization | Enforce configured API origin; strip path/reserved chars from filenames | `archiveUrl` & `http*` URLs trusted cross-origin; `ClipEditorPage`/`ClipLibraryPage` only replace whitespace | `FAIL` | `desktop.ts:52-80`, `clips.ts:36-58`, `ClipEditorPage.tsx:232` | `CC-FE-006`. |

---

## Category E — Client Storage & Privacy

| Test ID | Test Name | Files / Routes | Method | Expected Result | Actual Result | Status | Evidence | Limitations |
|---|---|---|---|---|---|---|---|---|
| `E-01` | Browser Storage & Cache Inventory | `http://localhost:3000/` | Check `localStorage`, `sessionStorage`, `document.cookie`, `indexedDB.databases()`, `caches.keys()` | Only minimal UI prefs, zero tokens/transcripts/secrets | `localStorage['clipcat-ui-preferences']` only (`clipcat-api-base-url` after Settings edit); cookies/session/IDB/Cache empty | `PASS` | `09_dynamic_tests.txt:2,13-20` | High confidence. |
| `E-02` | Verification of "Local-first · Zero Telemetry" Claims | `index.html:15-20`, `Footer.tsx:237`, `SettingsPage.tsx:726-731` | Inspect initial load `performance.getEntriesByType('resource')` | Zero undisclosed external network requests | Browser fires external requests to `fonts.googleapis.com` / `fonts.gstatic.com` on load | `FAIL` | `09_dynamic_tests.txt:2`, `index.html:15-20` | `CC-FE-004`. |
| `E-03` | Static Web Root Public Exposure Check | `public/assets/aistudio/*`, `dist/assets/aistudio/*` | `ls` `dist/` & `curl -sSI` public prompt path | Only app assets in `public/` & `dist/` | Internal security prompt `.txt` (`HTTP 200 OK`) + mobile ChatGPT screenshot shipped publicly | `FAIL` | `04_typecheck_build.txt:66-70`, `08_http_headers.txt:13-24` | `CC-FE-001`. |

---

## Category F — Authentication, Authorization, & Session Placeholders

| Test ID | Test Name | Files / Routes | Method | Expected Result | Actual Result | Status | Evidence | Limitations |
|---|---|---|---|---|---|---|---|---|
| `F-01` | Authentication, Role, & Token Implementation Check | `src/api/client.ts`, `src/App.tsx`, `src/stores/*` | Static inspection across codebase | Document present vs. absent controls honestly | Authentication, sessions, roles, and route guards are **completely absent** | `NOT APPLICABLE` / Design Gap | `client.ts:74-83`, `App.tsx:71-86` | `CC-FE-GAP-003`; required before LAN/shared deployment. |

---

## Category G — API Client & Future Backend Integration

| Test ID | Test Name | Files / Routes | Method | Expected Result | Actual Result | Status | Evidence | Limitations |
|---|---|---|---|---|---|---|---|---|
| `G-01` | Production `?mock=1` Query Bypass | `src/api/client.ts:29-38`, `src/stores/uiStore.ts:43-46` | Navigate to `http://localhost:3000/?mock=1` & inspect `client.ts` | Mock switch disabled or blocked in production builds | `?mock=1` unconditionally activates Mock Adapter without DEV check | `FAIL` | `sec-02-mock-query-bypass.png`, `client.ts:33-36` | `CC-FE-005`. |
| `G-02` | Runtime Backend URL Override Validation | `src/config/env.ts:24-52`, `/settings` | Set `http://10.0.0.99:9000/untrusted` in Settings & apply | Restrict/warn on non-loopback HTTP & reject credentials/paths | Persisted verbatim to `localStorage['clipcat-api-base-url']` | `FAIL` | `09_dynamic_tests.txt:2,100-105`, `SettingsPage.tsx:130-148` | `CC-FE-005`. |
| `G-03` | Runtime Schema Validation of Backend JSON | `src/api/client.ts:119-125` | Static review of `apiRequest` & `apiUpload` | Runtime type validation on parsed JSON | Raw `(await response.json()) as T` cast with no schema validation | `FAIL` | `client.ts:124,183` | `CC-FE-007`. |
| `G-04` | Backend CORS, SSRF, SQLi, Rate Limits | FastAPI backend (absent) | Static contract review (`docs/FRONTEND_BACKEND_CONTRACT.md`) | Verified backend controls | Backend not connected or present | `NOT TESTABLE` | `docs/FRONTEND_BACKEND_CONTRACT.md` | Must test against live FastAPI before launch. |

---

## Category H — Dependency & Supply-Chain Security

| Test ID | Test Name | Files / Routes | Method | Expected Result | Actual Result | Status | Evidence | Limitations |
|---|---|---|---|---|---|---|---|---|
| `H-01` | Package Audit (`npm audit` & `bun audit`) | `package.json`, `bun.lock` | `npm audit --json`; `bun audit` | Zero known CVEs | `npm audit` failed (`ENOLOCK`); `bun audit` passed: `0 vulnerabilities found (268 packages)` | `PASS` (via `bun`) / `FAIL` (lock mismatch) | `02_npm_audit.txt` | Clean audit ≠ proof of security (`CC-FE-GAP-001`). |
| `H-02` | Unused Server/AI Dependency Check | `package.json:14,19,20,38`, `metadata.json:5`, `src/` | `npm ls --depth=0` + `grep` source imports | Minimal frontend-only dependencies matching runtime | `@google/genai`, `express`, `dotenv`, `@types/express` installed but never imported | `FAIL` (Gap) | `03_npm_ls.txt`, `06_static_sink_scan.txt:35-36` | `CC-FE-GAP-001`. |

---

## Category I — Secrets & Configuration

| Test ID | Test Name | Files / Routes | Method | Expected Result | Actual Result | Status | Evidence | Limitations |
|---|---|---|---|---|---|---|---|---|
| `I-01` | Source & Production Bundle Secret Scan | `src/`, `.env.example`, `dist/` | `grep` for keys/tokens/passwords + inspect `dist/` source maps & embedded URLs | Zero exposed secrets; zero `.map` files in `dist/` | Zero leaked keys/secrets; zero `.map` files; dev/LAN URLs (`127.0.0.1:8000`, `192.168.1.*`) bundled as UI copy/defaults | `PASS` | `07_secret_bundle_scan.txt` | No `.git` commit history to inspect (`01_env_baseline.txt:7-8`). |

---

## Category J — Security Headers & Browser Policies

| Test ID | Test Name | Files / Routes | Method | Expected Result | Actual Result | Status | Evidence | Limitations |
|---|---|---|---|---|---|---|---|---|
| `J-01` | Local Dev HTTP Header Check & Repo Header Config Check | `http://localhost:3000/`, repo root | `curl -sSI http://localhost:3000/` & `ls` for hosting configs | Security headers / deployment config present | Zero security headers (`CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`); no hosting config in repo | `FAIL` / Deployment-Dependent | `08_http_headers.txt:1-11` | `CC-FE-GAP-002`; real prod headers depend on deployment platform. |

---

## Category K — Routing & Client Navigation

| Test ID | Test Name | Files / Routes | Method | Expected Result | Actual Result | Status | Evidence | Limitations |
|---|---|---|---|---|---|---|---|---|
| `K-01` | Fallback Routing & Unknown Route Parameters | `src/App.tsx:71-86` | Navigate to `/unknown-path/%3Cscript%3Ealert(1)%3C/script%3E` | Safe fallback to `/`; no open redirect | Redirects to `/` safely (`Navigate to="/" replace`) | `PASS` | `App.tsx:85`, `09_dynamic_tests.txt` | High confidence. |
| `K-02` | Top-Level React `ErrorBoundary` Check | `src/App.tsx`, `src/main.tsx` | Static search for `ErrorBoundary` / `componentDidCatch` / `getDerivedStateFromError` | ErrorBoundary catches render exceptions cleanly | Zero `ErrorBoundary` wrappers found | `FAIL` | `06_static_sink_scan.txt:38-39`, `App.tsx` | `CC-FE-007`. |

---

## Category L — Errors, Logging, & Information Disclosure

| Test ID | Test Name | Files / Routes | Method | Expected Result | Actual Result | Status | Evidence | Limitations |
|---|---|---|---|---|---|---|---|---|
| `L-01` | Error Message Sanitization & Offline Diagnostics | `src/api/errors.ts`, `src/pages/SystemStatusPage.tsx:270-299` | Inspect `normalizeUnknownError` / `extractErrorMessage` & UI error panels | No stack traces, secrets, or false success claims | Clear offline notice; however `SystemStatusPage.tsx:294` exposes CLI command & `09_dynamic_tests.txt` logs 10 failed fetch console errors to `127.0.0.1:8000` on startup | `PASS` (Partial) | `SystemStatusPage.tsx:282-296`, `09_dynamic_tests.txt:2,132` | Startup probes to port `8000` noted in `CC-FE-007`. |

---

## Category M — Resource Exhaustion & Resilience

| Test ID | Test Name | Files / Routes | Method | Expected Result | Actual Result | Status | Evidence | Limitations |
|---|---|---|---|---|---|---|---|---|
| `M-01` | Large URL Input Resilience & File Cleanup | `NewProjectPage.tsx` | Submit 2,072-char URL + upload & remove blob video | UI remains responsive; blob URL revoked | UI remained responsive & `Remove` cleaned up `<video>`, but 2,072-char URL was marked valid | `PASS` (UI Stability) / `FAIL` (`CC-FE-003`) | `09_dynamic_tests.txt:2,32,61-66` | 8 GB max upload size not dynamically stress-tested in memory. |

---

## Category N — Accessibility & Security-Relevant UX

| Test ID | Test Name | Files / Routes | Method | Expected Result | Actual Result | Status | Evidence | Limitations |
|---|---|---|---|---|---|---|---|---|
| `N-01` | Destructive Action Confirmations & Modal Keyboard Closing | `SettingsPage.tsx:479-487,734-743`, `Modal.tsx:23-32` | Click `Reset Defaults`, press `Escape`; inspect `Clear Temporary Files` | Confirmations guard destructive actions; dialogs trap focus & support `Escape` | `Reset Defaults` opens `ConfirmDialog` & closes on `Escape`; `Clear Temporary Files` executes on single click with no confirmation; `Modal.tsx` lacks `Tab` focus trap | `PASS` (Partial) | `09_dynamic_tests.txt:2,107-113`, `SettingsPage.tsx:479-487`, `Modal.tsx` | `CC-FE-GAP-004`. |

---

## Category O — Desktop Wrapper Review (Tauri 2 Compatibility Layer)

| Test ID | Test Name | Files / Routes | Method | Expected Result | Actual Result | Status | Evidence | Limitations |
|---|---|---|---|---|---|---|---|---|
| `O-01` | Native Tauri Config, Capabilities, & Rust IPC Audit | Repo root, `src/utils/desktop.ts` | Search for `src-tauri/`, `tauri.conf.json`, capabilities JSON; inspect `src/utils/desktop.ts` | Inspect native wrapper config if present | No `src-tauri/` directory or native wrapper exists; only browser adapter `src/utils/desktop.ts` (`open_output_folder` invoke stub) exists | `NOT APPLICABLE` / `NOT TESTABLE` | `desktop.ts:1-50` | Native IPC security, OS path validation, & Tauri CSP cannot be verified without `src-tauri/`. |
