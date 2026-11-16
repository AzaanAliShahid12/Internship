import { Loader2, Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin text-brand-600', className ?? 'size-6')} />;
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner className="size-8" />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} />;
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-slate-100 p-3 mb-3"><Inbox className="size-6 text-slate-400" /></div>
      <p className="font-medium text-slate-700">{title}</p>
      {message && <p className="text-sm text-slate-500 mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
      <span>{message}</span>
      {onRetry && <button className="font-medium underline" onClick={onRetry}>Retry</button>}
    </div>
  );
}
