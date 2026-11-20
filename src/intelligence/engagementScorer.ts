import type { DetectedSpike, EngagementScoreBreakdown } from './types';

export const HEURISTIC_ENGAGEMENT_DISCLAIMER =
  'Heuristic audience-chat engagement score derived from local chat velocity vs baseline, unique participants, reaction signals, and sustainment. This is not a prediction or guarantee of social media virality.';

export function computeHeuristicEngagementScore(
  spike: Pick<
    DetectedSpike,
    | 'spikeRatio'
    | 'zScorePeak'
    | 'peakMessagesPerSec'
    | 'baselineRate'
    | 'uniqueParticipantsInWindow'
    | 'reactionDensity'
    | 'sustainSeconds'
    | 'dominantKeywords'
  >
): EngagementScoreBreakdown {
  // 1. Spike Intensity relative to surrounding baseline (0-35 pts)
  const ratioNorm = Math.min(1, Math.max(0, (spike.spikeRatio - 1.2) / 5.5));
  const zNorm = Math.min(1, Math.max(0, spike.zScorePeak / 7));
  const intensity = Math.round((ratioNorm * 0.65 + zNorm * 0.35) * 35);

  // 2. Unique Participant Breadth (0-25 pts) — rewards crowd breadth over single-user chatter
  const uniqueNorm = Math.min(
    1,
    Math.log1p(Math.max(0, spike.uniqueParticipantsInWindow)) / Math.log1p(25)
  );
  const uniqueParticipants = Math.round(uniqueNorm * 25);

  // 3. Reaction Keyword + Emoji + Caps Density (0-25 pts)
  const kwBonus = Math.min(0.25, spike.dominantKeywords.length * 0.06);
  const reactionDensity = Math.round(
    Math.min(1, Math.max(0, spike.reactionDensity * 0.85 + kwBonus)) * 25
  );

  // 4. Sustainment across consecutive seconds (0-15 pts)
  const sustainNorm = Math.min(1, Math.max(0, spike.sustainSeconds / 8));
  const sustainment = Math.round(sustainNorm * 15);

  const score = Math.min(
    100,
    Math.max(1, intensity + uniqueParticipants + reactionDensity + sustainment)
  );

  const label =
    score >= 80
      ? 'High Reaction Spike'
      : score >= 60
        ? 'Strong Chat Surge'
        : score >= 40
          ? 'Notable Activity Burst'
          : 'Mild Activity Lift';

  const reasons: string[] = [];
  if (spike.baselineRate > 0) {
    reasons.push(
      `Chat rate hit ${spike.peakMessagesPerSec} msg/s (${spike.spikeRatio.toFixed(1)}x local baseline of ${spike.baselineRate.toFixed(1)} msg/s)`
    );
  } else {
    reasons.push(
      `Sudden burst of ${spike.peakMessagesPerSec} msg/s against quiet chat baseline`
    );
  }
  reasons.push(
    `${spike.uniqueParticipantsInWindow} unique chat participant${spike.uniqueParticipantsInWindow === 1 ? '' : 's'} active around peak`
  );
  if (spike.dominantKeywords.length > 0) {
    reasons.push(
      `Reaction keywords (${spike.dominantKeywords.slice(0, 4).join(', ')}) present in ${Math.round(spike.reactionDensity * 100)}% of burst messages`
    );
  } else if (spike.reactionDensity > 0.25) {
    reasons.push(
      `Expressive emoji/caps reactions present in ${Math.round(spike.reactionDensity * 100)}% of burst messages`
    );
  }
  if (spike.sustainSeconds >= 3) {
    reasons.push(`Sustained reaction energy for ${spike.sustainSeconds} seconds`);
  }

  return {
    score,
    label,
    disclaimer: HEURISTIC_ENGAGEMENT_DISCLAIMER,
    reasons,
    components: {
      intensity,
      uniqueParticipants,
      reactionDensity,
      sustainment,
    },
  };
}
