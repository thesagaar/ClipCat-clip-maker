import type {
  ChatSourceFormat,
  ChatSpikeDetectionConfig,
  ChatSpikeJob,
} from '../intelligence/types';
import type { BatchExportRequest, BatchExportResponse, Clip, ClipRenderRequest, ClipUpdateRequest } from '../types/clip';
import type { AspectRatio, OutputResolution, Project } from '../types/project';

let inMemorySessionToken: string | null = null;

export interface ChatSpikeCapabilities {
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  fasterWhisperAvailable: boolean;
  whisperNote: string;
  activeProcessingJobId: string | null;
  maxVideoUploadBytes: number;
  maxChatUploadBytes: number;
  engines: Array<{
    id: string;
    name: string;
    signalType: 'chat' | 'audio' | 'vision';
    availability: 'available' | 'planned';
    availabilityNote: string;
  }>;
  chatSourceAdapters: Array<{
    id: string;
    platform: string;
    availability: 'available' | 'unavailable_offline' | 'planned';
    requiresOfficialCredentials: boolean;
    availabilityNote: string;
  }>;
}

export function isChatSpikeEntityId(id: string | undefined): boolean {
  return Boolean(id && (id.startsWith('chatspike-proj-') || id.startsWith('chatspike-clip-')));
}

export async function ensureChatSpikeSessionToken(): Promise<string> {
  if (inMemorySessionToken) return inMemorySessionToken;
  const response = await fetch('/api/chatspike/session', {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Unable to establish ChatSpike session (HTTP ${response.status}).`);
  }
  const data = (await response.json()) as { token?: string };
  if (!data.token) {
    throw new Error('Server did not return a valid ChatSpike session token.');
  }
  inMemorySessionToken = data.token;
  return inMemorySessionToken;
}

async function csRequest<T>(
  path: string,
  options: RequestInit & { retryAuth?: boolean } = {}
): Promise<T> {
  const token = await ensureChatSpikeSessionToken();
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-ClipCat-Token', token);

  const response = await fetch(path, { ...options, headers });
  if (response.status === 401 && options.retryAuth !== false) {
    inMemorySessionToken = null;
    return csRequest<T>(path, { ...options, retryAuth: false });
  }
  if (!response.ok) {
    let detail = `ChatSpike server returned HTTP ${response.status}`;
    try {
      const parsed = (await response.json()) as { detail?: string };
      if (parsed?.detail) detail = parsed.detail;
    } catch {
      // ignore non-json
    }
    throw new Error(detail);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function getChatSpikeCapabilities(): Promise<ChatSpikeCapabilities> {
  return csRequest<ChatSpikeCapabilities>('/api/chatspike/capabilities');
}

export function createChatSpikeJob(params: {
  projectName: string;
  config?: Partial<ChatSpikeDetectionConfig>;
}): Promise<ChatSpikeJob> {
  return csRequest<ChatSpikeJob>('/api/chatspike/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export function getChatSpikeJob(jobId: string): Promise<ChatSpikeJob> {
  return csRequest<ChatSpikeJob>(`/api/chatspike/jobs/${encodeURIComponent(jobId)}`);
}

export async function uploadChatSpikeVideo(params: {
  jobId: string;
  file: File;
  onProgress?: (percent: number, loadedBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
}): Promise<ChatSpikeJob> {
  const token = await ensureChatSpikeSessionToken();
  return new Promise<ChatSpikeJob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/chatspike/jobs/${encodeURIComponent(params.jobId)}/video`, true);
    xhr.timeout = 30 * 60 * 1000;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('X-ClipCat-Token', token);
    xhr.setRequestHeader(
      'X-ClipCat-Filename',
      params.file.name.replace(/[^\x20-\x7e]/g, '_').slice(0, 120)
    );

    if (params.signal) {
      if (params.signal.aborted) {
        reject(new Error('Video upload cancelled.'));
        return;
      }
      params.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && params.onProgress) {
        params.onProgress(
          Math.min(100, Math.round((ev.loaded / ev.total) * 100)),
          ev.loaded,
          ev.total
        );
      }
    };

    xhr.onload = () => {
      let parsed: unknown = null;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        parsed = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed as ChatSpikeJob);
        return;
      }
      const detail =
        (parsed as { detail?: string } | null)?.detail ??
        `Video upload failed (HTTP ${xhr.status})`;
      reject(new Error(detail));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading video to local server.'));
    xhr.onabort = () => reject(new Error('Video upload cancelled.'));
    xhr.ontimeout = () => reject(new Error('Video upload timed out.'));
    xhr.send(params.file);
  });
}

