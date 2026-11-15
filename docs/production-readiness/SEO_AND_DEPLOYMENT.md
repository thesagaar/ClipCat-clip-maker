# SEO, Assets, HTTPS & Deployment Guide — ClipCat

**Product:** ClipCat — AI Video Clipping Studio  
**Parent Brand:** Single Dimension Projects (SDP)  
**Frontend Entry:** `index.html`, `vite.config.ts`, `src/components/seo/RouteMeta.tsx`, `scripts/generate-seo.mjs`

---

## 1. Route Indexing Policy (`src/components/seo/routesMetaConfig.ts`)

| Route Pattern | Robots Directive | Canonical Behavior | Purpose |
|---|---|---|---|
| `/` | `index, follow` | Generated only when `VITE_PUBLIC_SITE_URL` is set | Public Studio Landing / Dashboard overview |
| `/privacy` | `index, follow` | Generated only when `VITE_PUBLIC_SITE_URL` is set | Privacy Policy |
| `/terms` | `index, follow` | Generated only when `VITE_PUBLIC_SITE_URL` is set | Terms and Conditions |
| `/projects`, `/projects/new`, `/projects/:id/processing`, `/projects/:id/clips` | `noindex, nofollow` | Omitted | Private local workspace & project flows |
| `/clips`, `/clips/:id/edit`, `/exports`, `/presets`, `/templates` | `noindex, nofollow` | Omitted | Private media library & studio editors |
| `/settings`, `/system`, `/404`, `*` | `noindex, nofollow` | Omitted | Private diagnostics, settings, and 404 fallback |

This prevents accidental search indexing of private project IDs, local diagnostics, or unconfigured placeholder URLs.

---

## 2. Favicons, Web Manifest, & Branded Open Graph Image

Generated and saved under `public/brand/` preserving official mascot and SDP proportions:

| Asset Path | Dimensions / Format | Purpose |
|---|---|---|
| `/brand/og-preview.png` | `1200x630` PNG (567 KB) | Primary Open Graph / Twitter share card (`summary_large_image`) |
| `/brand/og-preview.webp` | `1200x630` WebP (47 KB) | Compressed WebP social preview variant |
| `/brand/favicon-32x32.png` | `32x32` PNG (2.4 KB) | Browser tab icon |
| `/brand/apple-touch-icon.png` | `180x180` PNG (40 KB) | iOS/Safari home screen icon |
| `/brand/icon-192.png` | `192x192` PNG (45 KB) | PWA Manifest standard icon |
| `/brand/icon-512.png` | `512x512` PNG (198 KB) | PWA Manifest maskable/large icon |
| `/site.webmanifest` | JSON manifest | Theme (`#0D0B14`), display (`standalone`), brand icons |

---

## 3. `robots.txt` and `sitemap.xml` Generation

- **`public/robots.txt`** explicitly allows `/`, `/privacy`, and `/terms`, while disallowing `/projects`, `/clips`, `/exports`, `/presets`, `/templates`, `/settings`, `/system`, `/api/`, and `/assets/aistudio/`.
- **`scripts/generate-seo.mjs`**: Reads `VITE_PUBLIC_SITE_URL` at build/release time:
  - When `VITE_PUBLIC_SITE_URL` is **unset** (current state), `scripts/generate-seo.mjs` skips writing `public/sitemap.xml` so no fabricated domain is ever published.
  - When `VITE_PUBLIC_SITE_URL=https://<your-real-domain>` is set, running `node scripts/generate-seo.mjs` generates `public/sitemap.xml` containing strictly the three public routes (`/`, `/privacy`, `/terms`) and appends the `Sitemap:` directive if configured in CI.

---

## 4. HTTPS, Mixed Content & Security Headers (`vercel.json` + `src/config/env.ts`)

### Hosting Security Headers (`vercel.json`)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `/assets/aistudio/(.*)` receives `X-Robots-Tag: noindex, nofollow`
- `/brand/(.*)` receives long-lived immutable caching (`public, max-age=31536000, immutable`)
- SPA rewrite maps application routes cleanly to `/index.html` while passing through `/brand/*`, `/site.webmanifest`, `/robots.txt`, and `/sitemap.xml`.

### Runtime Mixed-Content Guard (`validateApiBaseUrl` in `src/config/env.ts`)
- Local development HTTP (`http://127.0.0.1:8000` / `localhost`) continues to work cleanly on `http://` dev origins and Tauri desktop.
- When ClipCat is loaded over `https://`, `validateApiBaseUrl()` blocks non-loopback `http://` backend URLs to prevent mixed-content downgrades, while rejecting embedded URL credentials (`user:pass@`), query strings, and hashes.

---

## 5. Exact Deployment Configuration Still Required

Before deploying ClipCat publicly on Vercel, Cloudflare Pages, Netlify, or an equivalent static HTTPS host:

1. **Provision Real HTTPS Domain & Set Env Var:**
   ```bash
   VITE_PUBLIC_SITE_URL=https://<your-production-domain>
   ```
   Then run `node scripts/generate-seo.mjs` before `npm run build` so `public/sitemap.xml`, `<link rel="canonical">`, and absolute `og:url` / `og:image` tags resolve to your real domain.
2. **Keep Mock Mode Disabled in Production:**
   Ensure `VITE_USE_MOCK_API` is unset or `false`. (`?mock=1` query overrides are already blocked in production builds via `ENV.IS_DEV`.)
3. **Configure HTTPS FastAPI Backend + Strict CORS:**
   Set `VITE_API_BASE_URL=https://<your-backend-origin>` for hosted deployments, and configure FastAPI `CORSMiddleware` to allow **only** your deployed frontend origin (never `*` with credentials).
4. **Configure CSP Header at Hosting Edge:**
   Add a `Content-Security-Policy` header scoped to your real `VITE_API_BASE_URL` and `VITE_ANALYTICS_ENDPOINT` origins (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`).
5. **Remove Non-Runtime Uploaded Prompt Assets Before Public Bundle:**
   Remove `/public/assets/aistudio/` attachment `.txt` and reference screenshot files prior to building/shipping the public container or CDN artifact so they are not served statically under `/assets/aistudio/`.
6. **Verify `og:image` in Social Debuggers:**
   Once deployed to the real HTTPS origin, validate `/` in Open Graph / X Card validators to confirm absolute `https://<domain>/brand/og-preview.png` fetches cleanly over TLS.
