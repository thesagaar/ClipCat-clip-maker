import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Database,
  HardDrive,
  Radio,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import { pingBackendServer, type BackendPingResult } from '../api/system';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { ENV, getApiBaseUrl } from '../config/env';
import {
  useSystemDependenciesQuery,
  useSystemHealthQuery,
  useSystemStorageQuery,
} from '../hooks/useClipCatQueries';
import { useUiStore } from '../stores/uiStore';
import { getRuntimeEnvironmentLabel } from '../utils/desktop';
import { formatBytes, formatTimeShort } from '../utils/format';

export function SystemStatusPage() {
  const healthQuery = useSystemHealthQuery();
  const depsQuery = useSystemDependenciesQuery();
  const storageQuery = useSystemStorageQuery();
  const { mockModeEnabled, setMockModeEnabled, addToast } = useUiStore();
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<BackendPingResult | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleRefreshAll = () => {
    healthQuery.refetch();
    depsQuery.refetch();
    storageQuery.refetch();
  };

  const handlePingBackend = async () => {
    setIsPinging(true);
    try {
      const result = await pingBackendServer();
      setPingResult(result);
      if (result.reachable) {
        healthQuery.refetch();
        addToast({
          variant: 'success',
          title: 'Backend Reachable',
          description: result.message,
        });
      } else {
        addToast({
          variant: 'error',
          title: 'Backend Unreachable',
          description: result.message,
        });
      }
    } finally {
      setIsPinging(false);
    }
  };

  const activeApiUrl = getApiBaseUrl();

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(activeApiUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      addToast({
        variant: 'info',
        title: 'Copy Unavailable',
        description: `API URL: ${activeApiUrl}`,
      });
    }
  };

  const health = healthQuery.data;
  const deps = depsQuery.data?.dependencies ?? [];
  const storage = storageQuery.data;

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold text-ios-label">
            System Health & Dependencies
          </h2>
          <p className="text-sm text-ios-secondary mt-1">
            Live local environment diagnostics sourced from FastAPI health endpoints.
          </p>
        </div>
        <Button
          variant="secondary"
          className="shrink-0 self-start sm:self-auto"
          icon={<RefreshCw className="w-4 h-4" />}
          onClick={handleRefreshAll}
        >
          Refresh Diagnostics
        </Button>
      </div>

      {(healthQuery.isError || depsQuery.isError) && (
        <ErrorState
          error={healthQuery.error ?? depsQuery.error}
          title="FastAPI Health Endpoints Unreachable"
          onRetry={handleRefreshAll}
          secondaryAction={
            !mockModeEnabled ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMockModeEnabled(true)}
              >
                Inspect with Mock Adapter
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Top Core Telemetry Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-ios-secondary">
            <span>Frontend Client</span>
            <Server className="w-4 h-4 text-ios-green" aria-hidden="true" />
          </div>
          <StatusIndicator status="operational" />
          <p className="text-xs font-mono text-ios-secondary">
            v{ENV.APP_VERSION} · {getRuntimeEnvironmentLabel()}
          </p>
        </div>

        <div className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-ios-secondary">
            <span>FastAPI Backend</span>
            <Server className="w-4 h-4 text-ios-blue" aria-hidden="true" />
          </div>
          {healthQuery.isLoading ? (
            <Skeleton className="h-5 w-24" />
          ) : healthQuery.isError ? (
            <StatusIndicator status="unavailable" />
          ) : (
            <StatusIndicator status={health?.status ?? 'unavailable'} />
          )}
          <p className="text-xs font-mono text-ios-secondary truncate">
            {activeApiUrl}
          </p>
        </div>

        <div className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-ios-secondary">
            <span>SQLite Database</span>
            <Database className="w-4 h-4 text-ios-indigo" aria-hidden="true" />
          </div>
          {healthQuery.isLoading ? (
            <Skeleton className="h-5 w-24" />
          ) : (
            <StatusIndicator status={health?.databaseStatus ?? 'unavailable'} />
          )}
          <p className="text-xs font-mono text-ios-secondary tabular-nums">
            Active Jobs: {health?.activeJobsCount ?? '—'}
          </p>
        </div>

        <div className="min-w-0 rounded-xl bg-ios-surface border border-ios-sep p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-ios-secondary">
            <span>CPU & RAM</span>
            <Cpu className="w-4 h-4 text-ios-orange" aria-hidden="true" />
          </div>
          <p className="font-mono text-sm font-semibold text-ios-label tabular-nums">
            CPU: {health?.cpuUsagePercent !== null && health?.cpuUsagePercent !== undefined ? `${health.cpuUsagePercent}%` : '—'}
          </p>
          <p className="text-xs font-mono text-ios-secondary tabular-nums">
            RAM: {health?.ramUsedBytes ? `${formatBytes(health.ramUsedBytes)} / ${formatBytes(health.ramTotalBytes)}` : '—'}
          </p>
        </div>
      </section>

      {/* Backend Connection Section */}
      <section
        aria-label="Backend Connection"
        className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold text-ios-label">
              Backend Connection
            </h3>
            <p className="text-xs text-ios-secondary mt-1">
              Verify live reachability between the ClipCat frontend and your local Python FastAPI server.
            </p>
          </div>
          <Button
            variant="primary"
            className="shrink-0 self-start sm:self-auto"
            loading={isPinging}
            icon={<Radio className="w-4 h-4" />}
            onClick={handlePingBackend}
          >
            {isPinging ? 'Pinging Server...' : 'Ping Backend'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="min-w-0 rounded-lg bg-ios-bg border border-ios-sep p-3.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-ios-secondary">VITE_API_BASE_URL</span>
              <button
                type="button"
                onClick={handleCopyUrl}
                aria-label="Copy backend base URL"
                className="inline-flex items-center gap-1 text-[11px] text-ios-blue hover:underline cursor-pointer shrink-0"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="font-mono text-xs text-ios-label break-all">
              {activeApiUrl}
            </p>
          </div>

          <div className="min-w-0 rounded-lg bg-ios-bg border border-ios-sep p-3.5 space-y-1.5">
            <span className="text-xs text-ios-secondary">Connection Status</span>
            <div>
              {isPinging ? (
                <StatusIndicator status="running" customLabel="Testing Connection" />
              ) : pingResult ? (
                <StatusIndicator status={pingResult.status} />
              ) : healthQuery.isError ? (
                <StatusIndicator status="unavailable" />
              ) : healthQuery.data && !mockModeEnabled ? (
                <StatusIndicator status={healthQuery.data.status} />
              ) : (
                <StatusIndicator status="pending" customLabel="Not Pinged Yet" />
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-lg bg-ios-bg border border-ios-sep p-3.5 space-y-1.5">
            <span className="text-xs text-ios-secondary">Response Latency</span>
            <p className="font-mono text-xs text-ios-label tabular-nums">
              {pingResult
                ? `${pingResult.latencyMs} ms · checked ${formatTimeShort(pingResult.checkedAt)}`
                : '— (click Ping Backend)'}
            </p>
          </div>
        </div>

        {pingResult && (
          <div
            role="status"
            className={`rounded-lg border p-3.5 flex items-start gap-3 text-xs ${
              pingResult.reachable
                ? 'bg-[var(--ios-green-tint)] border-[var(--ios-green-border)] text-ios-label'
                : 'bg-[var(--ios-red-tint)] border-[var(--ios-red-border)] text-ios-label'
            }`}
          >
            {pingResult.reachable ? (
              <CheckCircle2 className="w-4 h-4 text-ios-green shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-ios-red shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 min-w-0">
              <p className="font-medium break-words">
                {pingResult.reachable
                  ? `FastAPI responded from ${pingResult.targetUrl} (${pingResult.latencyMs} ms)`
                  : `Ping failed for ${pingResult.targetUrl}`}
              </p>
              <p className="text-ios-secondary leading-relaxed break-words">
                {pingResult.reachable
                  ? `Backend version: ${pingResult.backendVersion ?? 'Reported operational'}`
                  : pingResult.message}
              </p>
              {!pingResult.reachable && (
                <p className="font-mono text-[11px] text-ios-secondary pt-1 break-all">
                  Start local FastAPI with CORS enabled: uvicorn app.main:app --host 127.0.0.1 --port 8000
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Dependency Inspection Table */}
      <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-ios-label">
            Local Media & AI Dependencies
          </h3>
          {depsQuery.data?.availableWhisperModels && (
            <span className="text-xs text-ios-secondary font-mono">
              Models: {depsQuery.data.availableWhisperModels.join(', ')}
            </span>
          )}
        </div>

        {depsQuery.isLoading ? (
          <Skeleton className="h-56" />
        ) : deps.length === 0 ? (
          <p className="text-sm text-ios-secondary">
            Dependency diagnostics unavailable until the FastAPI backend responds at{' '}
            <code className="font-mono text-ios-label">GET /api/system/dependencies</code>.
          </p>
        ) : (
          <div className="divide-y divide-ios-sep">
            {deps.map((dep) => (
              <div
                key={dep.id}
                className="py-4 flex flex-col md:flex-row md:items-start justify-between gap-3"
              >
                <div className="space-y-1 max-w-2xl min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-display text-sm font-bold text-ios-label">
                      {dep.name}
                    </span>
                    {dep.version && (
                      <span className="text-xs font-mono text-ios-secondary">
                        {dep.version}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ios-secondary leading-relaxed">
                    {dep.explanation}
                  </p>
                  {dep.installInstructions && dep.status !== 'operational' && (
                    <pre className="mt-2 rounded-lg bg-ios-bg border border-ios-sep p-2.5 text-xs font-mono text-ios-blue overflow-x-auto max-w-full">
                      {dep.installInstructions}
                    </pre>
                  )}
                </div>
                <StatusIndicator status={dep.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Disk Storage Breakdown */}
      <section className="rounded-xl bg-ios-surface border border-ios-sep p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-ios-blue" aria-hidden="true" />
          <h3 className="font-display text-base font-bold text-ios-label">
            Disk Space Breakdown
          </h3>
        </div>
        {storage ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="min-w-0">
              <p className="text-ios-secondary">Total Studio Used</p>
              <p className="font-mono tabular-nums text-base font-semibold text-ios-label mt-0.5">
                {formatBytes(storage.totalUsedBytes)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-ios-secondary">Projects</p>
              <p className="font-mono tabular-nums text-base font-semibold text-ios-label mt-0.5">
                {formatBytes(storage.projectStorageBytes)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-ios-secondary">Exports</p>
              <p className="font-mono tabular-nums text-base font-semibold text-ios-label mt-0.5">
                {formatBytes(storage.exportStorageBytes)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-ios-secondary">Available Disk</p>
              <p className="font-mono tabular-nums text-base font-semibold text-ios-green mt-0.5">
                {formatBytes(storage.availableDiskBytes)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-ios-secondary">
            Disk usage breakdown unavailable while backend is offline.
          </p>
        )}
      </section>
    </div>
  );
}
