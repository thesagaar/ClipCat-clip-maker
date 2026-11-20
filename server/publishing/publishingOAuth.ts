import crypto from 'node:crypto';
import type { ConnectedAccount, PublishPlatform } from '../../src/publishing/types';
import {
  loadVaultAccounts,
  saveVaultAccounts,
  scrubPublishingSecretText,
  type PublishingDirectories,
  type StoredOAuthAccountSecret,
} from './publishingStorage.ts';

export type FetchLike = typeof fetch;

export interface OAuthConfig {
  youtubeClientId: string;
  youtubeClientSecret: string;
  instagramAppId: string;
  instagramAppSecret: string;
  publicAppUrl: string;
  instagramPublicMediaBaseUrl: string;
}

export interface PendingOAuthState {
  state: string;
  platform: PublishPlatform;
  codeVerifier: string;
  redirectUri: string;
  expiresAtMs: number;
}

export const YOUTUBE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

export const INSTAGRAM_OAUTH_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
];

export function readOAuthEnvConfig(overrides: Partial<OAuthConfig> = {}): OAuthConfig {
  return {
    youtubeClientId: (overrides.youtubeClientId ?? process.env.YOUTUBE_CLIENT_ID ?? '').trim(),
    youtubeClientSecret: (overrides.youtubeClientSecret ?? process.env.YOUTUBE_CLIENT_SECRET ?? '').trim(),
    instagramAppId: (
      overrides.instagramAppId ??
      process.env.INSTAGRAM_APP_ID ??
      process.env.META_APP_ID ??
      ''
    ).trim(),
    instagramAppSecret: (
      overrides.instagramAppSecret ??
      process.env.INSTAGRAM_APP_SECRET ??
      process.env.META_APP_SECRET ??
      ''
    ).trim(),
    publicAppUrl: (overrides.publicAppUrl ?? process.env.APP_URL ?? '').trim().replace(/\/+$/, ''),
    instagramPublicMediaBaseUrl: (
      overrides.instagramPublicMediaBaseUrl ??
      process.env.CLIPCAT_PUBLIC_MEDIA_BASE_URL ??
      ''
    )
      .trim()
      .replace(/\/+$/, ''),
  };
}

export function buildPlatformRedirectUri(
  platform: PublishPlatform,
  requestOrigin: string | undefined,
  cfg: OAuthConfig
): string {
  const base = cfg.publicAppUrl || requestOrigin || 'http://localhost:3000';
  return `${base.replace(/\/+$/, '')}/api/publishing/oauth/${platform}/callback`;
}

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function toPublicAccountView(
  platform: PublishPlatform,
  secret: StoredOAuthAccountSecret | undefined,
  redirectUri: string,
  cfg: OAuthConfig
): ConnectedAccount {
  const isYoutube = platform === 'youtube';
  const configured = isYoutube
    ? Boolean(cfg.youtubeClientId && cfg.youtubeClientSecret)
    : Boolean(cfg.instagramAppId && cfg.instagramAppSecret);

  const hasIgHttpsRelay = Boolean(
    cfg.instagramPublicMediaBaseUrl && cfg.instagramPublicMediaBaseUrl.startsWith('https://')
  );

  const configHint = isYoutube
    ? 'Configure YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET on the server to connect your Google/YouTube channel via OAuth 2.0 + PKCE.'
    : hasIgHttpsRelay
      ? 'Configure INSTAGRAM_APP_ID (META_APP_ID) and INSTAGRAM_APP_SECRET to connect an eligible Instagram Business/Creator account.'
      : 'Configure INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, and an HTTPS CLIPCAT_PUBLIC_MEDIA_BASE_URL relay for direct API Reels upload, or use the Export & Manual Share bundle locally.';

  if (!secret) {
    return {
      platform,
      connected: false,
      configured,
      configHint,
      redirectUri,
      accountId: null,
      accountName: null,
      accountHandle: null,
      accountType: null,
      eligible: false,
      eligibilityReason: configured
        ? `Connect a ${isYoutube ? 'YouTube channel' : 'Business/Creator Instagram account'} to publish directly.`
        : configHint,
      scopes: isYoutube ? YOUTUBE_OAUTH_SCOPES : INSTAGRAM_OAUTH_SCOPES,
      tokenExpiresAt: null,
      instagramMediaTransferMode: hasIgHttpsRelay ? 'https_signed_relay' : 'manual_export_fallback',
    };
  }

  return {
    platform,
    connected: true,
    configured,
    configHint,
    redirectUri,
    accountId: secret.accountId,
    accountName: secret.accountName,
    accountHandle: secret.accountHandle,
    accountType: secret.accountType,
    eligible: secret.eligible,
    eligibilityReason: secret.eligibilityReason,
    scopes: secret.scopes,
    tokenExpiresAt: secret.expiresAtMs ? new Date(secret.expiresAtMs).toISOString() : null,
    instagramMediaTransferMode: hasIgHttpsRelay ? 'https_signed_relay' : 'manual_export_fallback',
  };
}

