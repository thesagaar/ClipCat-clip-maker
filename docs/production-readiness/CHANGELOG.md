# Changelog — ClipCat Production Readiness & UX Updates

**Release Scope:** Frontend `0.1.0` Production Readiness Pass (19-Point Implementation + Constant App Name + Default Top Scroll)

---

## Added
- **Legal & Privacy Routes:**
  - `/privacy` (`src/pages/PrivacyPolicyPage.tsx`) — Accurate local-processing, browser storage, analytics, diagnostics, excluded data, and consent policy.
  - `/terms` (`src/pages/TermsPage.tsx`) — Draft Terms and Conditions covering IP/copyright ownership, local limits, acceptable use, and disclaimers.
  - `/404` and catch-all `*` (`src/pages/NotFoundPage.tsx`) — Branded Custom 404 page with zero sensitive debug/path exposure.
- **Consent & Analytics Architecture (`src/analytics/*` & `src/components/legal/ConsentBanner.tsx`):**
  - Provider-independent allowlisted analytics schema (`events.ts`), strict payload sanitizer & path/token/URL redactor (`sanitize.ts`), unit tests (`sanitize.test.ts`), cookieless consent store (`consentStore.ts`), fail-safe cooldown-deduplicated transport (`client.ts`), and global error/API diagnostics adapter (`errorAdapter.ts`).
  - Accessible `ConsentBanner` with `Customize` modal, `Reject Optional`, and `Accept Optional` controls.
- **SEO, Favicons, Social Preview, & Hosting Config:**
  - `src/components/seo/routesMetaConfig.ts`, `src/components/seo/RouteMeta.tsx`, and automated route/link tests (`src/components/seo/routes.test.ts`).
  - `public/brand/og-preview.png` (1200x630) & `og-preview.webp`, `favicon-32x32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `public/site.webmanifest`, `public/robots.txt`, `scripts/generate-seo.mjs`, `vercel.json`, and updated `.env.example`.
- **Performance & Resilience Components:**
  - `src/components/ui/OptimizedImage.tsx` (WebP `<picture>` with PNG fallback and explicit width/height dimensions).
  - `src/components/ui/ErrorBoundary.tsx` wrapping app routes with sanitized recovery UI.
  - `src/hooks/useDebouncedValue.ts` for debounced search inputs.

## Changed
- **Settings (`src/pages/SettingsPage.tsx`):**
  - Locked **Application Name** as constant read-only `"ClipCat"` (`readOnly`, Lock icon, non-editable across saves/resets).
  - Added `ConfirmDialog` confirmation prior to **Clear Temporary Files**.
  - Added backend server URL validation (`validateApiBaseUrl`), updated privacy copy, and added **Privacy & Analytics Preferences** + `/privacy` & `/terms` links.
- **Navigation & Scroll Behavior (`src/components/seo/RouteMeta.tsx`, `src/layouts/AppShell.tsx`):**
  - Default viewport scroll reset to `(0, 0)` on route/tab open unless targeting a `#hash` section.
  - Added keyboard `Skip to main content` link and `<main id="main-content" tabIndex={-1}>` landmark.
- **Footer & Branding (`src/components/layout/footerConfig.ts`, `Footer.tsx`, `src/config/env.ts`, `src/config/brand.ts`):**
  - Removed inaccurate `"Zero analytics or telemetry collected"` claim; added `Privacy Policy`, `Terms & Conditions`, and interactive `Privacy Preferences` trigger.
  - Normalized support email config to block malformed `https://` `mailto:` links and blocked non-loopback `http://` API URLs on `https://` deployments.
- **Accessibility & Security Hardening:**
  - `src/components/ui/Modal.tsx`: Added `Tab`/`Shift+Tab` focus trap, `Escape` closing, and focus restoration.
  - `src/utils/validation.ts`, `src/utils/desktop.ts`, `src/api/client.ts`, `src/stores/uiStore.ts`: Added file MIME/extension consistency check, SSRF private/loopback/metadata IP URL rejection, `sanitizeDownloadFilename`, duplicate-submit guards, and dev-only restriction for `?mock=1`.
  - `vite.config.ts`, `src/App.tsx`: Enabled route `React.lazy` splitting, `rolldownOptions.output.manualChunks`, and disabled production sourcemaps.

## Fixed
- Fixed truncated mobile SDP attribution in previous rounds (preserved cleanly across all verified viewports).
- Fixed Vite build `> 500 kB` bundle warning via manual chunk separation (`vendor-react` reduced to 400.82 kB raw / 121.81 kB gzip).
- Fixed desktop settings page allowing accidental editing of the product name `"ClipCat"` and preserved top-of-page loading on navigation transitions.