export function uploadChatSpikeLog(params: {
  jobId: string;
  filename: string;
  content: string;
  format?: ChatSourceFormat;
}): Promise<ChatSpikeJob> {
  return csRequest<ChatSpikeJob>(
    `/api/chatspike/jobs/${encodeURIComponent(params.jobId)}/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: params.filename,
        content: params.content,
        format: params.format,
      }),
    }
  );
}

export function updateChatSpikeConfig(
  jobId: string,
  payload: {
    projectName?: string;
    config?: Partial<ChatSpikeDetectionConfig>;
  }
): Promise<ChatSpikeJob> {
  return csRequest<ChatSpikeJob>(
    `/api/chatspike/jobs/${encodeURIComponent(jobId)}/config`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

export function startChatSpikeProcessing(
  jobId: string,
  config?: Partial<ChatSpikeDetectionConfig>
): Promise<ChatSpikeJob> {
  return csRequest<ChatSpikeJob>(
    `/api/chatspike/jobs/${encodeURIComponent(jobId)}/process`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config ? { config } : {}),
    }
  );
}

export function cancelChatSpikeJob(jobId: string): Promise<ChatSpikeJob> {
  return csRequest<ChatSpikeJob>(
    `/api/chatspike/jobs/${encodeURIComponent(jobId)}/cancel`,
    { method: 'POST' }
  );
}

export function updateChatSpikeCandidate(
  jobId: string,
  candidateId: string,
  patch: {
    title?: string;
    status?: 'pending' | 'approved' | 'rejected';
    startSec?: number;
    endSec?: number;
    aspectRatio?: AspectRatio;
    resolution?: OutputResolution;
    captionsEnabled?: boolean;
    captionsSrt?: string;
  }
): Promise<ChatSpikeJob> {
  return csRequest<ChatSpikeJob>(
    `/api/chatspike/jobs/${encodeURIComponent(jobId)}/candidates/${encodeURIComponent(candidateId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }
  );
}

export function regenerateChatSpikeCandidate(
  jobId: string,
  candidateId: string,
  params?: {
    startSec?: number;
    endSec?: number;
    aspectRatio?: AspectRatio;
    resolution?: OutputResolution;
  }
): Promise<ChatSpikeJob> {
  return csRequest<ChatSpikeJob>(
    `/api/chatspike/jobs/${encodeURIComponent(jobId)}/candidates/${encodeURIComponent(candidateId)}/regenerate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params ?? {}),
    }
  );
}

export function mergeChatSpikeCandidates(
  jobId: string,
  candidateIds: string[]
): Promise<ChatSpikeJob> {
  return csRequest<ChatSpikeJob>(
    `/api/chatspike/jobs/${encodeURIComponent(jobId)}/candidates/merge`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateIds }),
    }
  );
}

export function saveChatSpikeToLibrary(
  jobId: string,
  candidateIds?: string[]
): Promise<{ project: Project; clips: Clip[] }> {
  return csRequest<{ project: Project; clips: Clip[] }>(
    `/api/chatspike/jobs/${encodeURIComponent(jobId)}/save-to-library`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidateIds ? { candidateIds } : {}),
    }
  );
}

export async function getChatSpikeLibrary(): Promise<{
  projects: Project[];
  clips: Clip[];
}> {
  if (typeof window === 'undefined') {
    return { projects: [], clips: [] };
  }
  return csRequest<{ projects: Project[]; clips: Clip[] }>('/api/chatspike/library');
}

export function updateChatSpikeLibraryClip(
  clipId: string,
  payload: ClipUpdateRequest
): Promise<Clip> {
  return csRequest<Clip>(
    `/api/chatspike/library/clips/${encodeURIComponent(clipId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

export function renderChatSpikeLibraryClip(
  clipId: string,
  payload: ClipRenderRequest
): Promise<Clip> {
  return csRequest<Clip>(
    `/api/chatspike/library/clips/${encodeURIComponent(clipId)}/render`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

export function deleteChatSpikeLibraryClip(clipId: string): Promise<void> {
  return csRequest<void>(
    `/api/chatspike/library/clips/${encodeURIComponent(clipId)}`,
    { method: 'DELETE' }
  );
}

export function batchExportChatSpikeClips(
  payload: BatchExportRequest
): Promise<BatchExportResponse> {
  return csRequest<BatchExportResponse>('/api/chatspike/library/batch-export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
