import { buildAndMergeClipCandidates } from './clipMerging.ts';
import { buildRollingMetricsAndDetectSpikes } from './spikeDetector.ts';
import type {
  ChatEvent,
  ChatSourceAdapter,
  ChatSpikeCandidate,
  ChatSpikeDetectionConfig,
  DetectionEngine,
  DetectionEngineContext,
  DetectionEngineOutput,
  RollingSecondBucket,
} from './types';

export class ChatSpikeEngine implements DetectionEngine {
  readonly id = 'chat_spike_v1';
  readonly name = 'ChatSpike Engine';
  readonly signalType = 'chat' as const;
  readonly availability = 'available' as const;
  readonly availabilityNote =
    'Active: Rolling Median + MAD audience chat burst detector with spam filtering and reaction keyword scoring.';

  analyze(context: DetectionEngineContext): DetectionEngineOutput {
    const result = buildRollingMetricsAndDetectSpikes({
      events: context.events,
      videoDurationSec: context.videoDurationSec,
      config: context.config,
    });

    return {
      engineId: this.id,
      available: true,
      spikes: result.spikes,
      timeseries: result.timeseries,
      spamFilteredCount: result.spamFilteredCount,
      notes: [
        `Processed ${context.events.length} aligned events (${result.spamFilteredCount} spam/flood duplicates filtered).`,
      ],
    };
  }
}

export class AudioSenseEngine implements DetectionEngine {
  readonly id = 'audio_sense_planned';
  readonly name = 'AudioSense Engine';
  readonly signalType = 'audio' as const;
  readonly availability = 'planned' as const;
  readonly availabilityNote =
    'Planned module: Acoustic RMS loudness and crowd-cheer inflection detection is not enabled in this build.';

  analyze(): DetectionEngineOutput {
    return {
      engineId: this.id,
      available: false,
      spikes: [],
      timeseries: [],
      spamFilteredCount: 0,
      notes: [this.availabilityNote],
    };
  }
}

export class VisionSenseEngine implements DetectionEngine {
  readonly id = 'vision_sense_planned';
  readonly name = 'VisionSense Engine';
  readonly signalType = 'vision' as const;
  readonly availability = 'planned' as const;
  readonly availabilityNote =
    'Planned module: Scene-cut velocity and scoreboard/action frame delta detection is not enabled in this build.';

  analyze(): DetectionEngineOutput {
    return {
      engineId: this.id,
      available: false,
      spikes: [],
      timeseries: [],
      spamFilteredCount: 0,
      notes: [this.availabilityNote],
    };
  }
}

export const REGISTERED_DETECTION_ENGINES: readonly DetectionEngine[] = [
  new ChatSpikeEngine(),
  new AudioSenseEngine(),
  new VisionSenseEngine(),
];

export const REGISTERED_CHAT_SOURCE_ADAPTERS: readonly ChatSourceAdapter[] = [
  {
    id: 'local_file_import',
    platform: 'Local Chat Log (JSON / JSONL / CSV / TXT)',
    availability: 'available',
    requiresOfficialCredentials: false,
    availabilityNote: 'Ready for local file upload and timestamp alignment.',
  },
  {
    id: 'twitch_official_api',
    platform: 'Twitch Official Helix / EventSub Archive',
    availability: 'unavailable_offline',
    requiresOfficialCredentials: true,
    availabilityNote:
      'Unavailable offline: requires configured official Twitch API credentials. ClipCat never scrapes or bypasses platform restrictions.',
  },
  {
    id: 'youtube_live_chat_api',
    platform: 'YouTube LiveChatMessages Official API',
    availability: 'unavailable_offline',
    requiresOfficialCredentials: true,
    availabilityNote:
      'Unavailable offline: requires configured official YouTube Data API v3 credentials. ClipCat never bypasses DRM or anti-bot protections.',
  },
];

export function runDecisionEngine(params: {
  jobId: string;
  events: readonly ChatEvent[];
  videoDurationSec: number;
  config: ChatSpikeDetectionConfig;
}): {
  timeseries: RollingSecondBucket[];
  candidates: ChatSpikeCandidate[];
  spamFilteredCount: number;
  engineNotes: string[];
} {
  const outputs: DetectionEngineOutput[] = REGISTERED_DETECTION_ENGINES.filter(
    (engine) => engine.availability === 'available'
  ).map((engine) =>
    engine.analyze({
      events: params.events,
      videoDurationSec: params.videoDurationSec,
      config: params.config,
    })
  );

  const primary = outputs.find((o) => o.engineId === 'chat_spike_v1');
  const spikes = outputs.flatMap((o) => o.spikes);
  const candidates = buildAndMergeClipCandidates({
    jobId: params.jobId,
    spikes,
    events: params.events,
    videoDurationSec: params.videoDurationSec,
    config: params.config,
  });

  return {
    timeseries: primary?.timeseries ?? [],
    candidates,
    spamFilteredCount: primary?.spamFilteredCount ?? 0,
    engineNotes: outputs.flatMap((o) => o.notes),
  };
}
