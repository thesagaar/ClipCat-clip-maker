import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCaptionPresetsQuery } from '../../hooks/useClipCatQueries';
import { DEFAULT_CAPTION_PRESETS } from '../../api';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Toggle } from '../../components/ui/Toggle';
import type {
  AspectRatio,
  CaptionFontSizeOption,
  CaptionPositionOption,
  OutputResolution,
  ProcessingConfig,
  VideoLayoutMode,
} from '../../types/project';

interface ProcessingConfigPanelProps {
  config: ProcessingConfig;
  errors: {
    projectName?: string;
    desiredClipCount?: string;
    durationRange?: string;
  };
  onChange: (patch: Partial<ProcessingConfig>) => void;
}

const layoutModes: Array<{ value: VideoLayoutMode; label: string; desc: string }> = [
  {
    value: 'smart_face_tracking',
    label: 'Smart Face Tracking',
    desc: 'Dynamically centers active speaker faces.',
  },
  {
    value: 'center_crop',
    label: 'Center Crop',
    desc: 'Fixed center vertical crop without panning.',
  },
  {
    value: 'blurred_background',
    label: 'Blurred Background',
    desc: 'Full frame centered over blurred backdrop.',
  },
  {
    value: 'split_screen',
    label: 'Split Screen',
    desc: 'Stacks two speakers or screen + webcam.',
  },
];

