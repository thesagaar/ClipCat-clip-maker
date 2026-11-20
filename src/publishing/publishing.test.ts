import assert from 'node:assert/strict';
import test from 'node:test';
import { assessRightsReadiness, buildAttributionInfo, sanitizeHttpSourceUrl } from './attributionService.ts';
import { detectContentLanguage } from './languageDetector.ts';
import {
  buildYouTubeTags,
  extractKeywordsFromText,
  generatePublishMetadataPackage,
} from './metadataService.ts';
import type { ConnectedAccount } from './types';
import { validatePublishPackage } from './validators.ts';
import type { Clip } from '../types/clip';
import type { Project } from '../types/project';
import type { Transcript } from '../types/transcript';

function makeSampleClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-gpu-1',
    projectId: 'proj-gpu-1',
    projectName: 'Hardware Benchmarks 2026',
    title: 'GPU Benchmark Comparison',
    description: 'Comparing frame pacing and thermal efficiency on the new graphics card.',
    startSec: 12,
    endSec: 54,
    durationSec: 42,
    aiScore: 88,
    scoringBreakdown: {
      overallScore: 88,
      summary: 'Focused explanation with clear conclusion.',
      disclaimer: 'Guidance metric only.',
      factors: [],
    },
    aspectRatio: '9:16',
    layoutMode: 'smart_face_tracking',
    resolution: '1080p',
    fileSizeBytes: 12_400_000,
    status: 'completed',
    captionStatus: 'applied',
    exportStatus: 'ready',
    captionSettings: {
      enabled: true,
      presetId: 'minimal-white',
      fontSize: 'medium',
      position: 'bottom',
      highlightKeywords: true,
      wordByWordAnimation: true,
      speakerLabels: false,
    },
    createdAt: '2026-11-18T10:00:00Z',
    updatedAt: '2026-11-18T10:05:00Z',
    ...overrides,
  };
}

const sampleTranscript: Transcript = {
  projectId: 'proj-gpu-1',
  language: 'en',
  durationSec: 120,
  modelUsed: 'small',
  segments: [
    {
      id: 'seg-1',
      startSec: 14,
      endSec: 25,
      text: "Today we're testing the performance of the new graphics card under sustained 4K workloads.",
    },
    {
      id: 'seg-2',
      startSec: 26,
      endSec: 48,
      text: 'Power draw dropped by twenty percent while frame times stayed completely flat.',
    },
  ],
};

test('metadata generator builds non-clickbait title candidates, structured description, hashtags, and separated YouTube tags', () => {
  const clip = makeSampleClip();
  const pkg = generatePublishMetadataPackage({
    clip,
    transcript: sampleTranscript,
    srtContent: '1\n00:00:00,000 --> 00:00:04,000\ntesting the performance of the new graphics card\n',
    sourceInput: { userOwnsContent: true },
  });

  assert.ok(pkg.content.title.length >= 10 && pkg.content.title.length <= 100);
  assert.ok(pkg.content.titleCandidates.length >= 2);
  assert.ok(pkg.content.description.includes('ClipCat'));
  assert.ok(pkg.content.hashtags.includes('#Shorts'));
  assert.ok(!pkg.content.hashtags.some((h) => /fyp|viral/i.test(h)));
  assert.ok(pkg.content.tags.length > 0);
  assert.ok(pkg.content.tags.every((t) => !t.startsWith('#')), 'YouTube tags should not contain # prefix');
  assert.equal(pkg.platforms.youtube.format, 'short');
  assert.equal(pkg.platforms.youtube.categoryId, '28'); // Science & Technology
  assert.equal(pkg.platforms.youtube.privacy, 'private');
  assert.equal(pkg.platforms.youtube.captionTrackUploadSupported, true);
  assert.equal(pkg.content.captions.lineCount, 1);
});

