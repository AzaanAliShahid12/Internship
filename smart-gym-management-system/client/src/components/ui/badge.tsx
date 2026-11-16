import { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const tones: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
};

export function Badge({ tone = 'slate', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)} {...props} />;
}

export function statusBadge(status: string) {
  switch (status) {
    case 'active': case 'completed': case 'success': case 'checked_in': return <Badge tone="green">{label(status)}</Badge>;
    case 'expired': case 'failed': case 'rejected': case 'suspended': return <Badge tone="red">{label(status)}</Badge>;
    case 'pending': case 'checked_out': return <Badge tone="amber">{label(status)}</Badge>;
    case 'inactive': case 'cancelled': case 'refunded': return <Badge tone="slate">{label(status)}</Badge>;
    default: return <Badge tone="blue">{label(status)}</Badge>;
  }
}

function label(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
