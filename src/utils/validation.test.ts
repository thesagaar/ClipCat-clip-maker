import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROCESSING_CONFIG } from '../config/env';
import {
  classifyAndValidateVideoUrl,
  validateClipTrimRange,
  validateProcessingConfig,
  validateVideoFileInput,
} from './validation';

test('validateVideoFileInput accepts supported video formats and rejects invalid ones', () => {
  assert.equal(
    validateVideoFileInput({ name: 'podcast.mp4', size: 1024, type: 'video/mp4' }).valid,
    true
  );
  assert.equal(
    validateVideoFileInput({ name: 'recording.MOV', size: 2048, type: 'video/quicktime' }).valid,
    true
  );
  assert.equal(
    validateVideoFileInput({ name: 'lecture.mkv', size: 4096 }).valid,
    true
  );
  assert.equal(
    validateVideoFileInput({ name: 'stream.webm', size: 4096 }).valid,
    true
  );

  const unsupported = validateVideoFileInput({ name: 'notes.pdf', size: 1024, type: 'application/pdf' });
  assert.equal(unsupported.valid, false);

  const empty = validateVideoFileInput({ name: 'empty.mp4', size: 0, type: 'video/mp4' });
  assert.equal(empty.valid, false);
});

test('classifyAndValidateVideoUrl detects direct MP4, YouTube restrictions, and invalid URLs', () => {
  const direct = classifyAndValidateVideoUrl('https://cdn.example.com/media/interview.mp4');
  assert.equal(direct.valid, true);
  assert.equal(direct.canAutoDownload, true);
  assert.equal(direct.category, 'direct_mp4');
  assert.equal(direct.detectedFilename, 'interview.mp4');

  const yt = classifyAndValidateVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(yt.valid, true);
  assert.equal(yt.canAutoDownload, false);
  assert.equal(yt.category, 'youtube');
  assert.ok(yt.restrictionReason && yt.restrictionReason.length > 20);

  const shortYt = classifyAndValidateVideoUrl('https://youtu.be/abc123');
  assert.equal(shortYt.category, 'youtube');
  assert.equal(shortYt.canAutoDownload, false);

  const bad = classifyAndValidateVideoUrl('not-a-valid-url');
  assert.equal(bad.valid, false);
  assert.equal(bad.category, 'invalid');
});

test('validateProcessingConfig catches missing project name and invalid duration ranges', () => {
  const validErrors = validateProcessingConfig({
    ...DEFAULT_PROCESSING_CONFIG,
    projectName: 'Podcast Episode 1',
  });
  assert.deepEqual(validErrors, {});

  const missingName = validateProcessingConfig({
    ...DEFAULT_PROCESSING_CONFIG,
    projectName: '   ',
  });
  assert.ok(missingName.projectName);

  const badDuration = validateProcessingConfig({
    ...DEFAULT_PROCESSING_CONFIG,
    projectName: 'Valid Name',
    minDurationSec: 60,
    preferredDurationSec: 30,
    maxDurationSec: 90,
  });
  assert.ok(badDuration.durationRange);
});

test('validateClipTrimRange enforces valid positive bounds and minimum clip length', () => {
  assert.equal(validateClipTrimRange(10, 45, 120).valid, true);
  assert.equal(validateClipTrimRange(-1, 20, 120).valid, false);
  assert.equal(validateClipTrimRange(20, 21, 120).valid, false);
  assert.equal(validateClipTrimRange(10, 130, 120).valid, false);
});