test('hashtag extraction deduplicates case-insensitively and YouTube tags obey 500-char limit', () => {
  const tags = buildYouTubeTags(
    ['GPU', 'gpu', 'benchmark', 'ThermalEfficiency', 'fyp', 'viral', 'Graphics', 'Hardware'],
    'Testing New Graphics Card GPU Benchmark Performance',
    60
  );
  const uniqueLower = new Set(tags.map((t) => t.toLowerCase()));
  assert.equal(uniqueLower.size, tags.length);
  assert.ok(!uniqueLower.has('fyp'));
  assert.ok(!uniqueLower.has('viral'));
  assert.ok(tags.join(',').length <= 60);

  const keywords = extractKeywordsFromText('Python Python server benchmark FastAPI Python performance');
  assert.equal(keywords[0]?.toLowerCase(), 'python');
});

test('language detector identifies non-English content and marks translated captions explicitly', () => {
  const es = detectContentLanguage({
    text: 'Cuando probamos esta nueva herramienta para crear subtítulos aquí, vemos que funciona rápido.',
  });
  assert.equal(es.code, 'es');
  assert.equal(es.label, 'Spanish');

  const translated = detectContentLanguage({
    text: 'Translated text sample.',
    transcriptLanguage: 'fr',
    isTranslated: true,
  });
  assert.equal(translated.code, 'fr');
  assert.equal(translated.translated, true);
  assert.ok(translated.translationNote?.includes('translated'));
});

test('attribution service uses ATTRIBUTION_UNVERIFIED without fabricating credits and enforces ownership vs attribution rules', () => {
  const clip = makeSampleClip();
  const project: Project = {
    id: 'proj-gpu-1',
    name: 'Unnamed Upload',
    sourceType: 'upload',
    sourceFilename: 'raw_stream.mp4',
    sourceUrl: null,
    durationSec: 120,
    resolution: '1920x1080',
    fileSizeBytes: 50_000_000,
    clipCount: 1,
    status: 'completed',
    config: {
      projectName: 'Unnamed Upload',
      desiredClipCount: 3,
      minDurationSec: 15,
      preferredDurationSec: 45,
      maxDurationSec: 90,
      aspectRatio: '9:16',
      layoutMode: 'smart_face_tracking',
      captionsEnabled: true,
      captionPresetId: 'minimal-white',
      captionFontSize: 'medium',
      captionPosition: 'bottom',
      highlightKeywords: true,
      wordByWordAnimation: true,
      speakerLabels: false,
      outputFormat: 'mp4',
      videoCodec: 'h264',
      outputResolution: '1080p',
      outputFps: 30,
      autoProcess: true,
    },
    createdAt: '2026-11-18T10:00:00Z',
    updatedAt: '2026-11-18T10:05:00Z',
  };

  // No external attribution supplied, ownership unconfirmed -> ATTRIBUTION_UNVERIFIED + blocked
  const unverifiedAttr = buildAttributionInfo(clip, project, {});
  assert.equal(unverifiedAttr.status, 'ATTRIBUTION_UNVERIFIED');
  assert.equal(unverifiedAttr.originalCreatorName, null);
  assert.equal(unverifiedAttr.sourceUrl, null);
  assert.equal(unverifiedAttr.formattedCreditYouTube, null);

  const unconfirmedRights = assessRightsReadiness(clip, project, unverifiedAttr, {});
  assert.equal(unconfirmedRights.readyToConfirm, false);
  assert.equal(unconfirmedRights.status, 'requires_user_confirmation');

  // Original creator publishing their own footage -> still ATTRIBUTION_UNVERIFIED externally, but ALLOWED
  const selfOwnedRights = assessRightsReadiness(clip, project, unverifiedAttr, {
    userOwnsContent: true,
  });
  assert.equal(selfOwnedRights.readyToConfirm, true);
  assert.equal(selfOwnedRights.status, 'owner_confirmed');

  // User supplies third-party creator credit WITHOUT permission -> STILL requires permission confirmation!
  const userCreditOnly = buildAttributionInfo(clip, project, {
    creatorHandle: '@TechChannel',
    sourceUrl: 'https://www.youtube.com/watch?v=abc123',
  });
  assert.equal(userCreditOnly.status, 'user_provided');
  assert.ok(userCreditOnly.formattedCreditYouTube?.includes('@TechChannel'));
  const attrWithoutPerm = assessRightsReadiness(clip, project, userCreditOnly, {
    creatorHandle: '@TechChannel',
    userHasPermission: false,
  });
  assert.equal(attrWithoutPerm.readyToConfirm, false);
});

