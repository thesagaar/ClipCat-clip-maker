import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Lock,
  Moon,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sun,
  Trash2,
} from 'lucide-react';
import { trackAnalyticsEvent } from '../analytics/client';
import { useConsentStore } from '../analytics/consentStore';
import { DEFAULT_APP_SETTINGS, DEFAULT_CAPTION_PRESETS } from '../api';
import { ClipCatLogo } from '../components/brand/ClipCatLogo';
import { SdpLogo } from '../components/brand/SdpLogo';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ConfirmDialog } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { Toggle } from '../components/ui/Toggle';
import { BRAND } from '../config/brand';
import {
  ENV,
  getApiBaseUrl,
  setRuntimeApiBaseUrl,
  validateApiBaseUrl,
} from '../config/env';
import {
  useCaptionPresetsQuery,
  useClearTempFilesMutation,
  useResetSettingsMutation,
  useSettingsQuery,
  useSystemDependenciesQuery,
  useSystemHealthQuery,
  useSystemStorageQuery,
  useUpdateSettingsMutation,
} from '../hooks/useClipCatQueries';
import { useUiStore } from '../stores/uiStore';
import type {
  AppSettings,
  StartupBehavior,
  WhisperModelSize,
} from '../types/settings';
import type { CaptionFontSizeOption, CaptionPositionOption } from '../types/project';
import { formatBytes } from '../utils/format';
import { getNextThemePreference, normalizeThemePreference } from '../utils/theme';

