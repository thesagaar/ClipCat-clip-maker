import type { Clip } from '../types/clip';
import type { Project } from '../types/project';
import type {
  AttributionInfo,
  RightsAssessment,
  RightsChecklistItem,
  SourceMetadataInput,
} from './types.ts';

function cleanOptionalText(value: string | null | undefined, maxLen = 140): string | null {
  if (!value) return null;
  const trimmed = value.replace(/[\r\n\0]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

export function sanitizeHttpSourceUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.')
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function inferSourcePlatformFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube';
    if (host.includes('instagram.com')) return 'Instagram';
    if (host.includes('twitch.tv')) return 'Twitch';
    if (host.includes('vimeo.com')) return 'Vimeo';
    return host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function normalizeHandle(raw: string | null): string | null {
  if (!raw) return null;
  const clean = raw.replace(/^@+/, '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 60);
  return clean ? `@${clean}` : null;
}

/**
 * Builds transparent source attribution without ever fabricating creator names,
 * handles, URLs, licences, or ownership claims.
 */
export function buildAttributionInfo(
  clip: Clip,
  project?: Project | null,
  sourceInput?: SourceMetadataInput
): AttributionInfo {
  const safeProjectUrl = sanitizeHttpSourceUrl(project?.sourceUrl ?? null);
  const safeUserUrl = sanitizeHttpSourceUrl(sourceInput?.sourceUrl ?? null);
  const resolvedSourceUrl = safeUserUrl ?? safeProjectUrl;

  const creatorName = cleanOptionalText(sourceInput?.creatorName, 100);
  const creatorHandle = normalizeHandle(cleanOptionalText(sourceInput?.creatorHandle, 64));
  const channelName = cleanOptionalText(sourceInput?.channelName, 100);
  const sourceVideoTitle =
    cleanOptionalText(sourceInput?.sourceVideoTitle, 140) ??
    (resolvedSourceUrl ? cleanOptionalText(project?.name ?? clip.projectName ?? null, 140) : null);
  const sourcePlatform =
    cleanOptionalText(sourceInput?.sourcePlatform, 40) ??
    inferSourcePlatformFromUrl(resolvedSourceUrl);
  const copyrightNotice = cleanOptionalText(sourceInput?.copyrightNotice, 160);
  const license = cleanOptionalText(sourceInput?.license, 100);

  const hasUserSuppliedCredit = Boolean(
    creatorName || creatorHandle || channelName || safeUserUrl || copyrightNotice || license
  );
  const hasProjectSourceUrlOnly = Boolean(!hasUserSuppliedCredit && safeProjectUrl);

  let status: AttributionInfo['status'] = 'ATTRIBUTION_UNVERIFIED';
  if (hasUserSuppliedCredit && (creatorName || creatorHandle || channelName) && resolvedSourceUrl) {
    // Only consider external metadata verified if an authorized API attached creator + source URL;
    // user-entered values remain explicitly labeled 'user_provided' unless marked verified upstream.
    status = 'user_provided';
  } else if (hasUserSuppliedCredit || hasProjectSourceUrlOnly) {
    status = 'user_provided';
  }

  const creditSubject =
    creatorHandle ?? creatorName ?? channelName ?? (copyrightNotice ? copyrightNotice : null);

  let formattedCreditYouTube: string | null = null;
  let formattedCreditInstagram: string | null = null;

  if (creditSubject || resolvedSourceUrl) {
    const ytLines: string[] = [];
    if (creditSubject) {
      ytLines.push(
        channelName && channelName !== creditSubject
          ? `Original creator: ${creditSubject} (${channelName})`
          : `Original creator: ${creditSubject}`
      );
    }
    if (sourceVideoTitle) {
      ytLines.push(`Source: ${sourceVideoTitle}`);
    }
    if (resolvedSourceUrl) {
      ytLines.push(`Watch the original: ${resolvedSourceUrl}`);
    }
    if (license) {
      ytLines.push(`License stated by source: ${license}`);
    }
    formattedCreditYouTube = ytLines.join('\n');

    const igLines: string[] = [];
    if (creatorHandle || creatorName || channelName) {
      igLines.push(`Original creator: ${creatorHandle ?? creatorName ?? channelName}`);
    }
    if (sourceVideoTitle) {
      igLines.push(`Source: ${sourceVideoTitle}`);
    }
    if (resolvedSourceUrl) {
      igLines.push(`Original link: ${resolvedSourceUrl}`);
    }
    formattedCreditInstagram = igLines.join('\n');
  }

  const warning =
    status === 'ATTRIBUTION_UNVERIFIED' && !sourceInput?.userOwnsContent
      ? 'Source creator and ownership could not be verified automatically (ATTRIBUTION_UNVERIFIED). Confirm you created this video or enter verified creator attribution before publishing.'
      : null;

  return {
    status,
    roleDistinctionNote:
      'Original creator, copyright owner, uploader, license holder, and local ClipCat user are distinct roles; attributing a creator never grants copyright reuse permission.',
    originalCreatorName: creatorName,
    originalCreatorHandle: creatorHandle,
    originalChannelName: channelName,
    sourceVideoTitle,
    sourceUrl: resolvedSourceUrl,
    sourcePlatform,
    copyrightNotice,
    license,
    verifiedByOfficialApi: false,
    formattedCreditYouTube,
    formattedCreditInstagram,
    warning,
  };
}

/**
 * Performs non-legal-advice rights-readiness checks before explicit user confirmation.
 * Allows publishing user's own original clips cleanly even when external attribution is absent.
 */
export function assessRightsReadiness(
  _clip: Clip,
  _project: Project | null | undefined,
  attribution: AttributionInfo,
  sourceInput?: SourceMetadataInput
): RightsAssessment {
  const userOwns = sourceInput?.userOwnsContent === true;
  const userHasPerm = sourceInput?.userHasPermission === true;
  const hasThirdPartyMusic = sourceInput?.thirdPartyMusicOrSegments === true;
  const restricted = sourceInput?.commercialOrDerivativeRestricted === true;

  const warnings: string[] = [];

  if (restricted) {
    warnings.push(
      'Source material has derivative-work or commercial restrictions flagged; verify rights before publishing.'
    );
  }
  if (hasThirdPartyMusic) {
    warnings.push(
      'Third-party copyrighted music or video segments flagged; platforms may mute, claim, or block the upload without proper clearance.'
    );
  }
  if (!userOwns && !userHasPerm) {
    warnings.push(
      attribution.status === 'ATTRIBUTION_UNVERIFIED'
        ? 'Ownership and reuse permission are unconfirmed, and source attribution is ATTRIBUTION_UNVERIFIED.'
        : 'Source attribution is filled in, but attribution alone does not grant reuse rights. Confirm you hold permission or a compatible license.'
    );
  }

  const checklist: RightsChecklistItem[] = [
    {
      id: 'ownership_or_permission',
      label: 'Original creator or explicit permission / compatible license',
      passed: userOwns || userHasPerm ? true : null,
      detail: userOwns
        ? 'Marked as your own original content.'
        : userHasPerm
          ? 'Reuse permission or compatible license confirmed by user.'
          : 'Confirm whether you own this video or hold reuse permission.',
    },
    {
      id: 'attribution_check',
      label: 'Source attribution recorded when reusing external footage',
      passed: userOwns || attribution.status !== 'ATTRIBUTION_UNVERIFIED',
      detail: userOwns
        ? 'Original user content does not require external third-party creator credit.'
        : attribution.status === 'ATTRIBUTION_UNVERIFIED'
          ? 'ATTRIBUTION_UNVERIFIED — supply creator/source URL if sourced from another creator.'
          : `Attribution status: ${attribution.status}.`,
    },
    {
      id: 'third_party_audio_video',
      label: 'No uncleared third-party music or embedded segments',
      passed: hasThirdPartyMusic ? false : userOwns || userHasPerm ? true : null,
      detail: hasThirdPartyMusic
        ? 'Third-party copyrighted audio/video flagged for review.'
        : 'Confirm no uncleared music/clips remain.',
    },
    {
      id: 'derivative_restrictions',
      label: 'Compatible with derivative / transformed short-form upload',
      passed: !restricted,
      detail: restricted
        ? 'Marked restricted against derivative or commercial redistribution.'
        : 'No derivative restriction flagged.',
    },
  ];

  let status: RightsAssessment['status'];
  if (restricted) {
    status = 'restricted_or_unverified';
  } else if (userOwns) {
    status = 'owner_confirmed';
  } else if (userHasPerm && attribution.status !== 'ATTRIBUTION_UNVERIFIED') {
    status = 'licensed_or_permitted';
  } else if (userHasPerm) {
    status = 'licensed_or_permitted';
  } else {
    status = 'requires_user_confirmation';
  }

  const readyToConfirm = !restricted && (userOwns || userHasPerm);

  const summary =
    status === 'owner_confirmed'
      ? 'Ready: Marked as your original content.'
      : status === 'licensed_or_permitted'
        ? hasThirdPartyMusic
          ? 'Permission confirmed, but third-party audio/video warning remains active.'
          : 'Ready: License or creator permission confirmed.'
        : status === 'restricted_or_unverified'
          ? 'Blocked: Derivative or commercial restrictions flagged.'
          : 'Confirmation required: Verify ownership or reuse permission before publishing.';

  return {
    status,
    readyToConfirm,
    summary,
    legalDisclaimer:
      'ClipCat validates workflow inputs only and cannot provide legal clearance or fair-use determinations.',
    warnings,
    checklist,
  };
}
