import { computeHeuristicEngagementScore } from './engagementScorer.ts';
import type {
  ChatEvent,
  ChatSpikeCandidate,
  ChatSpikeDetectionConfig,
  DetectedSpike,
} from './types';

export function formatSrtTime(sec: number): string {
  const safe = Math.max(0, sec);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const millis = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(Math.min(999, millis)).padStart(3, '0')}`;
}

export function formatVttTime(sec: number): string {
  return formatSrtTime(sec).replace(',', '.');
}

export function buildSynchronizedCaptions(params: {
  startSec: number;
  endSec: number;
  events: readonly ChatEvent[];
}): { srt: string; vtt: string } {
  const { startSec, endSec, events } = params;
  const duration = Math.max(0.5, endSec - startSec);
  const inWindow = events
    .filter((e) => e.timestampSec >= startSec && e.timestampSec <= endSec)
    .slice(0, 12);

  if (inWindow.length === 0) {
    return {
      srt: '',
      vtt: 'WEBVTT\n\n',
    };
  }

  // Group into readable 2.5s caption cues
  const cues: Array<{ start: number; end: number; text: string }> = [];
  for (const ev of inWindow) {
    const relStart = Math.max(0, Number((ev.timestampSec - startSec).toFixed(2)));
    const relEnd = Math.min(duration, Number((relStart + 2.4).toFixed(2)));
    if (relEnd <= relStart + 0.2) continue;

    const line = `${ev.username}: ${ev.message}`.slice(0, 84);
    const prev = cues[cues.length - 1];
    if (prev && Math.abs(relStart - prev.start) < 1.2 && prev.text.split('\n').length < 2) {
      prev.text = `${prev.text}\n${line}`;
      prev.end = Math.max(prev.end, relEnd);
    } else {
      cues.push({ start: relStart, end: relEnd, text: line });
    }
  }

  const srt = cues
    .map(
      (cue, idx) =>
        `${idx + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}`
    )
    .join('\n\n');

  const vtt =
    'WEBVTT\n\n' +
    cues
      .map(
        (cue, idx) =>
          `${idx + 1}\n${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}\n${cue.text}`
      )
      .join('\n\n');

  return { srt, vtt };
}

export function buildCandidateTitle(spike: DetectedSpike, index: number): string {
  const topKw = spike.dominantKeywords[0];
  const min = Math.floor(spike.peakTimestampSec / 60);
  const sec = Math.floor(spike.peakTimestampSec % 60);
  const ts = `${min}:${String(sec).padStart(2, '0')}`;
  if (topKw) {
    return `${topKw} Moment @ ${ts}`;
  }
  return `Chat Spike #${index + 1} @ ${ts}`;
}

export function clampClipWindow(
  rawStartSec: number,
  rawEndSec: number,
  videoDurationSec: number
): { startSec: number; endSec: number; durationSec: number } {
  const maxDur = Math.max(0.5, videoDurationSec);
  const startSec = Number(Math.max(0, Math.min(maxDur - 0.5, rawStartSec)).toFixed(2));
  const endSec = Number(Math.max(startSec + 0.5, Math.min(maxDur, rawEndSec)).toFixed(2));
  return {
    startSec,
    endSec,
    durationSec: Number((endSec - startSec).toFixed(2)),
  };
}

interface WorkingCluster {
  startSec: number;
  endSec: number;
  spikes: DetectedSpike[];
}

