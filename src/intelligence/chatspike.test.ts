import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChatLog, parseChatTimestamp } from './chatParser';
import {
  buildAndMergeClipCandidates,
  buildSynchronizedCaptions,
  clampClipWindow,
  mergeSelectedCandidates,
} from './clipMerging';
import {
  AudioSenseEngine,
  REGISTERED_CHAT_SOURCE_ADAPTERS,
  runDecisionEngine,
  VisionSenseEngine,
} from './decisionEngine';
import { computeHeuristicEngagementScore } from './engagementScorer';
import {
  buildRollingMetricsAndDetectSpikes,
  createDefaultDetectionConfig,
} from './spikeDetector';

test('parseChatTimestamp parses numeric seconds, epoch ms, MM:SS, HH:MM:SS, and ISO timestamps', () => {
  assert.deepEqual(parseChatTimestamp(42.5), {
    kind: 'relative',
    seconds: 42.5,
    rawText: '42.5',
  });
  assert.deepEqual(parseChatTimestamp('02:15'), {
    kind: 'relative',
    seconds: 135,
    rawText: '02:15',
  });
  assert.deepEqual(parseChatTimestamp('01:02:03.5'), {
    kind: 'relative',
    seconds: 3723.5,
    rawText: '01:02:03.5',
  });
  assert.equal(parseChatTimestamp('2026-11-20T12:00:05Z').kind, 'epoch');
  assert.equal(parseChatTimestamp('not-a-timestamp').kind, 'invalid');
});

test('parseChatLog parses JSON, JSONL, CSV, and TXT formats cleanly, sorts chronologically, and skips invalid lines', () => {
  const jsonInput = JSON.stringify([
    { timestamp: 15, username: 'bob', message: 'NO WAY!!!' },
    { timestamp: 5, username: 'alice', message: 'hello chat' },
    { timestamp: 'bad', username: 'charlie', message: 'skip me' },
  ]);
  const resJson = parseChatLog(jsonInput, { filename: 'chat.json' });
  assert.equal(resJson.format, 'json');
  assert.equal(resJson.validEvents, 2);
  assert.equal(resJson.skippedLines, 1);
  assert.equal(resJson.events[0].username, 'alice');
  assert.equal(resJson.events[1].matchedKeywords.includes('NO WAY'), true);

  const jsonlInput = [
    JSON.stringify({ offset_seconds: '00:10', author: 'u1', body: 'LMAO' }),
    '{malformed-json-line',
    JSON.stringify({ offset_seconds: '00:12', author: 'u2', body: 'clip it!! 🔥' }),
  ].join('\n');
  const resJsonl = parseChatLog(jsonlInput, { filename: 'stream.jsonl' });
  assert.equal(resJsonl.format, 'jsonl');
  assert.equal(resJsonl.validEvents, 2);
  assert.equal(resJsonl.skippedLines, 1);
  assert.equal(resJsonl.events[1].hasEmoji, true);

  const csvInput = [
    'timestamp,username,message',
    '12.5,viewer1,"LMAO, what a play!"',
    '14.0,viewer2,OMG',
    'invalid-row',
  ].join('\n');
  const resCsv = parseChatLog(csvInput, { filename: 'chat.csv' });
  assert.equal(resCsv.format, 'csv');
  assert.equal(resCsv.validEvents, 2);
  assert.equal(resCsv.events[0].message, 'LMAO, what a play!');

  const txtInput = [
    '[00:05] fanA: Lets go!!',
    '00:08 fanB: insane clutch',
    'random line without timestamp',
  ].join('\n');
  const resTxt = parseChatLog(txtInput, { filename: 'chat.txt' });
  assert.equal(resTxt.format, 'txt');
  assert.equal(resTxt.validEvents, 2);
  assert.equal(resTxt.skippedLines, 1);
});

test('parseChatLog handles timestamp offsets and warns on out-of-bounds / pre-stream alignment', () => {
  const eventsJson = JSON.stringify([
    { timestamp: 10, username: 'u1', message: 'before start' },
    { timestamp: 45, username: 'u2', message: 'in video peak' },
    { timestamp: 150, username: 'u3', message: 'after end' },
  ]);

  const parsed = parseChatLog(eventsJson, {
    format: 'json',
    alignment: {
      videoStartOffsetSec: 20,
      chatStartOffsetSec: 0,
      manualSyncOffsetSec: 0,
      videoDurationSec: 60,
    },
  });

  // Only t=45 -> mapped 25s stays within [0, 60]
  assert.equal(parsed.validEvents, 1);
  assert.equal(parsed.events[0].timestampSec, 25);
  assert.equal(parsed.outOfBoundsCount, 2);
  assert.equal(parsed.alignmentConfidence, 'low');
  assert.ok(parsed.alignmentNotes.length >= 2);
});

