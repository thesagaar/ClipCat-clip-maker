import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { PublishHistoryItem, PublishJobRecord, PublishPlatform } from '../../src/publishing/types';
import { isPathInsideRoot, isValidSafeId } from '../chatspikeSecurity.ts';
import { writeJsonAtomic, type ChatSpikeDirectories } from '../chatspikeStorage.ts';

export interface StoredOAuthAccountSecret {
  platform: PublishPlatform;
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresAtMs: number | null;
  scopes: string[];
  accountId: string;
  accountName: string;
  accountHandle: string | null;
  accountType: string;
  eligible: boolean;
  eligibilityReason: string | null;
  connectedAt: string;
}

export interface TempMediaTokenRecord {
  token: string;
  filePath: string;
  expiresAtMs: number;
  consumed: boolean;
  sizeBytes: number;
}

export interface PublishingDirectories {
  root: string;
  pubDir: string;
  tempMediaDir: string;
  vaultKeyPath: string;
  vaultFilePath: string;
  jobsFilePath: string;
  historyFilePath: string;
}

export function initPublishingDirectories(baseDirs: ChatSpikeDirectories): PublishingDirectories {
  const pubDir = path.join(baseDirs.root, 'publishing');
  const tempMediaDir = path.join(pubDir, 'temp-media');
  fs.mkdirSync(pubDir, { recursive: true });
  fs.mkdirSync(tempMediaDir, { recursive: true });

  return {
    root: baseDirs.root,
    pubDir,
    tempMediaDir,
    vaultKeyPath: path.join(pubDir, '.vault.key'),
    vaultFilePath: path.join(pubDir, 'vault.enc.json'),
    jobsFilePath: path.join(pubDir, 'jobs.json'),
    historyFilePath: path.join(pubDir, 'history.json'),
  };
}

function getOrCreateVaultKey(dirs: PublishingDirectories): Buffer {
  if (!isPathInsideRoot(dirs.vaultKeyPath, dirs.root)) {
    throw new Error('Invalid vault key path.');
  }
  if (fs.existsSync(dirs.vaultKeyPath)) {
    const hex = fs.readFileSync(dirs.vaultKeyPath, 'utf8').trim();
    if (/^[a-f0-9]{64}$/i.test(hex)) {
      return Buffer.from(hex, 'hex');
    }
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(dirs.vaultKeyPath, key.toString('hex'), { encoding: 'utf8', mode: 0o600 });
  return key;
}

interface EncryptedVaultPayload {
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
}

export function loadVaultAccounts(
  dirs: PublishingDirectories
): Partial<Record<PublishPlatform, StoredOAuthAccountSecret>> {
  if (!fs.existsSync(dirs.vaultFilePath)) return {};
  try {
    const key = getOrCreateVaultKey(dirs);
    const parsed = JSON.parse(fs.readFileSync(dirs.vaultFilePath, 'utf8')) as EncryptedVaultPayload;
    if (!parsed || parsed.version !== 1 || !parsed.iv || !parsed.tag || !parsed.ciphertext) {
      return {};
    }
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(parsed.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(decrypted) as Partial<Record<PublishPlatform, StoredOAuthAccountSecret>>;
  } catch {
    return {};
  }
}

export function saveVaultAccounts(
  dirs: PublishingDirectories,
  accounts: Partial<Record<PublishPlatform, StoredOAuthAccountSecret>>
): void {
  const key = getOrCreateVaultKey(dirs);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(accounts), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedVaultPayload = {
    version: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
  writeJsonAtomic(dirs.vaultFilePath, dirs.root, payload);
  try {
    fs.chmodSync(dirs.vaultFilePath, 0o600);
  } catch {
    // Non-POSIX filesystems ignore chmod
  }
}

export function loadPublishHistory(dirs: PublishingDirectories): PublishHistoryItem[] {
  if (!fs.existsSync(dirs.historyFilePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(dirs.historyFilePath, 'utf8')) as PublishHistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePublishHistory(
  dirs: PublishingDirectories,
  items: PublishHistoryItem[]
): void {
  writeJsonAtomic(dirs.historyFilePath, dirs.root, items.slice(0, 200));
}

export function loadPublishJobs(dirs: PublishingDirectories): Map<string, PublishJobRecord> {
  const map = new Map<string, PublishJobRecord>();
  if (!fs.existsSync(dirs.jobsFilePath)) return map;
  try {
    const list = JSON.parse(fs.readFileSync(dirs.jobsFilePath, 'utf8')) as PublishJobRecord[];
    if (!Array.isArray(list)) return map;
    for (const item of list) {
      if (item && isValidSafeId(item.id)) {
        if (
          item.status === 'preparing_media' ||
          item.status === 'validating_metadata' ||
          item.status === 'uploading' ||
          item.status === 'processing_platform'
        ) {
          item.status = 'failed';
          item.errorCode = 'UPLOAD_INTERRUPTED';
          item.errorMessage = 'Server restarted while publishing was in progress. You may retry cleanly.';
          item.retryable = true;
        }
        map.set(item.id, item);
      }
    }
  } catch {
    // Ignore unreadable job file
  }
  return map;
}

export function savePublishJobs(
  dirs: PublishingDirectories,
  jobsMap: Map<string, PublishJobRecord>
): void {
  const arr = Array.from(jobsMap.values()).slice(-100);
  writeJsonAtomic(dirs.jobsFilePath, dirs.root, arr);
}

/**
 * Scrubs any Bearer token, OAuth secret, client_secret, query token, or local path
 * from error messages before persistence or HTTP responses.
 */
export function scrubPublishingSecretText(raw: string): string {
  return raw
    .replace(/[\r\n\0\u001B]/g, ' ')
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/(?:access_token|refresh_token|client_secret)=[^\s&"']+/gi, '[REDACTED_PARAM]')
    .replace(/[A-Za-z]:\\(?:[^\s"'<>]+\\)*/g, '[LOCAL_PATH]')
    .replace(/\/(?:Users|home|tmp|root|var)\/[^\s"'<>]+/g, '[LOCAL_PATH]')
    .slice(0, 320);
}