test('SSRF-safe URL sanitizer rejects internal hosts and credentials in source URLs', () => {
  assert.equal(sanitizeHttpSourceUrl('http://127.0.0.1:8080/secret'), null);
  assert.equal(sanitizeHttpSourceUrl('http://user:pass@example.com/vod'), null);
  assert.equal(sanitizeHttpSourceUrl('javascript:alert(1)'), null);
  assert.equal(
    sanitizeHttpSourceUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  );
});

test('validator enforces YouTube limits, Instagram HTTPS relay requirement, and duplicate prevention', () => {
  const clip = makeSampleClip();
  const pkg = generatePublishMetadataPackage({
    clip,
    transcript: sampleTranscript,
    sourceInput: { userOwnsContent: true },
  });

  const ytAccount: ConnectedAccount = {
    platform: 'youtube',
    connected: true,
    configured: true,
    configHint: '',
    redirectUri: 'http://localhost:3000/api/publishing/oauth/youtube/callback',
    accountId: 'UC123',
    accountName: 'Test Studio',
    accountHandle: '@teststudio',
    accountType: 'youtube_channel',
    eligible: true,
    eligibilityReason: null,
    scopes: [],
    tokenExpiresAt: null,
    instagramMediaTransferMode: 'manual_export_fallback',
  };

  // Duplicate match blocked unless allowDuplicateRepublish is true
  const dupBlocked = validatePublishPackage({
    pkg,
    platform: 'youtube',
    account: ytAccount,
    clipFileSizeBytes: 5_000_000,
    duplicateMatch: { id: 'pub_old', status: 'published', publishedUrl: 'https://youtube.com/watch?v=1' },
    allowDuplicateRepublish: false,
  });
  assert.equal(dupBlocked.valid, false);
  assert.ok(dupBlocked.errors.some((e) => e.includes('already has a published')));

  // Title > 100 chars rejected
  const longTitleRes = validatePublishPackage({
    pkg,
    platform: 'youtube',
    account: ytAccount,
    overrides: { title: 'A'.repeat(120) },
    clipFileSizeBytes: 5_000_000,
  });
  assert.equal(longTitleRes.valid, false);
  assert.ok(longTitleRes.errors.some((e) => e.includes('exceeds 100 characters')));

  // Instagram local setup without HTTPS relay rejected honestly
  const igAccount: ConnectedAccount = {
    ...ytAccount,
    platform: 'instagram',
    instagramMediaTransferMode: 'manual_export_fallback',
  };
  const igLocalCheck = validatePublishPackage({
    pkg,
    platform: 'instagram',
    account: igAccount,
    clipFileSizeBytes: 5_000_000,
  });
  assert.equal(igLocalCheck.valid, false);
  assert.ok(igLocalCheck.errors.some((e) => e.includes('HTTPS')));
});

import { mapAttributionToVerificationState } from '../types/api/publishing';

test('mapAttributionToVerificationState produces all 5 canonical FastAPI states accurately', () => {
  const clip = makeSampleClip();
  const baseAttr = buildAttributionInfo(clip, null, {});
  const readyRights = assessRightsReadiness(clip, null, baseAttr, { userOwnsContent: true });
  const unconfirmedRights = assessRightsReadiness(clip, null, baseAttr, {});
  const restrictedRights = assessRightsReadiness(clip, null, baseAttr, {
    commercialOrDerivativeRestricted: true,
  });

  assert.equal(
    mapAttributionToVerificationState({ ...baseAttr, status: 'verified' }, readyRights),
    'VERIFIED'
  );
  assert.equal(
    mapAttributionToVerificationState({ ...baseAttr, status: 'user_provided' }, readyRights),
    'USER_PROVIDED'
  );
  assert.equal(
    mapAttributionToVerificationState(
      { ...baseAttr, status: 'ATTRIBUTION_UNVERIFIED' },
      readyRights
    ),
    'UNVERIFIED'
  );
  assert.equal(
    mapAttributionToVerificationState(baseAttr, unconfirmedRights),
    'NOT_AVAILABLE'
  );
  assert.equal(
    mapAttributionToVerificationState(baseAttr, restrictedRights),
    'REQUIRES_REVIEW'
  );
});
