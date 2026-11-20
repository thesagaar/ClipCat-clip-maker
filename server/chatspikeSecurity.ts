import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';

export const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{4,64}$/;
export const VALID_ARTIFACTS = new Set(['mp4', 'srt', 'vtt', 'json', 'jpg']);
const MEDIA_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface SecurityContext {
  readonly sessionToken: string;
  readonly hmacSecret: Buffer;
}

export function createSecurityContext(): SecurityContext {
  return {
    sessionToken: crypto.randomBytes(32).toString('base64url'),
    hmacSecret: crypto.randomBytes(32),
  };
}

export function isValidSafeId(value: string): boolean {
  return SAFE_ID_REGEX.test(value);
}

/**
 * Canonical path containment verification preventing `..`, NUL bytes,
 * and symlink escape outside `rootDir`.
 */
export function isPathInsideRoot(targetPath: string, rootDir: string): boolean {
  if (!targetPath || targetPath.includes('\0')) return false;
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(targetPath);

  const rel = path.relative(resolvedRoot, resolvedTarget);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    return false;
  }

  try {
    const realRoot = fs.realpathSync(resolvedRoot);
    let probe = resolvedTarget;
    const tailSegments: string[] = [];
    while (!fs.existsSync(probe)) {
      const parent = path.dirname(probe);
      if (parent === probe) break;
      tailSegments.unshift(path.basename(probe));
      probe = parent;
    }
    const existingReal = fs.realpathSync(probe);
    const reconstructed = path.join(existingReal, ...tailSegments);
    const realRel = path.relative(realRoot, reconstructed);
    return realRel !== '' && !realRel.startsWith('..') && !path.isAbsolute(realRel);
  } catch {
    return false;
  }
}

export function timingSafeTokenEqual(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = crypto.createHash('sha256').update(provided, 'utf8').digest();
  const b = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

export function isAllowedLocalOrigin(origin: string, requestHost?: string): boolean {
  if (!origin || origin === 'null') return false;
  if (origin === 'tauri://localhost' || origin === 'https://tauri.localhost') {
    return true;
  }
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
    return true;
  }
  if (requestHost) {
    return parsed.host.toLowerCase() === requestHost.toLowerCase();
  }
  return false;
}

export function signMediaUrl(
  ctx: SecurityContext,
  jobId: string,
  clipId: string,
  artifact: string,
  ttlMs = MEDIA_TOKEN_TTL_MS
): string {
  const exp = Date.now() + ttlMs;
  const payload = `${jobId}:${clipId}:${artifact}:${exp}`;
  const sig = crypto
    .createHmac('sha256', ctx.hmacSecret)
    .update(payload)
    .digest('hex');
  return `/api/chatspike/media/${encodeURIComponent(jobId)}/${encodeURIComponent(clipId)}/${encodeURIComponent(artifact)}?exp=${exp}&sig=${sig}`;
}

export function verifySignedMediaParams(
  ctx: SecurityContext,
  jobId: string,
  clipId: string,
  artifact: string,
  expStr: string | undefined,
  sigStr: string | undefined
): boolean {
  if (!isValidSafeId(jobId) || !isValidSafeId(clipId) || !VALID_ARTIFACTS.has(artifact)) {
    return false;
  }
  if (!expStr || !sigStr || !/^\d{10,16}$/.test(expStr) || !/^[a-f0-9]{64}$/.test(sigStr)) {
    return false;
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) {
    return false;
  }
  const expectedSig = crypto
    .createHmac('sha256', ctx.hmacSecret)
    .update(`${jobId}:${clipId}:${artifact}:${exp}`)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(sigStr, 'hex'), Buffer.from(expectedSig, 'hex'));
}

export function sanitizeDownloadFilename(name: string, ext: string): string {
  const base = name
    .replace(/[\r\n\0"\\/]/g, '_')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80)
    .replace(/^_+|_+$/g, '');
  return `${base || 'clipcat_clip'}.${ext.replace(/[^a-z0-9]/gi, '')}`;
}

export function strictOriginMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get('origin');
  const host = req.get('host');

  if (origin) {
    if (!isAllowedLocalOrigin(origin, host)) {
      res.status(403).json({ detail: 'Untrusted origin rejected by local security policy.' });
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, DELETE, OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-ClipCat-Token, X-ClipCat-Filename'
    );
  }

  if (req.method === 'OPTIONS') {
    res.status(origin ? 204 : 403).end();
    return;
  }

  next();
}

export function createRequireAuthMiddleware(ctx: SecurityContext) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.get('authorization') ?? '';
    const customToken = req.get('x-clipcat-token') ?? '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const provided = customToken || bearer;

    if (!timingSafeTokenEqual(provided, ctx.sessionToken)) {
      res.status(401).json({
        detail: 'Missing or invalid ChatSpike session token.',
      });
      return;
    }
    next();
  };
}

export function scrubLogLine(text: string): string {
  return text.replace(/[\r\n\0\u001B]/g, ' ').slice(0, 400);
}
