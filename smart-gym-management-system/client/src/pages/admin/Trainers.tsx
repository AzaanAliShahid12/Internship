import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { trainersApi, membersApi } from '../../services/api';
import { apiErrorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Input, Label, FieldError, Select } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Dialog, ConfirmDialog } from '../../components/ui/dialog';
import { PageLoading, EmptyState, ErrorState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { formatMoney } from '../../lib/utils';
import type { Trainer } from '../../types';

const schema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(5),
  specialization: z.string().min(2),
  experienceYears: z.coerce.number().min(0),
  salary: z.coerce.number().min(0).optional(),
  availability: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export default function Trainers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdminUser = user && ['super_admin', 'gym_admin'].includes(user.role);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Trainer | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<Trainer | null>(null);
  const [memberPick, setMemberPick] = useState('');

  const query = useQuery({ queryKey: ['trainers', search], queryFn: () => trainersApi.list({ search: search || undefined, limit: 50 }) });
  const memberSearch = useQuery({
    queryKey: ['assign-member-search'],
    queryFn: () => membersApi.list({ status: 'active', limit: 100 }),
    enabled: Boolean(assignFor),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['trainers'] });

  const save = useMutation({
    mutationFn: (v: Values) => (editing ? trainersApi.update(editing._id, v) : trainersApi.create(v)),
    onSuccess: () => { toast('success', editing ? 'Trainer updated' : 'Trainer added'); setDialogOpen(false); setEditing(null); invalidate(); },
    onError: err => toast('error', apiErrorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => trainersApi.remove(id),
    onSuccess: () => { toast('success', 'Trainer deactivated'); setConfirmId(null); invalidate(); },
    onError: err => toast('error', apiErrorMessage(err)),
  });
  const assign = useMutation({
    mutationFn: () => trainersApi.assignMember(assignFor!._id, memberPick),
    onSuccess: res => { toast('success', res.message); setAssignFor(null); invalidate(); },
    onError: err => toast('error', apiErrorMessage(err)),
  });

  const openCreate = () => { setEditing(null); reset({ fullName: '', email: '', phone: '', specialization: '', experienceYears: 0, salary: 0, availability: '' }); setDialogOpen(true); };
  const openEdit = (t: Trainer) => {
    setEditing(t);
    reset({ fullName: t.fullName, email: t.email, phone: t.phone, specialization: t.specialization, experienceYears: t.experienceYears, salary: t.salary ?? 0, availability: t.availability ?? '' });
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader title="Trainers" subtitle="Trainer profiles, specializations and member assignments"
        action={isAdminUser ? <Button onClick={openCreate}><Plus /> Add Trainer</Button> : undefined} />
      <div className="max-w-md mb-4">
        <Input placeholder="Search trainers or specializations…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {query.isLoading ? <PageLoading /> : query.isError ? <ErrorState message="Could not load trainers" onRetry={() => void query.refetch()} />
        : query.data && query.data.items.length > 0 ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {query.data.items.map(t => (
              <Card key={t._id}>
                <CardContent>
                  <div className="flex items-start gap-3">
                    {t.profileImage
                      ? <img src={t.profileImage} alt="" className="size-12 rounded-full object-cover" />
                      : <span className="size-12 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center font-bold">{t.fullName.charAt(0)}</span>}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">{t.fullName} <span className="text-xs text-slate-400 font-normal">{t.trainerId}</span></p>
                      <p className="text-sm text-brand-600">{t.specialization}</p>
                    </div>
                    {t.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="slate">Inactive</Badge>}
                  </div>
                  <div className="text-sm text-slate-600 space-y-1 mt-3">
                    <p>{t.email} · {t.phone}</p>
                    <p>Experience: {t.experienceYears} year(s){t.availability ? ` · ${t.availability}` : ''}</p>
                    {t.salary !== undefined && <p>Salary: {formatMoney(t.salary)} <span className="text-xs text-slate-400">(admin only)</span></p>}
                    <p className="inline-flex items-center gap-1"><Users className="size-4" /> {t.assignedCount ?? 0} assigned member(s)</p>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    <Button variant="ghost" size="sm" onClick={() => { setAssignFor(t); setMemberPick(''); }}>Assign member</Button>
                    {isAdminUser && <>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Pencil /> Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmId(t._id)}><Trash2 className="text-red-500" /> Deactivate</Button>
                    </>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : <Card><EmptyState title="No trainers found" /></Card>}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit trainer' : 'Add trainer'}>
        <form onSubmit={handleSubmit(v => save.mutate(v))} className="grid sm:grid-cols-2 gap-4">
          <div><Label>Full name *</Label><Input {...register('fullName')} /><FieldError message={errors.fullName?.message} /></div>
          <div><Label>Email *</Label><Input type="email" {...register('email')} /><FieldError message={errors.email?.message} /></div>
          <div><Label>Phone *</Label><Input {...register('phone')} /><FieldError message={errors.phone?.message} /></div>
          <div><Label>Specialization *</Label><Input {...register('specialization')} placeholder="e.g. Strength & Conditioning" /><FieldError message={errors.specialization?.message} /></div>
          <div><Label>Experience (years)</Label><Input type="number" {...register('experienceYears')} /></div>
          <div><Label>Salary (PKR, admin only)</Label><Input type="number" {...register('salary')} /></div>
          <div className="sm:col-span-2"><Label>Availability</Label><Input {...register('availability')} placeholder="e.g. Mon–Sat, 6am–12pm" /></div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save trainer'}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(assignFor)} onClose={() => setAssignFor(null)} title={`Assign member to ${assignFor?.fullName ?? ''}`}>
        <div className="space-y-4">
          <div>
            <Label>Member</Label>
            <Select value={memberPick} onChange={e => setMemberPick(e.target.value)}>
              <option value="">Select a member…</option>
              {memberSearch.data?.items.map(m => <option key={m._id} value={m._id}>{m.fullName} ({m.memberId})</option>)}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssignFor(null)}>Cancel</Button>
            <Button disabled={!memberPick || assign.isPending} onClick={() => assign.mutate()}>{assign.isPending ? 'Assigning…' : 'Assign'}</Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog open={Boolean(confirmId)} onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && remove.mutate(confirmId)} busy={remove.isPending}
        title="Deactivate trainer" message="The trainer will be deactivated and their members unassigned. Continue?" confirmLabel="Deactivate" />
    </div>
  );
}
