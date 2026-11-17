import React from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  Send,
  Wrench,
  XCircle,
} from 'lucide-react';
import { IssueStatus } from '../types/civic';

interface StatusBadgeProps {
  status: IssueStatus;
  compact?: boolean;
}

const STATUS_STYLES: Record<
  IssueStatus,
  {
    wrapper: string;
    Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  }
> = {
  [IssueStatus.Submitted]: {
    wrapper: 'border-[#9CCCCC] bg-[#F2F8F7] text-[#254B33]',
    Icon: Send,
  },
  [IssueStatus.UnderVerification]: {
    wrapper: 'border-amber-300 bg-amber-50 text-amber-900',
    Icon: Eye,
  },
  [IssueStatus.Verified]: {
    wrapper: 'border-[#5E9185] bg-[#B5D8C7]/35 text-[#06271A]',
    Icon: CheckCircle2,
  },
  [IssueStatus.ActionInProgress]: {
    wrapper: 'border-sky-300 bg-sky-50 text-sky-900',
    Icon: Wrench,
  },
  [IssueStatus.Resolved]: {
    wrapper: 'border-[#254B33] bg-[#254B33] text-white',
    Icon: CheckCircle2,
  },
  [IssueStatus.Recurring]: {
    wrapper: 'border-orange-300 bg-orange-50 text-orange-900',
    Icon: RefreshCw,
  },
  [IssueStatus.Rejected]: {
    wrapper: 'border-slate-300 bg-slate-100 text-slate-700',
    Icon: XCircle,
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, compact = false }) => {
  const config = STATUS_STYLES[status] ?? {
    wrapper: 'border-slate-300 bg-slate-50 text-slate-700',
    Icon: Clock,
  };
  const { Icon } = config;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium whitespace-nowrap shrink-0 ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      } ${config.wrapper}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden={true} />
      <span>{status}</span>
    </span>
  );
};
