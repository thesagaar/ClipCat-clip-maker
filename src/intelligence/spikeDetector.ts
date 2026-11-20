import type {
  ChatEvent,
  ChatSpikeDetectionConfig,
  DetectedSpike,
  RollingSecondBucket,
  SpikeSensitivity,
} from './types';

export interface SensitivityPresetParams {
  zThreshold: number;
  minRatioAboveMedian: number;
  defaultMinMessagesPerSec: number;
  defaultMinUniqueParticipants: number;
  baselineFloor: number;
}

export const SENSITIVITY_PRESETS: Record<SpikeSensitivity, SensitivityPresetParams> = {
  low: {
    zThreshold: 4.5,
    minRatioAboveMedian: 2.5,
    defaultMinMessagesPerSec: 5,
    defaultMinUniqueParticipants: 3,
    baselineFloor: 0.85,
  },
  medium: {
    zThreshold: 3.1,
    minRatioAboveMedian: 2.0,
    defaultMinMessagesPerSec: 3,
    defaultMinUniqueParticipants: 2,
    baselineFloor: 0.7,
  },
  high: {
    zThreshold: 2.1,
    minRatioAboveMedian: 1.5,
    defaultMinMessagesPerSec: 2,
    defaultMinUniqueParticipants: 2,
    baselineFloor: 0.5,
  },
};

export function createDefaultDetectionConfig(): ChatSpikeDetectionConfig {
  return {
    sensitivity: 'medium',
    preRollSec: 20,
    postRollSec: 40,
    minSpikeMessagesPerSec: null,
    minUniqueParticipants: null,
    cooldownSec: 30,
    spamDedupWindowSec: 4,
    spamMaxRepeatsPerUser: 2,
    videoStartOffsetSec: 0,
    chatStartOffsetSec: 0,
    manualSyncOffsetSec: 0,
    mergeOverlappingClips: true,
    mergeGapSec: 8,
    aspectRatio: '9:16',
    resolution: '1080p',
    captionsEnabled: true,
    whisperModel: 'small',
  };
}

export function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Filters duplicate/flood spam from repeated identical messages per user within
 * `spamDedupWindowSec` and caps rapid bursts per user in a rolling 3-second window.
 */
export function filterSpamFloodEvents(
  events: readonly ChatEvent[],
  spamDedupWindowSec: number,
  spamMaxRepeatsPerUser: number
): { accepted: ChatEvent[]; spamFilteredCount: number } {
  const dedupWindow = Math.max(0, spamDedupWindowSec);
  const maxRepeats = Math.max(1, spamMaxRepeatsPerUser);
  const lastSameMessageByUser = new Map<string, number>();
  const recentTimestampsByUser = new Map<string, number[]>();

  const accepted: ChatEvent[] = [];
  let spamFilteredCount = 0;

  for (const ev of events) {
    const userMsgKey = `${ev.normalizedUser}\u0000${ev.normalizedMessage}`;
    const lastSameTs = lastSameMessageByUser.get(userMsgKey);
    if (
      dedupWindow > 0 &&
      lastSameTs !== undefined &&
      ev.timestampSec - lastSameTs < dedupWindow
    ) {
      spamFilteredCount++;
      continue;
    }

    const userHistory = recentTimestampsByUser.get(ev.normalizedUser) ?? [];
    const pruned = userHistory.filter((ts) => ev.timestampSec - ts <= Math.max(2, dedupWindow));
    if (pruned.length >= maxRepeats + 2) {
      spamFilteredCount++;
      recentTimestampsByUser.set(ev.normalizedUser, pruned);
      continue;
    }

    pruned.push(ev.timestampSec);
    recentTimestampsByUser.set(ev.normalizedUser, pruned);
    lastSameMessageByUser.set(userMsgKey, ev.timestampSec);
    accepted.push(ev);
  }

  return { accepted, spamFilteredCount };
}

/**
 * Computes rolling 1-second activity counters, smoothed velocity,
 * and hybrid Rolling Median + MAD baseline scores over `[0 .. durationCeilSec]`.
 */
