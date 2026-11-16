import { Button } from './button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, totalPages, onChange, total }: {
  page: number; totalPages: number; total?: number; onChange: (page: number) => void;
}) {
  if (totalPages <= 1 && !total) return null;
  return (
    <div className="flex items-center justify-between px-1 py-3">
      <p className="text-xs text-slate-500">{total !== undefined ? `${total} record${total === 1 ? '' : 's'}` : ''}</p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft /> Prev
        </Button>
        <span className="text-xs text-slate-600">Page {page} of {totalPages}</span>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
