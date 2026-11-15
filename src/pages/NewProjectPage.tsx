import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  FileVideo,
  Link2,
  Play,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  createProjectFromUrl,
  startProjectProcessing,
  uploadProjectVideo,
} from '../api';
import { MascotAssistant } from '../components/brand/MascotAssistant';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ProcessingConfigPanel } from '../features/new-project/ProcessingConfigPanel';
import { useProjectDraftStore } from '../stores/projectDraftStore';
import { useUiStore } from '../stores/uiStore';
import { formatBytes, formatDuration } from '../utils/format';
import {
  classifyAndValidateVideoUrl,
  validateProcessingConfig,
  validateVideoFileInput,
  type ConfigValidationErrors,
} from '../utils/validation';

export function NewProjectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const {
    inputMode,
    selectedFile,
    previewObjectUrl,
    fileMetadata,
    videoUrlInput,
    urlValidation,
    config,
    setInputMode,
    setSelectedFile,
    setFileMetadata,
    setVideoUrlInput,
    setUrlValidation,
    updateConfig,
    resetDraft,
  } = useProjectDraftStore();

  const { addToast, addNotification } = useUiStore();

  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [configErrors, setConfigErrors] = useState<ConfigValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'upload' || mode === 'url') {
      setInputMode(mode);
    }
  }, [searchParams, setInputMode]);

  const handleFileSelection = (file: File | null) => {
    setFileError(null);
    setSubmitError(null);
    if (!file) return;

    const validation = validateVideoFileInput({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!validation.valid) {
      setFileError(validation.error ?? 'Invalid video file.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(
      file,
      {
        fileName: file.name,
        fileSizeBytes: file.size,
        durationSec: null,
        width: null,
        height: null,
      },
      objectUrl
    );
  };

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (!selectedFile) return;
    setFileMetadata({
      fileName: selectedFile.name,
      fileSizeBytes: selectedFile.size,
      durationSec: Number.isFinite(video.duration) ? video.duration : null,
      width: video.videoWidth || null,
      height: video.videoHeight || null,
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFileSelection(file);
  };

  const handlePasteUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setVideoUrlInput(text);
        setUrlValidation(classifyAndValidateVideoUrl(text));
      }
    } catch {
      addToast({
        variant: 'info',
        title: 'Clipboard Unavailable',
        description: 'Paste the URL directly into the input field using Ctrl+V / Cmd+V.',
      });
    }
  };

  const handleValidateUrl = () => {
    setSubmitError(null);
    const result = classifyAndValidateVideoUrl(videoUrlInput);
    setUrlValidation(result);
  };

  const hasValidSource =
    (inputMode === 'upload' && Boolean(selectedFile)) ||
    (inputMode === 'url' && Boolean(urlValidation?.valid && urlValidation.canAutoDownload));

  const handleStartClipping = async () => {
    setSubmitError(null);

    if (inputMode === 'upload' && !selectedFile) {
      setFileError('Please select a supported video file (MP4, MOV, MKV, or WEBM).');
      return;
    }

    if (inputMode === 'url') {
      const validation = classifyAndValidateVideoUrl(videoUrlInput);
      setUrlValidation(validation);
      if (!validation.valid || !validation.canAutoDownload) {
        setSubmitError(
          validation.restrictionReason ||
            validation.message ||
            'Please provide a direct downloadable video URL or switch to Upload Video.'
        );
        return;
      }
    }

    const errors = validateProcessingConfig(config);
    setConfigErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setUploadPercent(inputMode === 'upload' ? 0 : null);
    const controller = new AbortController();
    uploadAbortRef.current = controller;

    try {
      let createdProject;
      if (inputMode === 'upload' && selectedFile) {
        const resLabel =
          fileMetadata?.width && fileMetadata?.height
            ? `${fileMetadata.width}x${fileMetadata.height}`
            : null;
        createdProject = await uploadProjectVideo({
          file: selectedFile,
          config,
          durationSec: fileMetadata?.durationSec ?? null,
          resolution: resLabel,
          onProgress: (pct) => setUploadPercent(pct),
          signal: controller.signal,
        });
      } else {
        createdProject = await createProjectFromUrl({
          name: config.projectName.trim(),
          url: videoUrlInput.trim(),
          config,
        });
      }

      const startResp = await startProjectProcessing(createdProject.id, config);
      addNotification({
        title: 'Processing Started',
        message: `Project "${createdProject.name}" queued for AI clipping.`,
        type: 'info',
        href: `/projects/${createdProject.id}/processing?jobId=${startResp.jobId}`,
      });
      resetDraft();
      navigate(`/projects/${createdProject.id}/processing?jobId=${startResp.jobId}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Failed to submit project to the ClipCat backend.'
      );
    } finally {
      setIsSubmitting(false);
      setUploadPercent(null);
      uploadAbortRef.current = null;
    }
  };

  return (
    <div className="space-y-8 w-full">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-bold text-ios-label">
            Create New Video Project
          </h2>
          <p className="text-sm text-ios-secondary">
            Add a long-form video from your computer or a direct media URL, then configure AI clipping.
          </p>
        </div>
        <MascotAssistant
          message="Ready for your next cut"
          submessage="Local Whisper transcription + smart 9:16 framing stay on your device."
          className="lg:max-w-sm py-3 px-3.5"
        />
      </div>

      {/* Input Mode Tabs */}
      <section className="rounded-xl bg-ios-surface border border-ios-sep overflow-hidden">
        <div
          role="tablist"
          aria-label="Video source method"
          className="flex overflow-x-auto border-b border-ios-sep bg-ios-bg/60"
        >
          <button
            type="button"
            role="tab"
            aria-selected={inputMode === 'upload'}
            onClick={() => setInputMode('upload')}
            className={`flex items-center gap-2 px-4 sm:px-6 py-3.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              inputMode === 'upload'
                ? 'border-ios-blue text-ios-blue bg-ios-surface'
                : 'border-transparent text-ios-secondary hover:text-ios-label'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Video</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={inputMode === 'url'}
            onClick={() => setInputMode('url')}
            className={`flex items-center gap-2 px-4 sm:px-6 py-3.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              inputMode === 'url'
                ? 'border-ios-blue text-ios-blue bg-ios-surface'
                : 'border-transparent text-ios-secondary hover:text-ios-label'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>Video URL</span>
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {inputMode === 'upload' ? (
            <div className="space-y-4">
              {!selectedFile ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  className={`rounded-xl border-2 border-dashed p-6 sm:p-10 text-center transition-colors ${
                    dragActive
                      ? 'border-ios-blue bg-[var(--ios-blue-tint)]'
                      : 'border-ios-sep bg-ios-bg/60 hover:border-ios-sep-strong'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--ios-blue-tint)] border border-[var(--ios-blue-border)] flex items-center justify-center mx-auto text-ios-blue mb-4">
                    <FileVideo className="w-6 h-6" />
                  </div>
                  <p className="font-display text-base font-bold text-ios-label">
                    Drag and drop your source video here
                  </p>
                  <p className="text-xs text-ios-secondary mt-1">
                    Supported formats: MP4, MOV, MKV, WEBM · Processed locally on your machine
                  </p>
                  <div className="mt-5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".mp4,.mov,.mkv,.webm,video/mp4,video/quicktime,video/x-matroska,video/webm"
                      className="sr-only"
                      aria-label="Choose video file"
                      onChange={(e) => handleFileSelection(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      variant="secondary"
                      icon={<Upload className="w-4 h-4" />}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse Files
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                  <div className="lg:col-span-3 min-w-0 rounded-xl overflow-hidden bg-black border border-ios-sep aspect-video">
                    {previewObjectUrl && (
                      <video
                        src={previewObjectUrl}
                        controls
                        preload="metadata"
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                  <div className="lg:col-span-2 min-w-0 rounded-xl bg-ios-bg border border-ios-sep p-4 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-ios-secondary">Selected Source File</p>
                        <p className="text-sm font-semibold text-ios-label break-all mt-0.5">
                          {selectedFile.name}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Remove selected file"
                        icon={<Trash2 className="w-4 h-4 text-ios-red" />}
                        onClick={() => {
                          setSelectedFile(null, null, null);
                          setFileError(null);
                        }}
                      >
                        Remove
                      </Button>
                    </div>

                    <dl className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-ios-sep">
                      <div className="min-w-0">
                        <dt className="text-ios-secondary">File Size</dt>
                        <dd className="font-mono tabular-nums text-ios-label mt-0.5">
                          {formatBytes(selectedFile.size)}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-ios-secondary">Duration</dt>
                        <dd className="font-mono tabular-nums text-ios-label mt-0.5">
                          {fileMetadata?.durationSec
                            ? formatDuration(fileMetadata.durationSec)
                            : 'Inspecting...'}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-ios-secondary">Resolution</dt>
                        <dd className="font-mono tabular-nums text-ios-label mt-0.5">
                          {fileMetadata?.width && fileMetadata?.height
                            ? `${fileMetadata.width}x${fileMetadata.height}`
                            : 'Pending metadata'}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-ios-secondary">Validation</dt>
                        <dd className="text-ios-green font-medium mt-0.5">Valid format</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}

              {fileError && (
                <p role="alert" className="text-xs text-ios-red">
                  {fileError}
                </p>
              )}

              {uploadPercent !== null && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ios-label font-medium">
                      Uploading video to local FastAPI backend...
                    </span>
                    <span className="font-mono tabular-nums text-ios-blue">
                      {uploadPercent}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-ios-bg overflow-hidden border border-ios-sep">
                    <div
                      className="h-full bg-ios-blue-fill transition-all duration-150"
                      style={{ width: `${uploadPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                <div className="flex-1 w-full min-w-0">
                  <Input
                    label="Media Video URL"
                    type="url"
                    placeholder="https://.../video.mp4"
                    value={videoUrlInput}
                    onChange={(e) => {
                      setVideoUrlInput(e.target.value);
                      setUrlValidation(null);
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    icon={<ClipboardPaste className="w-4 h-4" />}
                    onClick={handlePasteUrl}
                  >
                    Paste
                  </Button>
                  <Button variant="primary" onClick={handleValidateUrl}>
                    Validate URL
                  </Button>
                </div>
              </div>

              {urlValidation && (
                <div
                  role="status"
                  className={`rounded-xl border p-4 space-y-2 ${
                    urlValidation.canAutoDownload
                      ? 'bg-[var(--ios-green-tint)] border-[var(--ios-green-border)]'
                      : 'bg-[var(--ios-orange-tint)] border-[var(--ios-orange-border)]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {urlValidation.canAutoDownload ? (
                      <CheckCircle2 className="w-4 h-4 text-ios-green mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-ios-orange mt-0.5 shrink-0" />
                    )}
                    <div className="space-y-1 text-xs min-w-0">
                      <p className="font-semibold text-ios-label text-sm">
                        {urlValidation.message}
                      </p>
                      {urlValidation.hostname && (
                        <p className="text-ios-secondary break-all">
                          Source host: <span className="font-mono">{urlValidation.hostname}</span>
                          {urlValidation.detectedFilename && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono">{urlValidation.detectedFilename}</span>
                            </>
                          )}
                        </p>
                      )}
                      {urlValidation.restrictionReason && (
                        <p className="text-ios-secondary leading-relaxed">
                          {urlValidation.restrictionReason}
                        </p>
                      )}
                      {!urlValidation.canAutoDownload && (
                        <div className="pt-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Upload className="w-3.5 h-3.5" />}
                            onClick={() => setInputMode('upload')}
                          >
                            Switch to Local Upload Instead
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-ios-bg border border-ios-sep p-4 text-xs text-ios-secondary space-y-1">
                <p className="font-medium text-ios-label">Supported URL Sources & Restrictions</p>
                <p>
                  Direct downloadable MP4, MOV, MKV, and WEBM links or authorized media URLs are supported. YouTube URLs are recognized for inspection, but ClipCat never bypasses platform restrictions, DRM, or login gates—download your authorized video file and upload locally if restricted.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Processing Configuration */}
      <ProcessingConfigPanel
        config={config}
        errors={configErrors}
        onChange={(patch) => {
          updateConfig(patch);
          setConfigErrors({});
        }}
      />

      {/* Summary & Primary CTA */}
      <section className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] sm:static z-20 rounded-xl bg-ios-surface/95 backdrop-blur-md border border-ios-sep p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-lg sm:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1 min-w-0">
            <h3 className="font-display text-sm sm:text-base font-bold text-ios-label">
              Ready to Start Clipping
            </h3>
            <p className="text-xs text-ios-secondary tabular-nums line-clamp-2 sm:line-clamp-none">
              {config.desiredClipCount} target clips · {config.minDurationSec}–{config.maxDurationSec}s · {config.aspectRatio} · {config.layoutMode.replace(/_/g, ' ')} ·{' '}
              {config.captionsEnabled ? `Captions (${config.captionPresetId})` : 'No captions'} ·{' '}
              {config.outputResolution} MP4
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {isSubmitting && uploadAbortRef.current && (
              <Button
                variant="danger"
                className="flex-1 sm:flex-initial"
                onClick={() => uploadAbortRef.current?.abort()}
              >
                Abort Upload
              </Button>
            )}
            <Button
              variant="accent-purple"
              size="lg"
              className="w-full sm:w-auto"
              loading={isSubmitting}
              disabled={!hasValidSource && inputMode === 'url'}
              icon={<Play className="w-4 h-4" />}
              onClick={handleStartClipping}
            >
              Start Clipping
            </Button>
          </div>
        </div>

        {submitError && (
          <p role="alert" className="text-xs text-ios-red">
            {submitError}
          </p>
        )}
      </section>
    </div>
  );
}
