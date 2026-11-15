# Executive Summary — ClipCat Pre-Backend Frontend Security Assessment

- **Product & Owner:** ClipCat (by Single Dimension Projects)
- **Repository Root:** `/app/applet`
- **Assessment Date:** `2026-11-15` (Version `0.1.0` per `src/config/env.ts` / `react-example@0.0.0` per `package.json`; no `.git` commit history present)
- **Scope Boundary:** **Frontend repository only — NO Python FastAPI backend and NO compiled Tauri 2 desktop wrapper are connected or present.** Only browser source code, static assets, dependency manifests, local Vite runtime (`http://localhost:3000`), and production Vite bundle (`dist/`) were assessed.
- **Engagement Framework:** OWASP Top 10 (2021), OWASP ASVS (v4.0.3 frontend-applicable controls), OWASP WSTG (v4.2), OWASP Cheat Sheet Series, and CWE classifications. No formal compliance or certification is claimed.

---

## 1. Overall Security Posture & Readiness Statement

The ClipCat frontend demonstrates **solid baseline React/DOM hygiene** where implemented: all 22 existing unit tests pass, `tsc --noEmit` and `vite build` pass cleanly with zero `.map` files in `dist/`, no dangerous DOM injection sinks (`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`) exist in source code, `rel="noopener noreferrer"` is consistently applied to external `target="_blank"` anchors, and React output encoding prevented script execution during dynamic XSS testing on project names and clip descriptions.

However, **7 confirmed frontend security findings (5 Medium, 2 Low)** and **4 structural security design gaps** were identified during static and dynamic testing. Most critically for pre-backend integration:

1. **Public exposure of non-application files (`CC-FE-001`):** Internal assessment prompt `.txt` files, an unreferenced design PNG, and a personal mobile screenshot containing ChatGPT UI framing are committed in `public/assets/aistudio/`, served at HTTP `200 OK`, and copied verbatim into `dist/assets/aistudio/`.
2. **Bypassable media input validation (`CC-FE-002`, `CC-FE-003`):** The upload validator ignores a spoofed MIME type (e.g., `text/html`) whenever the filename ends in `.mp4`, and the URL validator accepts cloud metadata (`169.254.169.254`), loopback (`[::1]`, `127.0.0.1`), embedded credentials (`admin:secret@...`), and multi-kilobyte URLs as ready for backend retrieval.
3. **Privacy claim vs. live network behavior mismatch (`CC-FE-004`):** Despite footer and Settings claims of *"Local-first · Zero analytics or telemetry collected"*, every page load initiates live external connections to `fonts.googleapis.com` and `fonts.gstatic.com`.
4. **Runtime mode & API endpoint manipulation (`CC-FE-005`):** `?mock=1` activates Mock Mode unconditionally in production builds, and `SettingsPage` persists arbitrary plaintext HTTP backend origins in `localStorage` without host/scheme controls.

Because **no backend exists**, controls such as authentication, authorization, CORS enforcement, SSRF blocking, FFmpeg/Whisper media processing isolation, magic-byte file verification, database parameterization, and path-traversal jailing remain **unverified (`NOT TESTABLE`)** and **cannot be satisfied by frontend code**. This frontend is **not ready for external or untrusted deployment** and requires targeted pre-backend frontend cleanup plus mandatory backend security controls prior to FastAPI integration.

---

## 2. Confirmed Vulnerabilities Summary

| Finding ID | Severity | CWE | Title | Primary Location | Retest Status |
|---|---|---|---|---|---|
| **CC-FE-001** | **Medium** | CWE-200, CWE-538 | Unintended Exposure of Internal Documents & Personal Mobile Screenshot in Public Web Root and Production Build | `public/assets/aistudio/*` -> `dist/assets/aistudio/*` | Open (Read-Only Assessment) |
| **CC-FE-002** | **Medium** | CWE-434, CWE-20 | File Upload Validator Ignores Disallowed MIME Types When Filename Has Video Extension | `src/utils/validation.ts:13-43` | Open (Read-Only Assessment) |
| **CC-FE-003** | **Medium** | CWE-918, CWE-20 | Media URL Validator Accepts Loopback, Metadata (`169.254.169.254`), Embedded Credentials, & Unbounded URLs | `src/utils/validation.ts:58-157` | Open (Read-Only Assessment) |
| **CC-FE-004** | **Medium** | CWE-359 | External Third-Party Google Fonts Requests Expose Network Metadata & Contradict Strict Local-First Privacy Claims | `index.html:15-20`, `Footer.tsx:235-238`, `SettingsPage.tsx:726-731` | Open (Read-Only Assessment) |
| **CC-FE-005** | **Medium** | CWE-639, CWE-345, CWE-319 | Production-Exposed `?mock=1` Query Switch & Unconstrained `localStorage` Backend Endpoint Override | `src/api/client.ts:29-38`, `src/stores/uiStore.ts:43-46`, `src/config/env.ts:24-52` | Open (Read-Only Assessment) |
| **CC-FE-006** | **Low** | CWE-601, CWE-22 | Unvalidated Backend-Supplied Download/Archive URLs & Inconsistent Download Filename Sanitization | `src/utils/desktop.ts:52-80`, `src/api/clips.ts:36-58`, `src/pages/ClipEditorPage.tsx:232` | Open (Read-Only Assessment) |
| **CC-FE-007** | **Low** | CWE-755, CWE-20 | Absence of React `ErrorBoundary`, Unchecked Runtime API JSON Casts, & Unauthenticated Probes to Port `8000` | `src/App.tsx`, `src/api/client.ts:119-125`, `src/config/env.ts:10` | Open (Read-Only Assessment) |

