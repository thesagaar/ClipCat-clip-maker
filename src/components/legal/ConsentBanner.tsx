import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, SlidersHorizontal } from 'lucide-react';
import {
  CURRENT_CONSENT_VERSION,
  useConsentStore,
} from '../../analytics/consentStore';
import { BRAND } from '../../config/brand';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Toggle } from '../ui/Toggle';

export function ConsentBanner() {
  const {
    hasResponded,
    analytics,
    diagnostics,
    preferencesOpen,
    updatedAt,
    acceptAll,
    rejectOptional,
    savePreferences,
    openPreferences,
    closePreferences,
  } = useConsentStore();

  const [draftAnalytics, setDraftAnalytics] = useState(analytics);
  const [draftDiagnostics, setDraftDiagnostics] = useState(diagnostics);

  useEffect(() => {
    if (preferencesOpen) {
      setDraftAnalytics(analytics);
      setDraftDiagnostics(diagnostics);
    }
  }, [preferencesOpen, analytics, diagnostics]);

  return (
    <>
      {!hasResponded && (
        <aside
          aria-label="Privacy and analytics preferences"
          className="fixed inset-x-3 sm:inset-x-auto sm:right-6 bottom-[calc(4.85rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 z-40 sm:max-w-lg rounded-2xl bg-ios-elevated/98 backdrop-blur-md border border-ios-sep shadow-2xl p-4 sm:p-5 space-y-3.5"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#7040DC]/15 border border-[#7040DC]/40 text-[#C8B9F1] flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="font-display text-sm font-bold text-ios-label">
                Privacy &amp; Usage Preferences
              </h2>
              <p className="text-xs text-ios-secondary leading-relaxed">
                {BRAND.productName} uses essential browser storage for your theme and local API settings (no ad cookies). Optional privacy-conscious product analytics and sanitized crash diagnostics stay off unless enabled below.{' '}
                <Link
                  to={BRAND.privacyRoute}
                  className="text-ios-blue font-medium underline underline-offset-2"
                >
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
              onClick={openPreferences}
            >
              Customize
            </Button>
            <Button variant="secondary" size="sm" onClick={rejectOptional}>
              Reject Optional
            </Button>
            <Button variant="accent-purple" size="sm" onClick={acceptAll}>
              Accept Optional
            </Button>
          </div>
        </aside>
      )}

      <Modal
        open={preferencesOpen}
        onClose={closePreferences}
        title="Privacy & Analytics Preferences"
        description="Control essential browser storage awareness and optional privacy-conscious telemetry."
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                rejectOptional();
              }}
            >
              Reject All Optional
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={closePreferences}>
                Cancel
              </Button>
              <Button
                variant="accent-purple"
                size="sm"
                onClick={() =>
                  savePreferences({
                    analytics: draftAnalytics,
                    diagnostics: draftDiagnostics,
                  })
                }
              >
                Save Preferences
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs sm:text-sm">
          <div className="rounded-xl bg-ios-bg border border-ios-sep p-3.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display font-bold text-ios-label">
                Essential Local Storage (Always Active)
              </span>
              <span className="text-[11px] font-mono text-ios-green font-medium">
                Required
              </span>
            </div>
            <p className="text-xs text-ios-secondary leading-relaxed">
              Stores interface theme, sidebar layout, local FastAPI URL override, and this consent record inside browser local storage. No tracking or advertising cookies are placed.
            </p>
          </div>

          <div className="rounded-xl bg-ios-bg border border-ios-sep p-3.5">
            <Toggle
              checked={draftAnalytics}
              onChange={setDraftAnalytics}
              label="Product Usage Analytics (Optional)"
              description="Allow sanitized feature usage counts (navigation group, upload extension category, export completion) when an analytics endpoint is configured. Excludes videos, transcripts, titles, and paths."
            />
          </div>

          <div className="rounded-xl bg-ios-bg border border-ios-sep p-3.5">
            <Toggle
              checked={draftDiagnostics}
              onChange={setDraftDiagnostics}
              label="Sanitized Error & Crash Diagnostics (Optional)"
              description="Allow scrubbed error categories and redacted exception summaries to diagnose bugs when monitoring is configured. Sensitive paths, URLs, and tokens are stripped client-side."
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ios-secondary pt-1">
            <span>
              Provider status:{' '}
              <strong className="text-ios-label">
                {BRAND.analyticsEnabled ? BRAND.analyticsProvider : 'Disabled in environment'}
              </strong>
            </span>
            <span>
              Policy v{CURRENT_CONSENT_VERSION}
              {updatedAt ? ` · Saved` : ''}
            </span>
          </div>
        </div>
      </Modal>
    </>
  );
}
