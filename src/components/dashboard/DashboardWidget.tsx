import { BarChart3, Film, Scissors } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Clip } from '../../types/clip';
import type { Project } from '../../types/project';
import { cn } from '../../utils/cn';
import { Skeleton } from '../ui/Skeleton';
import {
  buildStudioActivityBreakdown,
  type ActivityMetricDatum,
} from './dashboardWidgetUtils';

interface DashboardWidgetProps {
  projects: readonly Project[];
  clips: readonly Clip[];
  isLoading?: boolean;
  isError?: boolean;
  compact?: boolean;
  className?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ActivityMetricDatum }>;
}

function ActivityTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-lg bg-ios-elevated border border-ios-sep px-3 py-2 shadow-xl text-xs space-y-0.5">
      <div className="flex items-center gap-2 font-semibold text-ios-label">
        <span
          className="w-2.5 h-2.5 rounded-xs shrink-0"
          style={{ backgroundColor: item.fill }}
          aria-hidden="true"
        />
        <span>{item.label}</span>
      </div>
      <p className="font-mono text-sm font-bold text-ios-label tabular-nums">
        {item.count}
      </p>
      <p className="text-[11px] text-ios-secondary max-w-[190px]">
        {item.description}
      </p>
    </div>
  );
}

/**
 * Recharts studio activity breakdown showing Total Clips Generated vs. Processed Videos
 * alongside clip-per-video yield metrics derived from real workspace queries.
 */
export function DashboardWidget({
  projects,
  clips,
  isLoading = false,
  isError = false,
  compact = false,
  className,
}: DashboardWidgetProps) {
  const summary = buildStudioActivityBreakdown(projects, clips);

  return (
    <section
      aria-label="Clipping studio activity breakdown"
      data-testid="dashboard-activity-widget"
      className={cn(
        'rounded-xl bg-ios-surface border border-ios-sep min-w-0',
        compact ? 'p-4 space-y-3.5' : 'p-5 sm:p-6 space-y-4',
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#7040DC] shrink-0" aria-hidden="true" />
            <h3
              className={cn(
                'font-display font-bold text-ios-label',
                compact ? 'text-sm' : 'text-base sm:text-lg'
              )}
            >
              Clipping Studio Activity
            </h3>
          </div>
          <p className="text-xs text-ios-secondary">
            Breakdown of total clips generated vs. processed videos
          </p>
        </div>

        {!isLoading && !isError && (
          <div className="flex items-center gap-2 text-xs rounded-lg bg-ios-bg border border-ios-sep px-2.5 py-1.5 shrink-0">
            <span className="text-ios-secondary">Avg output:</span>
            <span className="font-mono font-bold text-ios-label tabular-nums">
              {summary.processedVideosCount > 0
                ? `${summary.averageClipsPerVideo} clips/video`
                : '0 clips/video'}
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <Skeleton className={compact ? 'h-48 w-full' : 'h-56 w-full'} />
      ) : isError ? (
        <div className="rounded-lg bg-ios-bg border border-ios-sep p-4 text-xs text-ios-secondary">
          Studio activity metrics will appear once the FastAPI backend is reachable or sample preview data is loaded.
        </div>
      ) : (
        <div className={cn('grid gap-4 items-center', compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12')}>
          {/* Metric Summary Side */}
          <div className={cn('grid grid-cols-2 gap-3', compact ? 'order-1' : 'lg:col-span-4 lg:grid-cols-1')}>
            <div className="rounded-lg bg-ios-bg border border-ios-sep p-3 sm:p-3.5 flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-ios-secondary leading-tight">
                  <Film className="w-3.5 h-3.5 text-[#0A84FF] shrink-0" aria-hidden="true" />
                  <span>Processed Videos</span>
                </div>
                <p className="font-display text-xl sm:text-2xl font-bold text-ios-label tabular-nums">
                  {summary.processedVideosCount}
                </p>
              </div>
              <span
                className="w-1.5 sm:w-2 h-8 rounded-full bg-[#0A84FF] shrink-0"
                aria-hidden="true"
              />
            </div>

            <div className="rounded-lg bg-ios-bg border border-ios-sep p-3 sm:p-3.5 flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-ios-secondary leading-tight">
                  <Scissors className="w-3.5 h-3.5 text-[#7040DC] shrink-0" aria-hidden="true" />
                  <span>Clips Generated</span>
                </div>
                <p className="font-display text-xl sm:text-2xl font-bold text-ios-label tabular-nums">
                  {summary.totalClipsCount}
                </p>
              </div>
              <span
                className="w-1.5 sm:w-2 h-8 rounded-full bg-[#7040DC] shrink-0"
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Recharts BarChart Breakdown */}
          <div
            className={cn(
              'min-w-0 w-full rounded-lg bg-ios-bg/60 border border-ios-sep p-3 sm:p-4',
              compact ? 'order-2 h-[200px]' : 'lg:col-span-8 h-[220px] sm:h-[240px]'
            )}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={summary.chartData}
                margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                barCategoryGap="28%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--ios-separator)"
                  opacity={0.5}
                />
                <XAxis
                  dataKey={compact ? 'shortLabel' : 'label'}
                  tick={{ fill: 'var(--ios-label-secondary)', fontSize: 12 }}
                  axisLine={{ stroke: 'var(--ios-separator)' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'var(--ios-label-secondary)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<ActivityTooltip />}
                  cursor={{ fill: 'var(--ios-bg-tertiary)', opacity: 0.35 }}
                />
                <Bar
                  dataKey="count"
                  name="Count"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={compact ? 56 : 72}
                >
                  {summary.chartData.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
