import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Combine,
  Download,
  FileCode2,
  FileText,
  Film,
  Flame,
  FolderPlus,
  Image as ImageIcon,
  Layers,
  Play,
  RefreshCw,
  RotateCcw,
  Scissors,
  Sliders,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useQueryClient } from '@tanstack/react-query';
import {
  cancelChatSpikeJob,
  createChatSpikeJob,
  getChatSpikeCapabilities,
  getChatSpikeJob,
  mergeChatSpikeCandidates,
  regenerateChatSpikeCandidate,
  saveChatSpikeToLibrary,
  startChatSpikeProcessing,
  updateChatSpikeCandidate,
  updateChatSpikeConfig,
  uploadChatSpikeLog,
  uploadChatSpikeVideo,
  type ChatSpikeCapabilities,
} from '../api/chatspike';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { Toggle } from '../components/ui/Toggle';
import { queryKeys } from '../hooks/useClipCatQueries';
import { HEURISTIC_ENGAGEMENT_DISCLAIMER } from '../intelligence/engagementScorer';
import { createDefaultDetectionConfig } from '../intelligence/spikeDetector';
import type {
  ChatSpikeCandidate,
  ChatSpikeDetectionConfig,
  ChatSpikeJob,
  RollingSecondBucket,
  SpikeSensitivity,
} from '../intelligence/types';
import { useUiStore } from '../stores/uiStore';
import type { AspectRatio, OutputResolution } from '../types/project';
import { triggerVerifiedDownload } from '../utils/desktop';
import { formatBytes, formatDuration } from '../utils/format';

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_LABELS: ReadonlyArray<{ step: WizardStep; label: string }> = [
  { step: 1, label: 'Source' },
  { step: 2, label: 'Detection' },
  { step: 3, label: 'Processing' },
  { step: 4, label: 'Results' },
  { step: 5, label: 'Review' },
  { step: 6, label: 'Export' },
];

function downsampleTimeseries(
  buckets: readonly RollingSecondBucket[],
  maxPoints = 180
): RollingSecondBucket[] {
  if (buckets.length <= maxPoints) return [...buckets];
  const stride = Math.ceil(buckets.length / maxPoints);
  const sampled: RollingSecondBucket[] = [];
  for (let i = 0; i < buckets.length; i += stride) {
    const slice = buckets.slice(i, i + stride);
    const peak = slice.reduce((best, cur) =>
      cur.filteredMessages > best.filteredMessages ? cur : best
    );
    sampled.push(peak);
  }
  return sampled;
}

