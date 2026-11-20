import { useState } from 'react';
import { Captions, Edit3, Globe, Hash, Sparkles, Tag } from 'lucide-react';
import type {
  PublishMetadataPackage,
  PublishOverrides,
  PublishPlatform,
} from '../../publishing/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface MetadataPackagePreviewProps {
  pkg: PublishMetadataPackage;
  platform: PublishPlatform;
  overrides: PublishOverrides;
  onChangeOverrides: (patch: Partial<PublishOverrides>) => void;
}

export function MetadataPackagePreview({
  pkg,
  platform,
  overrides,
  onChangeOverrides,
}: MetadataPackagePreviewProps) {
  const [editing, setEditing] = useState(false);

  const isYt = platform === 'youtube';
  const activeTitle = overrides.title ?? pkg.content.title;
  const activeDescription = isYt
    ? (overrides.description ?? pkg.platforms.youtube.description)
    : (overrides.instagramCaption ?? pkg.platforms.instagram.caption);
  const activeHashtags =
    overrides.hashtags ??
    (isYt ? pkg.platforms.youtube.hashtags : pkg.platforms.instagram.hashtags);
  const activeTags = overrides.tags ?? pkg.platforms.youtube.tags;

  return (
    <section
      aria-label="Auto-Prepared Metadata and Captions"
      className="rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#AF52DE]" aria-hidden="true" />
            <h3 className="font-display text-base font-bold text-ios-label">
              Auto-Prepared Metadata &amp; Captions
            </h3>
          </div>
          <p className="text-xs text-ios-secondary mt-0.5">
            Generated automatically from your clip transcript and settings—zero manual typing required. Review or customize before publishing.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={<Edit3 className="w-3.5 h-3.5" />}
          onClick={() => setEditing((prev) => !prev)}
        >
          {editing ? 'Done Editing' : 'Edit Metadata'}
        </Button>
      </div>

      {/* Unboxed language & captions telemetry line */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ios-secondary border-y border-ios-sep py-2.5">
        <span className="inline-flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-ios-blue" aria-hidden="true" />
          <span>
            Language: <strong className="text-ios-label">{pkg.languageLabel}</strong> ({pkg.language})
          </span>
        </span>
        {pkg.translationNote && (
          <span className="text-ios-orange font-medium">{pkg.translationNote}</span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Captions className="w-3.5 h-3.5 text-ios-green" aria-hidden="true" />
          <span>
            Captions:{' '}
            <strong className="text-ios-label">
              {pkg.content.captions.embedded ? 'Burned into MP4' : 'Sidecar Only'}
            </strong>
            {pkg.content.captions.lineCount > 0 && ` · ${pkg.content.captions.lineCount} cue lines`}
          </span>
        </span>
      </div>

      {/* Interactive Title Candidate Picker */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ios-label">
            {isYt ? 'Video Title' : 'Reel Summary Headline'}
          </span>
          <span className="font-mono tabular-nums text-ios-secondary">
            {activeTitle.length}/{isYt ? 100 : 120} chars
          </span>
        </div>

        {pkg.content.titleCandidates.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested title options">
            {pkg.content.titleCandidates.map((cand) => {
              const selected = activeTitle === cand.title;
              return (
                <button
                  key={cand.title}
                  type="button"
                  onClick={() => onChangeOverrides({ title: cand.title })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[var(--ios-blue-tint)] border-ios-blue text-ios-label'
                      : 'bg-ios-bg border-ios-sep text-ios-secondary hover:text-ios-label'
                  }`}
                >
                  {cand.title}
                </button>
              );
            })}
          </div>
        )}

        {editing ? (
          <Input
            label="Custom Title"
            maxLength={isYt ? 100 : 120}
            value={activeTitle}
            onChange={(e) => onChangeOverrides({ title: e.target.value })}
          />
        ) : (
          <p className="rounded-lg bg-ios-bg border border-ios-sep px-3.5 py-2.5 text-sm font-semibold text-ios-label">
            {activeTitle}
          </p>
        )}
      </div>

      {/* Platform Description / Caption */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="publish-desc-editor" className="font-semibold text-ios-label">
            {isYt ? 'YouTube Description (Includes Attribution & #Hashtags)' : 'Instagram Reel Caption'}
          </label>
          <span className="font-mono tabular-nums text-ios-secondary">
            {activeDescription.length}/{isYt ? 5000 : 2200} chars
          </span>
        </div>

        {editing ? (
          <textarea
            id="publish-desc-editor"
            rows={7}
            maxLength={isYt ? 5000 : 2200}
            value={activeDescription}
            onChange={(e) =>
              onChangeOverrides(
                isYt
                  ? { description: e.target.value }
                  : { instagramCaption: e.target.value }
              )
            }
            className="w-full rounded-lg bg-ios-input border border-ios-sep px-3 py-2.5 text-xs text-ios-label focus:border-ios-blue focus:outline-none leading-relaxed"
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans rounded-lg bg-ios-bg border border-ios-sep px-3.5 py-3 text-xs text-ios-label leading-relaxed max-h-56 overflow-y-auto">
            {activeDescription}
          </pre>
        )}
      </div>

      {/* Separated Hashtags & YouTube Tags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ios-label">
            <Hash className="w-3.5 h-3.5 text-ios-blue" aria-hidden="true" />
            <span>{isYt ? 'YouTube Description Hashtags' : 'Instagram Caption Hashtags'}</span>
          </div>
          {editing ? (
            <Input
              helperText="Space or comma separated #hashtags"
              value={activeHashtags.join(' ')}
              onChange={(e) =>
                onChangeOverrides({
                  hashtags: e.target.value
                    .split(/[\s,]+/)
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t) => (t.startsWith('#') ? t : `#${t}`)),
                })
              }
            />
          ) : (
            <p className="rounded-lg bg-ios-bg border border-ios-sep px-3 py-2 text-xs font-mono text-[#64D2FF]">
              {activeHashtags.length > 0 ? activeHashtags.join(' ') : 'None'}
            </p>
          )}
        </div>

        {isYt ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-ios-label">
              <span className="inline-flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#AF52DE]" aria-hidden="true" />
                <span>YouTube API Tags (No # Prefix)</span>
              </span>
              <span className="font-mono tabular-nums text-ios-secondary font-normal">
                {activeTags.join(',').length}/500 chars
              </span>
            </div>
            {editing ? (
              <Input
                helperText="Comma-separated video tags (<= 500 chars total)"
                value={activeTags.join(', ')}
                onChange={(e) =>
                  onChangeOverrides({
                    tags: e.target.value
                      .split(',')
                      .map((t) => t.trim().replace(/^#+/, ''))
                      .filter(Boolean),
                  })
                }
              />
            ) : (
              <p className="rounded-lg bg-ios-bg border border-ios-sep px-3 py-2 text-xs font-mono text-ios-secondary">
                {activeTags.length > 0 ? activeTags.join(', ') : 'None'}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-ios-bg border border-ios-sep px-3 py-2.5 text-xs text-ios-secondary leading-relaxed">
            <strong className="text-ios-label block mb-0.5">Instagram Captions Note</strong>
            {pkg.content.captions.instagramCaptionApiNote}
          </div>
        )}
      </div>
    </section>
  );
}