export function buildAndMergeClipCandidates(params: {
  jobId: string;
  spikes: readonly DetectedSpike[];
  events: readonly ChatEvent[];
  videoDurationSec: number;
  config: ChatSpikeDetectionConfig;
}): ChatSpikeCandidate[] {
  const { jobId, spikes, events, videoDurationSec, config } = params;
  if (spikes.length === 0) return [];

  // Expand each spike to [peak - preRoll, peak + postRoll] clamped to [0, videoDuration]
  const chronological = [...spikes].sort((a, b) => a.peakTimestampSec - b.peakTimestampSec);
  const rawClusters: WorkingCluster[] = chronological.map((spike) => {
    const { startSec, endSec } = clampClipWindow(
      spike.peakTimestampSec - Math.max(0, config.preRollSec),
      spike.peakTimestampSec + Math.max(1, config.postRollSec),
      videoDurationSec
    );
    return { startSec, endSec, spikes: [spike] };
  });

  const mergedClusters: WorkingCluster[] = [];
  if (config.mergeOverlappingClips) {
    const gapTolerance = Math.max(0, config.mergeGapSec);
    for (const cluster of rawClusters) {
      const prev = mergedClusters[mergedClusters.length - 1];
      if (prev && cluster.startSec <= prev.endSec + gapTolerance) {
        prev.endSec = Math.max(prev.endSec, cluster.endSec);
        prev.spikes.push(...cluster.spikes);
      } else {
        mergedClusters.push({
          startSec: cluster.startSec,
          endSec: cluster.endSec,
          spikes: [...cluster.spikes],
        });
      }
    }
  } else {
    mergedClusters.push(...rawClusters);
  }

  const candidates: ChatSpikeCandidate[] = mergedClusters.map((cluster, index) => {
    const primarySpike = [...cluster.spikes].sort(
      (a, b) => b.zScorePeak - a.zScorePeak || a.peakTimestampSec - b.peakTimestampSec
    )[0];

    const kwSet = new Set<string>();
    const sampleMsgs: DetectedSpike['sampleMessages'] = [];
    for (const sp of cluster.spikes) {
      sp.dominantKeywords.forEach((k) => kwSet.add(k));
      for (const m of sp.sampleMessages) {
        if (sampleMsgs.length < 8) sampleMsgs.push(m);
      }
    }

    const windowEvents = events.filter(
      (e) => e.timestampSec >= cluster.startSec && e.timestampSec <= cluster.endSec
    );
    const unionUsers = new Set(windowEvents.map((e) => e.normalizedUser));
    const dominantKeywords = [...kwSet].slice(0, 6);

    const breakdown = computeHeuristicEngagementScore({
      ...primarySpike,
      uniqueParticipantsInWindow: Math.max(
        primarySpike.uniqueParticipantsInWindow,
        unionUsers.size
      ),
      dominantKeywords,
      sustainSeconds: cluster.spikes.reduce((sum, sp) => sum + sp.sustainSeconds, 0),
    });

    const reasons = [...breakdown.reasons];
    if (cluster.spikes.length > 1) {
      reasons.push(
        `Merged ${cluster.spikes.length} overlapping spikes (${cluster.spikes
          .map((s) => `${Math.round(s.peakTimestampSec)}s`)
          .join(', ')})`
      );
    }

    const { srt, vtt } = config.captionsEnabled
      ? buildSynchronizedCaptions({
          startSec: cluster.startSec,
          endSec: cluster.endSec,
          events,
        })
      : { srt: '', vtt: '' };

    const durationSec = Number((cluster.endSec - cluster.startSec).toFixed(2));

    return {
      id: `cscand-${index + 1}-${Math.round(primarySpike.peakTimestampSec)}`,
      jobId,
      title: buildCandidateTitle(primarySpike, index),
      status: 'pending',
      renderStatus: 'pending',
      startSec: cluster.startSec,
      endSec: cluster.endSec,
      durationSec,
      peakSpikeSec: primarySpike.peakTimestampSec,
      constituentSpikeTimestamps: cluster.spikes.map((s) => s.peakTimestampSec),
      engagementScore: breakdown.score,
      engagementReasons: reasons,
      engagementDisclaimer: breakdown.disclaimer,
      scoreComponents: breakdown.components,
      peakMessagesPerSec: Math.max(...cluster.spikes.map((s) => s.peakMessagesPerSec)),
      uniqueParticipants: Math.max(
        unionUsers.size,
        ...cluster.spikes.map((s) => s.uniqueParticipantsInWindow)
      ),
      dominantKeywords,
      sampleMessages: sampleMsgs,
      aspectRatio: config.aspectRatio,
      resolution: config.resolution,
      captionsEnabled: config.captionsEnabled,
      captionsSrt: srt,
      captionsVtt: vtt,
      previewUrl: null,
      downloadUrl: null,
      srtUrl: null,
      vttUrl: null,
      metadataUrl: null,
      thumbnailUrl: null,
      fileSizeBytes: null,
      savedClipId: null,
    };
  });

  // Sort results highest heuristic engagement score first
  candidates.sort((a, b) => b.engagementScore - a.engagementScore || a.startSec - b.startSec);
  return candidates;
}

