import type {
  ConnectedAccount,
  MetadataGenerateRequestInput,
  PublishHistoryItem,
  PublishJobRecord,
  PublishMetadataPackage,
  PublishPlatform,
  PublishStartRequest,
  PublishValidationResult,
} from '../publishing/types';
import type { Clip } from '../types/clip';

let inMemoryPublishToken: string | null = null;

export async function ensurePublishingSessionToken(): Promise<string> {
  if (inMemoryPublishToken) return inMemoryPublishToken;
  const response = await fetch('/api/publishing/session', {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Unable to establish publishing session (HTTP ${response.status}).`);
  }
  const data = (await response.json()) as { token?: string };
  if (!data.token) {
    throw new Error('Server did not return a valid publishing session token.');
  }
  inMemoryPublishToken = data.token;
  return inMemoryPublishToken;
}

async function pubRequest<T>(
  path: string,
  options: RequestInit & { retryAuth?: boolean } = {}
): Promise<T> {
  const token = await ensurePublishingSessionToken();
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-ClipCat-Token', token);

  const response = await fetch(path, { ...options, headers });
  if (response.status === 401 && options.retryAuth !== false) {
    inMemoryPublishToken = null;
    return pubRequest<T>(path, { ...options, retryAuth: false });
  }
  if (!response.ok) {
    let detail = `Publishing server returned HTTP ${response.status}`;
    try {
      const parsed = (await response.json()) as { detail?: string; errors?: string[] };
      if (parsed?.detail) detail = parsed.detail;
      else if (parsed?.errors?.[0]) detail = parsed.errors[0];
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

export interface PublishingAccountsResponse {
  accounts: ConnectedAccount[];
  activeJob: { jobId: string; type: 'chatspike' | 'publishing' } | null;
}

export function getPublishingAccounts(): Promise<PublishingAccountsResponse> {
  return pubRequest<PublishingAccountsResponse>('/api/publishing/accounts');
}

export function startPublishingOAuth(
  platform: PublishPlatform
): Promise<{ authUrl: string; redirectUri: string; state: string }> {
  return pubRequest<{ authUrl: string; redirectUri: string; state: string }>(
    `/api/publishing/oauth/${encodeURIComponent(platform)}/start`,
    { method: 'POST' }
  );
}

export function disconnectPublishingAccount(
  platform: PublishPlatform
): Promise<{ account: ConnectedAccount }> {
  return pubRequest<{ account: ConnectedAccount }>(
    `/api/publishing/accounts/${encodeURIComponent(platform)}/disconnect`,
    { method: 'POST' }
  );
}

export function generatePublishingMetadata(
  payload: MetadataGenerateRequestInput
): Promise<{ package: PublishMetadataPackage; localMediaAvailable: boolean }> {
  return pubRequest<{ package: PublishMetadataPackage; localMediaAvailable: boolean }>(
    '/api/publishing/metadata/generate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

export function validatePublishingPackage(
  payload: Omit<PublishStartRequest, 'userConfirmedPublish' | 'idempotencyKey'>
): Promise<{ validation: PublishValidationResult; package: PublishMetadataPackage }> {
  return pubRequest<{ validation: PublishValidationResult; package: PublishMetadataPackage }>(
    '/api/publishing/validate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

export function startPublishingJob(payload: PublishStartRequest): Promise<PublishJobRecord> {
  return pubRequest<PublishJobRecord>('/api/publishing/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getPublishingJob(jobId: string): Promise<PublishJobRecord> {
  return pubRequest<PublishJobRecord>(
    `/api/publishing/jobs/${encodeURIComponent(jobId)}`
  );
}

export function retryPublishingJob(jobId: string): Promise<PublishJobRecord> {
  return pubRequest<PublishJobRecord>(
    `/api/publishing/jobs/${encodeURIComponent(jobId)}/retry`,
    { method: 'POST' }
  );
}

export function cancelPublishingJob(jobId: string): Promise<PublishJobRecord> {
  return pubRequest<PublishJobRecord>(
    `/api/publishing/jobs/${encodeURIComponent(jobId)}/cancel`,
    { method: 'POST' }
  );
}

export async function getPublishingHistory(): Promise<PublishHistoryItem[]> {
  const res = await pubRequest<{ history: PublishHistoryItem[] }>('/api/publishing/history');
  return res.history ?? [];
}

export async function downloadManualSharePackage(params: {
  clip: Clip;
  pkg: PublishMetadataPackage;
  platform: PublishPlatform;
}): Promise<void> {
  const token = await ensurePublishingSessionToken();
  const response = await fetch('/api/publishing/manual-share-package', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-ClipCat-Token': token,
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error(`Unable to build manual share bundle (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  const slug = (params.pkg.content.title || params.clip.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'clipcat_share';

  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `${slug}_${params.platform}_package.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  }
}

export function launchOAuthPopupWindow(
  authUrl: string,
  expectedPlatform: PublishPlatform,
  onComplete: (result: { ok: boolean; error: string | null }) => void
): { popupOpened: boolean; cleanup: () => void } {
  const handleMessage = (event: MessageEvent) => {
    const payload = event.data as
      | {
          type?: string;
          platform?: PublishPlatform;
          ok?: boolean;
          error?: string | null;
        }
      | undefined;
    if (!payload || payload.type !== 'CLIPCAT_PUBLISH_OAUTH') return;
    if (payload.platform && payload.platform !== expectedPlatform) return;
    cleanup();
    onComplete({
      ok: Boolean(payload.ok),
      error: payload.error ?? null,
    });
  };

  window.addEventListener('message', handleMessage);

  const popup = window.open(
    authUrl,
    `clipcat_oauth_${expectedPlatform}`,
    'popup=yes,width=560,height=720,noopener=no'
  );

  const pollTimer = popup
    ? window.setInterval(() => {
        if (popup.closed) {
          cleanup();
          onComplete({ ok: true, error: null });
        }
      }, 600)
    : null;

  const cleanup = () => {
    window.removeEventListener('message', handleMessage);
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
    }
  };

  return {
    popupOpened: Boolean(popup),
    cleanup,
  };
}
