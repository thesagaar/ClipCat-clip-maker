import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '../../utils/cn';

export type SemanticStatus =
  | 'completed'
  | 'operational'
  | 'ready'
  | 'applied'
  | 'running'
  | 'processing'
  | 'rendering'
  | 'queued'
  | 'waiting'
  | 'draft'
  | 'uploaded'
  | 'pending'
  | 'warning'
  | 'needs_attention'
  | 'degraded'
  | 'not_installed'
  | 'failed'
  | 'unavailable'
  | 'cancelled'
  | 'disabled'
  | 'not_exported'
  | 'exporting';

const statusConfig: Record<
  SemanticStatus,
  { label: string; colorClass: string; icon: React.ReactNode }
> = {
  completed: {
    label: 'Completed',
    colorClass: 'text-ios-green',
    icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
  },
  operational: {
    label: 'Operational',
    colorClass: 'text-ios-green',
    icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
  },
  ready: {
    label: 'Ready',
    colorClass: 'text-ios-green',
    icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
  },
  applied: {
    label: 'Captions Applied',
    colorClass: 'text-ios-green',
    icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
  },
  running: {
    label: 'Running',
    colorClass: 'text-ios-blue',
    icon: <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />,
  },
  processing: {
    label: 'Processing',
    colorClass: 'text-ios-blue',
    icon: <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />,
  },
  rendering: {
    label: 'Rendering',
    colorClass: 'text-ios-blue',
    icon: <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />,
  },
  exporting: {
    label: 'Exporting',
    colorClass: 'text-ios-blue',
    icon: <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />,
  },
  queued: {
    label: 'Queued',
    colorClass: 'text-ios-secondary',
    icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
  },
  waiting: {
    label: 'Waiting',
    colorClass: 'text-ios-secondary',
    icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
  },
  draft: {
    label: 'Draft',
    colorClass: 'text-ios-secondary',
    icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
  },
  uploaded: {
    label: 'Ready to Process',
    colorClass: 'text-ios-blue',
    icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
  },
  pending: {
    label: 'Pending',
    colorClass: 'text-ios-secondary',
    icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
  },
  warning: {
    label: 'Warning',
    colorClass: 'text-ios-orange',
    icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
  },
  needs_attention: {
    label: 'Needs Attention',
    colorClass: 'text-ios-orange',
    icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
  },
  degraded: {
    label: 'Warning',
    colorClass: 'text-ios-orange',
    icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
  },
  not_installed: {
    label: 'Not Installed',
    colorClass: 'text-ios-orange',
    icon: <AlertCircle className="w-3.5 h-3.5 shrink-0" />,
  },
  failed: {
    label: 'Failed',
    colorClass: 'text-ios-red',
    icon: <XCircle className="w-3.5 h-3.5 shrink-0" />,
  },
  unavailable: {
    label: 'Unavailable',
    colorClass: 'text-ios-red',
    icon: <XCircle className="w-3.5 h-3.5 shrink-0" />,
  },
  cancelled: {
    label: 'Cancelled',
    colorClass: 'text-ios-secondary',
    icon: <MinusCircle className="w-3.5 h-3.5 shrink-0" />,
  },
  disabled: {
    label: 'Disabled',
    colorClass: 'text-ios-secondary',
    icon: <MinusCircle className="w-3.5 h-3.5 shrink-0" />,
  },
  not_exported: {
    label: 'Not Exported',
    colorClass: 'text-ios-secondary',
    icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
  },
};

export function StatusIndicator({
  status,
  customLabel,
  className,
}: {
  status: SemanticStatus;
  customLabel?: string;
  className?: string;
}) {
  const cfg = statusConfig[status] ?? statusConfig.pending;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0',
        cfg.colorClass,
        className
      )}
    >
      <span aria-hidden="true">{cfg.icon}</span>
      <span>{customLabel ?? cfg.label}</span>
    </span>
  );
}
