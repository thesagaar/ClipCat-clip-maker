import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Film,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Send,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  DEFAULT_CAPTION_PRESETS,
  getClipDownloadUrl,
  getClipPreviewUrl,
} from '../api';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { Toggle } from '../components/ui/Toggle';
import {
  useCaptionPresetsQuery,
  useClipQuery,
  useRenderClipMutation,
  useUpdateClipMutation,
} from '../hooks/useClipCatQueries';
import { useEditorStore } from '../stores/editorStore';
import { useUiStore } from '../stores/uiStore';
import type {
  AspectRatio,
  CaptionFontSizeOption,
  CaptionPositionOption,
  OutputResolution,
  VideoLayoutMode,
} from '../types/project';
import { triggerVerifiedDownload } from '../utils/desktop';
import { formatDuration, formatPreciseTimestamp } from '../utils/format';
import { validateClipTrimRange } from '../utils/validation';

export function ClipEditorPage() {
  const { id: clipId } = useParams<{ id: string }>();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const clipQuery = useClipQuery(clipId);
  const presetsQuery = useCaptionPresetsQuery();
  const updateClipMutation = useUpdateClipMutation();
  const renderClipMutation = useRenderClipMutation();
  const { addToast } = useUiStore();

  const {
    title,
    description,
    startSec,
    endSec,
    aspectRatio,
    layoutMode,
    resolution,
    captionSettings,
    playbackSpeed,
    isDirty,
    loadFromClip,
    updateFields,
    updateCaptionSettings,
    setPlaybackSpeed,
    markSaved,
  } = useEditorStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [trimError, setTrimError] = useState<string | null>(null);
  const [advancedSheetOpen, setAdvancedSheetOpen] = useState(false);

  const clip = clipQuery.data;
  const presets = presetsQuery.data ?? DEFAULT_CAPTION_PRESETS;
  const previewUrl = clip ? getClipPreviewUrl(clip) : null;

  useEffect(() => {
    if (clip) {
      loadFromClip(clip);
      setVideoUnavailable(!getClipPreviewUrl(clip));
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [clip, loadFromClip]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const togglePlay = async () => {
    const vid = videoRef.current;
    if (!vid || videoUnavailable) return;
    if (vid.paused) {
      try {
        await vid.play();
        setIsPlaying(true);
      } catch {
        setVideoUnavailable(true);
      }
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (nextTime: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleVolumeChange = (nextVol: number) => {
    setVolume(nextVol);
    setMuted(nextVol === 0);
    if (videoRef.current) {
      videoRef.current.volume = nextVol;
      videoRef.current.muted = nextVol === 0;
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
  };

  const handleFullscreen = () => {
    const vid = videoRef.current;
    if (vid?.requestFullscreen) {
      vid.requestFullscreen();
    }
  };

  const handleSaveMetadata = async () => {
    if (!clip) return;
    const trimValidation = validateClipTrimRange(startSec, endSec);
    if (!trimValidation.valid) {
      setTrimError(trimValidation.error ?? 'Invalid trim range.');
      return;
    }
    setTrimError(null);
    try {
      await updateClipMutation.mutateAsync({
        clipId: clip.id,
        payload: {
          title,
          description,
          startSec,
          endSec,
          aspectRatio,
          layoutMode,
          resolution,
          captionSettings,
        },
      });
      markSaved();
      addToast({ variant: 'success', title: 'Clip Changes Saved' });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unable to save clip.',
      });
    }
  };

  const handleRerender = async () => {
    if (!clip) return;
    const trimValidation = validateClipTrimRange(startSec, endSec);
    if (!trimValidation.valid) {
      setTrimError(trimValidation.error ?? 'Invalid trim range.');
      return;
    }
    setTrimError(null);
    try {
      await renderClipMutation.mutateAsync({
        clipId: clip.id,
        payload: {
          startSec,
          endSec,
          aspectRatio,
          layoutMode,
          resolution,
          captionSettings,
        },
      });
      markSaved();
      addToast({
        variant: 'success',
        title: 'Re-render Requested',
        description: 'Clip rendering updated with your latest trim and caption settings.',
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Re-render Failed',
        description: err instanceof Error ? err.message : 'Unable to re-render clip.',
      });
    }
  };

  const handleDownload = async () => {
    if (!clip) return;
    const url = getClipDownloadUrl(clip);
    if (!url) {
      addToast({
        variant: 'warning',
        title: 'Download Unavailable',
        description: 'Connect the FastAPI backend to download rendered MP4 exports.',
      });
      return;
    }
    const res = await triggerVerifiedDownload(url, `${title.replace(/\s+/g, '_')}.mp4`);
    if (!res.started) {
      addToast({ variant: 'error', title: 'Download Failed', description: res.error });
    }
  };

  if (clipQuery.isLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Skeleton className="h-[520px] xl:col-span-3" />
        <Skeleton className="h-[520px] xl:col-span-5" />
        <Skeleton className="h-[520px] xl:col-span-4" />
      </div>
    );
  }

  if (clipQuery.isError || !clip) {
    return (
      <div className="space-y-4">
        <Link to="/clips">
          <Button variant="secondary" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            Back to Clip Library
          </Button>
        </Link>
        <ErrorState
          error={clipQuery.error ?? new Error('Clip not found.')}
          onRetry={() => clipQuery.refetch()}
        />
      </div>
    );
  }

  const aspectFrameClass =
    aspectRatio === '9:16'
      ? 'aspect-[9/16] max-h-[460px]'
      : aspectRatio === '1:1'
        ? 'aspect-square max-h-[420px]'
        : 'aspect-video w-full';

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
          <Link to={`/projects/${clip.projectId}/clips`}>
            <Button variant="secondary" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
          </Link>
          <span className="xl:hidden font-display text-sm font-bold text-ios-label truncate max-w-[160px] sm:max-w-xs">
            {title || clip.title}
          </span>
          <StatusIndicator status={clip.status} />
          {isDirty ? (
            <span className="text-xs text-ios-orange font-medium">Unsaved edits</span>
          ) : (
            <span className="text-xs text-ios-secondary">Saved</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 sm:flex-initial"
            loading={updateClipMutation.isPending}
            icon={<Save className="w-3.5 h-3.5" />}
            onClick={handleSaveMetadata}
          >
            Save Draft
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="hidden sm:inline-flex"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={handleDownload}
          >
            Download
          </Button>
          <Button
            variant="accent-purple"
            size="sm"
            className="flex-1 sm:flex-initial"
            loading={renderClipMutation.isPending}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={handleRerender}
          >
            Re-render Clip
          </Button>
          <Link to={`/publish/${clip.id}`} className="flex-1 sm:flex-initial">
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              icon={<Send className="w-3.5 h-3.5" />}
            >
              Publish
            </Button>
          </Link>
        </div>
      </div>

      {/* 3-Column Studio Editor (Preview ordered first on mobile) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* LEFT (3rd on mobile): Clip Info & AI Scoring Breakdown */}
        <section className="order-3 xl:order-1 xl:col-span-3 min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-4 sm:p-5 space-y-5">
          <div className="space-y-3">
            <h2 className="font-display text-base font-bold text-ios-label">
              Clip Information
            </h2>
            <Input
              label="Clip Title"
              value={title}
              onChange={(e) => updateFields({ title: e.target.value })}
            />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="clip-description-textarea"
                className="text-sm font-medium text-ios-label"
              >
                Description
              </label>
              <textarea
                id="clip-description-textarea"
                rows={3}
                value={description}
                onChange={(e) => updateFields({ description: e.target.value })}
                className="w-full rounded-lg bg-ios-input p-3 text-sm text-ios-label border border-ios-sep focus:border-ios-blue focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
              <div className="min-w-0 rounded-lg bg-ios-bg border border-ios-sep p-2.5">
                <p className="text-ios-secondary">Source Range</p>
                <p className="font-mono tabular-nums text-ios-label mt-0.5">
                  {formatDuration(startSec)} – {formatDuration(endSec)}
                </p>
              </div>
              <div className="min-w-0 rounded-lg bg-ios-bg border border-ios-sep p-2.5">
                <p className="text-ios-secondary">Clip Length</p>
                <p className="font-mono tabular-nums text-ios-label mt-0.5">
                  {formatDuration(Math.max(0, endSec - startSec))}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-ios-sep space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ios-label">
                AI Scoring Breakdown
              </h3>
              <span className="font-mono tabular-nums text-sm font-semibold text-ios-blue">
                {clip.aiScore}/100
              </span>
            </div>
            <p className="text-xs text-ios-secondary leading-relaxed">
              {clip.scoringBreakdown.summary}
            </p>
            <div className="space-y-2.5">
              {clip.scoringBreakdown.factors.map((factor) => (
                <div key={factor.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ios-label font-medium">{factor.label}</span>
                    <span className="font-mono tabular-nums text-ios-secondary">
                      {factor.score}/{factor.maxScore}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ios-bg overflow-hidden">
                    <div
                      className="h-full bg-ios-blue-fill"
                      style={{ width: `${(factor.score / factor.maxScore) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-ios-secondary">{factor.explanation}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ios-secondary pt-1">
              {clip.scoringBreakdown.disclaimer}
            </p>
          </div>
        </section>

        {/* CENTER (1st on mobile): Real HTML5 Video Preview & Transport Controls */}
        <section className="order-1 xl:order-2 xl:col-span-5 min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-bold text-ios-label">
              Video Preview
            </h2>
            <div
              role="group"
              aria-label="Preview aspect ratio"
              className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-ios-bg border border-ios-sep"
            >
              {(['9:16', '16:9', '1:1'] as AspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => updateFields({ aspectRatio: ratio })}
                  className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer transition-colors ${
                    aspectRatio === ratio
                      ? 'bg-ios-blue-fill text-white'
                      : 'text-ios-secondary hover:text-ios-label'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-ios-bg border border-ios-sep p-4 flex items-center justify-center min-h-[300px] sm:min-h-[360px]">
            {previewUrl && !videoUnavailable ? (
              <video
                ref={videoRef}
                src={previewUrl}
                preload="metadata"
                onLoadedMetadata={(e) => {
                  setVideoDuration(e.currentTarget.duration || clip.durationSec);
                }}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onEnded={() => setIsPlaying(false)}
                onError={() => setVideoUnavailable(true)}
                className={`${aspectFrameClass} rounded-lg bg-black object-contain`}
              />
            ) : (
              <div
                className={`${aspectFrameClass} w-full max-w-[320px] rounded-lg bg-ios-surface border border-ios-sep p-6 flex flex-col items-center justify-center text-center gap-3`}
              >
                <Film className="w-9 h-9 text-ios-secondary" />
                <div className="space-y-1">
                  <p className="font-display text-sm font-bold text-ios-label">
                    Video Stream Unavailable
                  </p>
                  <p className="text-xs text-ios-secondary leading-relaxed">
                    No playable preview stream is currently returned by the backend for this clip. Connect the Python FastAPI preview endpoint to stream rendered frames.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Custom Playback Controls */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-mono tabular-nums text-ios-secondary w-12 sm:w-14 shrink-0">
                {formatPreciseTimestamp(currentTime)}
              </span>
              <input
                type="range"
                aria-label="Seek video timeline"
                min={0}
                max={videoDuration || clip.durationSec || 1}
                step={0.1}
                value={currentTime}
                disabled={videoUnavailable}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="flex-1 min-w-0 accent-ios-blue-fill cursor-pointer disabled:opacity-40"
              />
              <span className="text-xs font-mono tabular-nums text-ios-secondary w-12 sm:w-14 text-right shrink-0">
                {formatPreciseTimestamp(videoDuration || clip.durationSec)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={videoUnavailable}
                  aria-label={isPlaying ? 'Pause video' : 'Play video'}
                  icon={
                    isPlaying ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )
                  }
                  onClick={togglePlay}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>

                <button
                  type="button"
                  onClick={handleToggleMute}
                  disabled={videoUnavailable}
                  aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                  className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 rounded-lg bg-ios-tertiary border border-ios-sep text-ios-label disabled:opacity-40 cursor-pointer flex items-center justify-center"
                >
                  {muted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  aria-label="Volume"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  disabled={videoUnavailable}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-16 sm:w-20 accent-ios-blue-fill cursor-pointer disabled:opacity-40"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  aria-label="Playback speed"
                  value={playbackSpeed}
                  disabled={videoUnavailable}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="h-11 sm:h-8 rounded-lg bg-ios-input border border-ios-sep px-2 text-xs font-mono text-ios-label disabled:opacity-40"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2.0x</option>
                </select>
                <button
                  type="button"
                  onClick={handleFullscreen}
                  disabled={videoUnavailable}
                  aria-label="Fullscreen preview"
                  className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 rounded-lg bg-ios-tertiary border border-ios-sep text-ios-label disabled:opacity-40 cursor-pointer flex items-center justify-center"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT (2nd on mobile): Trim, Caption, Layout & Export Controls */}
        <section className="order-2 xl:order-3 xl:col-span-4 min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-4 sm:p-5 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-ios-label">
                Trim Timing (seconds)
              </h2>
              <span className="text-xs font-mono tabular-nums text-ios-secondary">
                {formatDuration(Math.max(0, endSec - startSec))} clip
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Input
                  label="Clip Start (sec)"
                  type="number"
                  min={0}
                  step={0.5}
                  value={startSec}
                  onChange={(e) => updateFields({ startSec: Number(e.target.value) })}
                />
                <div className="flex items-center gap-1.5 sm:hidden">
                  <button
                    type="button"
                    aria-label="Trim start back 0.5 seconds"
                    onClick={() => updateFields({ startSec: Math.max(0, startSec - 0.5) })}
                    className="flex-1 min-h-[44px] rounded-lg bg-ios-bg border border-ios-sep text-xs font-mono text-ios-label flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>0.5s</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Trim start forward 0.5 seconds"
                    onClick={() => updateFields({ startSec: startSec + 0.5 })}
                    className="flex-1 min-h-[44px] rounded-lg bg-ios-bg border border-ios-sep text-xs font-mono text-ios-label flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>0.5s</span>
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Input
                  label="Clip End (sec)"
                  type="number"
                  min={1}
                  step={0.5}
                  value={endSec}
                  onChange={(e) => updateFields({ endSec: Number(e.target.value) })}
                />
                <div className="flex items-center gap-1.5 sm:hidden">
                  <button
                    type="button"
                    aria-label="Trim end back 0.5 seconds"
                    onClick={() => updateFields({ endSec: Math.max(1, endSec - 0.5) })}
                    className="flex-1 min-h-[44px] rounded-lg bg-ios-bg border border-ios-sep text-xs font-mono text-ios-label flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>0.5s</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Trim end forward 0.5 seconds"
                    onClick={() => updateFields({ endSec: endSec + 0.5 })}
                    className="flex-1 min-h-[44px] rounded-lg bg-ios-bg border border-ios-sep text-xs font-mono text-ios-label flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>0.5s</span>
                  </button>
                </div>
              </div>
            </div>
            {trimError && (
              <p role="alert" className="text-xs text-ios-red">
                {trimError}
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-ios-sep space-y-4">
            <h3 className="font-display text-sm font-bold text-ios-label">
              Caption Settings
            </h3>
            <Toggle
              checked={captionSettings.enabled}
              onChange={(checked) => updateCaptionSettings({ enabled: checked })}
              label="Enable Captions"
            />
            <div
              className={`space-y-3 ${
                !captionSettings.enabled ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {/* Horizontally Scrollable Caption Preset Previews */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-ios-secondary">
                  Preset Style (swipe to preview)
                </span>
                <div
                  role="listbox"
                  aria-label="Caption preset swatches"
                  className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-1 snap-x"
                >
                  {presets.map((preset) => {
                    const selected = captionSettings.presetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() =>
                          updateCaptionSettings({
                            presetId: preset.id,
                            highlightColor: preset.highlightColor,
                          })
                        }
                        className={`snap-start shrink-0 min-w-[116px] min-h-[56px] rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[var(--ios-blue-tint)] border-ios-blue'
                            : 'bg-ios-bg border-ios-sep hover:border-ios-sep-strong'
                        }`}
                      >
                        <p
                          className="text-sm font-extrabold tracking-tight leading-none"
                          style={{ color: preset.highlightColor }}
                        >
                          Aa
                        </p>
                        <p className="text-[11px] font-medium text-ios-label mt-1.5 truncate max-w-[100px]">
                          {preset.name}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Font Size"
                  value={captionSettings.fontSize}
                  onChange={(e) =>
                    updateCaptionSettings({
                      fontSize: e.target.value as CaptionFontSizeOption,
                    })
                  }
                  options={[
                    { value: 'small', label: 'Small' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'large', label: 'Large' },
                  ]}
                />
                <Select
                  label="Position"
                  value={captionSettings.position}
                  onChange={(e) =>
                    updateCaptionSettings({
                      position: e.target.value as CaptionPositionOption,
                    })
                  }
                  options={[
                    { value: 'top', label: 'Top' },
                    { value: 'center', label: 'Center' },
                    { value: 'bottom', label: 'Bottom' },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ios-label">Highlight Colour</span>
                  <span className="font-mono text-ios-secondary">
                    {captionSettings.highlightColor ??
                      presets.find((p) => p.id === captionSettings.presetId)?.highlightColor ??
                      '#64D2FF'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { hex: '#64D2FF', label: 'Electric Blue' },
                    { hex: '#AF52DE', label: 'Lavender' },
                    { hex: '#5856D6', label: 'Deep Purple' },
                    { hex: '#FF9F0A', label: 'Warm Orange' },
                    { hex: '#FFD60A', label: 'Bold Yellow' },
                    { hex: '#30D158', label: 'Mint Green' },
                  ].map((swatch) => {
                    const activeColor =
                      captionSettings.highlightColor ??
                      presets.find((p) => p.id === captionSettings.presetId)?.highlightColor ??
                      '#64D2FF';
                    const isSelected = activeColor.toUpperCase() === swatch.hex;
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        aria-label={`Set caption highlight colour to ${swatch.label}`}
                        aria-pressed={isSelected}
                        title={swatch.label}
                        onClick={() => updateCaptionSettings({ highlightColor: swatch.hex })}
                        className={`min-w-[44px] min-h-[44px] sm:min-w-[34px] sm:min-h-[34px] rounded-lg border flex items-center justify-center cursor-pointer transition-transform active:scale-95 ${
                          isSelected
                            ? 'border-ios-label ring-2 ring-ios-blue/40 bg-ios-bg'
                            : 'border-ios-sep bg-ios-bg hover:border-ios-sep-strong'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full border border-white/20"
                          style={{ backgroundColor: swatch.hex }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
              <Toggle
                checked={captionSettings.highlightKeywords}
                onChange={(checked) =>
                  updateCaptionSettings({ highlightKeywords: checked })
                }
                label="Highlight Keywords"
              />
              <Toggle
                checked={captionSettings.speakerLabels}
                onChange={(checked) =>
                  updateCaptionSettings({ speakerLabels: checked })
                }
                label="Speaker Labels"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-ios-sep space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-ios-label">
                Layout &amp; Export Settings
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="sm:hidden"
                icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
                onClick={() => setAdvancedSheetOpen(true)}
              >
                Sheet
              </Button>
            </div>
            <div className="hidden sm:block space-y-3">
              <Select
                label="Video Layout"
                value={layoutMode}
                onChange={(e) =>
                  updateFields({ layoutMode: e.target.value as VideoLayoutMode })
                }
                options={[
                  { value: 'smart_face_tracking', label: 'Smart Face Tracking' },
                  { value: 'center_crop', label: 'Center Crop' },
                  { value: 'blurred_background', label: 'Blurred Background' },
                  { value: 'split_screen', label: 'Split Screen' },
                ]}
              />
              <Select
                label="Output Resolution"
                value={resolution}
                onChange={(e) =>
                  updateFields({ resolution: e.target.value as OutputResolution })
                }
                options={[
                  { value: '1080p', label: '1080p MP4 (H.264)' },
                  { value: '720p', label: '720p MP4 (H.264)' },
                ]}
              />
            </div>
            <div className="sm:hidden flex items-center justify-between rounded-lg bg-ios-bg border border-ios-sep p-3 text-xs">
              <span className="text-ios-secondary">
                {layoutMode.replace(/_/g, ' ')} · {resolution}
              </span>
              <button
                type="button"
                onClick={() => setAdvancedSheetOpen(true)}
                className="text-ios-blue font-medium cursor-pointer"
              >
                Edit
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile Bottom Sheet for Advanced Layout, Highlight Color & Download */}
      <BottomSheet
        open={advancedSheetOpen}
        onClose={() => setAdvancedSheetOpen(false)}
        title="Advanced Framing & Export"
        description="Configure layout mode, output resolution, and direct download."
        footer={
          <Button className="w-full sm:w-auto" onClick={() => setAdvancedSheetOpen(false)}>
            Done
          </Button>
        }
      >
        <Select
          label="Video Layout"
          value={layoutMode}
          onChange={(e) =>
            updateFields({ layoutMode: e.target.value as VideoLayoutMode })
          }
          options={[
            { value: 'smart_face_tracking', label: 'Smart Face Tracking' },
            { value: 'center_crop', label: 'Center Crop' },
            { value: 'blurred_background', label: 'Blurred Background' },
            { value: 'split_screen', label: 'Split Screen' },
          ]}
        />
        <Select
          label="Output Resolution"
          value={resolution}
          onChange={(e) =>
            updateFields({ resolution: e.target.value as OutputResolution })
          }
          options={[
            { value: '1080p', label: '1080p MP4 (H.264)' },
            { value: '720p', label: '720p MP4 (H.264)' },
          ]}
        />
        <Button
          variant="secondary"
          className="w-full"
          icon={<Download className="w-4 h-4" />}
          onClick={handleDownload}
        >
          Download Rendered MP4
        </Button>
      </BottomSheet>
    </div>
  );
}
