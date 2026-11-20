import type {
  AttributionInfo,
  AttributionStatus,
  CaptionPackageSummary,
  ConnectedAccount,
  InstagramPlatformPackage,
  MetadataGenerateRequestInput,
  PublishHistoryItem,
  PublishingJobStatus,
  PublishJobRecord,
  PublishMetadataPackage,
  PublishOverrides,
  PublishPlatform,
  PublishStartRequest,
  PublishValidationResult,
  RightsAssessment,
  RightsChecklistItem,
  RightsStatus,
  SourceMetadataInput,
  TitleCandidate,
  YouTubeFormat,
  YouTubePlatformPackage,
  YouTubePrivacy,
} from '../../publishing/types';

export type {
  AttributionInfo,
  AttributionStatus,
  CaptionPackageSummary,
  ConnectedAccount,
  InstagramPlatformPackage,
  MetadataGenerateRequestInput,
  PublishHistoryItem,
  PublishingJobStatus,
  PublishJobRecord,
  PublishMetadataPackage,
  PublishOverrides,
  PublishPlatform,
  PublishStartRequest,
  PublishValidationResult,
  RightsAssessment,
  RightsChecklistItem,
  RightsStatus,
  SourceMetadataInput,
  TitleCandidate,
  YouTubeFormat,
  YouTubePlatformPackage,
  YouTubePrivacy,
};

/**
 * Canonical cross-backend attribution verification vocabulary shared with Python FastAPI schemas.
 */
export type AttributionVerificationState =
  | 'VERIFIED'
  | 'USER_PROVIDED'
  | 'UNVERIFIED'
  | 'NOT_AVAILABLE'
  | 'REQUIRES_REVIEW';

export function mapAttributionToVerificationState(
  attribution: AttributionInfo,
  rights: RightsAssessment
): AttributionVerificationState {
  if (!rights.readyToConfirm) {
    return rights.status === 'restricted_or_unverified'
      ? 'REQUIRES_REVIEW'
      : 'NOT_AVAILABLE';
  }
  switch (attribution.status) {
    case 'verified':
      return 'VERIFIED';
    case 'user_provided':
      return 'USER_PROVIDED';
    case 'ATTRIBUTION_UNVERIFIED':
    default:
      return 'UNVERIFIED';
  }
}
