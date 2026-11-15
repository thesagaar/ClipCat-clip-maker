# Remaining Backend & Deployment Requirements — ClipCat

**Product:** ClipCat — AI Video Clipping Studio  
**Parent Brand:** Single Dimension Projects (SDP)  
**Companion Contract:** See also `docs/FRONTEND_BACKEND_CONTRACT.md` and `security-assessment/BACKEND_SECURITY_REQUIREMENTS.md`.

Because ClipCat's FastAPI backend and production web hosting domain are not yet connected, the following controls **cannot** be fulfilled by frontend code alone and **must** be implemented prior to public production launch:

---

## 1. Server-Side Input, Upload, & SSRF Validation (Critical)
- **Strict File Upload Verification:** Re-validate uploaded video files server-side via magic-byte / `ffprobe` container inspection (never trust client extension or MIME headers). Enforce maximum file size, maximum duration, and disk-quota caps cleanly with HTTP `413` / `422` errors.
- **SSRF & URL Import Hardening:** For `POST /api/projects` / `/api/projects/validate-url` URL imports:
  - Allow only `http://` and `https://` schemes (HTTPS preferred).
  - Resolve DNS and reject loopback (`127.0.0.0/8`, `::1`), RFC1918 private ranges (`10/8`, `172.16/12`, `192.168/16`), link-local / cloud metadata (`169.254/16`, `fe80::/10`), and carrier-grade NAT (`100.64/10`) **including redirect hops**.
  - Enforce request timeouts and maximum downloaded content length.
- **Path Traversal & Symlink Defense:** Reject arbitrary client-supplied `projectDirectory`, `exportDirectory`, and `tempDirectory` writes outside sandboxed/whitelisted workspace roots; canonicalize and verify `Path.resolve()` stays under permitted base directories.

## 2. Rate Limiting, Abuse Prevention, & Concurrency Controls (Point 18)
- Enforce IP/session/user rate limiting (e.g., `slowapi` or reverse-proxy limits) on resource-heavy routes: `POST /api/projects`, `POST /api/projects/{id}/process`, `POST /api/projects/{id}/export`, and any future contact/support submission endpoint.
- Cap concurrent FFmpeg/Whisper worker queues server-side to prevent CPU/disk exhaustion denial-of-service.
- Add anti-abuse verification (CAPTCHA/Turnstile or authenticated quota tokens) **only** if ClipCat later exposes public multi-tenant endpoints or public web forms.

## 3. CORS, Transport Security (HTTPS), & CSP (Points 3 & 4)
- Configure FastAPI `CORSMiddleware` with explicit origin allowlist matching only the real production frontend URL (`VITE_PUBLIC_SITE_URL`) and local dev origins (`http://localhost:3000`, `http://127.0.0.1:3000`); never use `allow_origins=["*"]` with credentials.
- Serve production FastAPI API over HTTPS with TLS 1.2+ behind a reverse proxy (Caddy/Nginx/Cloudflare/Vercel).
- Configure hosting `Content-Security-Policy` headers explicitly listing allowed API & telemetry origins.
- Remove `/public/assets/aistudio/` prompt/reference attachment files from public static build output prior to deploying live hosting.

## 4. Production Domain, Canonical URLs, & Sitemap Generation (Points 6 & 9)
- Provision the final HTTPS domain and configure CI/hosting environment variables:
  ```bash
  VITE_PUBLIC_SITE_URL=https://<real-domain>
  VITE_API_BASE_URL=https://<real-api-domain>
  ```
- Execute `node scripts/generate-seo.mjs && npm run build` during deployment so `public/sitemap.xml`, `<link rel="canonical">`, and absolute `og:url` / `og:image` tags resolve cleanly.

## 5. Live Analytics & Error Diagnostics Ingestion (Point 19)
- Provision or deploy a privacy-conscious ingestion backend (e.g., first-party FastAPI/Worker receiver or self-hosted PostHog/Plausible/Umami) that accepts `SanitizedAnalyticsEnvelope` (`POST`) with CORS allowing the production frontend origin.
- Set retention auto-purge policies server-side (recommended: 90 days for diagnostic traces; aggregated usage metrics only).
- Set `VITE_ANALYTICS_ENABLED=true`, `VITE_ANALYTICS_PROVIDER`, `VITE_ANALYTICS_ENDPOINT`, and `VITE_ERROR_REPORTING_ENABLED=true` in production build settings.

## 6. Legal Counsel Sign-Off (Points 1 & 2)
- Review and finalize `PRIVACY_POLICY.md` (`PrivacyPolicyPage.tsx`) and `TERMS_AND_CONDITIONS.md` (`TermsPage.tsx`) with qualified legal counsel to insert official legal entity details, registered notice address, governing law jurisdiction, and regional compliance disclosures before commercial release.
