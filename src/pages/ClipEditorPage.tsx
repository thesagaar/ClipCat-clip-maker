import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Film,
  Maximize2,
  Pause,
  Play,
  RefreshCw,
  Save,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  DEFAULT_CAPTION_PRESETS,
  getClipDownloadUrl,
  getClipPreviewUrl,
} from '../api';
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <Link to={`/projects/${clip.projectId}/clips`}>
            <Button variant="secondary" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
              Back to Clips
            </Button>
          </Link>
          <StatusIndicator status={clip.status} />
          {isDirty && (
            <span className="text-xs text-ios-orange font-medium">Unsaved edits</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            loading={updateClipMutation.isPending}
            icon={<Save className="w-3.5 h-3.5" />}
            onClick={handleSaveMetadata}
          >
            Save Draft
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={handleDownload}
          >
            Download
          </Button>
          <Button
            size="sm"
            loading={renderClipMutation.isPending}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={handleRerender}
          >
            Re-render Clip
          </Button>
        </div>
      </div>

      {/* 3-Column Studio Editor */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT: Clip Info & AI Scoring Breakdown */}
        <section className="xl:col-span-3 min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-5">
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

        {/* CENTER: Real HTML5 Video Preview & Transport Controls */}
        <section className="xl:col-span-5 min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-4">
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
                  className="p-2 rounded-lg bg-ios-tertiary border border-ios-sep text-ios-label disabled:opacity-40 cursor-pointer"
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
                  className="w-20 accent-ios-blue-fill cursor-pointer disabled:opacity-40"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  aria-label="Playback speed"
                  value={playbackSpeed}
                  disabled={videoUnavailable}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="h-8 rounded-lg bg-ios-input border border-ios-sep px-2 text-xs font-mono text-ios-label disabled:opacity-40"
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
                  className="p-2 rounded-lg bg-ios-tertiary border border-ios-sep text-ios-label disabled:opacity-40 cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT: Trim, Caption, Layout & Export Controls */}
        <section className="xl:col-span-4 min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-6">
          <div className="space-y-3">
            <h2 className="font-display text-base font-bold text-ios-label">
              Trim Timing (seconds)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Clip Start (sec)"
                type="number"
                min={0}
                step={0.5}
                value={startSec}
                onChange={(e) => updateFields({ startSec: Number(e.target.value) })}
              />
              <Input
                label="Clip End (sec)"
                type="number"
                min={1}
                step={0.5}
                value={endSec}
                onChange={(e) => updateFields({ endSec: Number(e.target.value) })}
              />
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
              <Select
                label="Caption Style"
                value={captionSettings.presetId}
                onChange={(e) => updateCaptionSettings({ presetId: e.target.value })}
                options={presets.map((p) => ({ value: p.id, label: p.name }))}
              />
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
            <h3 className="font-display text-sm font-bold text-ios-label">
              Layout & Export Settings
            </h3>
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
        </section>
      </div>
    </div>
  );
}
