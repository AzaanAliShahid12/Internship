import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationsApi } from '../../services/api';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Pagination } from '../../components/ui/pagination';
import { PageLoading, EmptyState, ErrorState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { getSocket } from '../../lib/socket';
import { formatDateTime } from '../../lib/utils';
import { cn } from '../../lib/utils';

const TYPE_TONES: Record<string, 'green' | 'red' | 'amber' | 'blue' | 'violet' | 'slate'> = {
  membership_expiring: 'amber', membership_expired: 'red', payment_received: 'green',
  membership_renewed: 'blue', check_in_success: 'green', check_in_rejected: 'red',
  new_member: 'violet', general: 'slate',
};

export default function Notifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const query = useQuery({
    queryKey: ['notifications', page, unreadOnly],
    queryFn: () => notificationsApi.list({ page, limit: 15, unread: unreadOnly ? 'true' : undefined }),
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    socket.on('notification:new', refresh);
    return () => { socket.off('notification:new', refresh); };
  }, [queryClient]);

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
    onError: err => toast('error', apiErrorMessage(err)),
  });
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      toast('success', 'All notifications marked as read');
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
    onError: err => toast('error', apiErrorMessage(err)),
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" subtitle={`${query.data?.unread ?? 0} unread · updates arrive in real time`}
        action={
          <div className="flex gap-2">
            <Button variant={unreadOnly ? 'default' : 'secondary'} size="sm" onClick={() => { setUnreadOnly(u => !u); setPage(1); }}>
              {unreadOnly ? 'Showing unread' : 'Unread only'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}><CheckCheck /> Mark all read</Button>
          </div>
        } />
      <Card>
        {query.isLoading ? <PageLoading /> : query.isError ? <div className="p-4"><ErrorState message="Could not load notifications" onRetry={() => void query.refetch()} /></div>
          : query.data && query.data.items.length > 0 ? (
            <>
              <div className="divide-y divide-slate-100">
                {query.data.items.map(n => (
                  <button key={n._id} onClick={() => !n.isRead && markRead.mutate(n._id)}
                    className={cn('w-full text-left px-5 py-4 flex gap-3 hover:bg-slate-50', !n.isRead && 'bg-brand-50/50')}>
                    <span className={cn('mt-0.5 rounded-full p-2 h-fit', n.isRead ? 'bg-slate-100 text-slate-400' : 'bg-brand-100 text-brand-700')}>
                      <Bell className="size-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-sm', n.isRead ? 'font-medium text-slate-700' : 'font-semibold text-slate-900')}>{n.title}</span>
                        <Badge tone={TYPE_TONES[n.type] ?? 'slate'}>{n.type.replace(/_/g, ' ')}</Badge>
                        {!n.isRead && <span className="size-2 rounded-full bg-brand-600" />}
                      </span>
                      <span className="block text-sm text-slate-600 mt-0.5">{n.message}</span>
                      <span className="block text-xs text-slate-400 mt-1">{formatDateTime(n.createdAt)}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="px-4"><Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onChange={setPage} /></div>
            </>
          ) : <EmptyState title="No notifications" message="Check-ins, payments and membership events will appear here." />}
      </Card>
    </div>
  );
}