export function ChatSpikePage() {
  const queryClient = useQueryClient();
  const { smartFramingAspectRatio, addToast } = useUiStore();

  const [step, setStep] = useState<WizardStep>(1);
  const [capabilities, setCapabilities] = useState<ChatSpikeCapabilities | null>(null);
  const [job, setJob] = useState<ChatSpikeJob | null>(null);
  const [projectName, setProjectName] = useState('ChatSpike Highlight Session');
  const [config, setConfig] = useState<ChatSpikeDetectionConfig>(() => ({
    ...createDefaultDetectionConfig(),
    aspectRatio: smartFramingAspectRatio,
  }));

  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadPct, setVideoUploadPct] = useState(0);
  const [chatUploading, setChatUploading] = useState(false);
  const [isApplyingConfig, setIsApplyingConfig] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [editingDrafts, setEditingDrafts] = useState<
    Record<
      string,
      {
        title: string;
        startSec: string;
        endSec: string;
        aspectRatio: AspectRatio;
        resolution: OutputResolution;
        captionsEnabled: boolean;
        captionsSrt: string;
        showCaptionsEditor: boolean;
      }
    >
  >({});

  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const jobInitPromiseRef = useRef<Promise<ChatSpikeJob> | null>(null);

  useEffect(() => {
    let active = true;
    getChatSpikeCapabilities()
      .then((cap) => {
        if (active) setCapabilities(cap);
      })
      .catch(() => {
        // Handled cleanly if Express routes aren't active
      });
    return () => {
      active = false;
    };
  }, []);

  // Poll running ChatSpike job every 1s until terminal state
  useEffect(() => {
    if (!job || job.status !== 'running') return;
    const timer = window.setInterval(async () => {
      try {
        const fresh = await getChatSpikeJob(job.id);
        setJob(fresh);
        if (fresh.status === 'completed') {
          addToast({
            variant: 'success',
            title: 'ChatSpike Extraction Complete',
            description: `Generated ${fresh.candidates.filter((c) => c.renderStatus === 'ready').length} clip candidate(s).`,
          });
          setStep(4);
        } else if (fresh.status === 'failed') {
          addToast({
            variant: 'error',
            title: 'ChatSpike Processing Failed',
            description: fresh.errorMessage ?? 'Processing error.',
          });
        } else if (fresh.status === 'cancelled') {
          addToast({
            variant: 'info',
            title: 'Processing Cancelled',
            description: 'FFmpeg extraction halted and temporary files cleaned.',
          });
        }
      } catch {
        // transient poll hiccup ignored
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status, addToast]);

  // Synchronize per-candidate editable form drafts whenever candidates change
  useEffect(() => {
    if (!job) return;
    setEditingDrafts((prev) => {
      const next = { ...prev };
      for (const c of job.candidates) {
        if (!next[c.id]) {
          next[c.id] = {
            title: c.title,
            startSec: String(c.startSec),
            endSec: String(c.endSec),
            aspectRatio: c.aspectRatio,
            resolution: c.resolution,
            captionsEnabled: c.captionsEnabled,
            captionsSrt: c.captionsSrt,
            showCaptionsEditor: false,
          };
        }
      }
      return next;
    });
  }, [job?.candidates]);

  const ensureJobExists = async (): Promise<ChatSpikeJob> => {
    if (job) return job;
    if (!jobInitPromiseRef.current) {
      jobInitPromiseRef.current = createChatSpikeJob({
        projectName: projectName.trim() || 'ChatSpike Highlight Session',
        config,
      })
        .then((created) => {
          setJob((prev) => prev ?? created);
          return created;
        })
        .catch((err) => {
          jobInitPromiseRef.current = null;
          throw err;
        });
    }
    return jobInitPromiseRef.current;
  };

  const handleVideoFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setErrorBanner(null);
    setVideoUploading(true);
    setVideoUploadPct(0);
    const controller = new AbortController();
    uploadAbortRef.current = controller;

    try {
      const currentJob = await ensureJobExists();
      const updated = await uploadChatSpikeVideo({
        jobId: currentJob.id,
        file,
        onProgress: (pct) => setVideoUploadPct(pct),
        signal: controller.signal,
      });
      setJob(updated);
      addToast({
        variant: 'success',
        title: 'Video Verified (FFprobe)',
        description: `${file.name} (${formatDuration(updated.video?.durationSec ?? null)})`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Video upload failed.';
      setErrorBanner(msg);
      addToast({ variant: 'error', title: 'Video Upload Rejected', description: msg });
    } finally {
      setVideoUploading(false);
      uploadAbortRef.current = null;
    }
  };

  const handleChatFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setErrorBanner(null);
    setChatUploading(true);
    try {
      const text = await file.text();
      const currentJob = await ensureJobExists();
      const updated = await uploadChatSpikeLog({
        jobId: currentJob.id,
        filename: file.name,
        content: text,
      });
      setJob(updated);
      addToast({
        variant: 'success',
        title: 'Chat Log Parsed',
        description: `${updated.chatSummary?.validEvents ?? 0} messages parsed (${updated.chatSummary?.format.toUpperCase()})`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Chat log import failed.';
      setErrorBanner(msg);
      addToast({ variant: 'error', title: 'Chat Import Error', description: msg });
    } finally {
      setChatUploading(false);
    }
  };

  const handleApplyOffsetsOrConfig = async () => {
    if (!job) return;
    setIsApplyingConfig(true);
    setErrorBanner(null);
    try {
      const updated = await updateChatSpikeConfig(job.id, { projectName, config });
      setJob(updated);
      addToast({
        variant: 'info',
        title: 'Configuration Updated',
        description: updated.chatSummary
          ? `${updated.chatSummary.validEvents} chat messages aligned (${updated.chatSummary.alignmentConfidence} confidence).`
          : 'Detection settings saved.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to update settings.';
      setErrorBanner(msg);
      addToast({ variant: 'error', title: 'Update Failed', description: msg });
    } finally {
      setIsApplyingConfig(false);
    }
  };

  const handleStartProcessing = async () => {
    if (!job) return;
    setErrorBanner(null);
    try {
      const updated = await updateChatSpikeConfig(job.id, { projectName, config });
      setJob(updated);
      const started = await startChatSpikeProcessing(updated.id, config);
      setJob(started);
      setStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to start ChatSpike processing.';
      setErrorBanner(msg);
      addToast({ variant: 'error', title: 'Processing Blocked', description: msg });
    }
  };

  const handleCancelProcessing = async () => {
    if (!job) return;
    try {
      const cancelled = await cancelChatSpikeJob(job.id);
      setJob(cancelled);
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Cancel Failed',
        description: err instanceof Error ? err.message : 'Unable to cancel job.',
      });
    }
  };

  const handleSetCandidateStatus = async (
    candidateId: string,
    status: 'approved' | 'rejected' | 'pending'
  ) => {
    if (!job) return;
    try {
      const updated = await updateChatSpikeCandidate(job.id, candidateId, { status });
      setJob(updated);
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Unable to update approval status.',
      });
    }
  };

  const handleRegenerateCandidate = async (cand: ChatSpikeCandidate) => {
    if (!job) return;
    const draft = editingDrafts[cand.id];
    const startSec = Number(draft?.startSec ?? cand.startSec);
    const endSec = Number(draft?.endSec ?? cand.endSec);

    setRegeneratingId(cand.id);
    try {
      await updateChatSpikeCandidate(job.id, cand.id, {
        title: draft?.title ?? cand.title,
        captionsEnabled: draft?.captionsEnabled ?? cand.captionsEnabled,
        captionsSrt: draft?.captionsSrt ?? cand.captionsSrt,
      });
      const updated = await regenerateChatSpikeCandidate(job.id, cand.id, {
        startSec: Number.isFinite(startSec) ? startSec : cand.startSec,
        endSec: Number.isFinite(endSec) ? endSec : cand.endSec,
        aspectRatio: draft?.aspectRatio ?? cand.aspectRatio,
        resolution: draft?.resolution ?? cand.resolution,
      });
      setJob(updated);
      addToast({
        variant: 'success',
        title: 'Clip Re-cut with FFmpeg',
        description: `Updated "${draft?.title ?? cand.title}" (${(draft?.aspectRatio ?? cand.aspectRatio)}).`,
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Regeneration Failed',
        description: err instanceof Error ? err.message : 'FFmpeg re-cut failed.',
      });
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleSaveCaptionsOnly = async (cand: ChatSpikeCandidate) => {
    if (!job) return;
    const draft = editingDrafts[cand.id];
    if (!draft) return;
    try {
      const updated = await updateChatSpikeCandidate(job.id, cand.id, {
        title: draft.title,
        captionsEnabled: draft.captionsEnabled,
        captionsSrt: draft.captionsSrt,
      });
      setJob(updated);
      addToast({ variant: 'success', title: 'Captions Saved', description: 'SRT & VTT updated.' });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Save Captions Failed',
        description: err instanceof Error ? err.message : 'Unable to save captions.',
      });
    }
  };

  const handleMergeSelected = async () => {
    if (!job || selectedForMerge.length < 2) return;
    setIsMerging(true);
    try {
      const updated = await mergeChatSpikeCandidates(job.id, selectedForMerge);
      setJob(updated);
      setSelectedForMerge([]);
      addToast({
        variant: 'success',
        title: 'Merged Clips & Re-cut MP4',
        description: 'Merged candidate preserves all constituent spike peaks.',
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Merge Failed',
        description: err instanceof Error ? err.message : 'Unable to merge clips.',
      });
    } finally {
      setIsMerging(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!job) return;
    setSavingToLibrary(true);
    try {
      const res = await saveChatSpikeToLibrary(job.id);
      const refreshed = await getChatSpikeJob(job.id);
      setJob(refreshed);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.clips });
      addToast({
        variant: 'success',
        title: 'Saved to ClipCat Library',
        description: `${res.clips.length} approved clip${res.clips.length === 1 ? '' : 's'} now available in Clip Library & Export Manager.`,
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Save to Library Failed',
        description: err instanceof Error ? err.message : 'Approve at least one clip first.',
      });
    } finally {
      setSavingToLibrary(false);
    }
  };

  const handleResetSession = () => {
    if (uploadAbortRef.current) uploadAbortRef.current.abort();
    jobInitPromiseRef.current = null;
    setJob(null);
    setSelectedForMerge([]);
    setEditingDrafts({});
    setErrorBanner(null);
    setStep(1);
    setConfig({
      ...createDefaultDetectionConfig(),
      aspectRatio: smartFramingAspectRatio,
    });
  };

  const chartData = useMemo(
    () => downsampleTimeseries(job?.timeseries ?? []),
    [job?.timeseries]
  );

  const readySource = Boolean(job?.video && job?.chatSummary && job.chatSummary.validEvents > 0);
  const candidates = job?.candidates ?? [];
  const approvedCandidates = candidates.filter(
    (c) => c.status === 'approved' && c.renderStatus === 'ready'
  );

  return (
    <div className="space-y-6 w-full">
      {/* Feature Header */}
      <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#7040DC]/20 border border-[#7040DC]/40 text-[#C8B9F1] flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4" />
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-ios-label">
              ChatSpike Intelligence
            </h2>
          </div>
          <p className="text-sm text-ios-secondary">
            Find audience reaction moments and automatically turn them into clips.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {job && (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={handleResetSession}
            >
              New Session
            </Button>
          )}
          <Link to="/clips">
            <Button variant="secondary" size="sm" icon={<Film className="w-3.5 h-3.5" />}>
              Clip Library
            </Button>
          </Link>
        </div>
      </section>

      {/* 6-Step Progress Stepper */}
      <nav
        aria-label="ChatSpike workflow steps"
        className="rounded-xl bg-ios-surface border border-ios-sep p-2 sm:p-3 overflow-x-auto"
      >
        <ol className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 min-w-[460px]">
          {STEP_LABELS.map((item) => {
            const isCurrent = step === item.step;
            const canJump =
              item.step === 1 ||
              (item.step === 2 && readySource) ||
              (item.step === 3 && Boolean(job && (job.status === 'running' || job.timeseries.length > 0))) ||
              (item.step >= 4 && Boolean(job && job.status === 'completed'));

            return (
              <li key={item.step}>
                <button
                  type="button"
                  disabled={!canJump}
                  onClick={() => canJump && setStep(item.step)}
                  data-testid={`chatspike-step-${item.step}`}
                  className={`w-full flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors min-h-[40px] ${
                    isCurrent
                      ? 'bg-[#7040DC] text-white'
                      : canJump
                        ? 'text-ios-label bg-ios-bg hover:bg-ios-tertiary cursor-pointer border border-ios-sep'
                        : 'text-ios-tertiary-label bg-ios-bg/40 border border-transparent cursor-not-allowed'
                  }`}
                >
                  <span className="font-mono tabular-nums">{item.step}.</span>
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {errorBanner && (
        <div
          role="alert"
          className="rounded-xl bg-[var(--ios-red-tint)] border border-[var(--ios-red-border)] px-4 py-3 text-xs text-ios-red flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* STEP 1: SOURCE & ALIGNMENT */}
      {step === 1 && (
        <div className="space-y-6">
          <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-4">
            <Input
              label="Session / Project Title"
              value={projectName}
              maxLength={100}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Championship Stream Highlights"
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
              {/* Video Upload */}
              <div className="rounded-xl bg-ios-bg border border-ios-sep p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-ios-label">
                      1. Source Video
                    </h3>
                    <p className="text-xs text-ios-secondary mt-0.5">
                      MP4, MOV, MKV, or WEBM verified locally with FFprobe.
                    </p>
                  </div>
                  {job?.video && <StatusIndicator status="completed" customLabel="Verified" />}
                </div>

                <input
                  ref={videoInputRef}
                  type="file"
                  accept=".mp4,.mov,.mkv,.webm,video/mp4,video/quicktime,video/x-matroska,video/webm"
                  data-testid="chatspike-video-input"
                  className="sr-only"
                  onChange={(e) => {
                    void handleVideoFileSelected(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />

                <div className="rounded-lg border border-dashed border-ios-sep bg-ios-surface/60 p-5 text-center space-y-3">
                  <Upload className="w-7 h-7 text-ios-blue mx-auto" aria-hidden="true" />
                  <p className="text-xs text-ios-secondary">
                    {job?.video
                      ? `Loaded: ${job.video.originalFilename}`
                      : 'Choose a recorded VOD or highlight video file from your computer.'}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={videoUploading}
                    onClick={() => videoInputRef.current?.click()}
                  >
                    {job?.video ? 'Replace Video' : 'Select Video File'}
                  </Button>
                  {videoUploading && (
                    <div className="space-y-1">
                      <div className="h-2 w-full rounded-full bg-ios-bg overflow-hidden border border-ios-sep">
                        <div
                          className="h-full bg-[#7040DC] transition-all"
                          style={{ width: `${videoUploadPct}%` }}
                        />
                      </div>
                      <p className="text-[11px] font-mono text-ios-secondary tabular-nums">
                        Uploading... {videoUploadPct}%
                      </p>
                    </div>
                  )}
                </div>

                {job?.video && (
                  <dl className="grid grid-cols-2 gap-2.5 text-xs pt-1">
                    <div className="rounded-lg bg-ios-surface border border-ios-sep p-2.5">
                      <dt className="text-ios-secondary">Duration</dt>
                      <dd className="font-mono font-semibold text-ios-label tabular-nums">
                        {formatDuration(job.video.durationSec)}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-ios-surface border border-ios-sep p-2.5">
                      <dt className="text-ios-secondary">Resolution / Codec</dt>
                      <dd className="font-mono font-semibold text-ios-label tabular-nums">
                        {job.video.width}x{job.video.height} ({job.video.codec ?? 'video'})
                      </dd>
                    </div>
                  </dl>
                )}
              </div>

              {/* Chat Log Upload */}
              <div className="rounded-xl bg-ios-bg border border-ios-sep p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-ios-label">
                      2. Chat Replay Log
                    </h3>
                    <p className="text-xs text-ios-secondary mt-0.5">
                      Supports JSON, JSONL, CSV, and timestamped TXT chat exports (max 25 MB).
                    </p>
                  </div>
                  {job?.chatSummary && (
                    <StatusIndicator
                      status={job.chatSummary.validEvents > 0 ? 'completed' : 'needs_attention'}
                      customLabel={`${job.chatSummary.validEvents} Events`}
                    />
                  )}
                </div>

                <input
                  ref={chatInputRef}
                  type="file"
                  accept=".json,.jsonl,.ndjson,.csv,.txt,.log"
                  data-testid="chatspike-chat-input"
                  className="sr-only"
                  onChange={(e) => {
                    void handleChatFileSelected(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />

                <div className="rounded-lg border border-dashed border-ios-sep bg-ios-surface/60 p-5 text-center space-y-3">
                  <FileText className="w-7 h-7 text-[#64D2FF] mx-auto" aria-hidden="true" />
                  <p className="text-xs text-ios-secondary">
                    Import recorded chat messages containing timestamps, usernames, and text.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={chatUploading}
                    onClick={() => chatInputRef.current?.click()}
                  >
                    {job?.chatSummary ? 'Replace Chat Log' : 'Select Chat Log'}
                  </Button>
                </div>

                {job?.chatSummary && (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-ios-secondary">
                      <span>
                        Format:{' '}
                        <strong className="font-mono text-ios-label">
                          {job.chatSummary.format.toUpperCase()}
                        </strong>
                      </span>
                      <span>
                        Sync confidence:{' '}
                        <strong
                          className={
                            job.chatSummary.alignmentConfidence === 'high'
                              ? 'text-ios-green'
                              : job.chatSummary.alignmentConfidence === 'medium'
                                ? 'text-ios-orange'
                                : 'text-ios-red'
                          }
                        >
                          {job.chatSummary.alignmentConfidence.toUpperCase()}
                        </strong>
                      </span>
                    </div>
                    {job.chatSummary.alignmentNotes.length > 0 && (
                      <div className="rounded-lg bg-[var(--ios-orange-tint)] border border-[var(--ios-orange-border)] p-2.5 text-[11px] text-ios-orange space-y-1">
                        {job.chatSummary.alignmentNotes.map((note, idx) => (
                          <p key={idx}>{note}</p>
                        ))}
                      </div>
                    )}
                    {job.chatSummary.sampleEvents.length > 0 && (
                      <div className="rounded-lg bg-ios-surface border border-ios-sep p-2.5 space-y-1 max-h-32 overflow-y-auto font-mono text-[11px]">
                        {job.chatSummary.sampleEvents.slice(0, 4).map((ev, i) => (
                          <p key={i} className="truncate text-ios-secondary">
                            <span className="text-ios-blue">[{formatDuration(ev.timestampSec)}]</span>{' '}
                            <span className="text-ios-label">{ev.username}:</span> {ev.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Timestamp Alignment & Sync Controls */}
          <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-ios-label">
                  Timestamp Alignment &amp; Sync Controls
                </h3>
                <p className="text-xs text-ios-secondary mt-0.5">
                  Formula: <code className="font-mono text-ios-label">videoTime = rawChatTime + chatStartOffset - videoStartOffset + manualSyncOffset</code>
                </p>
              </div>
              {job && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={isApplyingConfig}
                  onClick={handleApplyOffsetsOrConfig}
                >
                  Re-Align Chat Timestamps
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Video Start Offset (sec)"
                type="number"
                value={config.videoStartOffsetSec}
                onChange={(e) =>
                  setConfig({ ...config, videoStartOffsetSec: Number(e.target.value) || 0 })
                }
              />
              <Input
                label="Chat Start Offset (sec)"
                type="number"
                value={config.chatStartOffsetSec}
                onChange={(e) =>
                  setConfig({ ...config, chatStartOffsetSec: Number(e.target.value) || 0 })
                }
              />
              <Input
                label="Manual Sync Adjustment (sec)"
                type="number"
                value={config.manualSyncOffsetSec}
                onChange={(e) =>
                  setConfig({ ...config, manualSyncOffsetSec: Number(e.target.value) || 0 })
                }
              />
            </div>
          </section>

          {/* Livestream Source Adapters Honesty Panel */}
          <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-3">
            <h3 className="font-display text-sm font-bold text-ios-label">
              Chat Source Adapters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {(capabilities?.chatSourceAdapters ?? []).map((adapter) => (
                <div
                  key={adapter.id}
                  className="rounded-lg bg-ios-bg border border-ios-sep p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ios-label">{adapter.platform}</span>
                    <StatusIndicator
                      status={adapter.availability === 'available' ? 'operational' : 'unavailable'}
                      customLabel={
                        adapter.availability === 'available' ? 'Active' : 'Offline Only'
                      }
                    />
                  </div>
                  <p className="text-[11px] text-ios-secondary leading-relaxed">
                    {adapter.availabilityNote}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end">
            <Button
              variant="accent-purple"
              size="lg"
              disabled={!readySource}
              onClick={() => setStep(2)}
              icon={<Sliders className="w-4 h-4" />}
            >
              Continue to Detection Settings
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: DETECTION SETTINGS */}
      {step === 2 && (
        <div className="space-y-6">
          <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-5">
            <div>
              <h3 className="font-display text-base font-bold text-ios-label">
                Spike Sensitivity Preset
              </h3>
              <p className="text-xs text-ios-secondary mt-0.5">
                Hybrid Rolling Median + MAD detector adapts to channel size while filtering flood spam.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  {
                    value: 'low',
                    label: 'Low Sensitivity',
                    desc: 'Only major chat explosions (>= 5 msg/s, 4.5x MAD deviation)',
                  },
                  {
                    value: 'medium',
                    label: 'Medium (Recommended)',
                    desc: 'Balanced detection (>= 3 msg/s, 3.1x MAD deviation)',
                  },
                  {
                    value: 'high',
                    label: 'High Sensitivity',
                    desc: 'Catches smaller creator / quiet stream reactions (>= 2 msg/s)',
                  },
                ] as Array<{ value: SpikeSensitivity; label: string; desc: string }>
              ).map((preset) => {
                const active = config.sensitivity === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setConfig({ ...config, sensitivity: preset.value })}
                    className={`rounded-xl p-4 text-left border transition-colors cursor-pointer space-y-1 ${
                      active
                        ? 'bg-[#7040DC]/15 border-[#7040DC] text-ios-label'
                        : 'bg-ios-bg border-ios-sep text-ios-secondary hover:border-ios-blue/50'
                    }`}
                  >
                    <p className="font-display text-sm font-bold text-ios-label">
                      {preset.label}
                    </p>
                    <p className="text-xs leading-relaxed">{preset.desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <Input
                label="Pre-spike Roll (sec)"
                type="number"
                min={0}
                max={180}
                value={config.preRollSec}
                onChange={(e) =>
                  setConfig({ ...config, preRollSec: Math.max(0, Number(e.target.value) || 0) })
                }
              />
              <Input
                label="Post-spike Roll (sec)"
                type="number"
                min={2}
                max={180}
                value={config.postRollSec}
                onChange={(e) =>
                  setConfig({ ...config, postRollSec: Math.max(2, Number(e.target.value) || 40) })
                }
              />
              <Input
                label="Cooldown Between Spikes (sec)"
                type="number"
                min={2}
                max={300}
                value={config.cooldownSec}
                onChange={(e) =>
                  setConfig({ ...config, cooldownSec: Math.max(2, Number(e.target.value) || 30) })
                }
              />
              <Input
                label="Spam Dedup Window (sec)"
                type="number"
                min={0}
                max={60}
                value={config.spamDedupWindowSec}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    spamDedupWindowSec: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input
                label="Min Msg / sec Override"
                type="number"
                min={1}
                placeholder="Auto by preset"
                value={config.minSpikeMessagesPerSec ?? ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    minSpikeMessagesPerSec: e.target.value ? Math.max(1, Number(e.target.value)) : null,
                  })
                }
              />
              <Input
                label="Min Unique Users Override"
                type="number"
                min={1}
                placeholder="Auto by preset"
                value={config.minUniqueParticipants ?? ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    minUniqueParticipants: e.target.value ? Math.max(1, Number(e.target.value)) : null,
                  })
                }
              />
              <Select
                label="Smart Framing Aspect Ratio"
                value={config.aspectRatio}
                onChange={(e) =>
                  setConfig({ ...config, aspectRatio: e.target.value as AspectRatio })
                }
                options={[
                  { value: '9:16', label: 'Vertical (9:16)' },
                  { value: '1:1', label: 'Square (1:1)' },
                  { value: '16:9', label: 'Horizontal (16:9)' },
                ]}
              />
              <Select
                label="Export Resolution"
                value={config.resolution}
                onChange={(e) =>
                  setConfig({ ...config, resolution: e.target.value as OutputResolution })
                }
                options={[
                  { value: '1080p', label: '1080p HD' },
                  { value: '720p', label: '720p Fast Render' },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-ios-sep">
              <Toggle
                checked={config.mergeOverlappingClips}
                onChange={(checked) =>
                  setConfig({ ...config, mergeOverlappingClips: checked })
                }
                label="Merge Overlapping Highlight Windows"
                description="Combine nearby spikes within gap tolerance into one continuous clip preserving all peak markers."
              />
              <Toggle
                checked={config.captionsEnabled}
                onChange={(checked) =>
                  setConfig({ ...config, captionsEnabled: checked })
                }
                label="Generate Synchronized Subtitles (SRT / VTT)"
                description="Create editable time-aligned SRT & VTT caption files for every extracted clip."
              />
            </div>

            {/* Whisper Policy & Future Multi-Signal Engines */}
            <div className="rounded-lg bg-ios-bg border border-ios-sep p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="space-y-1.5">
                  <label
                    htmlFor="chatspike-whisper-model"
                    className="text-sm font-medium text-ios-label"
                  >
                    Whisper Speech Model Preference
                  </label>
                  <select
                    id="chatspike-whisper-model"
                    value={config.whisperModel}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        whisperModel: e.target.value as ChatSpikeDetectionConfig['whisperModel'],
                      })
                    }
                    className="h-11 sm:h-10 w-full rounded-lg bg-ios-input px-3 text-sm text-ios-label border border-ios-sep"
                  >
                    <option value="tiny">tiny (~1 GB RAM, fastest)</option>
                    <option value="base">base (~1.5 GB RAM)</option>
                    <option value="small">small (Recommended for 8 GB RAM)</option>
                    <option value="medium">medium (~5 GB RAM — heavy on 8 GB systems)</option>
                    <option value="large-v3" disabled>
                      large-v3 (Disabled for 8 GB RAM stability)
                    </option>
                  </select>
                  {config.whisperModel === 'medium' && (
                    <p className="text-[11px] text-ios-orange flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Warning: medium Whisper model requires ~5 GB RAM and may degrade responsiveness on 8 GB hosts.
                      </span>
                    </p>
                  )}
                  <p className="text-[11px] text-ios-secondary">
                    {capabilities?.whisperNote ??
                      'Local ChatSpike builds synchronized chat highlight SRT/VTT captions; full speech-to-text Whisper executes when Python FastAPI is active.'}
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="font-semibold text-ios-label">Decision Engine Modules</p>
                  {(capabilities?.engines ?? []).map((eng) => (
                    <div
                      key={eng.id}
                      className="flex items-start justify-between gap-2 rounded bg-ios-surface border border-ios-sep px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-ios-label">{eng.name}</p>
                        <p className="text-[11px] text-ios-secondary">{eng.availabilityNote}</p>
                      </div>
                      <StatusIndicator
                        status={eng.availability === 'available' ? 'operational' : 'waiting'}
                        customLabel={eng.availability === 'available' ? 'Active' : 'Planned'}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back to Source
            </Button>
            <Button
              variant="accent-purple"
              size="lg"
              disabled={!readySource}
              data-testid="chatspike-start-btn"
              icon={<Flame className="w-4 h-4" />}
              onClick={handleStartProcessing}
            >
              Detect Spikes &amp; Extract Clips
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: PROCESSING */}
      {step === 3 && job && (
        <div className="space-y-6">
          <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <StatusIndicator
                    status={
                      job.status === 'running'
                        ? 'processing'
                        : job.status === 'completed'
                          ? 'completed'
                          : job.status === 'cancelled'
                            ? 'cancelled'
                            : 'failed'
                    }
                  />
                  <h3 className="font-display text-lg font-bold text-ios-label">
                    {job.currentTask}
                  </h3>
                </div>
                <p className="text-xs text-ios-secondary tabular-nums">
                  Extracted {job.candidates.filter((c) => c.renderStatus === 'ready').length} of{' '}
                  {job.candidates.length} candidate clips
                </p>
              </div>

              {job.status === 'running' ? (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<XCircle className="w-4 h-4" />}
                  onClick={handleCancelProcessing}
                >
                  Cancel Extraction
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setStep(2)}>
                    Adjust Settings
                  </Button>
                  {job.status === 'completed' && (
                    <Button
                      variant="accent-purple"
                      size="sm"
                      onClick={() => setStep(4)}
                    >
                      View Results
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={job.overallProgress}
              className="h-3 w-full rounded-full bg-ios-bg border border-ios-sep overflow-hidden"
            >
              <div
                className="h-full bg-[#7040DC] transition-all duration-300"
                style={{ width: `${job.overallProgress}%` }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {job.stages.map((st) => (
                <div
                  key={st.id}
                  className="rounded-lg bg-ios-bg border border-ios-sep p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ios-label">{st.label}</span>
                    <StatusIndicator status={st.status} />
                  </div>
                  {st.detail && <p className="text-[11px] text-ios-secondary">{st.detail}</p>}
                </div>
              ))}
            </div>

            {chartData.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-ios-secondary">
                  Chat Messages / Second vs Rolling Median Baseline
                </p>
                <div className="w-full h-56 rounded-lg bg-ios-bg border border-ios-sep p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="second"
                        tickFormatter={(s) => `${s}s`}
                        stroke="#8E8E93"
                        fontSize={11}
                      />
                      <YAxis stroke="#8E8E93" fontSize={11} width={34} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#13141B',
                          borderColor: 'rgba(255,255,255,0.12)',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="filteredMessages"
                        name="Filtered msg/s"
                        stroke="#64D2FF"
                        fill="#64D2FF"
                        fillOpacity={0.22}
                      />
                      <Area
                        type="monotone"
                        dataKey="medianBaseline"
                        name="Rolling Median"
                        stroke="#7040DC"
                        fill="none"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-ios-bg border border-ios-sep p-3 max-h-40 overflow-y-auto font-mono text-[11px] text-ios-secondary space-y-1">
              {job.logs.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* STEP 4: RESULTS */}
      {step === 4 && job && (
        <div className="space-y-6">
          <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-bold text-ios-label">
                  Detected Reaction Moments ({candidates.length})
                </h3>
                <p className="text-xs text-ios-secondary mt-0.5">
                  {HEURISTIC_ENGAGEMENT_DISCLAIMER}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <Button variant="secondary" size="sm" onClick={() => setStep(2)}>
                  Re-run with New Settings
                </Button>
                <Button
                  variant="accent-purple"
                  size="sm"
                  disabled={candidates.length === 0}
                  onClick={() => setStep(5)}
                >
                  Review &amp; Edit Clips
                </Button>
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="w-full h-48 rounded-lg bg-ios-bg border border-ios-sep p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="second"
                      tickFormatter={(s) => formatDuration(Number(s))}
                      stroke="#8E8E93"
                      fontSize={11}
                    />
                    <YAxis stroke="#8E8E93" fontSize={11} width={34} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#13141B',
                        borderColor: 'rgba(255,255,255,0.12)',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="filteredMessages"
                      name="Chat Rate (msg/s)"
                      stroke="#64D2FF"
                      fill="#64D2FF"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {candidates.length === 0 ? (
            <section className="rounded-xl bg-ios-surface border border-ios-sep p-8 text-center space-y-3">
              <Activity className="w-8 h-8 text-ios-secondary mx-auto" />
              <h4 className="font-display text-base font-bold text-ios-label">
                No Spikes Crossed Detection Threshold
              </h4>
              <p className="text-xs text-ios-secondary max-w-md mx-auto">
                Try switching Sensitivity to High, lowering the Min Messages/sec threshold, or checking your Timestamp Sync offsets.
              </p>
              <Button variant="secondary" size="sm" onClick={() => setStep(2)}>
                Adjust Detection Settings
              </Button>
            </section>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {candidates.map((cand) => (
                <article
                  key={cand.id}
                  data-testid={`chatspike-candidate-${cand.id}`}
                  className="rounded-xl bg-ios-surface border border-ios-sep overflow-hidden flex flex-col justify-between"
                >
                  <div className="bg-black h-64 sm:h-72 overflow-hidden relative flex items-center justify-center border-b border-ios-sep">
                    {cand.previewUrl ? (
                      <video
                        key={cand.previewUrl}
                        src={cand.previewUrl}
                        poster={cand.thumbnailUrl ?? undefined}
                        controls
                        preload="metadata"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-xs text-ios-secondary flex flex-col items-center gap-2">
                        <Play className="w-7 h-7" />
                        <span>{cand.errorMessage ?? 'Preview unavailable'}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-display text-base font-bold text-ios-label truncate">
                            {cand.title}
                          </h4>
                          <span className="text-xs font-mono font-bold text-[#64D2FF] tabular-nums">
                            {cand.engagementScore}/100
                          </span>
                        </div>
                        <p className="text-xs font-mono text-ios-secondary tabular-nums">
                          {formatDuration(cand.startSec)} – {formatDuration(cand.endSec)} ({cand.durationSec.toFixed(1)}s) · Peak @ {formatDuration(cand.peakSpikeSec)}
                        </p>
                      </div>
                      <StatusIndicator
                        status={
                          cand.status === 'approved'
                            ? 'completed'
                            : cand.status === 'rejected'
                              ? 'failed'
                              : 'waiting'
                        }
                        customLabel={cand.status}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                      <div className="rounded bg-ios-bg border border-ios-sep p-2">
                        <span className="block text-[10px] text-ios-secondary font-sans">Peak Rate</span>
                        <span className="font-bold text-ios-label">{cand.peakMessagesPerSec} msg/s</span>
                      </div>
                      <div className="rounded bg-ios-bg border border-ios-sep p-2">
                        <span className="block text-[10px] text-ios-secondary font-sans">Unique Chatters</span>
                        <span className="font-bold text-ios-label">{cand.uniqueParticipants}</span>
                      </div>
                      <div className="rounded bg-ios-bg border border-ios-sep p-2">
                        <span className="block text-[10px] text-ios-secondary font-sans">Top Keywords</span>
                        <span className="font-bold text-[#64D2FF] truncate block">
                          {cand.dominantKeywords.slice(0, 2).join(', ') || 'Energy'}
                        </span>
                      </div>
                    </div>

                    <ul className="text-xs text-ios-secondary space-y-1 list-disc list-inside">
                      {cand.engagementReasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>

                    <div className="pt-2 border-t border-ios-sep flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant={cand.status === 'approved' ? 'primary' : 'secondary'}
                          size="sm"
                          icon={<Check className="w-3.5 h-3.5" />}
                          onClick={() => handleSetCandidateStatus(cand.id, 'approved')}
                        >
                          Approve
                        </Button>
                        <Button
                          variant={cand.status === 'rejected' ? 'danger' : 'ghost'}
                          size="sm"
                          icon={<X className="w-3.5 h-3.5" />}
                          onClick={() => handleSetCandidateStatus(cand.id, 'rejected')}
                        >
                          Reject
                        </Button>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => setStep(5)}>
                        Edit / Trim
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 5: REVIEW & EDIT */}
      {step === 5 && job && (
        <div className="space-y-6">
          <section className="rounded-xl bg-ios-surface border border-ios-sep p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-ios-label">
                Review, Trim &amp; Merge Clips
              </h3>
              <p className="text-xs text-ios-secondary">
                Edit boundaries to re-cut real MP4 segments via FFmpeg, adjust framing, edit captions, or merge overlapping clips.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {selectedForMerge.length >= 2 && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={isMerging}
                  icon={<Combine className="w-3.5 h-3.5" />}
                  onClick={handleMergeSelected}
                >
                  Merge Selected ({selectedForMerge.length})
                </Button>
              )}
              <Button
                variant="accent-purple"
                size="sm"
                onClick={() => setStep(6)}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                Continue to Export ({approvedCandidates.length} Approved)
              </Button>
            </div>
          </section>

          <div className="space-y-4">
            {candidates.map((cand) => {
              const draft = editingDrafts[cand.id] ?? {
                title: cand.title,
                startSec: String(cand.startSec),
                endSec: String(cand.endSec),
                aspectRatio: cand.aspectRatio,
                resolution: cand.resolution,
                captionsEnabled: cand.captionsEnabled,
                captionsSrt: cand.captionsSrt,
                showCaptionsEditor: false,
              };
              const isSelected = selectedForMerge.includes(cand.id);

              return (
                <article
                  key={cand.id}
                  className="rounded-xl bg-ios-surface border border-ios-sep p-4 sm:p-5 space-y-4"
                >
                  <div className="flex flex-col xl:flex-row gap-5">
                    <div className="w-full xl:w-80 h-52 sm:h-56 shrink-0 rounded-lg bg-black overflow-hidden border border-ios-sep">
                      {cand.previewUrl ? (
                        <video
                          key={cand.previewUrl}
                          src={cand.previewUrl}
                          poster={cand.thumbnailUrl ?? undefined}
                          controls
                          preload="metadata"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-ios-secondary">
                          No preview available
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 text-xs text-ios-secondary cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              setSelectedForMerge((prev) =>
                                prev.includes(cand.id)
                                  ? prev.filter((id) => id !== cand.id)
                                  : [...prev, cand.id]
                              )
                            }
                          />
                          <span>Select for merge</span>
                        </label>

                        <div className="flex items-center gap-2">
                          <Button
                            variant={cand.status === 'approved' ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => handleSetCandidateStatus(cand.id, 'approved')}
                          >
                            Approved
                          </Button>
                          <Button
                            variant={cand.status === 'rejected' ? 'danger' : 'ghost'}
                            size="sm"
                            onClick={() => handleSetCandidateStatus(cand.id, 'rejected')}
                          >
                            Rejected
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="sm:col-span-2">
                          <Input
                            label="Clip Title"
                            value={draft.title}
                            onChange={(e) =>
                              setEditingDrafts((prev) => ({
                                ...prev,
                                [cand.id]: { ...draft, title: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <Input
                          label="Start (sec)"
                          type="number"
                          step="0.5"
                          value={draft.startSec}
                          onChange={(e) =>
                            setEditingDrafts((prev) => ({
                              ...prev,
                              [cand.id]: { ...draft, startSec: e.target.value },
                            }))
                          }
                        />
                        <Input
                          label="End (sec)"
                          type="number"
                          step="0.5"
                          value={draft.endSec}
                          onChange={(e) =>
                            setEditingDrafts((prev) => ({
                              ...prev,
                              [cand.id]: { ...draft, endSec: e.target.value },
                            }))
                          }
                        />
                        <Select
                          label="Aspect Ratio"
                          value={draft.aspectRatio}
                          onChange={(e) =>
                            setEditingDrafts((prev) => ({
                              ...prev,
                              [cand.id]: {
                                ...draft,
                                aspectRatio: e.target.value as AspectRatio,
                              },
                            }))
                          }
                          options={[
                            { value: '9:16', label: '9:16 Vertical' },
                            { value: '1:1', label: '1:1 Square' },
                            { value: '16:9', label: '16:9 Wide' },
                          ]}
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={regeneratingId === cand.id}
                            icon={<RefreshCw className="w-3.5 h-3.5" />}
                            onClick={() => handleRegenerateCandidate(cand)}
                          >
                            Save &amp; Re-cut MP4
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Scissors className="w-3.5 h-3.5" />}
                            onClick={() =>
                              setEditingDrafts((prev) => ({
                                ...prev,
                                [cand.id]: {
                                  ...draft,
                                  showCaptionsEditor: !draft.showCaptionsEditor,
                                },
                              }))
                            }
                          >
                            {draft.showCaptionsEditor ? 'Hide Captions' : 'Edit Captions (SRT)'}
                          </Button>
                        </div>
                        <span className="text-xs font-mono text-ios-secondary tabular-nums">
                          Score {cand.engagementScore}/100 · {formatBytes(cand.fileSizeBytes)}
                        </span>
                      </div>

                      {draft.showCaptionsEditor && (
                        <div className="rounded-lg bg-ios-bg border border-ios-sep p-3 space-y-2.5">
                          <Toggle
                            checked={draft.captionsEnabled}
                            onChange={(checked) =>
                              setEditingDrafts((prev) => ({
                                ...prev,
                                [cand.id]: { ...draft, captionsEnabled: checked },
                              }))
                            }
                            label="Include Synchronized Subtitles"
                          />
                          <textarea
                            rows={5}
                            value={draft.captionsSrt}
                            onChange={(e) =>
                              setEditingDrafts((prev) => ({
                                ...prev,
                                [cand.id]: { ...draft, captionsSrt: e.target.value },
                              }))
                            }
                            className="w-full rounded-lg bg-ios-surface border border-ios-sep p-2.5 font-mono text-xs text-ios-label"
                            placeholder="1&#10;00:00:01,000 --> 00:00:03,500&#10;viewer: LMAO!!"
                          />
                          <div className="flex justify-end">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleSaveCaptionsOnly(cand)}
                            >
                              Save Captions
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 6: EXPORT & LIBRARY */}
      {step === 6 && job && (
        <div className="space-y-6">
          <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-display text-lg font-bold text-ios-label">
                Export &amp; Sync to ClipCat Library
              </h3>
              <p className="text-xs text-ios-secondary">
                Commit {approvedCandidates.length} approved clip{approvedCandidates.length === 1 ? '' : 's'} into ClipCat&apos;s main Library, Clip Editor, and Export Manager.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="accent-purple"
                loading={savingToLibrary}
                disabled={approvedCandidates.length === 0}
                data-testid="chatspike-save-library-btn"
                icon={<FolderPlus className="w-4 h-4" />}
                onClick={handleSaveToLibrary}
              >
                Save Approved to Clip Library ({approvedCandidates.length})
              </Button>
            </div>
          </section>

          {job.savedProjectId && (
            <div className="rounded-xl bg-[var(--ios-green-tint)] border border-[var(--ios-green-border)] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-ios-green font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Saved to ClipCat Studio Library ({job.savedProjectId})</span>
              </div>
              <div className="flex items-center gap-3">
                <Link to="/clips" className="text-ios-label font-semibold hover:underline">
                  Open Clip Library
                </Link>
                <Link to="/exports" className="text-ios-label font-semibold hover:underline">
                  Open Export Manager
                </Link>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {approvedCandidates.map((cand) => {
              const slug = cand.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
              return (
                <div
                  key={cand.id}
                  className="rounded-xl bg-ios-surface border border-ios-sep p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-display text-sm font-bold text-ios-label truncate">
                      {cand.title}
                    </p>
                    <p className="text-xs font-mono text-ios-secondary tabular-nums">
                      {cand.aspectRatio} · {cand.resolution} · {cand.durationSec.toFixed(1)}s ·{' '}
                      {formatBytes(cand.fileSizeBytes)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {cand.downloadUrl && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Download className="w-3.5 h-3.5" />}
                        onClick={() => triggerVerifiedDownload(cand.downloadUrl!, `${slug}.mp4`)}
                      >
                        MP4
                      </Button>
                    )}
                    {cand.srtUrl && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<FileText className="w-3.5 h-3.5" />}
                        onClick={() => triggerVerifiedDownload(cand.srtUrl!, `${slug}.srt`)}
                      >
                        SRT
                      </Button>
                    )}
                    {cand.vttUrl && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<FileText className="w-3.5 h-3.5" />}
                        onClick={() => triggerVerifiedDownload(cand.vttUrl!, `${slug}.vtt`)}
                      >
                        VTT
                      </Button>
                    )}
                    {cand.metadataUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<FileCode2 className="w-3.5 h-3.5" />}
                        onClick={() => triggerVerifiedDownload(cand.metadataUrl!, `${slug}.json`)}
                      >
                        JSON
                      </Button>
                    )}
                    {cand.thumbnailUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ImageIcon className="w-3.5 h-3.5" />}
                        onClick={() => triggerVerifiedDownload(cand.thumbnailUrl!, `${slug}.jpg`)}
                      >
                        Thumb
                      </Button>
                    )}
                    {cand.savedClipId && (
                      <Link to={`/clips/${cand.savedClipId}/edit`}>
                        <Button variant="secondary" size="sm" icon={<Layers className="w-3.5 h-3.5" />}>
                          Open in Editor
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