export function buildRollingMetricsAndDetectSpikes(params: {
  events: readonly ChatEvent[];
  videoDurationSec: number;
  config: ChatSpikeDetectionConfig;
}): {
  timeseries: RollingSecondBucket[];
  spikes: DetectedSpike[];
  spamFilteredCount: number;
} {
  const { events, videoDurationSec, config } = params;
  const maxEventSec =
    events.length > 0 ? Math.max(...events.map((e) => Math.max(0, e.timestampSec))) : 0;
  const effectiveDuration = Math.max(
    1,
    Math.ceil(videoDurationSec > 0 ? videoDurationSec : maxEventSec + 1)
  );

  // Filter out-of-range events and spam floods
  const inBounds = events.filter(
    (e) => e.timestampSec >= 0 && e.timestampSec <= effectiveDuration
  );

  const { accepted, spamFilteredCount } = filterSpamFloodEvents(
    inBounds,
    config.spamDedupWindowSec,
    config.spamMaxRepeatsPerUser
  );

  const rawPerSec = new Array<number>(effectiveDuration).fill(0);
  const filteredPerSec = new Array<number>(effectiveDuration).fill(0);
  const usersPerSec = Array.from({ length: effectiveDuration }, () => new Set<string>());
  const reactionPerSec = new Array<number>(effectiveDuration).fill(0);
  const emojiPerSec = new Array<number>(effectiveDuration).fill(0);
  const eventsBySecond: ChatEvent[][] = Array.from({ length: effectiveDuration }, () => []);

  for (const ev of inBounds) {
    const sec = Math.min(effectiveDuration - 1, Math.max(0, Math.floor(ev.timestampSec)));
    rawPerSec[sec]++;
  }

  for (const ev of accepted) {
    const sec = Math.min(effectiveDuration - 1, Math.max(0, Math.floor(ev.timestampSec)));
    filteredPerSec[sec]++;
    usersPerSec[sec].add(ev.normalizedUser);
    if (
      ev.matchedKeywords.length > 0 ||
      ev.isAllCapsBurst ||
      ev.isExclamationBurst
    ) {
      reactionPerSec[sec]++;
    }
    if (ev.hasEmoji) {
      emojiPerSec[sec]++;
    }
    eventsBySecond[sec].push(ev);
  }

  // Rolling 3-second velocity (centered smoothing) & global stream characteristics
  const velocityPerSec = new Array<number>(effectiveDuration).fill(0);
  for (let s = 0; s < effectiveDuration; s++) {
    const lo = Math.max(0, s - 1);
    const hi = Math.min(effectiveDuration - 1, s + 1);
    let sum = 0;
    for (let k = lo; k <= hi; k++) sum += filteredPerSec[k];
    velocityPerSec[s] = sum / (hi - lo + 1);
  }

  const preset = SENSITIVITY_PRESETS[config.sensitivity];
  const minMessagesPerSec =
    config.minSpikeMessagesPerSec ?? preset.defaultMinMessagesPerSec;
  const minUniqueParticipants =
    config.minUniqueParticipants ?? preset.defaultMinUniqueParticipants;

  const globalMedian = medianOf(filteredPerSec);
  const halfWindow = Math.min(15, Math.max(4, Math.floor(effectiveDuration / 4)));

  const timeseries: RollingSecondBucket[] = [];
  const candidateSeconds: number[] = [];

  for (let s = 0; s < effectiveDuration; s++) {
    const winStart = Math.max(0, s - halfWindow);
    const winEnd = Math.min(effectiveDuration - 1, s + halfWindow);
    // Exclude +/- 2s around the candidate peak so large spikes do not inflate their own baseline
    const backgroundVals: number[] = [];
    for (let k = winStart; k <= winEnd; k++) {
      if (Math.abs(k - s) <= 2 && effectiveDuration > 10) continue;
      backgroundVals.push(filteredPerSec[k]);
    }
    if (backgroundVals.length === 0) {
      backgroundVals.push(...filteredPerSec.slice(winStart, winEnd + 1));
    }

    const localMed = medianOf(backgroundVals);
    const baseline = backgroundVals.length >= 4 ? localMed : globalMedian;
    const absDevs = backgroundVals.map((v) => Math.abs(v - baseline));
    const mad = medianOf(absDevs);
    const madScale = Math.max(1.4826 * mad, preset.baselineFloor);

    const count = filteredPerSec[s];
    const zScore = (count - baseline) / madScale;
    const ratio = count / Math.max(0.5, baseline);
    const uniqueCount = usersPerSec[s].size;

    timeseries.push({
      second: s,
      totalMessages: rawPerSec[s],
      filteredMessages: count,
      uniqueUsers: uniqueCount,
      reactionHits: reactionPerSec[s],
      emojiHits: emojiPerSec[s],
      velocityPerSec: Number(velocityPerSec[s].toFixed(2)),
      medianBaseline: Number(baseline.toFixed(2)),
      madScale: Number(madScale.toFixed(2)),
      zScore: Number(zScore.toFixed(2)),
    });

    const meetsVolume = count >= minMessagesPerSec;
    const meetsParticipants = uniqueCount >= minUniqueParticipants;
    const meetsStatisticalSpike =
      zScore >= preset.zThreshold && ratio >= preset.minRatioAboveMedian;
    // Also detect genuine sudden surge against local quiet baseline when enough unique chatters react
    const meetsBurstFallback =
      count >= Math.max(minMessagesPerSec, Math.ceil(baseline + 2.5)) &&
      zScore >= preset.zThreshold * 0.8 &&
      meetsParticipants;

    if (meetsVolume && meetsParticipants && (meetsStatisticalSpike || meetsBurstFallback)) {
      candidateSeconds.push(s);
    }
  }

  if (candidateSeconds.length === 0) {
    return { timeseries, spikes: [], spamFilteredCount };
  }

  // Group contiguous or cooldown-adjacent triggered seconds into distinct peaks
  const cooldownSec = Math.max(1, config.cooldownSec);
  const groups: number[][] = [];
  for (const sec of candidateSeconds) {
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup || sec - lastGroup[lastGroup.length - 1] > cooldownSec) {
      groups.push([sec]);
    } else {
      lastGroup.push(sec);
    }
  }

  const spikes: DetectedSpike[] = groups.map((group, idx) => {
    // Pick exact peak second within the burst
    let peakSec = group[0];
    let peakVal = -1;
    for (const sec of group) {
      const score =
        filteredPerSec[sec] * 1.0 +
        usersPerSec[sec].size * 0.4 +
        reactionPerSec[sec] * 0.25;
      if (score > peakVal) {
        peakVal = score;
        peakSec = sec;
      }
    }

    const windowStartSec = Math.max(0, group[0] - 2);
    const windowEndSec = Math.min(effectiveDuration, group[group.length - 1] + 3);

    const windowEvents: ChatEvent[] = [];
    const uniqueWindowUsers = new Set<string>();
    const keywordFreq = new Map<string, number>();
    let reactionWindowCount = 0;

    for (let s = windowStartSec; s < Math.min(effectiveDuration, windowEndSec); s++) {
      for (const ev of eventsBySecond[s]) {
        windowEvents.push(ev);
        uniqueWindowUsers.add(ev.normalizedUser);
        if (ev.matchedKeywords.length > 0 || ev.hasEmoji || ev.isAllCapsBurst) {
          reactionWindowCount++;
        }
        for (const kw of ev.matchedKeywords) {
          keywordFreq.set(kw, (keywordFreq.get(kw) ?? 0) + 1);
        }
      }
    }

    const dominantKeywords = [...keywordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([kw]) => kw);

    // Compute sustainment: consecutive/active seconds around peak >= 50% of peak rate
    const halfPeak = Math.max(1, filteredPerSec[peakSec] * 0.5);
    let sustainSeconds = 1;
    for (let s = peakSec - 1; s >= Math.max(0, peakSec - 10); s--) {
      if (filteredPerSec[s] >= halfPeak) sustainSeconds++;
      else break;
    }
    for (let s = peakSec + 1; s <= Math.min(effectiveDuration - 1, peakSec + 10); s++) {
      if (filteredPerSec[s] >= halfPeak) sustainSeconds++;
      else break;
    }

    const bucket = timeseries[peakSec];
    const peakRate = filteredPerSec[peakSec];
    const baselineRate = bucket.medianBaseline;

    return {
      id: `spike-${idx + 1}-${peakSec}`,
      peakTimestampSec: peakSec,
      windowStartSec,
      windowEndSec,
      peakMessagesPerSec: peakRate,
      peakUniqueUsers: usersPerSec[peakSec].size,
      totalMessagesInWindow: windowEvents.length,
      uniqueParticipantsInWindow: uniqueWindowUsers.size,
      baselineRate,
      madScale: bucket.madScale,
      spikeRatio: Number((peakRate / Math.max(0.5, baselineRate)).toFixed(2)),
      zScorePeak: bucket.zScore,
      reactionDensity:
        windowEvents.length > 0
          ? Number((reactionWindowCount / windowEvents.length).toFixed(2))
          : 0,
      sustainSeconds,
      dominantKeywords,
      sampleMessages: windowEvents.slice(0, 6).map((e) => ({
        username: e.username,
        message: e.message,
        timestampSec: Number(e.timestampSec.toFixed(1)),
      })),
    };
  });

  // Order highest-impact spikes first, keeping chronological tie-break
  spikes.sort((a, b) => b.zScorePeak - a.zScorePeak || a.peakTimestampSec - b.peakTimestampSec);

  return { timeseries, spikes, spamFilteredCount };
}
