import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Receipt, CheckCircle2 } from 'lucide-react';
import { paymentsApi, membersApi, plansApi } from '../../services/api';
import { apiErrorMessage, SERVER_URL } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Input, Label, FieldError, Select } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Table, THead, Th, Td, Tr } from '../../components/ui/table';
import { statusBadge } from '../../components/ui/badge';
import { Dialog } from '../../components/ui/dialog';
import { Pagination } from '../../components/ui/pagination';
import { PageLoading, EmptyState, ErrorState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { formatDate, formatMoney } from '../../lib/utils';
import type { Payment } from '../../types';

const schema = z.object({
  memberId: z.string().min(1, 'Select a member'),
  planId: z.string().optional(),
  amount: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).optional(),
  method: z.enum(['cash', 'bank_transfer', 'card', 'other']),
  status: z.enum(['pending', 'completed']),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export default function Payments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receipt, setReceipt] = useState<Record<string, unknown> | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  const query = useQuery({
    queryKey: ['payments', status, method, page],
    queryFn: () => paymentsApi.list({ status: status || undefined, method: method || undefined, page, limit: 10 }),
  });
  const memberOptions = useQuery({
    queryKey: ['payment-member-search', memberSearch],
    queryFn: () => membersApi.list({ search: memberSearch || undefined, limit: 10 }),
    enabled: dialogOpen,
  });
  const plans = useQuery({ queryKey: ['plans-active'], queryFn: () => plansApi.list('active'), enabled: dialogOpen });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { method: 'cash', status: 'pending', amount: 0, discount: 0 },
  });
  const selectedPlanId = watch('planId');

  const create = useMutation({
    mutationFn: (v: Values) => paymentsApi.create({ ...v, planId: v.planId || undefined }),
    onSuccess: () => {
      toast('success', 'Payment recorded');
      setDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: err => toast('error', apiErrorMessage(err)),
  });
  const complete = useMutation({
    mutationFn: (p: Payment) => paymentsApi.updateStatus(p._id, 'completed', p.transactionReference),
    onSuccess: () => { toast('success', 'Payment marked as completed'); void queryClient.invalidateQueries({ queryKey: ['payments'] }); },
    onError: err => toast('error', apiErrorMessage(err)),
  });

  const openReceipt = async (id: string) => {
    try { setReceipt(await paymentsApi.receipt(id)); }
    catch (err) { toast('error', apiErrorMessage(err)); }
  };

  return (
    <div>
      <PageHeader title="Payments & Billing" subtitle="Record payments, confirm transactions and print receipts"
        action={<Button onClick={() => setDialogOpen(true)}><Plus /> Record Payment</Button>} />
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Select className="w-44" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option><option value="completed">Completed</option>
            <option value="failed">Failed</option><option value="refunded">Refunded</option>
          </Select>
          <Select className="w-44" value={method} onChange={e => { setMethod(e.target.value); setPage(1); }}>
            <option value="">All methods</option>
            <option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option><option value="other">Other</option>
          </Select>
        </div>
      </Card>
      <Card>
        {query.isLoading ? <PageLoading /> : query.isError ? <div className="p-4"><ErrorState message="Could not load payments" onRetry={() => void query.refetch()} /></div>
          : query.data && query.data.items.length > 0 ? (
            <>
              <Table>
                <THead><tr><Th>Payment ID</Th><Th>Member</Th><Th>Plan</Th><Th>Date</Th><Th>Amount</Th><Th>Method</Th><Th>Reference</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></THead>
                <tbody>
                  {query.data.items.map(p => {
                    const m = typeof p.member === 'object' ? p.member : null;
                    const plan = typeof p.plan === 'object' && p.plan ? p.plan : null;
                    return (
                      <Tr key={p._id}>
                        <Td className="font-medium">{p.paymentId}</Td>
                        <Td>{m?.fullName ?? '—'}<span className="block text-xs text-slate-400">{m?.memberId}</span></Td>
                        <Td>{plan?.name ?? '—'}</Td>
                        <Td>{formatDate(p.paidAt)}</Td>
                        <Td>{formatMoney(p.amount - p.discount)}{p.discount > 0 && <span className="block text-xs text-slate-400">incl. {formatMoney(p.discount)} discount</span>}</Td>
                        <Td className="capitalize">{p.method.replace('_', ' ')}</Td>
                        <Td>{p.transactionReference ?? '—'}</Td>
                        <Td>{statusBadge(p.status)}</Td>
                        <Td className="text-right">
                          <div className="flex justify-end gap-1">
                            {p.status === 'pending' && (
                              <Button size="sm" variant="ghost" title="Confirm as completed" onClick={() => complete.mutate(p)}>
                                <CheckCircle2 className="text-emerald-600" /> Confirm
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => void openReceipt(p._id)}><Receipt /> Receipt</Button>
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
              <div className="px-4"><Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onChange={setPage} /></div>
            </>
          ) : <EmptyState title="No payments found" message="Record the first payment using the button above." />}
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Record payment" wide>
        <form onSubmit={handleSubmit(v => create.mutate(v))} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>Member *</Label>
            <Input placeholder="Search member by name or ID…" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} className="mb-2" />
            <Select {...register('memberId')}>
              <option value="">Select member…</option>
              {memberOptions.data?.items.map(m => <option key={m._id} value={m._id}>{m.fullName} ({m.memberId})</option>)}
            </Select>
            <FieldError message={errors.memberId?.message} />
          </div>
          <div>
            <Label>Plan</Label>
            <Select {...register('planId')} onChange={e => {
              setValue('planId', e.target.value);
              const plan = plans.data?.find(p => p._id === e.target.value);
              if (plan) setValue('amount', plan.price);
            }}>
              <option value="">No plan / other</option>
              {plans.data?.map(p => <option key={p._id} value={p._id}>{p.name} — {formatMoney(p.price)}</option>)}
            </Select>
          </div>
          <div>
            <Label>Method *</Label>
            <Select {...register('method')}>
              <option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option>
              <option value="card">Card</option><option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label>Amount (PKR) *</Label>
            <Input type="number" step="0.01" {...register('amount')} />
            <FieldError message={errors.amount?.message} />
          </div>
          <div>
            <Label>Discount (PKR)</Label>
            <Input type="number" step="0.01" {...register('discount')} />
          </div>
          <div>
            <Label>Status *</Label>
            <Select {...register('status')}>
              <option value="pending">Pending (not yet verified)</option>
              <option value="completed">Completed (verified / confirmed)</option>
            </Select>
            <p className="text-xs text-slate-500 mt-1">Only mark completed when the money has actually been received and verified.</p>
          </div>
          <div>
            <Label>Transaction reference</Label>
            <Input {...register('transactionReference')} placeholder="e.g. bank TXN number" />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Input {...register('notes')} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Record payment'}</Button>
          </div>
          {selectedPlanId && <p className="sm:col-span-2 text-xs text-slate-400">Amount auto-filled from the selected plan — adjust if a different amount was charged.</p>}
        </form>
      </Dialog>

      <Dialog open={Boolean(receipt)} onClose={() => setReceipt(null)} title="Payment Receipt">
        {receipt && (
          <div>
            <div className="border border-slate-200 rounded-lg p-5 text-sm space-y-2" id="receipt-print">
              <div className="text-center pb-2 border-b border-slate-100">
                <p className="font-extrabold text-lg">Smart Gym</p>
                <p className="text-xs text-slate-500">Payment Receipt · {String(receipt.receiptNo)}</p>
              </div>
              <Row k="Date" v={formatDate(receipt.date as string)} />
              <Row k="Member" v={`${String(receipt.member)} (${String(receipt.memberId)})`} />
              <Row k="Plan" v={String(receipt.plan)} />
              <Row k="Amount" v={formatMoney(receipt.amount as number)} />
              <Row k="Discount" v={formatMoney(receipt.discount as number)} />
              <Row k="Total paid" v={formatMoney(receipt.total as number)} />
              <Row k="Method" v={String(receipt.method).replace('_', ' ')} />
              <Row k="Status" v={String(receipt.status)} />
              <Row k="Reference" v={String(receipt.transactionReference ?? '—')} />
            </div>
            <div className="flex justify-end gap-2 mt-4 no-print">
              <Button variant="secondary" onClick={() => setReceipt(null)}>Close</Button>
              <Button onClick={() => window.print()}>Print receipt</Button>
            </div>
            <p className="text-xs text-slate-400 mt-2 no-print">Server: {SERVER_URL}</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-medium capitalize">{v}</span></div>;
}
