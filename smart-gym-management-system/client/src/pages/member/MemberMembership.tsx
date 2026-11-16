import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { portalApi } from '../../services/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, THead, Th, Td, Tr } from '../../components/ui/table';
import { statusBadge } from '../../components/ui/badge';
import { PageLoading, ErrorState, EmptyState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { formatDate, formatMoney } from '../../lib/utils';

export default function MemberMembership() {
  const { toast } = useToast();
  const membership = useQuery({ queryKey: ['portal-membership'], queryFn: () => portalApi.membership() });
  const payments = useQuery({ queryKey: ['portal-payments'], queryFn: () => portalApi.payments({ limit: 20 }) });

  const requestRenewal = async () => {
    try {
      const res = await portalApi.requestRenewal();
      toast('success', res.message);
    } catch { toast('error', 'Could not send the renewal request'); }
  };

  if (membership.isLoading) return <PageLoading />;
  if (membership.isError) return <ErrorState message="Could not load membership details" />;
  const ms = membership.data;
  const plan = ms && typeof ms.plan === 'object' ? ms.plan : null;

  return (
    <div className="space-y-4">
      <PageHeader title="My Membership" subtitle="Your current plan, expiry and payment history" />
      <Card>
        <CardHeader><CardTitle>Current plan</CardTitle></CardHeader>
        <CardContent>
          {ms ? (
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5 text-sm max-w-2xl">
              <p className="flex justify-between"><span className="text-slate-500">Plan</span><span className="font-medium">{plan?.name ?? '—'}</span></p>
              <p className="flex justify-between items-center"><span className="text-slate-500">Status</span>{statusBadge(ms.status)}</p>
              <p className="flex justify-between"><span className="text-slate-500">Start date</span><span className="font-medium">{formatDate(ms.startDate)}</span></p>
              <p className="flex justify-between"><span className="text-slate-500">Expiry date</span><span className="font-medium">{formatDate(ms.expiryDate)}</span></p>
              <p className="flex justify-between"><span className="text-slate-500">Days remaining</span><span className="font-medium">{ms.remainingDays ?? 0}</span></p>
              <p className="flex justify-between"><span className="text-slate-500">Price paid</span><span className="font-medium">{formatMoney(ms.pricePaid)}</span></p>
              {plan && plan.features.length > 0 && (
                <div className="sm:col-span-2 pt-1">
                  <p className="text-slate-500 mb-1">Plan features</p>
                  <ul className="list-disc list-inside text-slate-700 space-y-0.5">
                    {plan.features.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
              <div className="sm:col-span-2 pt-2">
                <Button onClick={requestRenewal}><RefreshCw /> Request renewal</Button>
                <p className="text-xs text-slate-400 mt-1.5">The front desk will contact you to complete the renewal and payment.</p>
              </div>
            </div>
          ) : <EmptyState title="No membership assigned" message="Please visit the front desk to choose a plan." />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>My payments</CardTitle></CardHeader>
        <CardContent className="px-0 py-0">
          {payments.isLoading ? <PageLoading /> : payments.data && payments.data.items.length > 0 ? (
            <Table>
              <THead><tr><Th>Payment ID</Th><Th>Date</Th><Th>Plan</Th><Th>Amount</Th><Th>Method</Th><Th>Status</Th></tr></THead>
              <tbody>
                {payments.data.items.map(p => (
                  <Tr key={p._id}>
                    <Td className="font-medium">{p.paymentId}</Td>
                    <Td>{formatDate(p.paidAt)}</Td>
                    <Td>{typeof p.plan === 'object' && p.plan ? p.plan.name : '—'}</Td>
                    <Td>{formatMoney(p.amount - p.discount)}</Td>
                    <Td className="capitalize">{p.method.replace('_', ' ')}</Td>
                    <Td>{statusBadge(p.status)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : <EmptyState title="No payments yet" />}
        </CardContent>
      </Card>
    </div>
  );
}
