import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Film,
  Instagram,
  Send,
  Share2,
  Youtube,
} from 'lucide-react';
import { trackAnalyticsEvent } from '../analytics/client';
import { getClipDownloadUrl, getClipPreviewUrl, getProject, getProjectTranscript } from '../api';
import {
  downloadManualSharePackage,
  generatePublishingMetadata,
  validatePublishingPackage,
} from '../api/publishing';
import { ConnectedAccountsPanel } from '../components/publishing/ConnectedAccountsPanel';
import { MetadataPackagePreview } from '../components/publishing/MetadataPackagePreview';
import { PublishHistoryPanel } from '../components/publishing/PublishHistoryPanel';
import { RightsAttributionPanel } from '../components/publishing/RightsAttributionPanel';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { Toggle } from '../components/ui/Toggle';
import { useAllClipsQuery, useClipQuery } from '../hooks/useClipCatQueries';
import {
  useCancelPublishingMutation,
  usePublishingAccountsQuery,
  usePublishingHistoryQuery,
  usePublishingJobPollingQuery,
  useStartPublishingMutation,
} from '../hooks/usePublishingQueries';
import { generatePublishMetadataPackage } from '../publishing/metadataService';
import type {
  PublishMetadataPackage,
  PublishOverrides,
  PublishPlatform,
  PublishValidationResult,
  SourceMetadataInput,
  YouTubeFormat,
  YouTubePrivacy,
} from '../publishing/types';
import { useUiStore } from '../stores/uiStore';
import type { Project } from '../types/project';
import type { Transcript } from '../types/transcript';
import { triggerVerifiedDownload } from '../utils/desktop';
import { formatBytes, formatDuration } from '../utils/format';

const YOUTUBE_CATEGORIES = [
  { value: '28', label: 'Science & Technology' },
  { value: '20', label: 'Gaming' },
  { value: '27', label: 'Education' },
  { value: '22', label: 'People & Blogs' },
  { value: '24', label: 'Entertainment' },
  { value: '26', label: 'Howto & Style' },
  { value: '10', label: 'Music' },
  { value: '17', label: 'Sports' },
  { value: '23', label: 'Comedy' },
  { value: '25', label: 'News & Politics' },
];

