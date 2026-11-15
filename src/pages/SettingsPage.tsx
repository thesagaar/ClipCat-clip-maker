import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save, Trash2 } from 'lucide-react';
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
import { ENV, getApiBaseUrl, setRuntimeApiBaseUrl } from '../config/env';
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
  const queryClient = useQueryClient();

  const [form, setForm] = useState<AppSettings>(() => {
    const initial = structuredClone(DEFAULT_APP_SETTINGS);
    initial.general.theme = themeMode;
    return initial;
  });
  const [backendUrlInput, setBackendUrlInput] = useState(() => getApiBaseUrl());
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(structuredClone(settingsQuery.data));
      setThemeMode(settingsQuery.data.general.theme);
    }
  }, [settingsQuery.data, setThemeMode]);

  useEffect(() => {
    if (!hash) return;
    const targetId = hash.replace(/^#/, '');
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [pathname, hash]);

  const presets = presetsQuery.data ?? DEFAULT_CAPTION_PRESETS;

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(form);
      setThemeMode(form.general.theme);
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
    try {
      const defaults = await resetMutation.mutateAsync();
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

  const handleClearTemp = async () => {
    try {
      const res = await clearTempMutation.mutateAsync();
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
    const trimmed = backendUrlInput.trim();
    if (trimmed && !/^https?:\/\/.+/i.test(trimmed)) {
      addToast({
        variant: 'error',
        title: 'Invalid Backend URL',
        description: 'Enter a valid http:// or https:// address (for example http://192.168.1.42:8000).',
      });
      return;
    }
    const activeUrl = setRuntimeApiBaseUrl(trimmed || null);
    setBackendUrlInput(activeUrl);
    queryClient.invalidateQueries();
    addToast({
      variant: 'success',
      title: 'Backend Address Updated',
      description: `FastAPI requests now target ${activeUrl}.`,
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
            Configure local Whisper models, FFmpeg thread allocation, default captions, and directories.
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
          <Input
            label="Application Name"
            value={form.general.applicationName}
            onChange={(e) =>
              setForm({
                ...form,
                general: { ...form.general, applicationName: e.target.value },
              })
            }
          />
          <Select
            label="Theme"
            value={themeMode}
            onChange={(e) => {
              const nextTheme = e.target.value as 'dark' | 'light' | 'system';
              setThemeMode(nextTheme);
              setForm({
                ...form,
                general: {
                  ...form.general,
                  theme: nextTheme,
                },
              });
            }}
            options={[
              { value: 'dark', label: 'iOS Dark (Default)' },
              { value: 'light', label: 'iOS Light (Grouped)' },
              { value: 'system', label: 'Follow System' },
            ]}
          />
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
          Processing & Hardware Budget
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
                  cpuThreads: Number(e.target.value) || 4,
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
                  defaultClipCount: Number(e.target.value) || 5,
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
                  concurrentJobs: Number(e.target.value) || 1,
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
            value={form.processing.defaultMinDurationSec}
            onChange={(e) =>
              setForm({
                ...form,
                processing: {
                  ...form.processing,
                  defaultMinDurationSec: Number(e.target.value) || 15,
                },
              })
            }
          />
          <Input
            label="Default Preferred Duration (sec)"
            type="number"
            min={10}
            value={form.processing.defaultPreferredDurationSec}
            onChange={(e) =>
              setForm({
                ...form,
                processing: {
                  ...form.processing,
                  defaultPreferredDurationSec: Number(e.target.value) || 45,
                },
              })
            }
          />
          <Input
            label="Default Max Duration (sec)"
            type="number"
            min={15}
            value={form.processing.defaultMaxDurationSec}
            onChange={(e) =>
              setForm({
                ...form,
                processing: {
                  ...form.processing,
                  defaultMaxDurationSec: Number(e.target.value) || 90,
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
              className="h-10 w-full rounded-lg bg-ios-input border border-ios-sep p-1 cursor-pointer"
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
            onClick={handleClearTemp}
          >
            Clear Temporary Files
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Project Directory"
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
            System & Backend Connection
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
                onChange={(e) => setBackendUrlInput(e.target.value)}
                helperText="On mobile devices, enter your host computer's LAN IP (e.g. http://192.168.1.25:8000) rather than 127.0.0.1."
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
                    const resetUrl = setRuntimeApiBaseUrl(null);
                    setBackendUrlInput(resetUrl);
                    queryClient.invalidateQueries();
                    addToast({
                      variant: 'info',
                      title: 'Backend URL Restored',
                      description: `Reverted to default (${resetUrl}).`,
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
        className="scroll-mt-20 rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-3"
      >
        <h3 className="font-display text-base font-bold text-ios-label">
          Privacy &amp; Data Handling
        </h3>
        <p className="text-xs sm:text-sm text-ios-secondary leading-relaxed">
          ClipCat runs strictly local-first. Uploaded videos, extracted audio, speech transcripts, and exported MP4/SRT files remain on your computer and your configured local FastAPI backend. No analytics, tracking beacons, user accounts, or unnecessary personal data are collected.
        </p>
        <p className="text-xs text-ios-tertiary-label">
          Only interface preferences (theme selection, sidebar state, and your local backend URL) are stored in browser local storage.
        </p>
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
    </div>
  );
}
