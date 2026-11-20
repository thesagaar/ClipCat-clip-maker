import type { Clip } from '../types/clip';
import type { AspectRatio, Project } from '../types/project';
import type { Transcript } from '../types/transcript';

export type PublishPlatform = 'youtube' | 'instagram';
export type YouTubeFormat = 'short' | 'video';
export type YouTubePrivacy = 'private' | 'unlisted' | 'public';

export type AttributionStatus =
  | 'verified'
  | 'user_provided'
  | 'ATTRIBUTION_UNVERIFIED';

export type RightsStatus =
  | 'owner_confirmed'
  | 'licensed_or_permitted'
  | 'requires_user_confirmation'
  | 'restricted_or_unverified';

export type PublishingJobStatus =
  | 'preparing_media'
  | 'validating_metadata'
  | 'uploading'
  | 'processing_platform'
  | 'published'
  | 'failed'
  | 'requires_attention'
  | 'cancelled';

export interface ConnectedAccount {
  platform: PublishPlatform;
  connected: boolean;
  configured: boolean;
  configHint: string;
  redirectUri: string;
  accountId: string | null;
  accountName: string | null;
  accountHandle: string | null;
  accountType: string | null;
  eligible: boolean;
  eligibilityReason: string | null;
  scopes: string[];
  tokenExpiresAt: string | null;
  instagramMediaTransferMode: 'https_signed_relay' | 'manual_export_fallback';
}

export interface SourceMetadataInput {
  sourceUrl?: string;
  creatorName?: string;
  creatorHandle?: string;
  channelName?: string;
  sourceVideoTitle?: string;
  sourcePlatform?: string;
  license?: string;
  copyrightNotice?: string;
  userOwnsContent?: boolean;
  userHasPermission?: boolean;
  thirdPartyMusicOrSegments?: boolean;
  commercialOrDerivativeRestricted?: boolean;
}

export interface AttributionInfo {
  status: AttributionStatus;
  roleDistinctionNote: string;
  originalCreatorName: string | null;
  originalCreatorHandle: string | null;
  originalChannelName: string | null;
  sourceVideoTitle: string | null;
  sourceUrl: string | null;
  sourcePlatform: string | null;
  copyrightNotice: string | null;
  license: string | null;
  verifiedByOfficialApi: boolean;
  formattedCreditYouTube: string | null;
  formattedCreditInstagram: string | null;
  warning: string | null;
}

export interface RightsChecklistItem {
  id: string;
  label: string;
  passed: boolean | null; // null = requires confirmation
  detail: string;
}

export interface RightsAssessment {
  status: RightsStatus;
  readyToConfirm: boolean;
  summary: string;
  legalDisclaimer: string;
  warnings: string[];
  checklist: RightsChecklistItem[];
}

export interface TitleCandidate {
  title: string;
  strategy: 'topic_question' | 'direct_statement' | 'key_takeaway';
  score: number;
}

export interface CaptionPackageSummary {
  available: boolean;
  embedded: boolean;
  subtitleFormatsSupported: Array<'srt' | 'vtt'>;
  youtubeCaptionUploadSupported: boolean;
  instagramCaptionApiNote: string;
  language: string;
  translated: boolean;
  translationLabel: string | null;
  lineCount: number;
  srtContent: string;
  vttContent: string;
  cleanedTranscriptExcerpt: string;
}

export interface YouTubePlatformPackage {
  ready: boolean;
  format: YouTubeFormat;
  privacy: YouTubePrivacy;
  madeForKids: boolean;
  categoryId: string;
  categoryLabel: string;
  title: string;
  description: string;
  hashtags: string[];
  tags: string[];
  language: string;
  attributionText: string | null;
  sourceUrl: string | null;
  thumbnailAvailable: boolean;
  captionTrackUploadSupported: boolean;
  shortsEligibilityNote: string;
  warnings: string[];
  errors: string[];
}

export interface InstagramPlatformPackage {
  ready: boolean;
  format: 'reel';
  caption: string;
  hashtags: string[];
  attributionText: string | null;
  coverImageAvailable: boolean;
  embeddedCaptionsRecommended: boolean;
  directPublishSupported: boolean;
  mediaTransferNote: string;
  manualShareBundleAvailable: boolean;
  warnings: string[];
  errors: string[];
}

export interface PublishMetadataPackage {
  clipId: string;
  clipTitleSource: string;
  durationSec: number;
  aspectRatio: AspectRatio;
  resolution: string;
  language: string;
  languageLabel: string;
  translationNote: string | null;
  generatedAt: string;
  aiAssistedDisclosureIncluded: boolean;
  content: {
    title: string;
    titleCandidates: TitleCandidate[];
    description: string;
    hashtags: string[];
    instagramHashtags: string[];
    tags: string[];
    captions: CaptionPackageSummary;
  };
  attribution: AttributionInfo;
  rights: RightsAssessment;
  platforms: {
    youtube: YouTubePlatformPackage;
    instagram: InstagramPlatformPackage;
  };
}

export interface MetadataGenerateRequestInput {
  clip: Clip;
  project?: Project | null;
  transcript?: Transcript | null;
  srtContent?: string | null;
  vttContent?: string | null;
  sourceInput?: SourceMetadataInput;
  youtubeFormat?: YouTubeFormat;
  youtubePrivacy?: YouTubePrivacy;
  madeForKids?: boolean;
  includeAiDisclosure?: boolean;
  preferredLanguage?: string;
}

export interface PublishOverrides {
  title?: string;
  description?: string;
  hashtags?: string[];
  tags?: string[];
  youtubeFormat?: YouTubeFormat;
  youtubePrivacy?: YouTubePrivacy;
  madeForKids?: boolean;
  categoryId?: string;
  uploadSeparateCaptions?: boolean;
  instagramCaption?: string;
}

export interface PublishValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  duplicateWarning: string | null;
  clipFileSizeBytes: number | null;
  clipDurationSec: number;
}

export interface PublishStartRequest {
  clip: Clip;
  project?: Project | null;
  transcript?: Transcript | null;
  srtContent?: string | null;
  vttContent?: string | null;
  sourceInput?: SourceMetadataInput;
  platform: PublishPlatform;
  overrides?: PublishOverrides;
  includeAiDisclosure?: boolean;
  userConfirmedPublish: boolean;
  allowDuplicateRepublish?: boolean;
  idempotencyKey: string;
}

export interface PublishJobRecord {
  id: string;
  clipId: string;
  clipTitle: string;
  platform: PublishPlatform;
  format: YouTubeFormat | 'reel';
  privacy: YouTubePrivacy | null;
  accountName: string | null;
  accountHandle: string | null;
  status: PublishingJobStatus;
  progressPercent: number | null; // Strictly real uploaded/total bytes, or null when indeterminate
  bytesUploaded: number;
  totalBytes: number;
  stageMessage: string;
  publishedUrl: string | null;
  platformMediaId: string | null;
  idempotencyKey: string;
  errorCode: string | null;
  errorMessage: string | null;
  retryable: boolean;
  clipAvailableLocally: boolean;
  packageSnapshot: PublishMetadataPackage;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface PublishHistoryItem {
  id: string;
  clipId: string;
  clipTitle: string;
  platform: PublishPlatform;
  format: YouTubeFormat | 'reel';
  privacy: YouTubePrivacy | null;
  accountName: string | null;
  accountHandle: string | null;
  status: PublishingJobStatus;
  publishedUrl: string | null;
  platformMediaId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryable: boolean;
  clipAvailableLocally: boolean;
  attributionStatus: AttributionStatus;
  rightsStatus: RightsStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}