export function ProcessingConfigPanel({
  config,
  errors,
  onChange,
}: ProcessingConfigPanelProps) {
  const presetsQuery = useCaptionPresetsQuery();
  const presets = presetsQuery.data ?? DEFAULT_CAPTION_PRESETS;
  const [framingOpenMobile, setFramingOpenMobile] = useState(true);
  const [captionsOpenMobile, setCaptionsOpenMobile] = useState(false);
  const [outputOpenMobile, setOutputOpenMobile] = useState(true);

  return (
    <div className="space-y-6">
      {/* Project Settings */}
      <section className="rounded-xl bg-ios-surface border border-ios-sep p-4 sm:p-6 space-y-5">
        <div>
          <h3 className="font-display text-base font-bold text-ios-label">
            Project Settings
          </h3>
          <p className="text-xs text-ios-secondary mt-0.5">
            Define clip count targets and duration boundaries.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Project Name"
            placeholder="Enter project title"
            value={config.projectName}
            error={errors.projectName}
            onChange={(e) => onChange({ projectName: e.target.value })}
          />
          <Input
            label="Output Directory (optional)"
            placeholder="Default export directory"
            value={config.outputDirectory ?? ''}
            onChange={(e) => onChange({ outputDirectory: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Input
            label="Desired Clip Count"
            type="number"
            min={1}
            max={30}
            value={config.desiredClipCount}
            error={errors.desiredClipCount}
            onChange={(e) =>
              onChange({ desiredClipCount: Number(e.target.value) || 1 })
            }
          />
          <Input
            label="Min Duration (sec)"
            type="number"
            min={5}
            max={180}
            value={config.minDurationSec}
            onChange={(e) =>
              onChange({ minDurationSec: Number(e.target.value) || 15 })
            }
          />
          <Input
            label="Preferred (sec)"
            type="number"
            min={10}
            max={240}
            value={config.preferredDurationSec}
            onChange={(e) =>
              onChange({ preferredDurationSec: Number(e.target.value) || 45 })
            }
          />
          <Input
            label="Max Duration (sec)"
            type="number"
            min={15}
            max={300}
            value={config.maxDurationSec}
            onChange={(e) =>
              onChange({ maxDurationSec: Number(e.target.value) || 90 })
            }
          />
        </div>

        {errors.durationRange && (
          <p role="alert" className="text-xs text-ios-red">
            {errors.durationRange}
          </p>
        )}
      </section>

      {/* Clip Framing & Layout */}
      <section className="rounded-xl bg-ios-surface border border-ios-sep p-4 sm:p-6 space-y-5">
        <button
          type="button"
          onClick={() => setFramingOpenMobile((prev) => !prev)}
          aria-expanded={framingOpenMobile}
          className="w-full flex items-center justify-between gap-3 text-left sm:pointer-events-none cursor-pointer sm:cursor-default min-h-[44px] sm:min-h-0"
        >
          <div>
            <h3 className="font-display text-base font-bold text-ios-label">
              Clip Aspect Ratio & Video Layout
            </h3>
            <p className="text-xs text-ios-secondary mt-0.5">
              {config.aspectRatio} · {config.layoutMode.replace(/_/g, ' ')}
            </p>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-ios-secondary transition-transform sm:hidden shrink-0 ${
              framingOpenMobile ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        <div className={`${framingOpenMobile ? 'block' : 'hidden sm:block'} space-y-5`}>
          <div className="space-y-2">
            <span className="text-sm font-medium text-ios-label">Aspect Ratio</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  { value: '9:16', label: '9:16 Vertical', sub: 'Shorts · Reels · TikTok' },
                  { value: '16:9', label: '16:9 Horizontal', sub: 'YouTube · Standard' },
                  { value: '1:1', label: '1:1 Square', sub: 'Feeds · LinkedIn' },
                ] as Array<{ value: AspectRatio; label: string; sub: string }>
              ).map((opt) => {
                const active = config.aspectRatio === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ aspectRatio: opt.value })}
                    className={`min-h-[48px] rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--ios-blue-tint)] border-ios-blue text-ios-label'
                        : 'bg-ios-bg border-ios-sep text-ios-secondary hover:text-ios-label'
                    }`}
                  >
                    <p className="text-sm font-semibold text-ios-label">{opt.label}</p>
                    <p className="text-xs text-ios-secondary mt-0.5">{opt.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-ios-label">Video Layout</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {layoutModes.map((mode) => {
                const active = config.layoutMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => onChange({ layoutMode: mode.value })}
                    className={`min-h-[48px] rounded-lg border p-3.5 text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--ios-blue-tint)] border-ios-blue'
                        : 'bg-ios-bg border-ios-sep hover:border-ios-sep-strong'
                    }`}
                  >
                    <p className="text-sm font-semibold text-ios-label">{mode.label}</p>
                    <p className="text-xs text-ios-secondary mt-0.5">{mode.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Caption & Output Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl bg-ios-surface border border-ios-sep p-4 sm:p-6 space-y-5 min-w-0">
          <div className="flex items-center justify-between gap-2 sm:hidden">
            <button
              type="button"
              onClick={() => setCaptionsOpenMobile((prev) => !prev)}
              aria-expanded={captionsOpenMobile}
              className="w-full flex items-center justify-between gap-3 text-left min-h-[44px] cursor-pointer"
            >
              <div>
                <h3 className="font-display text-base font-bold text-ios-label">
                  Caption Options
                </h3>
                <p className="text-xs text-ios-secondary mt-0.5">
                  {config.captionsEnabled
                    ? `Enabled · ${config.captionPresetId}`
                    : 'Captions disabled'}
                </p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-ios-secondary transition-transform shrink-0 ${
                  captionsOpenMobile ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </div>

          <div className={`${captionsOpenMobile ? 'block' : 'hidden sm:block'} space-y-5`}>
            <Toggle
              checked={config.captionsEnabled}
              onChange={(checked) => onChange({ captionsEnabled: checked })}
              label="Enable Burned-In Captions"
              description="Generate Whisper word timings and burn captions into rendered clips."
            />

            <div
              className={`space-y-4 ${
                !config.captionsEnabled ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <Select
                label="Caption Preset"
                value={config.captionPresetId}
                onChange={(e) => onChange({ captionPresetId: e.target.value })}
                options={presets.map((p) => ({ value: p.id, label: p.name }))}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Font Size"
                  value={config.captionFontSize}
                  onChange={(e) =>
                    onChange({
                      captionFontSize: e.target.value as CaptionFontSizeOption,
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
                  value={config.captionPosition}
                  onChange={(e) =>
                    onChange({
                      captionPosition: e.target.value as CaptionPositionOption,
                    })
                  }
                  options={[
                    { value: 'top', label: 'Top' },
                    { value: 'center', label: 'Center' },
                    { value: 'bottom', label: 'Bottom' },
                  ]}
                />
              </div>

              <div className="space-y-3 pt-1">
                <Toggle
                  checked={config.highlightKeywords}
                  onChange={(checked) => onChange({ highlightKeywords: checked })}
                  label="Highlight Keywords"
                />
                <Toggle
                  checked={config.wordByWordAnimation}
                  onChange={(checked) => onChange({ wordByWordAnimation: checked })}
                  label="Word-by-Word Animation"
                />
                <Toggle
                  checked={config.speakerLabels}
                  onChange={(checked) => onChange({ speakerLabels: checked })}
                  label="Speaker Labels"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-ios-surface border border-ios-sep p-4 sm:p-6 space-y-5 flex flex-col justify-between min-w-0">
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setOutputOpenMobile((prev) => !prev)}
              aria-expanded={outputOpenMobile}
              className="w-full flex items-center justify-between gap-3 text-left sm:pointer-events-none cursor-pointer sm:cursor-default min-h-[44px] sm:min-h-0"
            >
              <div>
                <h3 className="font-display text-base font-bold text-ios-label">
                  Output & Automation
                </h3>
                <p className="text-xs text-ios-secondary mt-0.5">
                  Standardized MP4 (H.264) export pipeline.
                </p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-ios-secondary transition-transform sm:hidden shrink-0 ${
                  outputOpenMobile ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            <div className={`${outputOpenMobile ? 'block' : 'hidden sm:block'} space-y-4`}>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Resolution"
                value={config.outputResolution}
                onChange={(e) =>
                  onChange({
                    outputResolution: e.target.value as OutputResolution,
                  })
                }
                options={[
                  { value: '1080p', label: '1080p Full HD' },
                  { value: '720p', label: '720p HD (Faster)' },
                ]}
              />
              <Select
                label="Frame Rate"
                value={String(config.outputFps)}
                onChange={(e) =>
                  onChange({
                    outputFps: Number(e.target.value) === 60 ? 60 : 30,
                  })
                }
                options={[
                  { value: '30', label: '30 FPS (Recommended)' },
                  { value: '60', label: '60 FPS' },
                ]}
              />
            </div>

            <div className="rounded-lg bg-ios-bg border border-ios-sep p-3 text-xs text-ios-secondary flex flex-wrap items-center justify-between gap-2">
              <span>Container & Codec</span>
              <span className="font-mono text-ios-label">MP4 · H.264 · AAC</span>
            </div>
            </div>
          </div>

          <div className="rounded-lg bg-ios-tertiary border border-ios-sep p-4">
            <Toggle
              checked={config.autoProcess}
              onChange={(checked) => onChange({ autoProcess: checked })}
              label="Fully Automatic Processing"
              description="Automatically select top moments, crop, render captions, and export results without manual pauses."
            />
          </div>
        </section>
      </div>
    </div>
  );
}
