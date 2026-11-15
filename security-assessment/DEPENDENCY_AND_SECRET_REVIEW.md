# Dependency and Secret Review — ClipCat Pre-Backend Frontend

- **Assessment Date:** `2026-11-15`
- **Repository Root:** `/app/applet`
- **Package Manifest:** `package.json` (`react-example@0.0.0`, `"type": "module"`)
- **Lockfile Found:** `bun.lock` (`71,776` bytes). **Missing:** `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`.
- **Note:** No automated package upgrades, `--force` installs, or third-party external uploads were performed.

---

## 1. Direct Dependency Inventory (`npm ls --depth=0`)

Recorded from `security-assessment/EVIDENCE/03_npm_ls.txt` (exited `0`):

### Runtime Dependencies (`package.json:13-28`)
| Package | Manifest Range | Installed Version | Imported in `src/`? | Assessment Note |
|---|---|---|---|---|
| `react` | `^19.0.1` | `19.3.1` | Yes | Core UI runtime |
| `react-dom` | `^19.0.1` | `19.3.1` | Yes | Browser DOM renderer |
| `react-router-dom` | `^7.18.5` | `7.18.5` | Yes | Client routing (`BrowserRouter`) |
| `@tanstack/react-query` | `^5.107.1` | `5.107.1` | Yes | Query cache & retries |
| `zustand` | `^5.1.0` | `5.1.0` | Yes | UI & draft state (`localStorage` persist) |
| `@use-gesture/react` | `^10.3.1` | `10.3.1` | Yes | Mobile swipe & pull-to-refresh |
| `motion` | `^12.23.24` | `12.43.0` | Yes | UI animations |
| `lucide-react` | `^0.546.0` | `0.546.0` | Yes | SVG icons |
| `@google/genai` | `^2.4.0` | `2.32.0` | **No (`0` imports)** | Unused AI SDK (`CC-FE-GAP-001`) |
| `express` | `^4.21.2` | `4.22.3` | **No (`0` imports)** | Unused HTTP server (`CC-FE-GAP-001`) |
| `dotenv` | `^17.2.3` | `17.4.2` | **No (`0` imports)** | Unused server env loader (`CC-FE-GAP-001`) |
| `vite` | `^8.3.0` | `8.3.8` | Build tool | Misplaced in `dependencies` instead of `devDependencies` |
| `@vitejs/plugin-react` | `^6.1.1` | `6.3.0` | Build plugin | Misplaced in `dependencies` |
| `@tailwindcss/vite` | `^4.3.3` | `4.3.5` | Build plugin | Misplaced in `dependencies` |

### Dev Dependencies (`package.json:29-39`)
| Package | Manifest Range | Installed Version | Assessment Note |
|---|---|---|---|
| `@types/node` | `^22.14.0` | `22.20.5` | Node types (for test runner/Vite config) |
| `@types/react` | `^19.3.0` | `19.3.0` | React types |
| `@types/react-dom` | `^19.3.0` | `19.3.0` | ReactDOM types |
| `@types/express` | `^4.17.21` | `4.17.25` | **Unused** (pairs with unused `express`) |
| `autoprefixer` | `^10.4.21` | `10.6.2` | CSS tooling |
| `esbuild` | `^0.25.0` | `0.25.12` | Bundler binary |
| `tailwindcss` | `^4.3.3` | `4.3.5` | Styling |
| `tsx` | `^4.21.0` | `4.23.15` | Unit test TypeScript execution |
| `typescript` | `^7.0.2` | `7.0.2` | Type checking (`tsc --noEmit`) |

---

## 2. Vulnerability Audit Results (Exact Recorded Runs)

1. **`npm audit --json`** (`security-assessment/EVIDENCE/02_npm_audit.txt:1-14`):
   - **Exit Code:** `1`
   - **Result:** `npm error code ENOLOCK — This command requires an existing lockfile.`
   - **Finding:** `README.md` instructs `npm install`, yet the workspace only ships `bun.lock` (`71,776` bytes), breaking standard `npm audit` / `npm ci` reproducibility (`CC-FE-GAP-001`).
2. **`bun audit`** (`security-assessment/EVIDENCE/02_npm_audit.txt:16-20`):
   - **Tool Version:** `bun v1.4.4`
   - **Exit Code:** `0`
   - **Output:** `No vulnerabilities found (checked 268 packages) [215.00ms]`
   - **Limitation:** Clean advisory scan proves only no matching known advisory in Bun's feed on `2026-11-15`; it does not detect unused dependencies, unpinned `^` ranges, or zero-day bugs.

---

## 3. Secret, Environment Variable, & Production Bundle Scan

Recorded from `security-assessment/EVIDENCE/07_secret_bundle_scan.txt`:

- **Environment Files Present:** `.env.example` only; `.env` and `.env.local` do not exist.
- **Browser-Exposed (`VITE_*`) Variables (`src/config/env.ts:9-22`):**
  - `VITE_API_BASE_URL` (fallback `http://127.0.0.1:8000`)
  - `VITE_USE_MOCK_API` (string `'true'` comparison)
  - `VITE_APP_VERSION` (fallback `'0.1.0'`)
  - `VITE_SDP_WEBSITE_URL` (fallback `https://single-dimension-projects.vercel.app`)
  - `VITE_SDP_SUPPORT_URL` (fallback `https://single-dimension-projects.vercel.app/contact`)
  - `VITE_SDP_SUPPORT_EMAIL` (fallback `null`)
  - **Verification:** None contain sensitive secrets; all are intended public or local runtime endpoints.
- **Secrets Search in `src/` & `dist/`:**
  - Zero occurrences of API keys (Google/AI Studio `AIza...`, OpenAI `sk-...`, AWS `AKIA...`), private keys (`BEGIN ... PRIVATE KEY`), JWTs, or hardcoded passwords.
  - Zero `.map` source-map files generated inside `dist/` (`07_secret_bundle_scan.txt:25-26`).
  - **Notable Bundled Strings (`dist/`):** `http://127.0.0.1:8000`, `http://192.168.1.25:8000`, `http://192.168.1.42:8000` (helper text), `https://fonts.googleapis.com` / `fonts.gstatic.com`, and `?mock=1` logic (`dist/assets/index-BnTMaKV7.js` / `uiStore-DT1ciJI8.js`).
- **Git History Limitation:** `.git` directory does not exist (`01_env_baseline.txt:7-8`); historical commits could not be scanned for previously leaked secrets.
- **Static Public Asset Exposure (`CC-FE-001`):** `dist/assets/aistudio/` contains copies of `public/assets/aistudio/*`, including `ClipCat_Pre_Backend_Frontend_Security_Assessment_Prompt_674f8152.txt` and `Screenshot_2026-11-15-13-58-40-15_96b26121e545231a3c569311a54cda96_2a5e2f04.jpg`.

---

## 4. Supply-Chain & Manifest Cleanup Recommendations

1. **Remove unused packages** (`@google/genai`, `express`, `dotenv`, `@types/express`) and move `vite`, `@vitejs/plugin-react`, and `@tailwindcss/vite` to `devDependencies`.
2. **Align `metadata.json:5`:** Remove `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` if ClipCat frontend performs no server-side Gemini API calls.
3. **Standardize lockfile:** Generate and commit `package-lock.json` (or update documentation/CI to `bun install --frozen-lockfile`) so `npm ci` and `npm audit` run deterministically.
4. **Eliminate external font CDN reliance (`CC-FE-004`):** Self-host WOFF2 fonts locally rather than fetching remote CSS/font payloads from `fonts.googleapis.com` at runtime.
