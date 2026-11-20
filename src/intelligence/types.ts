import type { AspectRatio, OutputResolution } from '../types/project';

export type ChatSourceFormat = 'json' | 'jsonl' | 'csv' | 'txt';
export type SpikeSensitivity = 'low' | 'medium' | 'high';
export type AlignmentConfidence = 'high' | 'medium' | 'low';

export interface ChatEvent {
  id: string;
  /** Mapped timestamp in seconds relative to video t=0 */
  timestampSec: number;
  /** Parsed raw relative/epoch timestamp before offset normalization */
  rawTimestampSec: number;
  /** Original timestamp token/string from the chat log */
  rawTimestamp: string;
  username: string;
  normalizedUser: string;
  message: string;
  normalizedMessage: string;
  hasEmoji: boolean;
  matchedKeywords: string[];
  isAllCapsBurst: boolean;
  isExclamationBurst: boolean;
}

export interface ChatAlignmentSettings {
  videoStartOffsetSec: number;
  chatStartOffsetSec: number;
  manualSyncOffsetSec: number;
  videoDurationSec?: number | null;
}

export interface ChatLogParseResult {
  format: ChatSourceFormat;
  events: ChatEvent[];
  totalLines: number;
  validEvents: number;
  skippedLines: number;
  outOfBoundsCount: number;
  minTimestampSec: number | null;
  maxTimestampSec: number | null;
  inferredClockBaseSec: number | null;
  alignmentConfidence: AlignmentConfidence;
  alignmentNotes: string[];
  warnings: string[];
  sampleEvents: Array<{
    timestampSec: number;
    rawTimestamp: string;
    username: string;
    message: string;
  }>;
}

export interface RollingSecondBucket {
  second: number;
  totalMessages: number;
  filteredMessages: number;
  uniqueUsers: number;
  reactionHits: number;
  emojiHits: number;
  velocityPerSec: number;
  medianBaseline: number;
  madScale: number;
  zScore: number;
}

export interface DetectedSpike {
  id: string;
  peakTimestampSec: number;
  windowStartSec: number;
  windowEndSec: number;
  peakMessagesPerSec: number;
  peakUniqueUsers: number;
  totalMessagesInWindow: number;
  uniqueParticipantsInWindow: number;
  baselineRate: number;
  madScale: number;
  spikeRatio: number;
  zScorePeak: number;
  reactionDensity: number;
  sustainSeconds: number;
  dominantKeywords: string[];
  sampleMessages: Array<{
    username: string;
    message: string;
    timestampSec: number;
  }>;
}

export interface ChatSpikeDetectionConfig {
  sensitivity: SpikeSensitivity;
  preRollSec: number;
  postRollSec: number;
  minSpikeMessagesPerSec: number | null;
  minUniqueParticipants: number | null;
  cooldownSec: number;
  spamDedupWindowSec: number;
  spamMaxRepeatsPerUser: number;
  videoStartOffsetSec: number;
  chatStartOffsetSec: number;
  manualSyncOffsetSec: number;
  mergeOverlappingClips: boolean;
  mergeGapSec: number;
  aspectRatio: AspectRatio;
  resolution: OutputResolution;
  captionsEnabled: boolean;
  whisperModel: 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';
}

export interface EngagementScoreBreakdown {
  score: number;
  label: string;
  disclaimer: string;
  reasons: string[];
  components: {
    intensity: number;
    uniqueParticipants: number;
    reactionDensity: number;
    sustainment: number;
  };
}

export type CandidateReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ChatSpikeCandidate {
  id: string;
  jobId: string;
  title: string;
  status: CandidateReviewStatus;
  renderStatus: 'pending' | 'rendering' | 'ready' | 'failed';
  startSec: number;
  endSec: number;
  durationSec: number;
  peakSpikeSec: number;
  constituentSpikeTimestamps: number[];
  engagementScore: number;
  engagementReasons: string[];
  engagementDisclaimer: string;
  scoreComponents: EngagementScoreBreakdown['components'];
  peakMessagesPerSec: number;
  uniqueParticipants: number;
  dominantKeywords: string[];
  sampleMessages: Array<{
    username: string;
    message: string;
    timestampSec: number;
  }>;
  aspectRatio: AspectRatio;
  resolution: OutputResolution;
  captionsEnabled: boolean;
  captionsSrt: string;
  captionsVtt: string;
  previewUrl: string | null;
  downloadUrl: string | null;
  srtUrl: string | null;
  vttUrl: string | null;
  metadataUrl: string | null;
  thumbnailUrl: string | null;
  fileSizeBytes: number | null;
  savedClipId: string | null;
  errorMessage?: string | null;
}

export type ChatSpikeJobStatus =
  | 'draft'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ChatSpikeStage {
  id: string;
  label: string;
  status: 'waiting' | 'running' | 'completed' | 'failed' | 'cancelled';
  progressPercent: number | null;
  detail?: string;
}

export interface ChatSpikeVideoInfo {
  originalFilename: string;
  fileSizeBytes: number;
  durationSec: number;
  width: number;
  height: number;
  fps: number | null;
  codec: string | null;
  hasAudio: boolean;
}

export interface ChatSpikeJob {
  id: string;
  projectName: string;
  status: ChatSpikeJobStatus;
  overallProgress: number;
  currentTask: string;
  video: ChatSpikeVideoInfo | null;
  chatSummary: Omit<ChatLogParseResult, 'events'> | null;
  config: ChatSpikeDetectionConfig;
  stages: ChatSpikeStage[];
  logs: string[];
  timeseries: RollingSecondBucket[];
  candidates: ChatSpikeCandidate[];
  savedProjectId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DetectionEngineContext {
  events: readonly ChatEvent[];
  videoDurationSec: number;
  config: ChatSpikeDetectionConfig;
}

export interface DetectionEngineOutput {
  engineId: string;
  available: boolean;
  spikes: DetectedSpike[];
  timeseries: RollingSecondBucket[];
  spamFilteredCount: number;
  notes: string[];
}

export interface DetectionEngine {
  readonly id: string;
  readonly name: string;
  readonly signalType: 'chat' | 'audio' | 'vision';
  readonly availability: 'available' | 'planned';
  readonly availabilityNote: string;
  analyze(context: DetectionEngineContext): DetectionEngineOutput;
}

export interface ChatSourceAdapter {
  readonly id: string;
  readonly platform: string;
  readonly availability: 'available' | 'unavailable_offline' | 'planned';
  readonly requiresOfficialCredentials: boolean;
  readonly availabilityNote: string;
}
