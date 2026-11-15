import { useEffect, useState } from 'react';
import { Copy, RotateCcw, Save, Trash2 } from 'lucide-react';
import { DEFAULT_CAPTION_PRESETS } from '../api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ConfirmDialog } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { Toggle } from '../components/ui/Toggle';
import {
  useCaptionPresetsQuery,
  useCreateCaptionPresetMutation,
  useDeleteCaptionPresetMutation,
  useRestoreDefaultPresetsMutation,
  useUpdateCaptionPresetMutation,
} from '../hooks/useClipCatQueries';
import { useProjectDraftStore } from '../stores/projectDraftStore';
import { useUiStore } from '../stores/uiStore';
import type { CaptionPreset } from '../types/caption';
import type { CaptionPositionOption } from '../types/project';

const SAMPLE_WORDS = ['Local', 'AI', 'clips', 'look', 'razor', 'sharp'];

export function CaptionPresetsPage() {
  const presetsQuery = useCaptionPresetsQuery();
  const createMutation = useCreateCaptionPresetMutation();
  const updateMutation = useUpdateCaptionPresetMutation();
  const deleteMutation = useDeleteCaptionPresetMutation();
  const restoreMutation = useRestoreDefaultPresetsMutation();
  const { updateConfig } = useProjectDraftStore();
  const { addToast } = useUiStore();

  const presets = presetsQuery.data ?? DEFAULT_CAPTION_PRESETS;
  const [selectedId, setSelectedId] = useState<string>(presets[0]?.id ?? 'minimal-white');
  const [draft, setDraft] = useState<CaptionPreset | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  const activePreset =
    presets.find((p) => p.id === selectedId) ?? presets[0] ?? DEFAULT_CAPTION_PRESETS[0];

  useEffect(() => {
    if (activePreset) {
      setDraft(structuredClone(activePreset));
    }
  }, [activePreset]);

  const handleDuplicate = async () => {
    if (!draft) return;
    try {
      const created = await createMutation.mutateAsync({
        name: `${draft.name} Copy`,
        description: draft.description,
        fontFamily: draft.fontFamily,
        fontSizePx: draft.fontSizePx,
        primaryColor: draft.primaryColor,
        highlightColor: draft.highlightColor,
        outlineColor: draft.outlineColor,
        outlineWidthPx: draft.outlineWidthPx,
        shadowEnabled: draft.shadowEnabled,
        shadowColor: draft.shadowColor,
        backgroundColor: draft.backgroundColor,
        position: draft.position,
        wordsPerLine: draft.wordsPerLine,
        uppercase: draft.uppercase,
        wordByWordHighlight: draft.wordByWordHighlight,
      });
      setSelectedId(created.id);
      addToast({ variant: 'success', title: 'Preset Duplicated', description: created.name });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Save Failed',
        description:
          err instanceof Error
            ? err.message
            : 'Unable to duplicate preset. Connect FastAPI backend.',
      });
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      await updateMutation.mutateAsync({
        presetId: draft.id,
        payload: {
          name: draft.name,
          description: draft.description,
          fontFamily: draft.fontFamily,
          fontSizePx: draft.fontSizePx,
          primaryColor: draft.primaryColor,
          highlightColor: draft.highlightColor,
          outlineColor: draft.outlineColor,
          outlineWidthPx: draft.outlineWidthPx,
          shadowEnabled: draft.shadowEnabled,
          shadowColor: draft.shadowColor,
          backgroundColor: draft.backgroundColor,
          position: draft.position,
          wordsPerLine: draft.wordsPerLine,
          uppercase: draft.uppercase,
          wordByWordHighlight: draft.wordByWordHighlight,
        },
      });
      addToast({ variant: 'success', title: 'Preset Saved', description: draft.name });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Save Failed',
        description:
          err instanceof Error
            ? err.message
            : 'Unable to update preset on backend.',
      });
    }
  };

  const handleDeleteCustom = async () => {
    if (!draft || draft.isDefault) return;
    try {
      await deleteMutation.mutateAsync(draft.id);
      setSelectedId(DEFAULT_CAPTION_PRESETS[0].id);
      addToast({ variant: 'info', title: 'Custom Preset Deleted' });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'Unable to delete preset.',
      });
    }
  };

  const handleRestoreDefaults = async () => {
    try {
      await restoreMutation.mutateAsync();
      setRestoreConfirmOpen(false);
      setSelectedId('minimal-white');
      addToast({ variant: 'success', title: 'Default Presets Restored' });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Restore Failed',
        description: err instanceof Error ? err.message : 'Unable to restore defaults.',
      });
    }
  };

  const handleUseInNewProject = () => {
    if (!draft) return;
    updateConfig({ captionPresetId: draft.id, captionsEnabled: true });
    addToast({
      variant: 'success',
      title: 'Preset Applied to Draft',
      description: `"${draft.name}" selected for your next project.`,
    });
  };

  const previewPositionClass =
    draft?.position === 'top'
      ? 'items-start pt-8'
      : draft?.position === 'center'
        ? 'items-center'
        : 'items-end pb-8';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold text-ios-label">
            Caption Preset Library
          </h2>
          <p className="text-sm text-ios-secondary mt-1">
            Customize typography, highlight colors, outlines, and placement for burned-in captions.
          </p>
        </div>
        <Button
          variant="secondary"
          icon={<RotateCcw className="w-4 h-4" />}
          onClick={() => setRestoreConfirmOpen(true)}
        >
          Restore Defaults
        </Button>
      </div>

      {presetsQuery.isError && (
        <div className="rounded-xl bg-[var(--ios-orange-tint)] border border-[var(--ios-orange-border)] px-4 py-3 text-xs text-ios-orange">
          FastAPI backend is currently offline. Showing ClipCat&apos;s built-in reference preset definitions—saving or duplicating custom presets requires the backend connection.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Preset Selector Cards */}
        <section className="xl:col-span-5 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {presets.map((preset) => {
            const active = preset.id === activePreset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedId(preset.id)}
                className={`min-w-0 rounded-xl border p-4 text-left transition-colors cursor-pointer space-y-2 ${
                  active
                    ? 'bg-[var(--ios-blue-tint)] border-[var(--ios-blue-border)]'
                    : 'bg-ios-surface border-ios-sep hover:border-ios-sep-strong'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold text-ios-label truncate">
                    {preset.name}
                  </span>
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-ios-sep-strong"
                    style={{ backgroundColor: preset.highlightColor }}
                    aria-hidden="true"
                  />
                </div>
                <p className="text-xs text-ios-secondary line-clamp-2 leading-relaxed">
                  {preset.description}
                </p>
                <p className="text-[11px] font-mono text-ios-secondary truncate">
                  {preset.fontFamily} · {preset.fontSizePx}px · {preset.position}
                </p>
              </button>
            );
          })}
        </section>

        {/* Visual Sample Preview + Editor */}
        {draft && (
          <section className="xl:col-span-7 min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-lg font-bold text-ios-label">
                {draft.name}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleUseInNewProject}>
                  Use in New Project
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Copy className="w-3.5 h-3.5" />}
                  onClick={handleDuplicate}
                >
                  Duplicate
                </Button>
                {!draft.isDefault && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={handleDeleteCustom}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>

            {/* 9:16 Sample Canvas (neutral video backdrop) */}
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="w-full md:w-[220px] shrink-0 space-y-2">
                <div
                  className={`aspect-[9/16] rounded-xl bg-gradient-to-b from-[#2C2C2E] via-[#1C1C1E] to-[#000000] border border-ios-sep p-4 flex justify-center ${previewPositionClass}`}
                >
                  <div
                    className="text-center px-2.5 py-1.5 rounded-md leading-tight"
                    style={{
                      fontFamily: draft.fontFamily,
                      fontSize: `${Math.max(14, Math.round(draft.fontSizePx * 0.62))}px`,
                      fontWeight: 800,
                      backgroundColor: draft.backgroundColor ?? 'transparent',
                      textShadow: draft.shadowEnabled
                        ? `0 2px 6px ${draft.shadowColor}`
                        : 'none',
                      WebkitTextStroke:
                        draft.outlineWidthPx > 0
                          ? `${Math.min(2, draft.outlineWidthPx * 0.4)}px ${draft.outlineColor}`
                          : undefined,
                    }}
                  >
                    {SAMPLE_WORDS.slice(0, draft.wordsPerLine).map((word, idx) => {
                      const text = draft.uppercase ? word.toUpperCase() : word;
                      const isHighlighted = draft.wordByWordHighlight && idx === 1;
                      return (
                        <span
                          key={`${word}-${idx}`}
                          style={{
                            color: isHighlighted ? draft.highlightColor : draft.primaryColor,
                          }}
                        >
                          {text}
                          {idx < Math.min(SAMPLE_WORDS.length, draft.wordsPerLine) - 1
                            ? ' '
                            : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <p className="text-[11px] text-ios-secondary leading-relaxed">
                  Sample text preview only — not actual video captions.
                </p>
              </div>

              {/* Configuration Form */}
              <div className="flex-1 w-full min-w-0 space-y-4">
                <Input
                  label="Preset Name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="Font Family"
                    value={draft.fontFamily}
                    onChange={(e) => setDraft({ ...draft, fontFamily: e.target.value })}
                    options={[
                      { value: 'Inter', label: 'Inter' },
                      { value: 'Nunito', label: 'Nunito' },
                      { value: 'JetBrains Mono', label: 'JetBrains Mono' },
                    ]}
                  />
                  <Input
                    label="Font Size (px)"
                    type="number"
                    min={16}
                    max={64}
                    value={draft.fontSizePx}
                    onChange={(e) =>
                      setDraft({ ...draft, fontSizePx: Number(e.target.value) || 28 })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="preset-primary-color"
                      className="text-xs font-medium text-ios-label flex items-center justify-between"
                    >
                      <span>Primary Color</span>
                      <span className="font-mono text-[11px] text-ios-secondary">
                        {draft.primaryColor.toUpperCase()}
                      </span>
                    </label>
                    <input
                      id="preset-primary-color"
                      type="color"
                      value={draft.primaryColor}
                      onChange={(e) =>
                        setDraft({ ...draft, primaryColor: e.target.value })
                      }
                      className="h-10 w-full rounded-lg bg-ios-input border border-ios-sep p-1 cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="preset-highlight-color"
                      className="text-xs font-medium text-ios-label flex items-center justify-between"
                    >
                      <span>Highlight Color</span>
                      <span className="font-mono text-[11px] text-ios-secondary">
                        {draft.highlightColor.toUpperCase()}
                      </span>
                    </label>
                    <input
                      id="preset-highlight-color"
                      type="color"
                      value={draft.highlightColor}
                      onChange={(e) =>
                        setDraft({ ...draft, highlightColor: e.target.value })
                      }
                      className="h-10 w-full rounded-lg bg-ios-input border border-ios-sep p-1 cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="preset-outline-color"
                      className="text-xs font-medium text-ios-label flex items-center justify-between"
                    >
                      <span>Outline Color</span>
                      <span className="font-mono text-[11px] text-ios-secondary">
                        {draft.outlineColor.toUpperCase()}
                      </span>
                    </label>
                    <input
                      id="preset-outline-color"
                      type="color"
                      value={draft.outlineColor}
                      onChange={(e) =>
                        setDraft({ ...draft, outlineColor: e.target.value })
                      }
                      className="h-10 w-full rounded-lg bg-ios-input border border-ios-sep p-1 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Select
                    label="Position"
                    value={draft.position}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        position: e.target.value as CaptionPositionOption,
                      })
                    }
                    options={[
                      { value: 'top', label: 'Top' },
                      { value: 'center', label: 'Center' },
                      { value: 'bottom', label: 'Bottom' },
                    ]}
                  />
                  <Input
                    label="Words / Line"
                    type="number"
                    min={1}
                    max={8}
                    value={draft.wordsPerLine}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        wordsPerLine: Math.max(1, Math.min(8, Number(e.target.value) || 4)),
                      })
                    }
                  />
                  <Input
                    label="Outline (px)"
                    type="number"
                    min={0}
                    max={8}
                    value={draft.outlineWidthPx}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        outlineWidthPx: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <Toggle
                    checked={draft.shadowEnabled}
                    onChange={(checked) => setDraft({ ...draft, shadowEnabled: checked })}
                    label="Drop Shadow"
                  />
                  <Toggle
                    checked={draft.uppercase}
                    onChange={(checked) => setDraft({ ...draft, uppercase: checked })}
                    label="Uppercase Display"
                  />
                  <Toggle
                    checked={draft.wordByWordHighlight}
                    onChange={(checked) =>
                      setDraft({ ...draft, wordByWordHighlight: checked })
                    }
                    label="Word-by-Word Highlight"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    loading={updateMutation.isPending}
                    icon={<Save className="w-4 h-4" />}
                    onClick={handleSave}
                  >
                    Save Preset Changes
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={restoreConfirmOpen}
        onClose={() => setRestoreConfirmOpen(false)}
        onConfirm={handleRestoreDefaults}
        title="Restore Default Presets"
        message="Restore all built-in ClipCat caption presets to their factory typography and color settings?"
        confirmLabel="Restore Defaults"
        loading={restoreMutation.isPending}
      />
    </div>
  );
}
