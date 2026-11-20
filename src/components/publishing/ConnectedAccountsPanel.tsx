import { useState } from 'react';
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Instagram,
  Link2,
  Unlink,
  Youtube,
} from 'lucide-react';
import {
  launchOAuthPopupWindow,
  startPublishingOAuth,
} from '../../api/publishing';
import { useDisconnectPublishingAccountMutation } from '../../hooks/usePublishingQueries';
import type { ConnectedAccount, PublishPlatform } from '../../publishing/types';
import { useUiStore } from '../../stores/uiStore';
import { Button } from '../ui/Button';
import { StatusIndicator } from '../ui/StatusIndicator';

interface ConnectedAccountsPanelProps {
  accounts: ConnectedAccount[];
  selectedPlatform: PublishPlatform;
  onRefreshAccounts: () => void;
}

export function ConnectedAccountsPanel({
  accounts,
  selectedPlatform,
  onRefreshAccounts,
}: ConnectedAccountsPanelProps) {
  const { addToast } = useUiStore();
  const disconnectMutation = useDisconnectPublishingAccountMutation();
  const [connectingPlatform, setConnectingPlatform] = useState<PublishPlatform | null>(null);
  const [fallbackAuthLink, setFallbackAuthLink] = useState<{
    platform: PublishPlatform;
    url: string;
  } | null>(null);
  const [showRedirectDetails, setShowRedirectDetails] = useState(false);

  const handleConnect = async (platform: PublishPlatform) => {
    setConnectingPlatform(platform);
    setFallbackAuthLink(null);
    try {
      const { authUrl } = await startPublishingOAuth(platform);
      const { popupOpened } = launchOAuthPopupWindow(authUrl, platform, (res) => {
        setConnectingPlatform(null);
        onRefreshAccounts();
        if (res.ok) {
          addToast({
            variant: 'success',
            title: `${platform === 'youtube' ? 'YouTube' : 'Instagram'} Authorization`,
            description: 'Account status updated cleanly.',
          });
        } else if (res.error) {
          addToast({
            variant: 'error',
            title: 'Authorization Failed',
            description: res.error,
          });
        }
      });

      if (!popupOpened) {
        setConnectingPlatform(null);
        setFallbackAuthLink({ platform, url: authUrl });
        addToast({
          variant: 'warning',
          title: 'Popup Blocked',
          description: 'Use the direct authorization link shown below to connect your account.',
        });
      }
    } catch (err) {
      setConnectingPlatform(null);
      addToast({
        variant: 'error',
        title: `Unable to Start ${platform === 'youtube' ? 'YouTube' : 'Instagram'} OAuth`,
        description: err instanceof Error ? err.message : 'OAuth configuration missing.',
      });
    }
  };

  const handleDisconnect = async (platform: PublishPlatform) => {
    try {
      await disconnectMutation.mutateAsync(platform);
      addToast({
        variant: 'info',
        title: `${platform === 'youtube' ? 'YouTube' : 'Instagram'} Disconnected`,
        description: 'Encrypted OAuth tokens revoked and removed from local vault.',
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Disconnect Failed',
        description: err instanceof Error ? err.message : 'Could not revoke account tokens.',
      });
    }
  };

  const handleCopyRedirect = async (uri: string) => {
    try {
      await navigator.clipboard.writeText(uri);
      addToast({
        variant: 'success',
        title: 'Callback URL Copied',
        description: uri,
      });
    } catch {
      addToast({
        variant: 'info',
        title: 'Callback URL',
        description: uri,
      });
    }
  };

  return (
    <section
      aria-label="Connected Publishing Accounts"
      className="rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold text-ios-label">
            Connected Publishing Accounts
          </h3>
          <p className="text-xs text-ios-secondary mt-0.5">
            OAuth 2.0 tokens are encrypted at rest on the local server vault and never stored in browser storage.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowRedirectDetails((prev) => !prev)}
          className="text-xs font-medium text-ios-blue hover:underline cursor-pointer whitespace-nowrap"
        >
          {showRedirectDetails ? 'Hide OAuth Callback URIs' : 'OAuth Callback URIs'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc) => {
          const isYt = acc.platform === 'youtube';
          const isActiveTarget = acc.platform === selectedPlatform;

          return (
            <div
              key={acc.platform}
              className={`rounded-xl bg-ios-bg border p-4 space-y-3 transition-colors ${
                isActiveTarget ? 'border-ios-blue' : 'border-ios-sep'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                      isYt
                        ? 'bg-[var(--ios-red-tint)] border-[var(--ios-red-border)] text-ios-red'
                        : 'bg-[#7040DC]/15 border-[#7040DC]/35 text-[#AF52DE]'
                    }`}
                  >
                    {isYt ? <Youtube className="w-4 h-4" /> : <Instagram className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-display text-sm font-bold text-ios-label">
                        {isYt ? 'YouTube' : 'Instagram'}
                      </p>
                      {isActiveTarget && (
                        <span className="text-[11px] font-medium text-ios-blue">Selected</span>
                      )}
                    </div>
                    <p className="text-xs text-ios-secondary truncate">
                      {acc.connected
                        ? `${acc.accountName ?? 'Connected Account'}${acc.accountHandle ? ` (${acc.accountHandle})` : ''}`
                        : isYt
                          ? 'YouTube Data API v3 · Shorts & Video'
                          : 'Instagram Graph API · Reels (Business / Creator)'}
                    </p>
                  </div>
                </div>

                {acc.connected ? (
                  acc.eligible ? (
                    <StatusIndicator status="operational" customLabel="Connected" />
                  ) : (
                    <StatusIndicator status="needs_attention" customLabel="Ineligible" />
                  )
                ) : acc.configured ? (
                  <StatusIndicator status="waiting" customLabel="Not Connected" />
                ) : (
                  <StatusIndicator status="not_installed" customLabel="Setup Needed" />
                )}
              </div>

              {!acc.connected && (
                <p className="text-xs text-ios-secondary leading-relaxed">
                  {acc.configHint}
                </p>
              )}

              {acc.connected && acc.eligibilityReason && !acc.eligible && (
                <div className="rounded-lg bg-[var(--ios-orange-tint)] border border-[var(--ios-orange-border)] p-2.5 text-xs text-ios-orange flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{acc.eligibilityReason}</span>
                </div>
              )}

              {!isYt && (
                <p className="text-[11px] text-ios-secondary leading-relaxed">
                  {acc.instagramMediaTransferMode === 'https_signed_relay'
                    ? 'HTTPS signed temporary media relay is configured for official Meta Reels ingestion.'
                    : 'Local filesystem mode: direct API Reels upload requires an HTTPS media relay (CLIPCAT_PUBLIC_MEDIA_BASE_URL). Use Export & Manual Share locally.'}
                </p>
              )}

              {showRedirectDetails && (
                <div className="rounded-lg bg-ios-surface border border-ios-sep p-2.5 flex items-center justify-between gap-2">
                  <code className="text-[11px] font-mono text-ios-secondary truncate">
                    {acc.redirectUri}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Copy ${acc.platform} callback URI`}
                    icon={<Copy className="w-3 h-3" />}
                    onClick={() => handleCopyRedirect(acc.redirectUri)}
                  >
                    Copy
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {acc.connected ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={disconnectMutation.isPending}
                    icon={<Unlink className="w-3.5 h-3.5" />}
                    onClick={() => handleDisconnect(acc.platform)}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant={isYt ? 'primary' : 'accent-purple'}
                    size="sm"
                    disabled={!acc.configured}
                    loading={connectingPlatform === acc.platform}
                    icon={<Link2 className="w-3.5 h-3.5" />}
                    onClick={() => handleConnect(acc.platform)}
                  >
                    {isYt ? 'Connect YouTube' : 'Connect Instagram'}
                  </Button>
                )}

                {fallbackAuthLink?.platform === acc.platform && (
                  <a
                    href={fallbackAuthLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-ios-blue hover:underline"
                  >
                    <span>Open OAuth Window</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
