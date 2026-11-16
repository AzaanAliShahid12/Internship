import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check } from 'lucide-react';
import { plansApi } from '../../services/api';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Input, Label, FieldError, Select, Textarea } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Dialog, ConfirmDialog } from '../../components/ui/dialog';
import { PageLoading, EmptyState, ErrorState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { formatMoney } from '../../lib/utils';
import type { MembershipPlan } from '../../types';

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  planType: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'custom']),
  durationDays: z.coerce.number().int().min(1),
  price: z.coerce.number().min(0),
  featuresText: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});
type Values = z.infer<typeof schema>;

export default function Plans() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MembershipPlan | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['plans-all'], queryFn: () => plansApi.list() });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { planType: 'monthly', status: 'active', durationDays: 30, price: 0 },
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['plans-all'] });
  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        name: v.name, description: v.description, planType: v.planType,
        durationDays: v.durationDays, price: v.price, status: v.status,
        features: (v.featuresText ?? '').split('\n').map(s => s.trim()).filter(Boolean),
      };
      return editing ? plansApi.update(editing._id, body) : plansApi.create(body);
    },
    onSuccess: () => { toast('success', editing ? 'Plan updated' : 'Plan created'); setDialogOpen(false); setEditing(null); invalidate(); },
    onError: err => toast('error', apiErrorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => plansApi.remove(id),
    onSuccess: () => { toast('success', 'Plan deleted'); setConfirmId(null); invalidate(); },
    onError: err => toast('error', apiErrorMessage(err)),
  });

  const openCreate = () => { setEditing(null); reset({ planType: 'monthly', status: 'active', durationDays: 30, price: 0, name: '', featuresText: '' }); setDialogOpen(true); };
  const openEdit = (p: MembershipPlan) => {
    setEditing(p);
    reset({ name: p.name, description: p.description ?? '', planType: p.planType, durationDays: p.durationDays, price: p.price, featuresText: p.features.join('\n'), status: p.status });
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader title="Membership Plans" subtitle="Plans that can be assigned to members"
        action={<Button onClick={openCreate}><Plus /> Create Plan</Button>} />
      {query.isLoading ? <PageLoading /> : query.isError ? <ErrorState message="Could not load plans" onRetry={() => void query.refetch()} />
        : query.data && query.data.length > 0 ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {query.data.map(p => (
              <Card key={p._id} className="flex flex-col">
                <CardContent className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">{p.name}</h3>
                      <p className="text-xs text-slate-500 capitalize">{p.planType.replace('_', ' ')} · {p.durationDays} days</p>
                    </div>
                    {p.status === 'active' ? <Badge tone="green">Active</Badge> : <Badge tone="slate">Inactive</Badge>}
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 mt-3">{formatMoney(p.price)}</p>
                  {p.description && <p className="text-sm text-slate-500 mt-1">{p.description}</p>}
                  <ul className="mt-3 space-y-1.5">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-600"><Check className="size-4 text-emerald-600 shrink-0" />{f}</li>
                    ))}
                  </ul>
                </CardContent>
                <div className="flex justify-end gap-1 px-4 pb-4">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil /> Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmId(p._id)}><Trash2 className="text-red-500" /> Delete</Button>
                </div>
              </Card>
            ))}
          </div>
        ) : <Card><EmptyState title="No plans yet" message="Create your first membership plan." action={<Button onClick={openCreate}><Plus /> Create Plan</Button>} /></Card>}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit plan' : 'Create plan'}>
        <form onSubmit={handleSubmit(v => save.mutate(v))} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>Plan name *</Label>
            <Input {...register('name')} placeholder="e.g. Monthly" />
            <FieldError message={errors.name?.message} />
          </div>
          <div>
            <Label>Plan type *</Label>
            <Select {...register('planType')}>
              <option value="daily">Daily</option><option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
              <option value="half_yearly">Half-yearly</option><option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select {...register('status')}><option value="active">Active</option><option value="inactive">Inactive</option></Select>
          </div>
          <div>
            <Label>Duration (days) *</Label>
            <Input type="number" {...register('durationDays')} />
            <FieldError message={errors.durationDays?.message} />
          </div>
          <div>
            <Label>Price (PKR) *</Label>
            <Input type="number" step="0.01" {...register('price')} />
            <FieldError message={errors.price?.message} />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input {...register('description')} />
          </div>
          <div className="sm:col-span-2">
            <Label>Features (one per line)</Label>
            <Textarea {...register('featuresText')} placeholder={'All equipment\nLocker\nGroup classes'} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save plan'}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog open={Boolean(confirmId)} onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && remove.mutate(confirmId)} busy={remove.isPending}
        title="Delete plan" message="Plans assigned to current members cannot be deleted. Continue?" confirmLabel="Delete" />
    </div>
  );
}