test('spikeDetector produces zero spikes on empty or steady baseline chat', () => {
  const cfg = createDefaultDetectionConfig();

  const empty = buildRollingMetricsAndDetectSpikes({
    events: [],
    videoDurationSec: 120,
    config: cfg,
  });
  assert.equal(empty.spikes.length, 0);

  // Uniform 1 msg every second from different users -> steady normal activity, no sudden spike
  const steadyText = Array.from({ length: 120 }, (_, s) => ({
    timestamp: s,
    username: `user_${s % 20}`,
    message: 'nice stream',
  }));
  const steadyParsed = parseChatLog(JSON.stringify(steadyText), { format: 'json' });
  const steady = buildRollingMetricsAndDetectSpikes({
    events: steadyParsed.events,
    videoDurationSec: 120,
    config: cfg,
  });
  assert.equal(steady.spikes.length, 0);
});

test('spikeDetector detects sudden multi-user reaction spike and filters single-user flood spam', () => {
  const records: Array<{ timestamp: number; username: string; message: string }> = [];

  // Quiet background: 1 message every 3 seconds
  for (let s = 0; s < 120; s += 3) {
    records.push({ timestamp: s, username: `bg_${s}`, message: 'watching' });
  }

  // Single-user spam flood at t=30s (same user repeating identical text 15 times) -> must be filtered!
  for (let i = 0; i < 15; i++) {
    records.push({
      timestamp: 30 + i * 0.05,
      username: 'spammer99',
      message: 'SPAM TEST',
    });
  }

  // Genuine crowd spike at t=75s (16 unique users reacting fast with keywords)
  const hypeWords = ['LMAO', 'NO WAY', 'WTF', 'CLIP IT', 'OMG', 'BRO', 'INSANE', 'KEKW'];
  for (let i = 0; i < 16; i++) {
    records.push({
      timestamp: 75 + (i % 2) * 0.25,
      username: `viewer_${i}`,
      message: `${hypeWords[i % hypeWords.length]}!! 🔥`,
    });
  }

  const parsed = parseChatLog(JSON.stringify(records), {
    format: 'json',
    alignment: { videoDurationSec: 120 },
  });
  const cfg = createDefaultDetectionConfig();
  const res = buildRollingMetricsAndDetectSpikes({
    events: parsed.events,
    videoDurationSec: 120,
    config: cfg,
  });

  assert.ok(res.spamFilteredCount >= 10, 'Spam repetitions should be filtered');
  assert.equal(res.spikes.length, 1, 'Only the real crowd reaction at t=75s should trigger');
  assert.ok(Math.abs(res.spikes[0].peakTimestampSec - 75) <= 1);
  assert.ok(res.spikes[0].dominantKeywords.length >= 2);
});

test('sensitivity presets adjust detection strictness and cooldown groups close bursts', () => {
  const records: Array<{ timestamp: number; username: string; message: string }> = [];
  for (let s = 0; s < 100; s += 4) {
    records.push({ timestamp: s, username: `bg_${s}`, message: 'ok' });
  }
  // Two moderate bursts of 3 unique messages 10s apart (above high=2 & medium=3, below low=5)
  for (let i = 0; i < 3; i++) {
    records.push({ timestamp: 41 + i * 0.2, username: `u_${i}`, message: 'LOL' });
    records.push({ timestamp: 51 + i * 0.2, username: `v_${i}`, message: 'OMG' });
  }

  const parsed = parseChatLog(JSON.stringify(records), {
    format: 'json',
    alignment: { videoDurationSec: 100 },
  });

  const lowCfg = { ...createDefaultDetectionConfig(), sensitivity: 'low' as const };
  const highCfg = { ...createDefaultDetectionConfig(), sensitivity: 'high' as const };
  const noCooldownHighCfg = { ...highCfg, cooldownSec: 3 };

  const lowRes = buildRollingMetricsAndDetectSpikes({
    events: parsed.events,
    videoDurationSec: 100,
    config: lowCfg,
  });
  const highCooldownRes = buildRollingMetricsAndDetectSpikes({
    events: parsed.events,
    videoDurationSec: 100,
    config: highCfg,
  });
  const highSeparateRes = buildRollingMetricsAndDetectSpikes({
    events: parsed.events,
    videoDurationSec: 100,
    config: noCooldownHighCfg,
  });

  assert.equal(lowRes.spikes.length, 0);
  assert.equal(highCooldownRes.spikes.length, 1);
  assert.equal(highSeparateRes.spikes.length, 2);
});

