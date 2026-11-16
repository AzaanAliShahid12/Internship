import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, AlarmClock } from 'lucide-react';
import { membershipsApi } from '../../services/api';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, THead, Th, Td, Tr } from '../../components/ui/table';
import { statusBadge } from '../../components/ui/badge';
import { Pagination } from '../../components/ui/pagination';
import { PageLoading, EmptyState, ErrorState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { formatDate, formatMoney, daysUntil } from '../../lib/utils';

export default function Memberships() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['memberships', status, page],
    queryFn: () => membershipsApi.list({ status: status || undefined, page, limit: 10 }),
  });
  const upcoming = useQuery({ queryKey: ['upcoming-renewals'], queryFn: () => membershipsApi.upcoming(7) });

  const renew = useMutation({
    mutationFn: (id: string) => membershipsApi.renew(id),
    onSuccess: () => {
      toast('success', 'Membership renewed');
      void queryClient.invalidateQueries({ queryKey: ['memberships'] });
      void queryClient.invalidateQueries({ queryKey: ['upcoming-renewals'] });
    },
    onError: err => toast('error', apiErrorMessage(err)),
  });
  const suspend = useMutation({
    mutationFn: ({ id, status: s }: { id: string; status: string }) => membershipsApi.update(id, { status: s }),
    onSuccess: () => { toast('success', 'Membership updated'); void queryClient.invalidateQueries({ queryKey: ['memberships'] }); },
    onError: err => toast('error', apiErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader title="Memberships" subtitle="Current membership for every member, renewals and expiry tracking" />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Current Memberships</CardTitle>
            <Select className="w-40" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </Select>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {query.isLoading ? <PageLoading /> : query.isError ? <div className="p-4"><ErrorState message="Could not load memberships" onRetry={() => void query.refetch()} /></div>
              : query.data && query.data.items.length > 0 ? (
                <>
                  <Table>
                    <THead><tr><Th>Member</Th><Th>Plan</Th><Th>Start</Th><Th>Expiry</Th><Th>Remaining</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></THead>
                    <tbody>
                      {query.data.items.map(ms => {
                        const remaining = daysUntil(ms.expiryDate);
                        const member = typeof ms.member === 'object' ? ms.member : undefined;
                        const plan = typeof ms.plan === 'object' ? ms.plan : undefined;
                        return (
                          <Tr key={ms._id}>
                            <Td><span className="font-medium text-slate-900">{member?.fullName ?? '—'}</span><span className="block text-xs text-slate-400">{member?.memberId}</span></Td>
                            <Td>{plan?.name ?? '—'}</Td>
                            <Td>{formatDate(ms.startDate)}</Td>
                            <Td>{formatDate(ms.expiryDate)}</Td>
                            <Td>{remaining !== null ? (remaining >= 0 ? `${remaining} days` : 'Expired') : '—'}</Td>
                            <Td>{statusBadge(ms.status)}</Td>
                            <Td className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => renew.mutate(ms._id)} disabled={renew.isPending}><RefreshCw /> Renew</Button>
                                {ms.status !== 'suspended'
                                  ? <Button variant="ghost" size="sm" onClick={() => suspend.mutate({ id: ms._id, status: 'suspended' })}>Suspend</Button>
                                  : <Button variant="ghost" size="sm" onClick={() => suspend.mutate({ id: ms._id, status: 'active' })}>Reactivate</Button>}
                              </div>
                            </Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </Table>
                  <div className="px-4"><Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onChange={setPage} /></div>
                </>
              ) : <EmptyState title="No memberships" message="Assign plans from a member's profile page." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle><span className="inline-flex items-center gap-2"><AlarmClock className="size-4 text-amber-500" /> Expiring in 7 days</span></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {upcoming.isLoading ? <PageLoading /> : upcoming.data && upcoming.data.length > 0 ? upcoming.data.map(ms => {
              const member = typeof ms.member === 'object' ? ms.member : undefined;
              const plan = typeof ms.plan === 'object' ? ms.plan : undefined;
              return (
                <div key={ms._id} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{member?.fullName}</p>
                    <p className="text-xs text-slate-500">{plan?.name} · {formatMoney(plan?.price)} · expires {formatDate(ms.expiryDate)}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => renew.mutate(ms._id)}>Renew</Button>
                </div>
              );
            }) : <EmptyState title="Nothing expiring soon" message="No memberships expire in the next 7 days." />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