---

## 3. Security Design Gaps (Non-Exhaustive Summary)

- **`CC-FE-GAP-001` (Supply Chain & Manifest Hygiene):** Unused packages `@google/genai`, `express`, `dotenv`, and `@types/express` remain in `package.json`; `metadata.json` declares `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` despite zero AI SDK usage; `package-lock.json` is absent despite `README.md` `npm install` instructions (`npm audit` fails with `ENOLOCK`, while `bun audit` passes with `0` CVEs across `268` packages).
- **`CC-FE-GAP-002` (Security Headers & Deployment Policy):** Zero deployment configuration (`vercel.json`, `nginx.conf`, security headers) exists in the repo; Vite dev server emits no `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`.
- **`CC-FE-GAP-003` (Authentication, Session & CSRF Absence):** No authentication token, session, role, or CSRF model exists yet; LAN `http://192.168.x.x:8000` communication pattern relies on unauthenticated plaintext HTTP unless redesigned before shared/network use.
- **`CC-FE-GAP-004` (Security UX & Storage Path Handling):** `Clear Temporary Files` executes on a single click without `ConfirmDialog` (`SettingsPage.tsx:479-487`); `Modal.tsx` traps `Escape` but does not trap `Tab` focus; `projectDirectory`, `exportDirectory`, and `tempDirectory` allow free-form local OS paths (`SettingsPage.tsx:491-520`) whose server-side jailing cannot be verified without the backend.

---

## 4. Highest-Priority Pre-Backend Actions

1. **Immediate (Before Any Build/Deploy):** Remove `ClipCat_Pre_Backend_Frontend_Security_Assessment_Prompt_674f8152.txt`, `Screenshot_2026-11-15-13-58-40-15_...jpg`, and unused upload artifacts from `public/assets/aistudio/` (`CC-FE-001`); migrate `/assets/aistudio/sdp-logo-mark_5f38d36d.svg` reference in `src/config/brand.ts` to `/brand/sdp-logo.svg`.
2. **Pre-Integration Frontend Hardening:** Fix `validateVideoFileInput` MIME logic (`CC-FE-002`), restrict `classifyAndValidateVideoUrl` against credentials/private IPs/metadata hosts/excessive length (`CC-FE-003`), self-host Inter/Nunito/JetBrains Mono fonts or align privacy copy (`CC-FE-004`), disable `?mock=1` in `import.meta.env.PROD` and harden runtime API base URL checks (`CC-FE-005`), validate backend download URLs to match configured API origin + sanitize filenames (`CC-FE-006`), and add top-level React `ErrorBoundary` (`CC-FE-007`).
3. **Mandatory Backend Controls Before Connecting FastAPI (`BACKEND_SECURITY_REQUIREMENTS.md`):** Strict CORS allowlist bound to `127.0.0.1` by default, auth/CSRF design for LAN/network mode, Pydantic schema validation, upload byte limits + magic-byte inspection + UUID storage naming, directory allowlists/jailing for `storage.*` settings, SSRF-safe URL downloader (DNS resolution check + private IP block + redirect re-check), sandboxed FFmpeg/Whisper subprocess invocation without shell interpolation, and safe non-stack-trace error responses.

---

## 5. Assessment Artifacts Map

- `security-assessment/EXECUTIVE_SUMMARY.md` — High-level posture, confirmed summary, priorities
- `security-assessment/DETAILED_FINDINGS.md` — Detailed technical write-ups (`CC-FE-001`–`CC-FE-007` + design gaps)
- `security-assessment/TEST_REGISTER.md` — Complete test log across Categories A–O
- `security-assessment/SECURITY_TEST_MATRIX.csv` — Machine-readable matrix matching Section 12.H columns
- `security-assessment/BACKEND_SECURITY_REQUIREMENTS.md` — Prioritized FastAPI/desktop security controls
- `security-assessment/DEPENDENCY_AND_SECRET_REVIEW.md` — Inventory, audit runs, secret/bundle scan results
- `security-assessment/SECURITY_REMEDIATION_PLAN.md` — Minimal patches, regression tests, owners
- `security-assessment/SECURITY_ASSESSMENT_LIMITATIONS.md` — Explicit untested/blocked surfaces and reasons
- `security-assessment/EVIDENCE/` & `security-assessment/EVIDENCE/INDEX.md` — Raw outputs and screenshots
