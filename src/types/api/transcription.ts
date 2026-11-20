import type { WhisperModelSize } from '../settings';
import type {
  Transcript,
  TranscriptSegment,
  TranscriptWord,
} from '../transcript';

export type {
  Transcript,
  TranscriptSegment,
  TranscriptWord,
  WhisperModelSize,
};

export interface StartTranscriptionRequest {
  modelSize?: WhisperModelSize;
  language?: string | null;
}
