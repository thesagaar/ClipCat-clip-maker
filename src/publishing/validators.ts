import type {
  ConnectedAccount,
  PublishMetadataPackage,
  PublishOverrides,
  PublishPlatform,
  PublishValidationResult,
} from './types.ts';

export const MAX_YOUTUBE_TITLE_CHARS = 100;
export const MAX_YOUTUBE_DESCRIPTION_CHARS = 5000;
export const MAX_YOUTUBE_TOTAL_TAG_CHARS = 500;
export const MAX_INSTAGRAM_CAPTION_CHARS = 2200;
export const MAX_INSTAGRAM_HASHTAGS = 30;
export const MAX_INSTAGRAM_REEL_DURATION_SEC = 15 * 60;

export function validatePublishPackage(params: {
  pkg: PublishMetadataPackage;
  platform: PublishPlatform;
  account: ConnectedAccount | null;
  overrides?: PublishOverrides;
  clipFileSizeBytes: number | null;
  duplicateMatch?: { id: string; status: string; publishedUrl: string | null } | null;
  allowDuplicateRepublish?: boolean;
}): PublishValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { pkg, platform, account, overrides } = params;

  if (!pkg.rights.readyToConfirm) {
    errors.push(
      pkg.rights.status === 'restricted_or_unverified'
        ? 'Publishing blocked: Source content has derivative or commercial restrictions flagged.'
        : 'Rights confirmation required: Confirm you created this clip or hold permission/license to publish it.'
    );
  }

  for (const w of pkg.rights.warnings) {
    warnings.push(w);
  }
  if (pkg.attribution.warning && !pkg.attribution.originalCreatorName && !pkg.attribution.originalCreatorHandle) {
    warnings.push(pkg.attribution.warning);
  }

  if (pkg.durationSec <= 0) {
    errors.push('Clip duration must be greater than 0 seconds.');
  }

  if (!account || !account.connected) {
    errors.push(
      platform === 'youtube'
        ? 'YouTube account is not connected. Authorize your YouTube channel first.'
        : 'Instagram account is not connected. Authorize an eligible Business/Creator account first.'
    );
  } else if (!account.eligible) {
    errors.push(
      account.eligibilityReason ??
        `Connected ${platform} account is not eligible for direct API publishing.`
    );
  }

  if (platform === 'youtube') {
    const title = (overrides?.title ?? pkg.platforms.youtube.title).trim();
    const description = (overrides?.description ?? pkg.platforms.youtube.description).trim();
    const tags = overrides?.tags ?? pkg.platforms.youtube.tags;

    if (!title) {
      errors.push('YouTube video title cannot be empty.');
    } else if (title.length > MAX_YOUTUBE_TITLE_CHARS) {
      errors.push(`YouTube title exceeds ${MAX_YOUTUBE_TITLE_CHARS} characters (${title.length}).`);
    }
    if (/[<>]/.test(title) || /[<>]/.test(description)) {
      errors.push('YouTube titles and descriptions must not contain < or > angle brackets.');
    }
    if (description.length > MAX_YOUTUBE_DESCRIPTION_CHARS) {
      errors.push(
        `YouTube description exceeds ${MAX_YOUTUBE_DESCRIPTION_CHARS} characters (${description.length}).`
      );
    }
    const joinedTagsLen = tags.join(',').length;
    if (joinedTagsLen > MAX_YOUTUBE_TOTAL_TAG_CHARS) {
      errors.push(
        `Combined YouTube tags exceed the ${MAX_YOUTUBE_TOTAL_TAG_CHARS}-character API limit (${joinedTagsLen}).`
      );
    }
    for (const w of pkg.platforms.youtube.warnings) {
      warnings.push(w);
    }
  } else {
    const caption = (overrides?.instagramCaption ?? pkg.platforms.instagram.caption).trim();
    if (caption.length > MAX_INSTAGRAM_CAPTION_CHARS) {
      errors.push(
        `Instagram caption exceeds ${MAX_INSTAGRAM_CAPTION_CHARS} characters (${caption.length}).`
      );
    }
    const hashtagMatches = caption.match(/#[a-zA-Z0-9_\u00C0-\u024F]+/g) ?? [];
    if (hashtagMatches.length > MAX_INSTAGRAM_HASHTAGS) {
      errors.push(
        `Instagram caption exceeds the ${MAX_INSTAGRAM_HASHTAGS}-hashtag limit (${hashtagMatches.length}).`
      );
    }
    if (pkg.durationSec > MAX_INSTAGRAM_REEL_DURATION_SEC) {
      errors.push('Instagram Reels cannot exceed 15 minutes (900 seconds).');
    }
    if (account && account.connected && account.instagramMediaTransferMode !== 'https_signed_relay') {
      errors.push(
        'Instagram direct API upload requires an HTTPS public media transfer URL (CLIPCAT_PUBLIC_MEDIA_BASE_URL). Use Export & Manual Share Bundle for purely local setups.'
      );
    }
    for (const w of pkg.platforms.instagram.warnings) {
      warnings.push(w);
    }
  }

  let duplicateWarning: string | null = null;
  if (params.duplicateMatch) {
    const urlNote = params.duplicateMatch.publishedUrl
      ? ` (${params.duplicateMatch.publishedUrl})`
      : '';
    duplicateWarning = `This clip already has a ${params.duplicateMatch.status} ${platform} publication${urlNote}.`;
    if (!params.allowDuplicateRepublish) {
      errors.push(
        `${duplicateWarning} Enable "Allow duplicate re-publish" explicitly if you intend to upload again.`
      );
    } else {
      warnings.push(`${duplicateWarning} Re-publishing allowed by explicit confirmation.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: Array.from(new Set(errors)),
    warnings: Array.from(new Set(warnings)),
    duplicateWarning,
    clipFileSizeBytes: params.clipFileSizeBytes,
    clipDurationSec: pkg.durationSec,
  };
}