export function SettingsPage() {
  const settingsQuery = useSettingsQuery();
  const presetsQuery = useCaptionPresetsQuery();
  const depsQuery = useSystemDependenciesQuery();
  const healthQuery = useSystemHealthQuery();
  const storageQuery = useSystemStorageQuery();

  const updateMutation = useUpdateSettingsMutation();
  const resetMutation = useResetSettingsMutation();
  const clearTempMutation = useClearTempFilesMutation();
  const { mockModeEnabled, setMockModeEnabled, themeMode, setThemeMode, addToast } = useUiStore();
  const openPrivacyPreferences = useConsentStore((s) => s.openPreferences);
  const queryClient = useQueryClient();

  const [form, setForm] = useState<AppSettings>(() => {
    const initial = structuredClone(DEFAULT_APP_SETTINGS);
    initial.general.applicationName = BRAND.productName;
    initial.general.theme = themeMode;
    return initial;
  });
  const [backendUrlInput, setBackendUrlInput] = useState(() => getApiBaseUrl());
  const [backendUrlError, setBackendUrlError] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [clearTempDialogOpen, setClearTempDialogOpen] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      const persistedTheme = normalizeThemePreference(useUiStore.getState().themeMode);
      const next = structuredClone(settingsQuery.data);
      next.general.applicationName = BRAND.productName;
      next.general.theme = persistedTheme;
      setForm(next);
    }
  }, [settingsQuery.data]);

  const presets = presetsQuery.data ?? DEFAULT_CAPTION_PRESETS;

  const handleSave = async () => {
    if (updateMutation.isPending) return;
    const payloadToSave: AppSettings = {
      ...form,
      general: {
        ...form.general,
        applicationName: BRAND.productName,
      },
    };
    try {
      await updateMutation.mutateAsync(payloadToSave);
      setThemeMode(payloadToSave.general.theme);
      trackAnalyticsEvent('settings_updated', {
        section: 'general_and_processing',
        themeMode: payloadToSave.general.theme,
      });
      addToast({
        variant: 'success',
        title: 'Settings Saved',
        description: 'Application configuration updated on backend.',
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Save Failed',
        description:
          err instanceof Error
            ? err.message
            : 'Unable to save settings. Verify FastAPI is running.',
      });
    }
  };

  const handleConfirmReset = async () => {
    if (resetMutation.isPending) return;
    try {
      const defaults = await resetMutation.mutateAsync();
      defaults.general.applicationName = BRAND.productName;
      setForm(structuredClone(defaults));
      setThemeMode(defaults.general.theme);
      setResetDialogOpen(false);
      addToast({ variant: 'info', title: 'Settings Reset to Defaults' });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Reset Failed',
        description: err instanceof Error ? err.message : 'Unable to reset settings.',
      });
    }
  };

  const handleConfirmClearTemp = async () => {
    if (clearTempMutation.isPending) return;
    try {
      const res = await clearTempMutation.mutateAsync();
      setClearTempDialogOpen(false);
      addToast({
        variant: 'success',
        title: 'Temporary Files Cleared',
        description: `${res.message} (${formatBytes(res.freedBytes)} freed)`,
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Cleanup Failed',
        description: err instanceof Error ? err.message : 'Unable to clear temp files.',
      });
    }
  };

  const handleApplyBackendUrl = () => {
    setBackendUrlError(null);
    const trimmed = backendUrlInput.trim();
    if (trimmed) {
      const check = validateApiBaseUrl(trimmed);
      if (!check.valid) {
        setBackendUrlError(check.error ?? 'Invalid backend URL.');
        addToast({
          variant: 'error',
          title: 'Invalid Backend URL',
          description: check.error ?? 'Enter a valid http:// or https:// address.',
        });
        return;
      }
    }

    const result = setRuntimeApiBaseUrl(trimmed || null);
    if (!result.valid) {
      setBackendUrlError(result.error ?? 'Invalid backend URL.');
      return;
    }

    setBackendUrlInput(result.normalized);
    queryClient.invalidateQueries();
    addToast({
      variant: 'success',
      title: 'Backend Address Updated',
      description: `FastAPI requests now target ${result.normalized}.`,
    });
  };

  const getDepStatus = (id: string) =>
    depsQuery.data?.dependencies.find((d) => d.id === id)?.status ?? 'unavailable';

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold text-ios-label">
            Application Settings
          </h2>
          <p className="text-sm text-ios-secondary mt-1">
            Configure local Whisper models, FFmpeg thread allocation, default captions, directories, and privacy preferences.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Button
            variant="secondary"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={() => setResetDialogOpen(true)}
          >
            Reset Defaults
          </Button>
          <Button
            loading={updateMutation.isPending}
            icon={<Save className="w-4 h-4" />}
            onClick={handleSave}
          >
            Save Settings
          </Button>
        </div>
      </div>

      {settingsQuery.isError && (
        <div className="rounded-xl bg-[var(--ios-orange-tint)] border border-[var(--ios-orange-border)] px-4 py-3 text-xs text-ios-orange break-words">
          Unable to load live settings from FastAPI ({getApiBaseUrl()}). Showing default values—saving requires the backend server.
        </div>
      )}

      {/* GENERAL */}
      <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-4">
        <h3 className="font-display text-base font-bold text-ios-label">General</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="settings-constant-app-name"
              className="text-sm font-medium text-ios-label inline-flex items-center gap-1.5"
            >
              <span>Application Name</span>
              <Lock className="w-3.5 h-3.5 text-ios-tertiary-label" aria-hidden="true" />
            </label>
            <input
              id="settings-constant-app-name"
              type="text"
              value={BRAND.productName}
              readOnly
              aria-readonly="true"
              className="h-11 sm:h-10 w-full rounded-lg bg-ios-bg/80 px-3 text-sm font-semibold text-ios-secondary border border-ios-sep cursor-not-allowed select-all focus:outline-none"
            />
            <p className="text-[11px] text-ios-tertiary-label">
              Product identity is fixed and cannot be changed.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="settings-theme-toggle"
              className="text-sm font-medium text-ios-label"
            >
              Theme
            </label>
            <button
              id="settings-theme-toggle"
              type="button"
              role="switch"
              aria-checked={themeMode === 'dark'}
              aria-label={`Theme: ${themeMode}`}
              onClick={() => {
                const nextTheme = getNextThemePreference(themeMode);
                setThemeMode(nextTheme);
                setForm((prev) => ({
                  ...prev,
                  general: {
                    ...prev.general,
                    theme: nextTheme,
                  },
                }));
              }}
              className="h-11 sm:h-10 w-full rounded-lg bg-ios-input px-3 text-sm text-ios-label border border-ios-sep hover:border-ios-blue/60 focus-visible:border-ios-blue focus-visible:outline-none transition-colors cursor-pointer flex items-center justify-between gap-2"
            >
              <span className="inline-flex items-center gap-2 font-medium min-w-0">
                {themeMode === 'dark' ? (
                  <Moon className="w-4 h-4 text-[#C8B9F1] shrink-0" aria-hidden="true" />
                ) : (
                  <Sun className="w-4 h-4 text-ios-orange shrink-0" aria-hidden="true" />
                )}
                <span>{themeMode}</span>
              </span>
              <span
                aria-hidden="true"
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-150 ${
                  themeMode === 'dark'
                    ? 'bg-[#7040DC] border-[#7040DC]'
                    : 'bg-ios-tertiary border-ios-sep'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                    themeMode === 'dark' ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>
          </div>

          <Select
            label="Language"
            value={form.general.language}
            onChange={(e) =>
              setForm({
                ...form,
                general: { ...form.general, language: e.target.value },
              })
            }
            options={[
              { value: 'en-US', label: 'English (US)' },
              { value: 'en-GB', label: 'English (UK)' },
            ]}
          />
          <Select
            label="Startup Behaviour"
            value={form.general.startupBehavior}
            onChange={(e) =>
              setForm({
                ...form,
                general: {
                  ...form.general,
                  startupBehavior: e.target.value as StartupBehavior,
                },
              })
            }
            options={[
              { value: 'dashboard', label: 'Open Dashboard' },
              { value: 'new_project', label: 'Open New Project' },
              { value: 'last_project', label: 'Resume Last Project' },
            ]}
          />
        </div>
      </section>

      {/* PROCESSING */}
      <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-5">
        <h3 className="font-display text-base font-bold text-ios-label">
          Processing &amp; Hardware Budget
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select
            label="Whisper Model"
            value={form.processing.whisperModel}
            onChange={(e) =>
              setForm({
                ...form,
                processing: {
                  ...form.processing,
                  whisperModel: e.target.value as WhisperModelSize,
                },
              })
            }
            options={[
              { value: 'tiny', label: 'tiny (Fastest, ~1 GB RAM)' },
              { value: 'base', label: 'base (~1.5 GB RAM)' },
              { value: 'small', label: 'small (Recommended 8GB)' },
              { value: 'medium', label: 'medium (~5 GB RAM)' },
              { value: 'large-v3', label: 'large-v3 (High RAM)' },
            ]}
          />
          <Input
            label="CPU Thread Count"
            type="number"
            min={1}
            max={32}
            value={form.processing.cpuThreads}
            onChange={(e) =>
              setForm({
                ...form,
                processing: {
                  ...form.processing,
                  cpuThreads: Math.min(32, Math.max(1, Number(e.target.value) || 4)),
                },
              })
            }
          />
          <Input
            label="Default Clip Count"
            type="number"
            min={1}
            max={30}
            value={form.processing.defaultClipCount}
            onChange={(e) =>
              setForm({
                ...form,
                processing: {
                  ...form.processing,
                  defaultClipCount: Math.min(30, Math.max(1, Number(e.target.value) || 5)),
                },
              })
            }
          />
          <Input
            label="Concurrent Jobs"
            type="number"
            min={1}
            max={4}
            value={form.processing.concurrentJobs}
            onChange={(e) =>
              setForm({
                ...form,
                processing: {
                  ...form.processing,
                  concurrentJobs: Math.min(4, Math.max(1, Number(e.target.value) || 1)),
                },
              })
            }
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Default Min Duration (sec)"
            type="number"
            min={5}
            max={120}
            value={form.processing.defaultMinDurationSec}
            onChange={(e) =>
              setForm({
                ...form,
                processing: {
                  ...form.processing,
                  defaultMinDurationSec: Math.max(5, Number(e.target.value) || 15),
                },
              })
            }
          />
          <Input
            label="Default Preferred Duration (sec)"
            type="number"
            min={10}
            max={240}
            value={form.processing.defaultPreferredDurationSec}
            onChange={(e) =>
              setForm({
                ...form,
                processing: {
                  ...form.processing,
                  defaultPreferredDurationSec: Math.max(10, Number(e.target.value) || 45),
                },
              })
            }
          />
          <Input
            label="Default Max Duration (sec)"
            type="number"
            min={15}
            max={300}
            value={form.processing.defaultMaxDurationSec}
            onChange={(e) =>
              setForm({
                ...form,
                processing: {
                  ...form.processing,
                  defaultMaxDurationSec: Math.min(300, Math.max(15, Number(e.target.value) || 90)),
                },
              })
            }
          />
        </div>

        <Toggle
          checked={form.processing.cleanupTempFilesOnComplete}
          onChange={(checked) =>
            setForm({
              ...form,
              processing: {
                ...form.processing,
                cleanupTempFilesOnComplete: checked,
              },
            })
          }
          label="Automatic Temporary File Cleanup"
          description="Delete extracted WAV audio and intermediate frames once clip rendering finishes."
        />
      </section>

      {/* CAPTIONS */}
      <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-4">
        <h3 className="font-display text-base font-bold text-ios-label">
          Default Caption Settings
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select
            label="Default Preset"
            value={form.captions.defaultPresetId}
            onChange={(e) =>
              setForm({
                ...form,
                captions: { ...form.captions, defaultPresetId: e.target.value },
              })
            }
            options={presets.map((p) => ({ value: p.id, label: p.name }))}
          />
          <Select
            label="Font Size"
            value={form.captions.fontSize}
            onChange={(e) =>
              setForm({
                ...form,
                captions: {
                  ...form.captions,
                  fontSize: e.target.value as CaptionFontSizeOption,
                },
              })
            }
            options={[
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
            ]}
          />
          <Select
            label="Caption Position"
            value={form.captions.position}
            onChange={(e) =>
              setForm({
                ...form,
                captions: {
                  ...form.captions,
                  position: e.target.value as CaptionPositionOption,
                },
              })
            }
            options={[
              { value: 'top', label: 'Top' },
              { value: 'center', label: 'Center' },
              { value: 'bottom', label: 'Bottom' },
            ]}
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="settings-highlight-color"
              className="text-sm font-medium text-ios-label"
            >
              Highlight Color
            </label>
            <input
              id="settings-highlight-color"
              type="color"
              value={form.captions.highlightColor}
              onChange={(e) =>
                setForm({
                  ...form,
                  captions: { ...form.captions, highlightColor: e.target.value },
                })
              }
              className="h-11 sm:h-10 w-full rounded-lg bg-ios-input border border-ios-sep p-1 cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* STORAGE */}
      <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="font-display text-base font-bold text-ios-label">
            Storage Directories
          </h3>
          <Button
            variant="secondary"
            size="sm"
            loading={clearTempMutation.isPending}
            icon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => setClearTempDialogOpen(true)}
          >
            Clear Temporary Files
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Project Directory"
            maxLength={240}
            value={form.storage.projectDirectory}
            onChange={(e) =>
              setForm({
                ...form,
                storage: { ...form.storage, projectDirectory: e.target.value },
              })
            }
          />
          <Input
            label="Export Directory"
            maxLength={240}
            value={form.storage.exportDirectory}
            onChange={(e) =>
              setForm({
                ...form,
                storage: { ...form.storage, exportDirectory: e.target.value },
              })
            }
          />
          <Input
            label="Temporary Directory"
            maxLength={240}
            value={form.storage.tempDirectory}
            onChange={(e) =>
              setForm({
                ...form,
                storage: { ...form.storage, tempDirectory: e.target.value },
              })
            }
          />
        </div>

        {storageQuery.data && (
          <p className="text-xs text-ios-secondary font-mono tabular-nums break-words">
            Total Used: {formatBytes(storageQuery.data.totalUsedBytes)} · Temp Cache:{' '}
            {formatBytes(storageQuery.data.tempStorageBytes)} · Available Disk:{' '}
            {formatBytes(storageQuery.data.availableDiskBytes)}
          </p>
        )}
      </section>

      {/* SYSTEM & DEVELOPER ADAPTER */}
      <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-ios-label">
            System &amp; Backend Connection
          </h3>
          <Link to="/system" className="text-xs font-medium text-ios-blue hover:underline">
            Open System Diagnostics
          </Link>
        </div>

        <div className="rounded-lg bg-ios-bg border border-ios-sep p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 min-w-0">
              <Input
                label="FastAPI Backend Server URL (Desktop or LAN IP for Mobile)"
                type="url"
                placeholder={ENV.API_BASE_URL}
                value={backendUrlInput}
                error={backendUrlError ?? undefined}
                onChange={(e) => {
                  setBackendUrlInput(e.target.value);
                  setBackendUrlError(null);
                }}
                helperText="On mobile devices over LAN HTTP dev, enter your host IP (e.g. http://192.168.1.25:8000). On HTTPS deployments, use https:// or local loopback."
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button variant="secondary" onClick={handleApplyBackendUrl}>
                Apply Server URL
              </Button>
              {backendUrlInput !== ENV.API_BASE_URL && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    const resetRes = setRuntimeApiBaseUrl(null);
                    setBackendUrlInput(resetRes.normalized);
                    setBackendUrlError(null);
                    queryClient.invalidateQueries();
                    addToast({
                      variant: 'info',
                      title: 'Backend URL Restored',
                      description: `Reverted to default (${resetRes.normalized}).`,
                    });
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="min-w-0 rounded-lg bg-ios-bg border border-ios-sep p-3.5 flex items-center justify-between gap-2">
            <span className="text-ios-secondary">Backend Connection</span>
            <StatusIndicator
              status={healthQuery.isError ? 'unavailable' : healthQuery.data?.status ?? 'waiting'}
            />
          </div>
          <div className="min-w-0 rounded-lg bg-ios-bg border border-ios-sep p-3.5 flex items-center justify-between gap-2">
            <span className="text-ios-secondary">FFmpeg</span>
            <StatusIndicator status={getDepStatus('ffmpeg')} />
          </div>
          <div className="min-w-0 rounded-lg bg-ios-bg border border-ios-sep p-3.5 flex items-center justify-between gap-2">
            <span className="text-ios-secondary">FFprobe</span>
            <StatusIndicator status={getDepStatus('ffprobe')} />
          </div>
          <div className="min-w-0 rounded-lg bg-ios-bg border border-ios-sep p-3.5 flex items-center justify-between gap-2">
            <span className="text-ios-secondary">Whisper</span>
            <StatusIndicator status={getDepStatus('whisper')} />
          </div>
          <div className="min-w-0 rounded-lg bg-ios-bg border border-ios-sep p-3.5 flex items-center justify-between gap-2">
            <span className="text-ios-secondary">Python</span>
            <StatusIndicator status={getDepStatus('python')} />
          </div>
          <div className="min-w-0 rounded-lg bg-ios-bg border border-ios-sep p-3.5 flex items-center justify-between gap-2">
            <span className="text-ios-secondary">Frontend Version</span>
            <span className="font-mono text-ios-label">v{BRAND.version}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-ios-sep">
          <Toggle
            checked={mockModeEnabled}
            onChange={(checked) => setMockModeEnabled(checked)}
            label="Isolated Development Mock Adapter (VITE_USE_MOCK_API)"
            description={`When enabled, ClipCat serves explicitly labeled sample data in-memory instead of querying ${getApiBaseUrl()}.`}
          />
        </div>
      </section>

      {/* ABOUT CLIPCAT (SDP OWNERSHIP & PRODUCT IDENTITY) */}
      <section
        id="about"
        aria-label="About ClipCat"
        className="scroll-mt-20 rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ios-sep">
          <div className="flex flex-wrap items-center gap-4">
            <ClipCatLogo size="lg" variant="full" showSubtitle />
            <span className="hidden sm:inline-block h-8 w-px bg-ios-sep" aria-hidden="true" />
            <div className="flex items-center gap-2.5">
              <SdpLogo size="sm" />
              <div className="text-xs">
                <p className="font-medium text-ios-label">{BRAND.parentBrandName}</p>
                <p className="text-ios-secondary">{BRAND.shortAttribution}</p>
              </div>
            </div>
          </div>
          <span className="text-xs font-mono text-ios-secondary">
            v{BRAND.version}
          </span>
        </div>

        <div>
          <h3 className="font-display text-base font-bold text-ios-label">
            About {BRAND.productName}
          </h3>
          <p className="text-xs text-ios-secondary mt-1">
            {BRAND.developedByStatement} &ldquo;{BRAND.productTagline}&rdquo;
          </p>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg bg-ios-bg border border-ios-sep p-3.5 space-y-1">
            <dt className="text-ios-secondary">Product</dt>
            <dd className="font-semibold text-ios-label">{BRAND.productName}</dd>
          </div>
          <div className="rounded-lg bg-ios-bg border border-ios-sep p-3.5 space-y-1">
            <dt className="text-ios-secondary">Product category</dt>
            <dd className="font-semibold text-ios-label">{BRAND.productCategory}</dd>
          </div>
          <div className="rounded-lg bg-ios-bg border border-ios-sep p-3.5 space-y-1">
            <dt className="text-ios-secondary">Developed by</dt>
            <dd className="font-semibold text-ios-label">{BRAND.parentBrandName}</dd>
          </div>
          <div className="rounded-lg bg-ios-bg border border-ios-sep p-3.5 space-y-1">
            <dt className="text-ios-secondary">Product version</dt>
            <dd className="font-mono text-ios-label">v{BRAND.version}</dd>
          </div>
          <div className="rounded-lg bg-ios-bg border border-ios-sep p-3.5 space-y-1">
            <dt className="text-ios-secondary">Platform</dt>
            <dd className="font-semibold text-ios-label">{BRAND.platforms}</dd>
          </div>
          <div className="rounded-lg bg-ios-bg border border-ios-sep p-3.5 space-y-1">
            <dt className="text-ios-secondary">Processing</dt>
            <dd className="font-semibold text-ios-label">{BRAND.processingSummary}</dd>
          </div>
          <div className="rounded-lg bg-ios-bg border border-ios-sep p-3.5 space-y-1">
            <dt className="text-ios-secondary">Website</dt>
            <dd className="font-mono text-ios-label break-words">
              <a
                href={BRAND.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ios-blue hover:underline"
              >
                {BRAND.website}
              </a>
            </dd>
          </div>
          <div className="rounded-lg bg-ios-bg border border-ios-sep p-3.5 space-y-1">
            <dt className="text-ios-secondary">Support</dt>
            <dd className="font-mono text-ios-label break-words space-y-1">
              <a
                href={BRAND.supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ios-blue hover:underline block"
              >
                {BRAND.supportUrl}
              </a>
              {BRAND.supportEmail && (
                <a
                  href={`mailto:${BRAND.supportEmail}`}
                  className="text-ios-blue hover:underline block"
                >
                  {BRAND.supportEmail}
                </a>
              )}
            </dd>
          </div>
          <div className="rounded-lg bg-ios-bg border border-ios-sep p-3.5 space-y-1">
            <dt className="text-ios-secondary">Copyright</dt>
            <dd className="font-semibold text-ios-label">{BRAND.aboutCopyright}</dd>
          </div>
        </dl>
      </section>

      {/* PRIVACY & DATA HANDLING */}
      <section
        id="privacy"
        aria-label="Privacy and Data Handling"
        className="scroll-mt-20 rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-bold text-ios-label">
            Privacy, Analytics &amp; Data Handling
          </h3>
          <Button
            variant="secondary"
            size="sm"
            icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
            onClick={openPrivacyPreferences}
          >
            Privacy &amp; Analytics Preferences
          </Button>
        </div>

        <p className="text-xs sm:text-sm text-ios-secondary leading-relaxed">
          {BRAND.productName} processes uploaded video, extracted audio, speech transcripts, captions, and rendered exports between your browser and your configured FastAPI backend. Media files, transcripts, project titles, filenames, and credentials are strictly excluded from telemetry. Optional privacy-conscious product usage analytics and sanitized technical error diagnostics remain disabled unless both environment configuration and your explicit consent allow them.
        </p>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <Link to={BRAND.privacyRoute} className="text-ios-blue font-medium hover:underline">
            Read Full Privacy Policy
          </Link>
          <Link to={BRAND.termsRoute} className="text-ios-blue font-medium hover:underline">
            Read Terms &amp; Conditions
          </Link>
        </div>
      </section>

      <ConfirmDialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        onConfirm={handleConfirmReset}
        title="Reset Settings to Defaults"
        message="Reset all general, processing, caption, and directory preferences back to ClipCat defaults?"
        confirmLabel="Reset Settings"
        danger
        loading={resetMutation.isPending}
      />

      <ConfirmDialog
        open={clearTempDialogOpen}
        onClose={() => setClearTempDialogOpen(false)}
        onConfirm={handleConfirmClearTemp}
        title="Clear Temporary Processing Files"
        message="Delete extracted WAV audio and intermediate frame caches from the backend temporary directory? Saved projects and finished MP4 exports remain intact."
        confirmLabel="Clear Temporary Files"
        danger
        loading={clearTempMutation.isPending}
      />
    </div>
  );
}
