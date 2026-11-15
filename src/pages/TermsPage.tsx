import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, Scale } from 'lucide-react';
import { BRAND } from '../config/brand';

export function TermsPage() {
  return (
    <article className="max-w-4xl mx-auto space-y-6">
      <header className="rounded-2xl bg-ios-surface border border-ios-sep p-5 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#C8B9F1]">
            <Scale className="w-4 h-4 text-[#7040DC]" aria-hidden="true" />
            <span>{BRAND.productIdentity}</span>
          </div>
          <span className="text-xs font-mono text-ios-secondary">
            Version 1.0 (Draft) · November 15, 2026
          </span>
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-ios-label">
          Terms and Conditions
        </h2>

        <div
          role="note"
          className="rounded-xl bg-[var(--ios-orange-tint)] border border-[var(--ios-orange-border)] p-4 flex items-start gap-3 text-xs sm:text-sm"
        >
          <AlertTriangle className="w-5 h-5 text-ios-orange shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-ios-label">
              Draft Legal Text — Pending Formal Counsel Review
            </p>
            <p className="text-ios-secondary leading-relaxed">
              These Terms and Conditions are provided as an operational pre-release baseline for {BRAND.productName}. Formal legal review by qualified counsel is required before commercial distribution or hosted production launch.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-5">
        <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-2.5">
          <h3 className="font-display text-lg font-bold text-ios-label">
            1. Scope &amp; Product Nature
          </h3>
          <p className="text-sm text-ios-secondary leading-relaxed">
            {BRAND.productName} is an AI-assisted local-first video clipping workspace developed under{' '}
            {BRAND.parentBrandName} ({BRAND.parentBrandAbbreviation}). The software helps creators inspect, transcribe, highlight-score, reframe, caption, and export short-form clips from long-form source media using your configured local or authorized backend environment.
          </p>
        </section>

        <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-2.5">
          <h3 className="font-display text-lg font-bold text-ios-label">
            2. User Content Ownership, Copyright &amp; Source URLs
          </h3>
          <p className="text-sm text-ios-secondary leading-relaxed">
            You retain all ownership rights to videos, audio, transcripts, and exported clips you process using {BRAND.productName}. By selecting a local video file or submitting a media URL, you represent and warrant that you own the necessary rights, licenses, or explicit permissions to process, modify, transcribe, and redistribute that content.
          </p>
          <p className="text-sm text-ios-secondary leading-relaxed">
            {BRAND.productName} will not intentionally circumvent DRM, paywalls, authentication gates, or anti-bot protections on third-party video hosting platforms. You are solely responsible for complying with the terms of service and copyright laws governing any external media source.
          </p>
        </section>

        <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-2.5">
          <h3 className="font-display text-lg font-bold text-ios-label">
            3. Acceptable Use &amp; Prohibited Conduct
          </h3>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-ios-secondary">
            <li>Do not use {BRAND.productName} to infringe intellectual property rights or process unlawful, non-consensual, or malicious content.</li>
            <li>Do not attempt to probe, overload, inject SSRF/internal network URLs into, or disrupt connected backend or telemetry endpoints.</li>
            <li>Do not misrepresent AI-generated clip scores, automated transcriptions, or captions as verified human review without inspecting final outputs.</li>
          </ul>
        </section>

        <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-2.5">
          <h3 className="font-display text-lg font-bold text-ios-label">
            4. Local Processing Limitations &amp; Export Responsibility
          </h3>
          <p className="text-sm text-ios-secondary leading-relaxed">
            Because transcription (e.g., Whisper), FFmpeg video decoding, and rendering execute on local or user-configured compute resources, performance, hardware memory limits, codec compatibility, and availability depend on your host system and FastAPI backend installation. You remain responsible for reviewing exported MP4 videos, trimmed timestamps, and burned-in captions before publishing.
          </p>
        </section>

        <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-2.5">
          <h3 className="font-display text-lg font-bold text-ios-label">
            5. Third-Party Dependencies, Disclaimers &amp; Liability
          </h3>
          <p className="text-sm text-ios-secondary leading-relaxed">
            {BRAND.productName} integrates with open-source media and runtime ecosystems (such as FFmpeg, FFprobe, Whisper models, and web browser APIs) governed by their respective licenses. To the maximum extent permitted by applicable law, the pre-release software is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of uninterrupted availability or error-free output, and {BRAND.parentBrandName} is not liable for indirect losses, lost media, or data loss resulting from unbacked local storage cleanup.
          </p>
        </section>

        <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-2.5">
          <h3 className="font-display text-lg font-bold text-ios-label">
            6. Updates &amp; Contact Information
          </h3>
          <p className="text-sm text-ios-secondary leading-relaxed">
            We may revise these terms as backend capabilities, desktop packaging, and legal reviews progress. Continued use after updates constitutes acceptance of the revised terms. See also our{' '}
            <Link to={BRAND.privacyRoute} className="text-ios-blue underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs sm:text-sm">
            <a
              href={BRAND.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-ios-blue hover:underline font-medium"
            >
              <span>{BRAND.parentBrandName}</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
            <a
              href={BRAND.supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-ios-blue hover:underline font-medium"
            >
              <span>Contact &amp; Support</span>
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
          </div>
        </section>
      </div>
    </article>
  );
}
