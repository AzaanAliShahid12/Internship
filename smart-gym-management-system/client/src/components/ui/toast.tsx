import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; message: string; }

const ToastContext = createContext<{ toast: (kind: ToastKind, message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setItems(prev => [...prev, { id, kind, message }]);
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,360px)]">
        {items.map(t => (
          <div key={t.id} className={cn('flex items-start gap-2.5 rounded-lg px-4 py-3 shadow-lg text-sm text-white animate-fade-in',
            t.kind === 'success' ? 'bg-emerald-600' : t.kind === 'error' ? 'bg-red-600' : 'bg-slate-800')}>
            {t.kind === 'success' ? <CheckCircle2 className="size-5 shrink-0" /> : t.kind === 'error' ? <XCircle className="size-5 shrink-0" /> : <Info className="size-5 shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => setItems(prev => prev.filter(x => x.id !== t.id))} aria-label="Dismiss"><X className="size-4" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