test('clip boundaries clamp cleanly for short videos and overlapping candidates merge with constituent spike history', () => {
  const clamped = clampClipWindow(-15, 95, 18);
  assert.deepEqual(clamped, { startSec: 0, endSec: 18, durationSec: 18 });

  const cfg = {
    ...createDefaultDetectionConfig(),
    preRollSec: 20,
    postRollSec: 40,
    cooldownSec: 5,
    mergeOverlappingClips: true,
    mergeGapSec: 5,
  };

  const events = parseChatLog(
    JSON.stringify([
      ...Array.from({ length: 6 }, (_, i) => ({
        timestamp: 25 + i * 0.1,
        username: `a_${i}`,
        message: 'WTF',
      })),
      ...Array.from({ length: 7 }, (_, i) => ({
        timestamp: 45 + i * 0.1,
        username: `b_${i}`,
        message: 'LMAO CLIP IT',
      })),
    ]),
    { format: 'json', alignment: { videoDurationSec: 120 } }
  ).events;

  const { spikes } = buildRollingMetricsAndDetectSpikes({
    events,
    videoDurationSec: 120,
    config: cfg,
  });

  assert.equal(spikes.length, 2);

  const candidates = buildAndMergeClipCandidates({
    jobId: 'job-test',
    spikes,
    events,
    videoDurationSec: 120,
    config: cfg,
  });

  // 25s -> [5, 65], 45s -> [25, 85] overlap -> merged [5, 85]
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].startSec, 5);
  assert.equal(candidates[0].endSec, 85);
  assert.equal(candidates[0].constituentSpikeTimestamps.length, 2);
  assert.ok(candidates[0].engagementDisclaimer.includes('not a prediction'));

  // Manual merge test on non-overlapping candidates
  const c1 = { ...candidates[0], id: 'c1', startSec: 5, endSec: 25, constituentSpikeTimestamps: [12] };
  const c2 = { ...candidates[0], id: 'c2', startSec: 40, endSec: 70, constituentSpikeTimestamps: [55] };
  const manuallyMerged = mergeSelectedCandidates([c1, c2], 120, events, 'merged-1');
  assert.equal(manuallyMerged.startSec, 5);
  assert.equal(manuallyMerged.endSec, 70);
  assert.deepEqual(manuallyMerged.constituentSpikeTimestamps, [12, 55]);
});

test('engagementScorer stays bounded 0-100 with transparent reasons and SRT/VTT captions generate cleanly', () => {
  const breakdown = computeHeuristicEngagementScore({
    spikeRatio: 6.4,
    zScorePeak: 8.2,
    peakMessagesPerSec: 14,
    baselineRate: 1.5,
    uniqueParticipantsInWindow: 22,
    reactionDensity: 0.9,
    sustainSeconds: 6,
    dominantKeywords: ['LMAO', 'CLIP IT', 'NO WAY'],
  });

  assert.ok(breakdown.score >= 70 && breakdown.score <= 100);
  assert.ok(breakdown.reasons.length >= 3);
  assert.ok(breakdown.disclaimer.toLowerCase().includes('not a prediction'));

  const parsed = parseChatLog(
    JSON.stringify([
      { timestamp: 22, username: 'alice', message: 'NO WAY!!' },
      { timestamp: 25, username: 'bob', message: 'CLIP IT!' },
    ]),
    { format: 'json' }
  );
  const captions = buildSynchronizedCaptions({
    startSec: 20,
    endSec: 40,
    events: parsed.events,
  });
  assert.ok(captions.srt.includes('00:00:02,000 -->'));
  assert.ok(captions.srt.includes('alice: NO WAY!!'));
  assert.ok(captions.vtt.startsWith('WEBVTT'));
});

test('DecisionEngine keeps AudioSense, VisionSense, and offline livestream adapters honestly marked as planned/unavailable', () => {
  const audio = new AudioSenseEngine();
  const vision = new VisionSenseEngine();
  assert.equal(audio.availability, 'planned');
  assert.equal(vision.availability, 'planned');
  assert.equal(audio.analyze().available, false);
  assert.equal(vision.analyze().available, false);

  for (const adapter of REGISTERED_CHAT_SOURCE_ADAPTERS) {
    if (adapter.requiresOfficialCredentials) {
      assert.equal(adapter.availability, 'unavailable_offline');
    }
  }

  const out = runDecisionEngine({
    jobId: 'job-de',
    events: [],
    videoDurationSec: 60,
    config: createDefaultDetectionConfig(),
  });
  assert.equal(out.candidates.length, 0);
  assert.equal(out.timeseries.length, 60);
});
