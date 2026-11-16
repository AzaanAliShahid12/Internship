import { LucideIcon } from 'lucide-react';
import { Card } from './card';
import { cn } from '../../lib/utils';

export function StatCard({ title, value, icon: Icon, tone = 'blue', sub }: {
  title: string; value: string | number; icon: LucideIcon;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'violet'; sub?: string;
}) {
  const tones = {
    blue: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <Card className="p-5 flex items-start gap-4">
      <div className={cn('rounded-lg p-2.5', tones[tone])}><Icon className="size-5" /></div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}
