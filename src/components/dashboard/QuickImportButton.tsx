import { useState, type DragEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Link2,
  Play,
  Zap,
} from 'lucide-react';
import { trackAnalyticsEvent } from '../../analytics/client';
import { createProjectFromUrl, startProjectProcessing } from '../../api';
import { DEFAULT_PROCESSING_CONFIG } from '../../config/env';
import { queryKeys } from '../../hooks/useClipCatQueries';
import { useUiStore } from '../../stores/uiStore';
import type { ProcessingConfig, UrlValidationResult } from '../../types/project';
import { cn } from '../../utils/cn';
import {
  classifyAndValidateVideoUrl,
  validateProjectNameValue,
} from '../../utils/validation';
import { Button, type ButtonProps } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

interface QuickImportButtonProps {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  label?: string;
}

/**
 * Dashboard Quick Import button + modal letting users drop or paste a video link
 * to validate, create a project using default studio config, and start processing immediately.
 */
export function QuickImportButton({
  variant = 'secondary',
  size = 'lg',
  className,
  label = 'Quick Import',
}: QuickImportButtonProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast, addNotification } = useUiStore();

  const [open, setOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [projectName, setProjectName] = useState('');
  const [validation, setValidation] = useState<UrlValidationResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resetModalState = () => {
    setUrlInput('');
    setProjectName('');
    setValidation(null);
    setDragOver(false);
    setSubmitError(null);
  };

  const applyUrlValue = (rawUrl: string) => {
    setUrlInput(rawUrl);
    setSubmitError(null);
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      setValidation(null);
      return;
    }
    const res = classifyAndValidateVideoUrl(trimmed);
    setValidation(res);
    if (!projectName.trim() && res.detectedFilename) {
      const suggested = res.detectedFilename
        .replace(/\.[^/.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .trim();
      if (suggested) setProjectName(suggested);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const droppedText =
      e.dataTransfer.getData('text/uri-list') ||
      e.dataTransfer.getData('text/plain') ||
      '';
    if (droppedText.trim()) {
      applyUrlValue(droppedText.split('\n')[0]?.trim() ?? '');
    } else {
      setSubmitError(
        'Dropped item did not contain a URL. Paste a direct MP4/MOV/MKV/WEBM link below or use Upload Video.'
      );
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        applyUrlValue(text);
      }
    } catch {
      addToast({
        variant: 'info',
        title: 'Clipboard Unavailable',
        description: 'Paste the video URL directly into the input using Ctrl+V / Cmd+V.',
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    const urlResult = classifyAndValidateVideoUrl(urlInput);
    setValidation(urlResult);
    trackAnalyticsEvent('project_creation_started', { inputMode: 'url' });

    if (!urlResult.valid || !urlResult.canAutoDownload) {
      setSubmitError(
        urlResult.restrictionReason ||
          urlResult.message ||
          'Please provide a valid direct media URL (MP4, MOV, MKV, or WEBM).'
      );
      trackAnalyticsEvent('upload_validation_failed', {
        reasonCode: `quick_import_${urlResult.category}`,
      });
      return;
    }

    const candidateName =
      projectName.trim() ||
      urlResult.detectedFilename?.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() ||
      'Quick Import Clip Project';

    const nameError = validateProjectNameValue(candidateName);
    if (nameError) {
      setSubmitError(nameError);
      return;
    }

    const config: ProcessingConfig = {
      projectName: candidateName,
      outputDirectory: '',
      ...DEFAULT_PROCESSING_CONFIG,
      autoProcess: true,
    };

    setSubmitting(true);
    try {
      const created = await createProjectFromUrl({
        name: candidateName,
        url: urlInput.trim(),
        config,
      });
      const startResp = await startProjectProcessing(created.id, config);

      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });

      trackAnalyticsEvent('project_creation_completed', {
        inputMode: 'url',
        aspectRatio: config.aspectRatio,
        captionsEnabled: config.captionsEnabled,
        resolution: config.outputResolution,
      });
      trackAnalyticsEvent('processing_started', {
        aspectRatio: config.aspectRatio,
        resolution: config.outputResolution,
        captionsEnabled: config.captionsEnabled,
        desiredClipCount: config.desiredClipCount,
      });

      addNotification({
        title: 'Quick Import Started',
        message: `Project "${created.name}" queued for immediate AI clipping.`,
        type: 'info',
        href: `/projects/${created.id}/processing?jobId=${startResp.jobId}`,
      });
      addToast({
        variant: 'success',
        title: 'Import Started',
        description: `Processing started for "${created.name}".`,
      });

      resetModalState();
      setOpen(false);
      navigate(`/projects/${created.id}/processing?jobId=${startResp.jobId}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Unable to start processing from that video URL.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        icon={<Zap className="w-4 h-4" />}
        className={className}
        data-testid="quick-import-button"
      >
        {label}
      </Button>

      <Modal
        open={open}
        onClose={() => {
          if (!submitting) {
            setOpen(false);
            setSubmitError(null);
          }
        }}
        title="Quick Import Video URL"
        description="Drop or paste a direct video link (MP4, MOV, MKV, or WEBM) to launch AI clipping immediately using your studio defaults."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drag-and-drop URL zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'rounded-xl border border-dashed p-4 text-center transition-colors space-y-1.5',
              dragOver
                ? 'border-[#7040DC] bg-[rgba(112,64,220,0.12)]'
                : 'border-ios-sep-strong bg-ios-bg/60'
            )}
          >
            <div className="w-9 h-9 mx-auto rounded-lg bg-[var(--ios-blue-tint)] border border-[var(--ios-blue-border)] text-ios-cyan flex items-center justify-center">
              <Link2 className="w-4 h-4" aria-hidden="true" />
            </div>
            <p className="text-xs font-medium text-ios-label">
              Drop a video link here or enter it below
            </p>
            <p className="text-[11px] text-ios-secondary">
              Uses studio defaults ({DEFAULT_PROCESSING_CONFIG.aspectRatio},{' '}
              {DEFAULT_PROCESSING_CONFIG.outputResolution},{' '}
              {DEFAULT_PROCESSING_CONFIG.desiredClipCount} clips)
            </p>
          </div>

          {/* URL Input + Paste */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
            <div className="flex-1 min-w-0">
              <Input
                label="Video URL"
                type="url"
                maxLength={2048}
                placeholder="https://example.com/videos/podcast-episode.mp4"
                value={urlInput}
                onChange={(e) => applyUrlValue(e.target.value)}
                required
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handlePaste}
              icon={<ClipboardPaste className="w-4 h-4" />}
              className="shrink-0"
            >
              Paste
            </Button>
          </div>

          <Input
            label="Project Name (optional)"
            maxLength={120}
            placeholder="Auto-filled from video filename"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />

          {validation && (
            <div
              role="status"
              className={cn(
                'rounded-lg border p-3 text-xs flex items-start gap-2.5',
                validation.valid && validation.canAutoDownload
                  ? 'bg-[var(--ios-green-tint)] border-[var(--ios-green-border)] text-ios-green'
                  : 'bg-[var(--ios-orange-tint)] border-[var(--ios-orange-border)] text-ios-orange'
              )}
            >
              {validation.valid && validation.canAutoDownload ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium break-words">{validation.message}</p>
                {validation.restrictionReason && (
                  <p className="text-ios-secondary leading-relaxed">
                    {validation.restrictionReason}
                  </p>
                )}
              </div>
            </div>
          )}

          {submitError && (
            <p role="alert" className="text-xs font-medium text-ios-red">
              {submitError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-ios-sep">
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => {
                setOpen(false);
                setSubmitError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="accent-purple"
              loading={submitting}
              icon={<Play className="w-4 h-4" />}
            >
              Start Immediate Processing
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
