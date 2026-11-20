import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ChatSpikeJob } from '../src/intelligence/types';
import type { Clip } from '../src/types/clip';
import type { Project } from '../src/types/project';
import { isPathInsideRoot, isValidSafeId } from './chatspikeSecurity.ts';

export interface ChatSpikeDirectories {
  root: string;
  uploads: string;
  chatlogs: string;
  jobs: string;
  exports: string;
  library: string;
  temp: string;
}

export interface LibraryStoreData {
  projects: Project[];
  clips: Array<{
    clip: Clip;
    sourceVideoPath: string;
    mp4Path: string;
    thumbPath: string;
    srtPath: string;
    vttPath: string;
    metadataPath: string;
    captionsSrt: string;
    captionsVtt: string;
  }>;
}

function getDefaultDataRoot(): string {
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'ClipCat', 'ClipCatData');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'ClipCat', 'ClipCatData');
  }
  const xdg = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(xdg, 'ClipCat', 'ClipCatData');
}

function validateAllowedDataRoot(candidate: string): string {
  const resolved = path.resolve(candidate);
  const homeDir = path.resolve(os.homedir());
  const tmpDir = path.resolve(os.tmpdir());
  const appDataDir = process.env.LOCALAPPDATA ? path.resolve(process.env.LOCALAPPDATA) : null;

  const allowedParents = [homeDir, tmpDir, ...(appDataDir ? [appDataDir] : [])];
  const insideAllowed = allowedParents.some((parent) => {
    const rel = path.relative(parent, resolved);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  });

  if (!insideAllowed) {
    throw new Error('CLIPCAT_DATA_DIR must reside inside the user home, AppData, or OS temp directory.');
  }
  return resolved;
}

export function initChatSpikeStorage(customRoot?: string): ChatSpikeDirectories {
  let root: string;
  if (customRoot) {
    root = validateAllowedDataRoot(customRoot);
  } else if (process.env.CLIPCAT_DATA_DIR) {
    root = validateAllowedDataRoot(process.env.CLIPCAT_DATA_DIR);
  } else {
    root = getDefaultDataRoot();
  }

  try {
    fs.mkdirSync(root, { recursive: true });
    fs.accessSync(root, fs.constants.W_OK);
  } catch {
    // Fallback strictly to OS user temp folder if home directory is read-only
    root = path.join(os.tmpdir(), 'ClipCat', 'ClipCatData');
    fs.mkdirSync(root, { recursive: true });
  }

  const dirs: ChatSpikeDirectories = {
    root,
    uploads: path.join(root, 'uploads'),
    chatlogs: path.join(root, 'chatlogs'),
    jobs: path.join(root, 'jobs'),
    exports: path.join(root, 'exports'),
    library: path.join(root, 'library'),
    temp: path.join(root, 'temp'),
  };

  for (const dir of Object.values(dirs)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dirs;
}

export function writeJsonAtomic(filePath: string, rootDir: string, data: unknown): void {
  if (!isPathInsideRoot(filePath, rootDir)) {
    throw new Error('Refusing atomic write outside ClipCatData root.');
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

export function getAvailableDiskBytes(dirPath: string): number {
  try {
    const stat = fs.statfsSync(dirPath);
    return Number(stat.bavail) * Number(stat.bsize);
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

export function getJobJsonPath(dirs: ChatSpikeDirectories, jobId: string): string {
  if (!isValidSafeId(jobId)) throw new Error('Invalid job ID.');
  const target = path.join(dirs.jobs, jobId, 'job.json');
  if (!isPathInsideRoot(target, dirs.root)) throw new Error('Invalid job path.');
  return target;
}

export function getJobTempDir(dirs: ChatSpikeDirectories, jobId: string): string {
  if (!isValidSafeId(jobId)) throw new Error('Invalid job ID.');
  const target = path.join(dirs.temp, jobId);
  if (!isPathInsideRoot(target, dirs.root)) throw new Error('Invalid temp path.');
  fs.mkdirSync(target, { recursive: true });
  return target;
}

export function cleanupJobTempDir(dirs: ChatSpikeDirectories, jobId: string): void {
  if (!isValidSafeId(jobId)) return;
  const target = path.join(dirs.temp, jobId);
  if (!isPathInsideRoot(target, dirs.temp)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

export function loadPersistedJobs(dirs: ChatSpikeDirectories): Map<string, ChatSpikeJob> {
  const map = new Map<string, ChatSpikeJob>();
  if (!fs.existsSync(dirs.jobs)) return map;
  for (const entry of fs.readdirSync(dirs.jobs, { withFileTypes: true })) {
    if (!entry.isDirectory() || !isValidSafeId(entry.name)) continue;
    const jobFile = path.join(dirs.jobs, entry.name, 'job.json');
    if (!fs.existsSync(jobFile)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(jobFile, 'utf8')) as ChatSpikeJob;
      if (parsed && parsed.id === entry.name) {
        if (parsed.status === 'running') {
          parsed.status = 'failed';
          parsed.errorMessage = 'Server restarted while processing was running.';
        }
        map.set(parsed.id, parsed);
      }
    } catch {
      // Ignore corrupt job JSON
    }
  }
  return map;
}

export function loadLibraryStore(dirs: ChatSpikeDirectories): LibraryStoreData {
  const libFile = path.join(dirs.library, 'library.json');
  if (!fs.existsSync(libFile)) {
    return { projects: [], clips: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(libFile, 'utf8')) as LibraryStoreData;
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      clips: Array.isArray(parsed.clips) ? parsed.clips : [],
    };
  } catch {
    return { projects: [], clips: [] };
  }
}

export function saveLibraryStore(dirs: ChatSpikeDirectories, data: LibraryStoreData): void {
  const libFile = path.join(dirs.library, 'library.json');
  writeJsonAtomic(libFile, dirs.root, data);
}
