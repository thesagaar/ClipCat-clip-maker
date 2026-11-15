import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Lock, Shield, SlidersHorizontal } from 'lucide-react';
import { useConsentStore } from '../analytics/consentStore';
import { ANALYTICS_EVENT_NAMES, EXCLUDED_DATA_CATEGORIES } from '../analytics/events';
import { Button } from '../components/ui/Button';
import { BRAND } from '../config/brand';

export function PrivacyPolicyPage() {
  const { analytics, diagnostics, hasResponded, updatedAt, openPreferences } = useConsentStore();

  return (
    <article className="max-w-4xl mx-auto space-y-6">
      <header className="rounded-2xl bg-ios-surface border border-ios-sep p-5 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#C8B9F1]">
            <Shield className="w-4 h-4 text-[#7040DC]" aria-hidden="true" />
            <span>{BRAND.productIdentity}</span>
          </div>
          <span className="text-xs font-mono text-ios-secondary">
            Effective Date: November 15, 2026
          </span>
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-ios-label">
          Privacy Policy
        </h2>
        <p className="text-sm sm:text-base text-ios-secondary leading-relaxed">
          {BRAND.productName} is designed as a local-first AI video clipping studio developed by{' '}
          {BRAND.parentBrandName} ({BRAND.parentBrandAbbreviation}). This policy accurately explains what media stays strictly on your device, how browser storage is used, and how optional privacy-conscious product analytics and error diagnostics operate.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            variant="accent-purple"
            size="sm"
            icon={<SlidersHorizontal className="w-4 h-4" />}
            onClick={openPreferences}
          >
            Manage Privacy Preferences
          </Button>
          <span className="text-xs text-ios-secondary">
            Current choice:{' '}
            <strong className="text-ios-label">
              {!hasResponded
                ? 'Not selected yet (Optional tracking OFF)'
                : `Analytics ${analytics ? 'On' : 'Off'} · Diagnostics ${diagnostics ? 'On' : 'Off'}`}
            </strong>
            {updatedAt ? ` · Saved` : ''}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5">
        <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-3">
          <h3 className="font-display text-lg font-bold text-ios-label">
            1. Local Video, Audio, Transcript &amp; Export Processing
          </h3>
          <p className="text-sm text-ios-secondary leading-relaxed">
            When you upload an MP4, MOV, MKV, or WEBM file, preview a clip, adjust captions, or render an export, media files are handled between this interface and your configured FastAPI backend URL (defaulting to local loopback <code className="font-mono text-ios-label">http://127.0.0.1:8000</code>). This frontend does not upload your video files, audio tracks, speech transcripts, subtitles, or exported videos to third-party cloud storage or analytics servers.
          </p>
        </section>

        <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-3">
          <h3 className="font-display text-lg font-bold text-ios-label">
            2. Browser Local Storage &amp; Cookieless Architecture
          </h3>
          <p className="text-sm text-ios-secondary leading-relaxed">
            {BRAND.productName} does <strong>not</strong> create advertising cookies or cross-site tracking cookies. Essential client preferences are saved in your browser&apos;s <code className="font-mono text-ios-label">localStorage</code> solely so the interface remembers your configuration:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-ios-secondary">
            <li>
              <code className="font-mono text-ios-label">clipcat-ui-preferences</code> — Theme (<code className="font-mono">dark</code> / <code className="font-mono">light</code>), sidebar collapse state, and project grid/list layout.
            </li>
            <li>
              <code className="font-mono text-ios-label">clipcat-consent-preferences</code> — Your opt-in/opt-out choices for optional analytics and diagnostics.
            </li>
            <li>
              <code className="font-mono text-ios-label">clipcat-api-base-url</code> — Optional local/LAN backend server address override entered in Settings.
            </li>
          </ul>
        </section>

        <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold text-ios-label">
              3. Product Usage Analytics &amp; Sanitized Error Diagnostics
            </h3>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C8B9F1]">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Strict Field Allowlist</span>
            </span>
          </div>
          <p className="text-sm text-ios-secondary leading-relaxed">
            {BRAND.productName} includes a privacy-conscious, provider-independent analytics and error reporting architecture to help improve stability, feature usability, and failure diagnosis. Optional telemetry is <strong>never</strong> transmitted unless both (a) an analytics endpoint is configured for the deployment and (b) you have explicitly granted consent.
          </p>
          <p className="text-xs font-mono text-ios-secondary bg-ios-bg border border-ios-sep rounded-lg p-3">
            Current Deployment State: Analytics={BRAND.analyticsEnabled ? `Enabled (${BRAND.analyticsProvider})` : 'Disabled'} · Error Monitoring={BRAND.errorMonitoringEnabled ? 'Enabled' : 'Disabled'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="rounded-lg bg-ios-bg border border-ios-sep p-4 space-y-2">
              <h4 className="font-display text-sm font-bold text-ios-label">
                Allowlisted Events (When Consented &amp; Configured)
              </h4>
              <p className="text-xs text-ios-secondary leading-relaxed">
                Only high-level operational events and scrubbed technical metadata (app version, viewport size category, route template without query params or project IDs, and processing stage status) may be recorded:
              </p>
              <p className="text-[11px] font-mono text-ios-secondary leading-relaxed break-words">
                {ANALYTICS_EVENT_NAMES.join(', ')}
              </p>
            </div>

            <div className="rounded-lg bg-ios-bg border border-ios-sep p-4 space-y-2">
              <h4 className="font-display text-sm font-bold text-ios-label">
                Strictly Excluded Data (Never Collected)
              </h4>
              <ul className="space-y-1.5 text-xs text-ios-secondary">
                {EXCLUDED_DATA_CATEGORIES.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-ios-green shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-3">
          <h3 className="font-display text-lg font-bold text-ios-label">
            4. Third-Party Services &amp; Planned Future Backend Notice
          </h3>
          <p className="text-sm text-ios-secondary leading-relaxed">
            This web interface loads display and UI typography stylesheets (<code className="font-mono text-ios-label">Nunito</code>, <code className="font-mono text-ios-label">Inter</code>, and <code className="font-mono text-ios-label">JetBrains Mono</code>) from Google Fonts CDN (<code className="font-mono text-ios-label">fonts.googleapis.com</code>), which exposes your browser&apos;s standard HTTP connection headers to that CDN when fonts load. No social ad pixels, session replay scripts, or third-party advertising networks are embedded.
          </p>
          <div className="rounded-lg bg-ios-bg border border-ios-sep p-4 text-xs sm:text-sm text-ios-secondary space-y-1">
            <p className="font-semibold text-ios-label">Planned / Pending Backend Integration</p>
            <p>
              A separate local Python FastAPI backend (handling FFmpeg, Whisper transcription, SQLite project persistence, and optional remote deployment telemetry ingestion) is not yet connected to this static frontend. Before deploying any hosted backend or public telemetry endpoint, server-side retention windows, IP log anonymization, and data processing notices will be updated accordingly.
            </p>
          </div>
        </section>

        <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-3">
          <h3 className="font-display text-lg font-bold text-ios-label">
            5. Your Controls, Retention &amp; Contact
          </h3>
          <p className="text-sm text-ios-secondary leading-relaxed">
            You may opt in, opt out, or customize optional analytics and error diagnostics at any time using the button above or inside{' '}
            <Link to="/settings#privacy" className="text-ios-blue underline underline-offset-2">
              Application Settings
            </Link>
            . You can clear browser local storage entries at any time via your browser site-data settings.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs sm:text-sm">
            <a
              href={BRAND.supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-ios-blue hover:underline font-medium"
            >
              <span>{BRAND.parentBrandName} Support</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
            {BRAND.supportEmail && (
              <a
                href={`mailto:${BRAND.supportEmail}`}
                className="text-ios-blue hover:underline font-medium"
              >
                {BRAND.supportEmail}
              </a>
            )}
            <Link to={BRAND.termsRoute} className="text-ios-blue hover:underline font-medium">
              View Terms &amp; Conditions
            </Link>
          </div>
        </section>
      </div>
    </article>
  );
}