export class PublishingOAuthManager {
  private readonly pendingStates = new Map<string, PendingOAuthState>();
  private readonly dirs: PublishingDirectories;
  private readonly fetchFn: FetchLike;
  private readonly envOverrides: Partial<OAuthConfig>;

  constructor(
    dirs: PublishingDirectories,
    options: { fetchFn?: FetchLike; envOverrides?: Partial<OAuthConfig> } = {}
  ) {
    this.dirs = dirs;
    this.fetchFn = options.fetchFn ?? fetch;
    this.envOverrides = options.envOverrides ?? {};
  }

  getConfig(): OAuthConfig {
    return readOAuthEnvConfig(this.envOverrides);
  }

  listPublicAccounts(requestOrigin?: string): ConnectedAccount[] {
    const cfg = this.getConfig();
    const vault = loadVaultAccounts(this.dirs);
    return (['youtube', 'instagram'] as PublishPlatform[]).map((platform) =>
      toPublicAccountView(
        platform,
        vault[platform],
        buildPlatformRedirectUri(platform, requestOrigin, cfg),
        cfg
      )
    );
  }

  getPublicAccount(platform: PublishPlatform, requestOrigin?: string): ConnectedAccount {
    const cfg = this.getConfig();
    const vault = loadVaultAccounts(this.dirs);
    return toPublicAccountView(
      platform,
      vault[platform],
      buildPlatformRedirectUri(platform, requestOrigin, cfg),
      cfg
    );
  }

  startAuthorization(
    platform: PublishPlatform,
    requestOrigin?: string
  ): { authUrl: string; redirectUri: string; state: string } {
    const cfg = this.getConfig();
    const redirectUri = buildPlatformRedirectUri(platform, requestOrigin, cfg);
    this.pruneExpiredStates();

    if (platform === 'youtube') {
      if (!cfg.youtubeClientId || !cfg.youtubeClientSecret) {
        throw new Error(
          'YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET are not configured on the server.'
        );
      }
      const state = crypto.randomBytes(24).toString('base64url');
      const { codeVerifier, codeChallenge } = generatePkcePair();
      this.pendingStates.set(state, {
        state,
        platform,
        codeVerifier,
        redirectUri,
        expiresAtMs: Date.now() + 10 * 60 * 1000,
      });

      const params = new URLSearchParams({
        client_id: cfg.youtubeClientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: YOUTUBE_OAUTH_SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
      return {
        authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        redirectUri,
        state,
      };
    }

    if (!cfg.instagramAppId || !cfg.instagramAppSecret) {
      throw new Error(
        'INSTAGRAM_APP_ID (or META_APP_ID) and INSTAGRAM_APP_SECRET are not configured on the server.'
      );
    }

    const state = crypto.randomBytes(24).toString('base64url');
    const { codeVerifier } = generatePkcePair();
    this.pendingStates.set(state, {
      state,
      platform,
      codeVerifier,
      redirectUri,
      expiresAtMs: Date.now() + 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: cfg.instagramAppId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: INSTAGRAM_OAUTH_SCOPES.join(','),
      state,
    });
    return {
      authUrl: `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`,
      redirectUri,
      state,
    };
  }

  async completeCallback(
    platform: PublishPlatform,
    code: string,
    state: string
  ): Promise<ConnectedAccount> {
    this.pruneExpiredStates();
    const pending = this.pendingStates.get(state);
    if (!pending || pending.platform !== platform || pending.expiresAtMs < Date.now()) {
      this.pendingStates.delete(state);
      throw new Error('Invalid or expired OAuth authorization state parameter.');
    }
    this.pendingStates.delete(state);

    const cfg = this.getConfig();
    if (platform === 'youtube') {
      const tokenRes = await this.fetchFn('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: cfg.youtubeClientId,
          client_secret: cfg.youtubeClientSecret,
          code,
          code_verifier: pending.codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: pending.redirectUri,
        }),
      });
      if (!tokenRes.ok) {
        const text = scrubPublishingSecretText(await tokenRes.text());
        throw new Error(`YouTube token exchange failed: ${text}`);
      }
      const tokenJson = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        token_type?: string;
      };
      if (!tokenJson.access_token) {
        throw new Error('YouTube OAuth response did not include an access token.');
      }

