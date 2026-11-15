import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const CURRENT_CONSENT_VERSION = '2026-11-15';

export interface ConsentState {
  hasResponded: boolean;
  essential: true;
  analytics: boolean;
  diagnostics: boolean;
  consentVersion: string;
  updatedAt: string | null;
  preferencesOpen: boolean;
  acceptAll: () => void;
  rejectOptional: () => void;
  savePreferences: (prefs: { analytics: boolean; diagnostics: boolean }) => void;
  openPreferences: () => void;
  closePreferences: () => void;
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      hasResponded: false,
      essential: true,
      analytics: false,
      diagnostics: false,
      consentVersion: CURRENT_CONSENT_VERSION,
      updatedAt: null,
      preferencesOpen: false,

      acceptAll: () =>
        set({
          hasResponded: true,
          essential: true,
          analytics: true,
          diagnostics: true,
          consentVersion: CURRENT_CONSENT_VERSION,
          updatedAt: new Date().toISOString(),
          preferencesOpen: false,
        }),

      rejectOptional: () =>
        set({
          hasResponded: true,
          essential: true,
          analytics: false,
          diagnostics: false,
          consentVersion: CURRENT_CONSENT_VERSION,
          updatedAt: new Date().toISOString(),
          preferencesOpen: false,
        }),

      savePreferences: ({ analytics, diagnostics }) =>
        set({
          hasResponded: true,
          essential: true,
          analytics: Boolean(analytics),
          diagnostics: Boolean(diagnostics),
          consentVersion: CURRENT_CONSENT_VERSION,
          updatedAt: new Date().toISOString(),
          preferencesOpen: false,
        }),

      openPreferences: () => set({ preferencesOpen: true }),
      closePreferences: () => set({ preferencesOpen: false }),
    }),
    {
      name: 'clipcat-consent-preferences',
      partialize: (state) => ({
        hasResponded: state.hasResponded,
        essential: state.essential,
        analytics: state.analytics,
        diagnostics: state.diagnostics,
        consentVersion: state.consentVersion,
        updatedAt: state.updatedAt,
      }),
    }
  )
);
