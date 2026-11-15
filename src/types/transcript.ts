export interface TranscriptWord {
  word: string;
  startSec: number;
  endSec: number;
  confidence?: number;
}

export interface TranscriptSegment {
  id: string;
  speaker?: string | null;
  startSec: number;
  endSec: number;
  text: string;
  words?: TranscriptWord[];
}

export interface Transcript {
  projectId: string;
  language: string;
  durationSec: number;
  modelUsed: string;
  segments: TranscriptSegment[];
}