      // Inspect channel metadata & eligibility
      const chRes = await this.fetchFn(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet,status&mine=true',
        {
          headers: { Authorization: `Bearer ${tokenJson.access_token}` },
        }
      );
      if (!chRes.ok) {
        throw new Error(`Unable to verify YouTube channel eligibility (HTTP ${chRes.status}).`);
      }
      const chJson = (await chRes.json()) as {
        items?: Array<{
          id: string;
          snippet?: { title?: string; customUrl?: string };
          status?: { isLinked?: boolean; longUploadsStatus?: string };
        }>;
      };
      const channel = chJson.items?.[0];
      const eligible = Boolean(channel?.id);
      const vault = loadVaultAccounts(this.dirs);
      const record: StoredOAuthAccountSecret = {
        platform: 'youtube',
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token ?? vault.youtube?.refreshToken ?? null,
        tokenType: tokenJson.token_type ?? 'Bearer',
        expiresAtMs: tokenJson.expires_in ? Date.now() + tokenJson.expires_in * 1000 : null,
        scopes: tokenJson.scope ? tokenJson.scope.split(/\s+/) : YOUTUBE_OAUTH_SCOPES,
        accountId: channel?.id ?? 'no_channel',
        accountName: channel?.snippet?.title ?? 'Google Account (No YouTube Channel)',
        accountHandle: channel?.snippet?.customUrl ?? null,
        accountType: eligible ? 'youtube_channel' : 'no_youtube_channel',
        eligible,
        eligibilityReason: eligible
          ? null
          : 'This Google account does not have an active YouTube channel created yet.',
        connectedAt: new Date().toISOString(),
      };
      vault.youtube = record;
      saveVaultAccounts(this.dirs, vault);
      return toPublicAccountView('youtube', record, pending.redirectUri, cfg);
    }

    // Instagram Graph API OAuth exchange
    const igParams = new URLSearchParams({
      client_id: cfg.instagramAppId,
      client_secret: cfg.instagramAppSecret,
      redirect_uri: pending.redirectUri,
      code,
    });
    const igTokenRes = await this.fetchFn(
      `https://graph.facebook.com/v21.0/oauth/access_token?${igParams.toString()}`
    );
    if (!igTokenRes.ok) {
      const txt = scrubPublishingSecretText(await igTokenRes.text());
      throw new Error(`Instagram OAuth exchange failed: ${txt}`);
    }
    const igTokenJson = (await igTokenRes.json()) as {
      access_token?: string;
      expires_in?: number;
      token_type?: string;
    };
    if (!igTokenJson.access_token) {
      throw new Error('Instagram OAuth response did not include an access token.');
    }

    // Inspect linked Facebook Pages -> instagram_business_account to verify Professional/Creator eligibility
    const acctRes = await this.fetchFn(
      `https://graph.facebook.com/v21.0/me/accounts?fields=name,instagram_business_account{id,username,name,account_type}`,
      {
        headers: { Authorization: `Bearer ${igTokenJson.access_token}` },
      }
    );
    if (!acctRes.ok) {
      throw new Error(`Unable to inspect Instagram Business account eligibility (HTTP ${acctRes.status}).`);
    }
    const acctJson = (await acctRes.json()) as {
      data?: Array<{
        name?: string;
        instagram_business_account?: {
          id?: string;
          username?: string;
          name?: string;
          account_type?: string;
        };
      }>;
    };

    const linkedIg = acctJson.data?.find((page) => Boolean(page.instagram_business_account?.id))
      ?.instagram_business_account;
    const accountType = linkedIg?.account_type ?? 'PERSONAL_OR_UNLINKED';
    const eligible = Boolean(
      linkedIg?.id &&
        (accountType === 'BUSINESS' ||
          accountType === 'MEDIA_CREATOR' ||
          accountType === 'CREATOR' ||
          !linkedIg.account_type)
    );

    const vault = loadVaultAccounts(this.dirs);
    const record: StoredOAuthAccountSecret = {
      platform: 'instagram',
      accessToken: igTokenJson.access_token,
      refreshToken: null,
      tokenType: igTokenJson.token_type ?? 'Bearer',
      expiresAtMs: igTokenJson.expires_in ? Date.now() + igTokenJson.expires_in * 1000 : null,
      scopes: INSTAGRAM_OAUTH_SCOPES,
      accountId: linkedIg?.id ?? 'ineligible',
      accountName: linkedIg?.name ?? linkedIg?.username ?? 'Instagram Account',
      accountHandle: linkedIg?.username ? `@${linkedIg.username}` : null,
      accountType,
      eligible,
      eligibilityReason: eligible
        ? null
        : 'Only Instagram Professional (Business or Creator) accounts linked to a Facebook Page support the official Instagram Content Publishing API.',
      connectedAt: new Date().toISOString(),
    };
    vault.instagram = record;
    saveVaultAccounts(this.dirs, vault);
    return toPublicAccountView('instagram', record, pending.redirectUri, cfg);
  }

  async ensureValidAccessToken(platform: PublishPlatform): Promise<StoredOAuthAccountSecret> {
    const vault = loadVaultAccounts(this.dirs);
    const account = vault[platform];
    if (!account) {
      throw new Error(`${platform} account is disconnected.`);
    }
    if (!account.eligible) {
      throw new Error(
        account.eligibilityReason ?? `${platform} account is not eligible for direct API publishing.`
      );
    }

    const needsRefresh =
      account.expiresAtMs !== null && Date.now() >= account.expiresAtMs - 60_000;

    if (!needsRefresh) {
      return account;
    }

    if (platform === 'youtube' && account.refreshToken) {
      const cfg = this.getConfig();
      const res = await this.fetchFn('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: cfg.youtubeClientId,
          client_secret: cfg.youtubeClientSecret,
          refresh_token: account.refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (!res.ok) {
        const txt = scrubPublishingSecretText(await res.text());
        throw new Error(`YouTube token refresh failed (${res.status}): ${txt}. Please reconnect.`);
      }
      const json = (await res.json()) as { access_token?: string; expires_in?: number };
      if (!json.access_token) {
        throw new Error('YouTube refresh response omitted access token. Please reconnect.');
      }
      account.accessToken = json.access_token;
      account.expiresAtMs = json.expires_in ? Date.now() + json.expires_in * 1000 : null;
      vault.youtube = account;
      saveVaultAccounts(this.dirs, vault);
      return account;
    }

    throw new Error(`${platform} authorization has expired. Please reconnect your account.`);
  }

  async disconnect(platform: PublishPlatform): Promise<void> {
    const vault = loadVaultAccounts(this.dirs);
    const existing = vault[platform];
    if (existing?.accessToken) {
      try {
        if (platform === 'youtube') {
          await this.fetchFn('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: existing.accessToken }),
          });
        }
      } catch {
        // Always remove local encrypted credentials even if remote revocation network fails
      }
    }
    delete vault[platform];
    saveVaultAccounts(this.dirs, vault);
  }

  private pruneExpiredStates(): void {
    const now = Date.now();
    for (const [key, val] of this.pendingStates.entries()) {
      if (val.expiresAtMs < now) {
        this.pendingStates.delete(key);
      }
    }
  }
}
