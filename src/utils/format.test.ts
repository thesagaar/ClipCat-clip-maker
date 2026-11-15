import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  formatDuration,
  formatElapsedVerbose,
  formatPreciseTimestamp,
} from './format';

test('formatDuration formats seconds, minutes, and hours consistently', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(45), '0:45');
  assert.equal(formatDuration(125), '2:05');
  assert.equal(formatDuration(3665), '1:01:05');
  assert.equal(formatDuration(null), '0:00');
});

test('formatPreciseTimestamp formats tenths of a second cleanly', () => {
  assert.equal(formatPreciseTimestamp(0), '00:00.0');
  assert.equal(formatPreciseTimestamp(65.4), '01:05.4');
});

test('formatBytes formats storage values with appropriate units', () => {
  assert.equal(formatBytes(null), '—');
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(1048576), '1.0 MB');
});

test('formatElapsedVerbose formats human-readable elapsed seconds', () => {
  assert.equal(formatElapsedVerbose(42), '42s');
  assert.equal(formatElapsedVerbose(125), '2m 5s');
  assert.equal(formatElapsedVerbose(3661), '1h 1m 1s');
});
