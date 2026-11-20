import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import type { AttributionInfo, RightsAssessment, SourceMetadataInput } from '../../publishing/types';
import { Input } from '../ui/Input';
import { StatusIndicator } from '../ui/StatusIndicator';

interface RightsAttributionPanelProps {
  attribution: AttributionInfo;
  rights: RightsAssessment;
  sourceInput: SourceMetadataInput;
  onChangeSourceInput: (patch: Partial<SourceMetadataInput>) => void;
}

export function RightsAttributionPanel({
  attribution,
  rights,
  sourceInput,
  onChangeSourceInput,
}: RightsAttributionPanelProps) {
  const [showCreatorFields, setShowCreatorFields] = useState(
    Boolean(sourceInput.creatorName || sourceInput.creatorHandle || sourceInput.sourceUrl)
  );

  const attrStatusView =
    attribution.status === 'verified'
      ? { status: 'completed' as const, label: 'Verified Source Attribution' }
      : attribution.status === 'user_provided'
        ? { status: 'uploaded' as const, label: 'User-Provided Attribution' }
        : { status: 'needs_attention' as const, label: 'ATTRIBUTION_UNVERIFIED' };

  return (
    <section
      aria-label="Creator Attribution and Publishing Rights"
      className="rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-ios-blue" aria-hidden="true" />
            <h3 className="font-display text-base font-bold text-ios-label">
              Creator Attribution &amp; Publishing Rights
            </h3>
          </div>
          <p className="text-xs text-ios-secondary leading-relaxed">
            {attribution.roleDistinctionNote}
          </p>
        </div>
        <StatusIndicator status={attrStatusView.status} customLabel={attrStatusView.label} />
      </div>

      {/* Ownership vs Permission checkboxes */}
      <div className="rounded-lg bg-ios-bg border border-ios-sep p-4 space-y-3">
        <label className="flex items-start gap-3 text-xs text-ios-label cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(sourceInput.userOwnsContent)}
            onChange={(e) => onChangeSourceInput({ userOwnsContent: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-ios-sep accent-[#0A84FF] cursor-pointer"
          />
          <span>
            <strong className="font-semibold block">I created or own the rights to this footage</strong>
            <span className="text-ios-secondary">
              Original recordings you filmed or stream VODs you own may be published even when no external source attribution exists.
            </span>
          </span>
        </label>

        {!sourceInput.userOwnsContent && (
          <label className="flex items-start gap-3 text-xs text-ios-label cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(sourceInput.userHasPermission)}
              onChange={(e) => onChangeSourceInput({ userHasPermission: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-ios-sep accent-[#0A84FF] cursor-pointer"
            />
            <span>
              <strong className="font-semibold block">I hold permission or an active license to re-upload</strong>
              <span className="text-ios-secondary">
                Crediting a creator does not substitute for copyright permission when clipping third-party content.
              </span>
            </span>
          </label>
        )}

        <div className="pt-1 flex flex-wrap gap-x-6 gap-y-2 border-t border-ios-sep/70">
          <label className="flex items-center gap-2 text-xs text-ios-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(sourceInput.thirdPartyMusicOrSegments)}
              onChange={(e) =>
                onChangeSourceInput({ thirdPartyMusicOrSegments: e.target.checked })
              }
              className="h-4 w-4 rounded border-ios-sep accent-[#FF9F0A] cursor-pointer"
            />
            <span>Includes third-party music or segments</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-ios-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(sourceInput.commercialOrDerivativeRestricted)}
              onChange={(e) =>
                onChangeSourceInput({ commercialOrDerivativeRestricted: e.target.checked })
              }
              className="h-4 w-4 rounded border-ios-sep accent-[#FF9F0A] cursor-pointer"
            />
            <span>Commercial or derivative use restricted</span>
          </label>
        </div>
      </div>

      {/* Optional Source / Creator Credit Inputs (never auto-fabricated) */}
      <div>
        <button
          type="button"
          onClick={() => setShowCreatorFields((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ios-blue hover:underline cursor-pointer"
        >
          {showCreatorFields ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>
            {showCreatorFields
              ? 'Hide Original Source & Creator Credit Fields'
              : 'Add Original Source & Creator Credit (Optional)'}
          </span>
        </button>

        {showCreatorFields && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-ios-bg border border-ios-sep p-4">
            <Input
              label="Original Creator Name"
              placeholder="e.g., Jane Doe"
              value={sourceInput.creatorName ?? ''}
              onChange={(e) => onChangeSourceInput({ creatorName: e.target.value })}
            />
            <Input
              label="Creator Handle"
              placeholder="e.g., @janedoe"
              value={sourceInput.creatorHandle ?? ''}
              onChange={(e) => onChangeSourceInput({ creatorHandle: e.target.value })}
            />
            <Input
              label="Channel / Studio Name"
              placeholder="e.g., TechBench Live"
              value={sourceInput.channelName ?? ''}
              onChange={(e) => onChangeSourceInput({ channelName: e.target.value })}
            />
            <Input
              label="Original Source URL (HTTPS)"
              placeholder="https://youtube.com/watch?v=..."
              value={sourceInput.sourceUrl ?? ''}
              onChange={(e) => onChangeSourceInput({ sourceUrl: e.target.value })}
            />
            <Input
              label="License (Only if verified)"
              placeholder="e.g., CC-BY 4.0 or Written Permission"
              value={sourceInput.license ?? ''}
              onChange={(e) => onChangeSourceInput({ license: e.target.value })}
            />
            <Input
              label="Copyright Notice (Optional)"
              placeholder="e.g., © 2026 Original Creator"
              value={sourceInput.copyrightNotice ?? ''}
              onChange={(e) => onChangeSourceInput({ copyrightNotice: e.target.value })}
            />
          </div>
        )}
      </div>

      {/* Rights assessment & warnings */}
      <div className="space-y-2 text-xs">
        <div
          className={`rounded-lg border p-3 flex items-start gap-2.5 ${
            rights.readyToConfirm
              ? 'bg-[var(--ios-green-tint)] border-[var(--ios-green-border)] text-ios-green'
              : 'bg-[var(--ios-orange-tint)] border-[var(--ios-orange-border)] text-ios-orange'
          }`}
        >
          {rights.readyToConfirm ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="font-semibold">{rights.summary}</p>
            {rights.warnings.map((w, idx) => (
              <p key={idx} className="text-ios-label/90">
                {w}
              </p>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-ios-tertiary-label leading-relaxed">
          {rights.legalDisclaimer}
        </p>
      </div>
    </section>
  );
}