/**
 * Merges explicitly user-selected candidates during Review (Step 5), preserving
 * constituent spike timestamps, union window bounds, reasons, and re-scored heuristics.
 */
export function mergeSelectedCandidates(
  selected: readonly ChatSpikeCandidate[],
  videoDurationSec: number,
  events: readonly ChatEvent[],
  mergedId: string
): ChatSpikeCandidate {
  if (selected.length < 2) {
    throw new Error('Select at least 2 clip candidates to merge.');
  }
  const sorted = [...selected].sort((a, b) => a.startSec - b.startSec);
  const { startSec, endSec, durationSec } = clampClipWindow(
    Math.min(...sorted.map((c) => c.startSec)),
    Math.max(...sorted.map((c) => c.endSec)),
    videoDurationSec
  );

  const primary = [...sorted].sort((a, b) => b.engagementScore - a.engagementScore)[0];
  const constituentSet = new Set<number>();
  const keywordSet = new Set<string>();
  const sampleMsgs: ChatSpikeCandidate['sampleMessages'] = [];

  for (const item of sorted) {
    item.constituentSpikeTimestamps.forEach((t) => constituentSet.add(t));
    item.dominantKeywords.forEach((k) => keywordSet.add(k));
    item.sampleMessages.forEach((m) => {
      if (sampleMsgs.length < 8) sampleMsgs.push(m);
    });
  }

  const constituentSpikeTimestamps = [...constituentSet].sort((a, b) => a - b);
  const dominantKeywords = [...keywordSet].slice(0, 6);
  const peakMessagesPerSec = Math.max(...sorted.map((c) => c.peakMessagesPerSec));
  const windowEvents = events.filter(
    (e) => e.timestampSec >= startSec && e.timestampSec <= endSec
  );
  const uniqueUsers = new Set(windowEvents.map((e) => e.normalizedUser));
  const uniqueParticipants = Math.max(
    uniqueUsers.size,
    ...sorted.map((c) => c.uniqueParticipants)
  );

  const combinedScore = Math.min(
    100,
    Math.round(primary.engagementScore + Math.min(10, (sorted.length - 1) * 4))
  );

  const mergedReasons = [
    ...new Set([
      ...primary.engagementReasons.filter((r) => !r.startsWith('Manually merged')),
      `Manually merged ${sorted.length} overlapping reaction moments (peaks at ${constituentSpikeTimestamps
        .map((t) => `${Math.round(t)}s`)
        .join(', ')})`,
    ]),
  ];

  const captions = primary.captionsEnabled
    ? buildSynchronizedCaptions({ startSec, endSec, events })
    : { srt: '', vtt: '' };

  return {
    ...primary,
    id: mergedId,
    title: `${primary.title} (Merged)`,
    status: 'approved',
    renderStatus: 'pending',
    startSec,
    endSec,
    durationSec,
    constituentSpikeTimestamps,
    engagementScore: combinedScore,
    engagementReasons: mergedReasons,
    peakMessagesPerSec,
    uniqueParticipants,
    dominantKeywords,
    sampleMessages: sampleMsgs,
    captionsSrt: captions.srt,
    captionsVtt: captions.vtt,
    previewUrl: null,
    downloadUrl: null,
    srtUrl: null,
    vttUrl: null,
    metadataUrl: null,
    thumbnailUrl: null,
    fileSizeBytes: null,
    savedClipId: null,
    errorMessage: null,
  };
}
