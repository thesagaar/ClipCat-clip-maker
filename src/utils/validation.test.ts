import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateApiBaseUrl } from '../config/env';
import {
  classifyAndValidateVideoUrl,
  sanitizeDownloadFilename,
  validateProcessingConfig,
  validateVideoFileInput,
} from './validation';

describe('ClipCat frontend validation and URL/file security guards', () => {
  it('rejects non-video MIME types disguised with .mp4 extension', () => {
    const htmlSpoof = validateVideoFileInput({
      name: 'payload.mp4',
      size: 1024,
      type: 'text/html',
    });
    assert.equal(htmlSpoof.valid, false);

    const jsSpoof = validateVideoFileInput({
      name: 'script.webm',
      size: 2048,
      type: 'application/javascript',
    });
    assert.equal(jsSpoof.valid, false);
  });

  it('accepts legitimate video files including Unicode names and empty OS MIME on MKV', () => {
    const validMp4 = validateVideoFileInput({
      name: 'Podcást Episode 12 🎬.mp4',
      size: 15_000_000,
      type: 'video/mp4',
    });
    assert.equal(validMp4.valid, true);

    const validMkvNoMime = validateVideoFileInput({
      name: 'recording.mkv',
      size: 5_000_000,
      type: '',
    });
    assert.equal(validMkvNoMime.valid, true);
  });

  it('rejects embedded credentials, private/SSRF hosts, and oversized URLs in video URL validator', () => {
    assert.equal(
      classifyAndValidateVideoUrl('https://user:pass@cdn.example.com/clip.mp4').valid,
      false
    );
    assert.equal(
      classifyAndValidateVideoUrl('http://127.0.0.1:8000/secret.mp4').valid,
      false
    );
    assert.equal(
      classifyAndValidateVideoUrl('http://169.254.169.254/latest/meta-data.mp4').valid,
      false
    );
    assert.equal(
      classifyAndValidateVideoUrl('http://192.168.1.10/private.mp4').valid,
      false
    );
    assert.equal(
      classifyAndValidateVideoUrl(`https://cdn.example.com/${'a'.repeat(2060)}.mp4`).valid,
      false
    );

    const validDirect = classifyAndValidateVideoUrl('https://cdn.example.com/media/interview.mp4');
    assert.equal(validDirect.valid, true);
    assert.equal(validDirect.canAutoDownload, true);
  });

  it('sanitizes export filenames against path traversal and control characters', () => {
    assert.equal(
      sanitizeDownloadFilename('../../etc/passwd', '.mp4'),
      'etc_passwd.mp4'
    );
    assert.equal(
      sanitizeDownloadFilename('My Cool Clip / #1', '.mp4'),
      'My_Cool_Clip_1.mp4'
    );
  });

  it('validates backend API URL mixed-content and credential rules while keeping localhost dev working', () => {
    assert.equal(validateApiBaseUrl('http://127.0.0.1:8000', 'http:').valid, true);
    assert.equal(validateApiBaseUrl('http://127.0.0.1:8000', 'https:').valid, true);
    assert.equal(validateApiBaseUrl('https://api.example.com:8443', 'https:').valid, true);

    // Mixed-content remote HTTP blocked when app runs on HTTPS
    assert.equal(validateApiBaseUrl('http://192.168.1.25:8000', 'https:').valid, false);
    // Embedded credentials and query strings always blocked
    assert.equal(validateApiBaseUrl('https://admin:pw@api.example.com', 'https:').valid, false);
    assert.equal(validateApiBaseUrl('https://api.example.com?debug=1', 'https:').valid, false);
  });

  it('validates processing configuration lengths and boundaries cleanly', () => {
    const bad = validateProcessingConfig({
      projectName: '   ',
      desiredClipCount: 0,
      minDurationSec: 20,
      preferredDurationSec: 15,
      maxDurationSec: 10,
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
    });
    assert.ok(bad.projectName);
    assert.ok(bad.desiredClipCount);
    assert.ok(bad.durationRange);
  });
});
