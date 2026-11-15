import { useEffect, useState } from 'react';
import { RotateCcw, Save, Trash2 } from 'lucide-react';
import { DEFAULT_APP_SETTINGS, DEFAULT_CAPTION_PRESETS } from '../api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ConfirmDialog } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { Toggle } from '../components/ui/Toggle';
import { ENV } from '../config/env';
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

  const [form, setForm] = useState<AppSettings>(() => {
    const initial = structuredClone(DEFAULT_APP_SETTINGS);
    initial.general.theme = themeMode;
    return initial;
  });
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(structuredClone(settingsQuery.data));
      setThemeMode(settingsQuery.data.general.theme);
    }
  }, [settingsQuery.data, setThemeMode]);

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
          Unable to load live settings from FastAPI ({ENV.API_BASE_URL}). Showing default values—saving requires the backend server.
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
        <h3 className="font-display text-base font-bold text-ios-label">
          System & Backend Connection
        </h3>

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
            <span className="font-mono text-ios-label">v{ENV.APP_VERSION}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-ios-sep">
          <Toggle
            checked={mockModeEnabled}
            onChange={(checked) => setMockModeEnabled(checked)}
            label="Isolated Development Mock Adapter (VITE_USE_MOCK_API)"
            description="When enabled, ClipCat serves explicitly labeled sample data in-memory instead of querying http://127.0.0.1:8000."
          />
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
    </div>
  );
}
