import { useNavigate } from 'react-router-dom';
import { ArrowRight, Captions, LayoutTemplate, Smartphone } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useProjectDraftStore } from '../stores/projectDraftStore';
import { useUiStore } from '../stores/uiStore';
import type { ProcessingConfig } from '../types/project';

interface WorkflowTemplate {
  id: string;
  name: string;
  targetPlatform: string;
  description: string;
  config: Partial<ProcessingConfig>;
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'podcast-vertical',
    name: 'Podcast Highlight 9:16',
    targetPlatform: 'YouTube Shorts · Reels · TikTok',
    description:
      'Smart face tracking crop with 35–60s complete thought extraction and Minimal White captions.',
    config: {
      desiredClipCount: 6,
      minDurationSec: 20,
      preferredDurationSec: 45,
      maxDurationSec: 75,
      aspectRatio: '9:16',
      layoutMode: 'smart_face_tracking',
      captionsEnabled: true,
      captionPresetId: 'minimal-white',
      speakerLabels: true,
      outputResolution: '1080p',
      outputFps: 30,
    },
  },
  {
    id: 'fast-shorts-hook',
    name: 'Short-Form Hook Format',
    targetPlatform: 'TikTok · YouTube Shorts',
    description:
      'Shorter 15–40s focused moments paired with Bold Yellow centered word-by-word captions.',
    config: {
      desiredClipCount: 8,
      minDurationSec: 15,
      preferredDurationSec: 28,
      maxDurationSec: 45,
      aspectRatio: '9:16',
      layoutMode: 'smart_face_tracking',
      captionsEnabled: true,
      captionPresetId: 'bold-yellow',
      captionPosition: 'center',
      wordByWordAnimation: true,
      outputResolution: '1080p',
      outputFps: 30,
    },
  },
  {
    id: 'educational-breakdown',
    name: 'Educational Clean Explainer',
    targetPlatform: 'Instagram Reels · LinkedIn',
    description:
      'Blurred background preserves slide/screen context while keeping legible lower-third captions.',
    config: {
      desiredClipCount: 5,
      minDurationSec: 30,
      preferredDurationSec: 60,
      maxDurationSec: 90,
      aspectRatio: '9:16',
      layoutMode: 'blurred_background',
      captionsEnabled: true,
      captionPresetId: 'educational-clean',
      captionPosition: 'bottom',
      wordByWordAnimation: false,
      outputResolution: '1080p',
      outputFps: 30,
    },
  },
  {
    id: 'dual-speaker-split',
    name: 'Two-Speaker Split Screen',
    targetPlatform: 'Podcasts · Debates · Gaming',
    description:
      'Vertical split-screen layout for interviews or screen-share + facecam sessions.',
    config: {
      desiredClipCount: 5,
      minDurationSec: 20,
      preferredDurationSec: 45,
      maxDurationSec: 80,
      aspectRatio: '9:16',
      layoutMode: 'split_screen',
      captionsEnabled: true,
      captionPresetId: 'modern-podcast',
      speakerLabels: true,
      outputResolution: '1080p',
      outputFps: 30,
    },
  },
];

export function TemplatesPage() {
  const navigate = useNavigate();
  const { applyTemplateConfig } = useProjectDraftStore();
  const { addToast } = useUiStore();

  const handleApplyTemplate = (template: WorkflowTemplate) => {
    applyTemplateConfig(template.config);
    addToast({
      variant: 'success',
      title: 'Template Applied',
      description: `Loaded "${template.name}" settings into New Project.`,
    });
    navigate('/projects/new');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-ios-label">
          Workflow Templates
        </h2>
        <p className="text-sm text-ios-secondary mt-1">
          Start faster with curated framing, duration, and caption presets tuned for each video format.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {WORKFLOW_TEMPLATES.map((template) => (
          <article
            key={template.id}
            className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 flex flex-col justify-between gap-5"
          >
            <div className="space-y-3 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-ios-blue">
                  {template.targetPlatform}
                </span>
                <LayoutTemplate className="w-4 h-4 text-ios-secondary shrink-0" aria-hidden="true" />
              </div>

              <h3 className="font-display text-lg font-bold text-ios-label">
                {template.name}
              </h3>

              <p className="text-sm text-ios-secondary leading-relaxed">
                {template.description}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-ios-secondary font-mono tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
                  {template.config.aspectRatio}
                </span>
                <span>
                  {template.config.minDurationSec}–{template.config.maxDurationSec}s
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Captions className="w-3.5 h-3.5" aria-hidden="true" />
                  {template.config.captionPresetId}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-ios-sep flex justify-end">
              <Button
                icon={<ArrowRight className="w-4 h-4" />}
                onClick={() => handleApplyTemplate(template)}
              >
                Use Template
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