export function PublishPage() {
  const { id: paramClipId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useUiStore();

  const allClipsQuery = useAllClipsQuery();
  const singleClipQuery = useClipQuery(paramClipId);
  const accountsQuery = usePublishingAccountsQuery();
  const historyQuery = usePublishingHistoryQuery();
  const startMutation = useStartPublishingMutation();
  const cancelMutation = useCancelPublishingMutation();

  const clips = allClipsQuery.data ?? [];
  const selectedClip = useMemo(() => {
    if (paramClipId && singleClipQuery.data) return singleClipQuery.data;
    if (paramClipId) return clips.find((c) => c.id === paramClipId) ?? null;
    return clips[0] ?? null;
  }, [paramClipId, singleClipQuery.data, clips]);

  const [platform, setPlatform] = useState<PublishPlatform>('youtube');
  const [sourceInput, setSourceInput] = useState<SourceMetadataInput>({
    userOwnsContent: false,
    userHasPermission: false,
    thirdPartyMusicOrSegments: false,
    commercialOrDerivativeRestricted: false,
  });
  const [overrides, setOverrides] = useState<PublishOverrides>({
    youtubePrivacy: 'private',
    madeForKids: false,
    uploadSeparateCaptions: true,
  });
  const [includeAiDisclosure, setIncludeAiDisclosure] = useState(true);
  const [userConfirmedPublish, setUserConfirmedPublish] = useState(false);
  const [allowDuplicateRepublish, setAllowDuplicateRepublish] = useState(false);

  const [projectContext, setProjectContext] = useState<Project | null>(null);
  const [transcriptContext, setTranscriptContext] = useState<Transcript | null>(null);
  const [srtTextContext, setSrtTextContext] = useState<string>('');
  const [vttTextContext, setVttTextContext] = useState<string>('');

  const [pkg, setPkg] = useState<PublishMetadataPackage | null>(null);
  const [validation, setValidation] = useState<PublishValidationResult | null>(null);
  const [localMediaAvailable, setLocalMediaAvailable] = useState<boolean>(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [exportingManual, setExportingManual] = useState(false);

  const trackedJobTerminalRef = useRef<string | null>(null);
  const jobQuery = usePublishingJobPollingQuery(activeJobId);
  const activeJob = jobQuery.data ?? null;

  // Reset confirmation and custom title/desc overrides when clip changes
  useEffect(() => {
    setUserConfirmedPublish(false);
    setAllowDuplicateRepublish(false);
    setOverrides((prev) => ({
      youtubePrivacy: prev.youtubePrivacy ?? 'private',
      madeForKids: prev.madeForKids ?? false,
      uploadSeparateCaptions: prev.uploadSeparateCaptions ?? true,
      youtubeFormat:
        selectedClip && selectedClip.durationSec <= 180 && selectedClip.aspectRatio !== '16:9'
          ? 'short'
          : 'video',
    }));
  }, [selectedClip?.id]);

  // Fetch optional project/transcript/subtitle sidecars cleanly (never blocks if offline/chatspike)
  useEffect(() => {
    if (!selectedClip) return;
    let cancelled = false;

    setProjectContext(null);
    setTranscriptContext(null);
    setSrtTextContext('');
    setVttTextContext('');

    void (async () => {
      try {
        const proj = await getProject(selectedClip.projectId);
        if (!cancelled) setProjectContext(proj);
      } catch {
        // Optional context
      }

      try {
        const tr = await getProjectTranscript(selectedClip.projectId);
        if (!cancelled) setTranscriptContext(tr);
      } catch {
        // ChatSpike / offline clips may not have a separate project transcript endpoint
      }

      if (selectedClip.srtUrl && selectedClip.srtUrl.startsWith('/')) {
        try {
          const r = await fetch(selectedClip.srtUrl);
          if (r.ok) {
            const text = await r.text();
            if (!cancelled) setSrtTextContext(text);
          }
        } catch {
          // Optional sidecar
        }
      }

      if (selectedClip.vttUrl && selectedClip.vttUrl.startsWith('/')) {
        try {
          const r = await fetch(selectedClip.vttUrl);
          if (r.ok) {
            const text = await r.text();
            if (!cancelled) setVttTextContext(text);
          }
        } catch {
          // Optional sidecar
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedClip?.id, selectedClip?.projectId, selectedClip?.srtUrl, selectedClip?.vttUrl]);

  // Auto-generate metadata & run server pre-publish validation whenever inputs change
  useEffect(() => {
    if (!selectedClip) {
      setPkg(null);
      setValidation(null);
      return;
    }

    let cancelled = false;

    // Immediate deterministic preview so zero blank flash occurs
    const instantPkg = generatePublishMetadataPackage({
      clip: selectedClip,
      project: projectContext,
      transcript: transcriptContext,
      srtContent: srtTextContext,
      vttContent: vttTextContext,
      sourceInput,
      youtubeFormat: overrides.youtubeFormat,
      youtubePrivacy: overrides.youtubePrivacy,
      madeForKids: overrides.madeForKids,
      includeAiDisclosure,
    });
    setPkg(instantPkg);

    void (async () => {
      try {
        const genRes = await generatePublishingMetadata({
          clip: selectedClip,
          project: projectContext,
          transcript: transcriptContext,
          srtContent: srtTextContext || undefined,
          vttContent: vttTextContext || undefined,
          sourceInput,
          youtubeFormat: overrides.youtubeFormat,
          youtubePrivacy: overrides.youtubePrivacy,
          madeForKids: overrides.madeForKids,
          includeAiDisclosure,
        });
        if (cancelled) return;
        setLocalMediaAvailable(genRes.localMediaAvailable);

        const valRes = await validatePublishingPackage({
          clip: selectedClip,
          project: projectContext,
          transcript: transcriptContext,
          srtContent: srtTextContext || undefined,
          vttContent: vttTextContext || undefined,
          sourceInput,
          platform,
          overrides,
          includeAiDisclosure,
          allowDuplicateRepublish,
        });
        if (cancelled) return;
        setPkg(valRes.package);
        setValidation(valRes.validation);
      } catch {
        // Fallback keeps deterministic package visible even if server session hasn't initialized
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    selectedClip,
    projectContext,
    transcriptContext,
    srtTextContext,
    vttTextContext,
    sourceInput,
    platform,
    overrides,
    includeAiDisclosure,
    allowDuplicateRepublish,
    accountsQuery.data,
  ]);

  // Track terminal publish job outcomes cleanly (strict non-PII analytics)
  useEffect(() => {
    if (!activeJob) return;
    if (trackedJobTerminalRef.current === `${activeJob.id}:${activeJob.status}`) return;

    if (activeJob.status === 'published') {
      trackedJobTerminalRef.current = `${activeJob.id}:${activeJob.status}`;
      trackAnalyticsEvent('publish_completed', {
        platform: activeJob.platform,
        format: activeJob.format,
      });
      void historyQuery.refetch();
      void accountsQuery.refetch();
      addToast({
        variant: 'success',
        title: `Published to ${activeJob.platform === 'youtube' ? 'YouTube' : 'Instagram'}`,
        description: activeJob.publishedUrl
          ? 'Verified upload is live at the link below.'
          : 'Upload verified by platform API.',
      });
    } else if (activeJob.status === 'failed') {
      trackedJobTerminalRef.current = `${activeJob.id}:${activeJob.status}`;
      trackAnalyticsEvent('publish_failed', {
        platform: activeJob.platform,
        errorCategory: activeJob.errorCode ?? 'upload_failed',
      });
      void historyQuery.refetch();
      void accountsQuery.refetch();
    }
  }, [activeJob, addToast, historyQuery, accountsQuery]);

  const accounts = accountsQuery.data?.accounts ?? [];
  const activePlatformAccount = accounts.find((a) => a.platform === platform);
  const instagramSupportsDirect =
    activePlatformAccount?.platform === 'instagram' &&
    activePlatformAccount.instagramMediaTransferMode === 'https_signed_relay';

  const isJobRunning =
    activeJob?.status === 'preparing_media' ||
    activeJob?.status === 'validating_metadata' ||
    activeJob?.status === 'uploading' ||
    activeJob?.status === 'processing_platform';

  const handleStartPublish = async () => {
    if (!selectedClip || !pkg || !validation?.valid || !userConfirmedPublish) return;
    const idempotencyKey = `${selectedClip.id}:${platform}:${Date.now()}`;
    trackAnalyticsEvent('publish_started', {
      platform,
      format: platform === 'youtube' ? pkg.platforms.youtube.format : 'reel',
    });

    try {
      const started = await startMutation.mutateAsync({
        clip: selectedClip,
        project: projectContext,
        transcript: transcriptContext,
        srtContent: srtTextContext || undefined,
        vttContent: vttTextContext || undefined,
        sourceInput,
        platform,
        overrides,
        includeAiDisclosure,
        userConfirmedPublish: true,
        allowDuplicateRepublish,
        idempotencyKey,
      });
      setActiveJobId(started.id);
      addToast({
        variant: 'info',
        title: 'Publishing Started',
        description: `Preparing local MP4 and uploading to ${platform === 'youtube' ? 'YouTube' : 'Instagram'}.`,
      });
    } catch (err) {
      trackAnalyticsEvent('publish_failed', {
        platform,
        errorCategory: 'start_rejected',
      });
      addToast({
        variant: 'error',
        title: 'Unable to Start Publish',
        description: err instanceof Error ? err.message : 'Publishing request rejected.',
      });
    }
  };

  const handleDownloadManualBundle = async () => {
    if (!selectedClip || !pkg) return;
    setExportingManual(true);
    try {
      await downloadManualSharePackage({
        clip: selectedClip,
        pkg,
        platform,
      });
      const mp4Url = getClipDownloadUrl(selectedClip);
      if (mp4Url && localMediaAvailable) {
        const slug = (pkg.content.title || selectedClip.title)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_');
        await triggerVerifiedDownload(mp4Url, `${slug}.mp4`);
      }
      addToast({
        variant: 'success',
        title: 'Manual Share Bundle Exported',
        description:
          'Downloaded prepared metadata JSON (title, caption, hashtags, attribution) alongside your clip.',
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Export Failed',
        description: err instanceof Error ? err.message : 'Could not build manual share package.',
      });
    } finally {
      setExportingManual(false);
    }
  };

  if (allClipsQuery.isLoading || (paramClipId && singleClipQuery.isLoading)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!selectedClip) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={<Send className="w-6 h-6" />}
          title="No clips ready to publish yet"
          description="Generate and render a clip via New Project or ChatSpike Intelligence first, then return here to auto-prepare captions, attribution, and publishing."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/clips">
                <Button variant="secondary">Open Clip Library</Button>
              </Link>
              <Link to="/chatspike">
                <Button variant="accent-purple">Open ChatSpike</Button>
              </Link>
            </div>
          }
        />
        <PublishHistoryPanel history={historyQuery.data ?? []} onRetryStarted={setActiveJobId} />
      </div>
    );
  }

  const previewUrl = getClipPreviewUrl(selectedClip);
  const canSubmitPublish = Boolean(
    validation?.valid &&
      userConfirmedPublish &&
      !startMutation.isPending &&
      !isJobRunning &&
      (platform === 'youtube' || instagramSupportsDirect)
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Link to="/clips">
              <Button variant="secondary" size="sm" icon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Clip Library
              </Button>
            </Link>
            <Link to={`/clips/${selectedClip.id}/edit`}>
              <Button variant="ghost" size="sm">
                Open in Editor
              </Button>
            </Link>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-ios-label pt-1">
            Publish Clip
          </h2>
          <p className="text-xs sm:text-sm text-ios-secondary">
            Zero-typing metadata, automatic captions &amp; language detection, honest creator attribution, and explicit pre-upload confirmation.
          </p>
        </div>

        {clips.length > 1 && (
          <div className="w-full sm:w-72 shrink-0">
            <Select
              label="Selected Clip"
              value={selectedClip.id}
              onChange={(e) => navigate(`/publish/${encodeURIComponent(e.target.value)}`)}
              options={clips.map((c) => ({
                value: c.id,
                label: `${c.title} (${formatDuration(c.durationSec)})`,
              }))}
            />
          </div>
        )}
      </div>

      {/* Selected Clip Summary + Destination Switcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 rounded-xl bg-ios-surface border border-ios-sep p-4 space-y-3">
          <div className="rounded-lg bg-ios-bg border border-ios-sep overflow-hidden aspect-video flex items-center justify-center">
            {previewUrl ? (
              <video
                src={previewUrl}
                controls
                preload="metadata"
                poster={selectedClip.thumbnailUrl ?? undefined}
                className="w-full h-full object-contain bg-black"
              />
            ) : selectedClip.thumbnailUrl ? (
              <img
                src={selectedClip.thumbnailUrl}
                alt={selectedClip.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-ios-secondary p-6 text-center">
                <Film className="w-8 h-8" />
                <span className="text-xs font-mono">
                  {selectedClip.aspectRatio} · {selectedClip.resolution}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ios-secondary font-mono tabular-nums">
            <span>
              {selectedClip.aspectRatio} · {selectedClip.resolution} · {formatDuration(selectedClip.durationSec)}
            </span>
            <span>{formatBytes(selectedClip.fileSizeBytes)}</span>
          </div>

          {!localMediaAvailable && (
            <div className="rounded-lg bg-[var(--ios-orange-tint)] border border-[var(--ios-orange-border)] p-2.5 text-xs text-ios-orange flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Metadata preview is live, but no rendered local MP4 exists for this sample clip ID on disk. Create or save a rendered clip via ChatSpike or FastAPI to run a real upload.
              </span>
            </div>
          )}
        </div>

        {/* Destination Platform & Privacy Controls */}
        <div className="lg:col-span-7 rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-ios-secondary">
              Destination Platform
            </p>
            <div className="grid grid-cols-2 gap-2.5" role="tablist" aria-label="Target platform">
              <button
                type="button"
                role="tab"
                aria-selected={platform === 'youtube'}
                onClick={() => setPlatform('youtube')}
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                  platform === 'youtube'
                    ? 'bg-[var(--ios-red-tint)] border-ios-red text-ios-label'
                    : 'bg-ios-bg border-ios-sep text-ios-secondary hover:text-ios-label'
                }`}
              >
                <Youtube className="w-4 h-4 text-ios-red" />
                <span>YouTube</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={platform === 'instagram'}
                onClick={() => setPlatform('instagram')}
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                  platform === 'instagram'
                    ? 'bg-[#7040DC]/20 border-[#AF52DE] text-ios-label'
                    : 'bg-ios-bg border-ios-sep text-ios-secondary hover:text-ios-label'
                }`}
              >
                <Instagram className="w-4 h-4 text-[#AF52DE]" />
                <span>Instagram Reels</span>
              </button>
            </div>
          </div>

          {platform === 'youtube' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="YouTube Format"
                value={overrides.youtubeFormat ?? pkg?.platforms.youtube.format ?? 'short'}
                onChange={(e) =>
                  setOverrides((prev) => ({
                    ...prev,
                    youtubeFormat: e.target.value as YouTubeFormat,
                  }))
                }
                options={[
                  { value: 'short', label: 'YouTube Shorts (<= 3 min)' },
                  { value: 'video', label: 'Standard YouTube Video' },
                ]}
              />
              <Select
                label="Visibility (Default Private)"
                value={overrides.youtubePrivacy ?? 'private'}
                onChange={(e) =>
                  setOverrides((prev) => ({
                    ...prev,
                    youtubePrivacy: e.target.value as YouTubePrivacy,
                  }))
                }
                options={[
                  { value: 'private', label: 'Private (Safe Default)' },
                  { value: 'unlisted', label: 'Unlisted' },
                  { value: 'public', label: 'Public' },
                ]}
              />
              <Select
                label="YouTube Category"
                value={overrides.categoryId ?? pkg?.platforms.youtube.categoryId ?? '28'}
                onChange={(e) =>
                  setOverrides((prev) => ({ ...prev, categoryId: e.target.value }))
                }
                options={YOUTUBE_CATEGORIES}
              />
            </div>
          ) : (
            <div className="rounded-lg bg-ios-bg border border-ios-sep p-3.5 text-xs text-ios-secondary space-y-2">
              <p className="font-semibold text-ios-label">
                Instagram Media Transfer Requirements
              </p>
              <p className="leading-relaxed">
                {pkg?.platforms.instagram.mediaTransferNote}
              </p>
            </div>
          )}

          <div className="space-y-3 pt-1 border-t border-ios-sep">
            {platform === 'youtube' && (
              <>
                <Toggle
                  checked={Boolean(overrides.madeForKids)}
                  onChange={(checked) =>
                    setOverrides((prev) => ({ ...prev, madeForKids: checked }))
                  }
                  label="Made for Kids (COPPA Declaration)"
                  description="Leave off unless your video is specifically directed at children."
                />
                <Toggle
                  checked={overrides.uploadSeparateCaptions !== false}
                  onChange={(checked) =>
                    setOverrides((prev) => ({ ...prev, uploadSeparateCaptions: checked }))
                  }
                  label="Upload Separate Closed Caption Track (.srt)"
                  description="Uploads your local .srt subtitle track to YouTube alongside any burned-in captions."
                />
              </>
            )}
            <Toggle
              checked={includeAiDisclosure}
              onChange={setIncludeAiDisclosure}
              label="Include ClipCat Editing Disclosure"
              description="Adds an honest note stating the clip was edited and captioned locally with ClipCat."
            />
          </div>
        </div>
      </div>

      {/* Connected Accounts */}
      <ConnectedAccountsPanel
        accounts={accounts}
        selectedPlatform={platform}
        onRefreshAccounts={() => void accountsQuery.refetch()}
      />

      {/* Attribution & Rights Check */}
      {pkg && (
        <RightsAttributionPanel
          attribution={pkg.attribution}
          rights={pkg.rights}
          sourceInput={sourceInput}
          onChangeSourceInput={(patch) =>
            setSourceInput((prev) => ({ ...prev, ...patch }))
          }
        />
      )}

      {/* Auto-Prepared Metadata Preview & Optional Editor */}
      {pkg && (
        <MetadataPackagePreview
          pkg={pkg}
          platform={platform}
          overrides={overrides}
          onChangeOverrides={(patch) =>
            setOverrides((prev) => ({ ...prev, ...patch }))
          }
        />
      )}

      {/* Validation, Duplicate Guard, Confirmation & Upload Execution */}
      <section
        aria-label="Pre-Publish Review and Upload"
        className="rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold text-ios-label">
              Review &amp; Publish Confirmation
            </h3>
            <p className="text-xs text-ios-secondary mt-0.5">
              Zero manual typing is automatic—but human confirmation is always required before uploading externally.
            </p>
          </div>
          {validation?.valid ? (
            <StatusIndicator status="ready" customLabel="Ready to Publish" />
          ) : (
            <StatusIndicator status="needs_attention" customLabel="Action Needed" />
          )}
        </div>

        {validation && validation.errors.length > 0 && (
          <div className="rounded-lg bg-[var(--ios-red-tint)] border border-[var(--ios-red-border)] p-3.5 text-xs text-ios-red space-y-1">
            {validation.errors.map((errMsg, idx) => (
              <p key={idx} className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{errMsg}</span>
              </p>
            ))}
          </div>
        )}

        {validation && validation.warnings.length > 0 && (
          <div className="rounded-lg bg-[var(--ios-orange-tint)] border border-[var(--ios-orange-border)] p-3.5 text-xs text-ios-orange space-y-1">
            {validation.warnings.map((warnMsg, idx) => (
              <p key={idx}>{warnMsg}</p>
            ))}
          </div>
        )}

        {validation?.duplicateWarning && (
          <label className="flex items-start gap-2.5 rounded-lg bg-ios-bg border border-[var(--ios-orange-border)] p-3 text-xs text-ios-label cursor-pointer">
            <input
              type="checkbox"
              checked={allowDuplicateRepublish}
              onChange={(e) => setAllowDuplicateRepublish(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-[#FF9F0A] cursor-pointer"
            />
            <span>
              <strong className="font-semibold text-ios-orange block">Duplicate Guard</strong>
              {validation.duplicateWarning} Check this box to intentionally publish a new copy anyway.
            </span>
          </label>
        )}

        {/* Explicit Human Confirmation Checkbox */}
        <label className="flex items-start gap-3 rounded-lg bg-ios-bg border border-ios-sep p-4 text-xs text-ios-label cursor-pointer">
          <input
            type="checkbox"
            data-testid="publish-confirm-checkbox"
            checked={userConfirmedPublish}
            onChange={(e) => setUserConfirmedPublish(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded accent-[#0A84FF] cursor-pointer"
          />
          <span>
            <strong className="font-semibold block">
              I confirm this destination, metadata, captions, and content rights declaration
            </strong>
            <span className="text-ios-secondary">
              ClipCat will upload only this verified local MP4 clip to your connected account using official APIs.
            </span>
          </span>
        </label>

        {/* Active Upload Progress Bar */}
        {activeJob && (
          <div className="rounded-lg bg-ios-bg border border-ios-sep p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-ios-label">{activeJob.stageMessage}</span>
              <span className="font-mono tabular-nums text-ios-secondary">
                {activeJob.progressPercent !== null
                  ? `${activeJob.progressPercent}% (${formatBytes(activeJob.bytesUploaded)} / ${formatBytes(activeJob.totalBytes)})`
                  : activeJob.status === 'published'
                    ? 'Verified 100%'
                    : 'In Progress…'}
              </span>
            </div>

            <div className="h-2 w-full rounded-full bg-ios-surface overflow-hidden border border-ios-sep">
              <div
                className={`h-full transition-all duration-300 ${
                  activeJob.status === 'failed'
                    ? 'bg-ios-red'
                    : activeJob.status === 'published'
                      ? 'bg-ios-green'
                      : activeJob.progressPercent === null
                        ? 'w-1/2 bg-ios-blue motion-safe:animate-pulse'
                        : 'bg-ios-blue-fill'
                }`}
                style={
                  activeJob.progressPercent !== null
                    ? { width: `${activeJob.progressPercent}%` }
                    : undefined
                }
              />
            </div>

            {activeJob.status === 'published' && activeJob.publishedUrl && (
              <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                <span className="inline-flex items-center gap-1.5 text-ios-green font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  Upload verified by {activeJob.platform === 'youtube' ? 'YouTube' : 'Instagram'}!
                </span>
                <a
                  href={activeJob.publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-ios-blue font-semibold hover:underline"
                >
                  <span>View Published Post</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {isJobRunning && (
              <div className="flex justify-end">
                <Button
                  variant="danger"
                  size="sm"
                  loading={cancelMutation.isPending}
                  onClick={() => void cancelMutation.mutateAsync(activeJob.id)}
                >
                  Cancel Upload
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Primary & Fallback CTAs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Button
            variant="secondary"
            loading={exportingManual}
            icon={<Share2 className="w-4 h-4" />}
            onClick={handleDownloadManualBundle}
          >
            {platform === 'instagram' && !instagramSupportsDirect
              ? 'Download MP4 & Instagram Share Bundle'
              : 'Export Metadata Share Bundle'}
          </Button>

          <div className="flex flex-wrap items-center gap-2.5">
            {getClipDownloadUrl(selectedClip) && (
              <Button
                variant="ghost"
                icon={<Download className="w-4 h-4" />}
                onClick={() => {
                  const url = getClipDownloadUrl(selectedClip);
                  if (url) {
                    void triggerVerifiedDownload(
                      url,
                      `${selectedClip.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.mp4`
                    );
                  }
                }}
              >
                Save MP4 Copy
              </Button>
            )}

            {(platform === 'youtube' || instagramSupportsDirect) && (
              <Button
                variant={platform === 'youtube' ? 'primary' : 'accent-purple'}
                disabled={!canSubmitPublish}
                loading={startMutation.isPending || isJobRunning}
                data-testid="publish-submit-btn"
                icon={<Send className="w-4 h-4" />}
                onClick={handleStartPublish}
              >
                {platform === 'youtube'
                  ? `Publish to YouTube (${overrides.youtubePrivacy ?? 'private'})`
                  : 'Publish Reel to Instagram'}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Persistent Publish History */}
      <PublishHistoryPanel
        history={historyQuery.data ?? []}
        onRetryStarted={setActiveJobId}
      />
    </div>
  );
}
