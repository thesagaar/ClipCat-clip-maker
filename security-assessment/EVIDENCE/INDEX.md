# Evidence Index — ClipCat Pre-Backend Frontend Security Assessment

- **Assessment Date:** 2026-11-15 (`2026-11-15T10:05:59Z` UTC)
- **Target Scope:** ClipCat frontend repository at `/app/applet` (no connected FastAPI backend; no native Tauri desktop runtime)
- **Engagement Boundary:** Read-only assessment; original application files under `src/`, `public/`, `index.html`, `package.json`, and `vite.config.ts` were not modified.

---

## 1. Automated Command & Static Scan Logs

| Evidence File | Description & Exact Command | Key Recorded Result |
|---|---|---|
| `security-assessment/EVIDENCE/01_env_baseline.txt` | Runtime versions, workspace metadata, git history check, lockfile & `.env` inventory (`node -v`, `npm -v`, `bun -v`, `git status`, `ls`) | Node `v22.23.2`, npm `10.9.8`, bun `1.4.4`; no `.git` history; no `.env` / `.env.local` / `package-lock.json`; `bun.lock` (`71,776` bytes) present. |
| `security-assessment/EVIDENCE/02_npm_audit.txt` | Dependency vulnerability audits (`npm audit --json` and `bun audit`) | `npm audit --json` exited `1` (`ENOLOCK` due to missing `package-lock.json`); `bun audit` (`v1.4.4`) exited `0` (`No vulnerabilities found (checked 268 packages) [215.00ms]`). |
| `security-assessment/EVIDENCE/03_npm_ls.txt` | Direct installed dependency inventory (`npm ls --depth=0`) | Exited `0`; lists all 23 direct/dev installed packages including `@google/genai@2.32.0`, `express@4.22.3`, `dotenv@17.4.2`, `@types/express@4.17.25`. |
| `security-assessment/EVIDENCE/04_typecheck_build.txt` | Type-check & production build (`npx tsc --noEmit`, `npm run build`, and `ls -la` of `dist/`) | Both exited `0`; 2,185 modules transformed in `928ms`; zero `.map` files; `dist/index-BnTMaKV7.js` (`716.02 kB`) triggers chunk warning; `dist/assets/aistudio/` includes prompt `.txt` and mobile screenshot `.jpg`. |
| `security-assessment/EVIDENCE/05_unit_tests.txt` | Existing unit test suite (`npx --yes tsx --test $(find src -name '*.test.ts*' | sort)`) | Exited `0`; `22/22` tests passed across 5 test files (`client.test.ts`, `filters.test.ts`, `format.test.ts`, `gestures.test.ts`, `validation.test.ts`). |
| `security-assessment/EVIDENCE/06_static_sink_scan.txt` | Static source scan for DOM sinks (`dangerouslySetInnerHTML`, `innerHTML`, `eval`, etc.), external anchors/schemes, storage keys, unused server packages, and React error boundaries | Zero dangerous DOM sink hits; all `target="_blank"` anchors use `rel="noopener noreferrer"`; zero imports of `@google/genai`/`express`/`dotenv`; zero `ErrorBoundary` implementations. |
| `security-assessment/EVIDENCE/07_secret_bundle_scan.txt` | Source & `dist/` scan for API keys, tokens, credentials, source maps, and hardcoded/bundled URLs | Zero hardcoded API keys/secrets; zero `.map` files; verified hardcoded `http://127.0.0.1:8000`, LAN example IPs (`192.168.1.25:8000`, `192.168.1.42:8000`), and `fonts.googleapis.com` / `fonts.gstatic.com` in built output. |
| `security-assessment/EVIDENCE/08_http_headers.txt` | Live HTTP response header capture (`curl -sSI http://localhost:3000/` and `/assets/aistudio/ClipCat_Pre_Backend_Frontend_Security_Assessment_Prompt_674f8152.txt`) | Dev server returns HTTP `200 OK` without CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`; internal prompt `.txt` (`27,840` bytes) served at HTTP `200 OK`. |
| `security-assessment/EVIDENCE/09_dynamic_tests.txt` | Playwright dynamic browser verification log across `/`, `/projects/new?mode=url`, `/projects?mock=1`, `/clips/clip-sample-01/edit?mock=1`, and `/settings` | Verified `fonts.googleapis.com` network request on load, URL SSRF/credential/length bypasses (`169.254.169.254`, `admin:secret@127.0.0.1`, `[::1]`, 2,072-char URL), `text/html` MIME bypass on `.mp4` upload, React XSS escaping, `localStorage` backend URL override, and `Escape` modal dismissal. |

---

## 2. Browser Screenshots (`security-assessment/EVIDENCE/`)

| Screenshot Path | Route / State Captured | Finding / Control Evidenced |
|---|---|---|
| `security-assessment/EVIDENCE/sec-01-dashboard-offline.png` | `http://localhost:3000/` (offline baseline without backend) | App loads cleanly without connected backend and displays explicit offline/backend-unavailable error banner instead of silent failure; unknown routes redirect to `/`. |
| `security-assessment/EVIDENCE/sec-02-mock-query-bypass.png` | `http://localhost:3000/?mock=1` | Query parameter `?mock=1` activates Mock Adapter in standard build (`Mock Adapter Active` banner + simulated projects). Supports `CC-FE-005`. |
| `security-assessment/EVIDENCE/sec-03-url-ssrf-accepted.png` | `http://localhost:3000/projects/new?mode=url` | Submitting `http://admin:secret@127.0.0.1:8000/video.mp4` yields green `"Direct MP4 media URL detected and ready for backend retrieval"` status with `Start Clipping` enabled. Supports `CC-FE-003`. |
| `security-assessment/EVIDENCE/sec-04-xss-escaped-projects.png` | `http://localhost:3000/projects?mock=1` | Injecting `<b>TestXSS</b><img src=x onerror="window.__xss=1">` via project rename renders literally as escaped text (`window.__xss === null`). Supports passing XSS output-encoding verification. |
