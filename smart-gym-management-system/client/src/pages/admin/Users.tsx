import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, UserX } from 'lucide-react';
import { usersApi } from '../../services/api';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Input, Label, FieldError, Select } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Table, THead, Th, Td, Tr } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Dialog, ConfirmDialog } from '../../components/ui/dialog';
import { Pagination } from '../../components/ui/pagination';
import { PageLoading, EmptyState, ErrorState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { formatDateTime } from '../../lib/utils';
import type { Role, User } from '../../types';

const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin', gym_admin: 'Gym Admin', receptionist: 'Receptionist', trainer: 'Trainer', member: 'Member',
};

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, 'At least 8 characters'),
  role: z.enum(['super_admin', 'gym_admin', 'receptionist', 'trainer', 'member']),
});

export default function Users() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['users', search, role, page],
    queryFn: () => usersApi.list({ search: search || undefined, role: role || undefined, page, limit: 10 }),
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof createSchema>>({ resolver: zodResolver(createSchema) });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['users'] });
  const create = useMutation({
    mutationFn: (v: z.infer<typeof createSchema>) => usersApi.create(v),
    onSuccess: () => { toast('success', 'User account created'); setCreateOpen(false); reset(); invalidate(); },
    onError: err => toast('error', apiErrorMessage(err)),
  });
  const update = useMutation({
    mutationFn: (v: { name?: string; role?: Role; isActive?: boolean }) => usersApi.update(editing!.id, v),
    onSuccess: () => { toast('success', 'User updated'); setEditing(null); invalidate(); },
    onError: err => toast('error', apiErrorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => { toast('success', 'User deactivated'); setConfirmId(null); invalidate(); },
    onError: err => toast('error', apiErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader title="User Accounts" subtitle="Login accounts and roles. Staff accounts are created here — public sign-up is member-only."
        action={<Button onClick={() => setCreateOpen(true)}><Plus /> Create User</Button>} />
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input className="w-64" placeholder="Search name or email…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          <Select className="w-44" value={role} onChange={e => { setRole(e.target.value); setPage(1); }}>
            <option value="">All roles</option>
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
      </Card>
      <Card>
        {query.isLoading ? <PageLoading /> : query.isError ? <div className="p-4"><ErrorState message="Could not load users" onRetry={() => void query.refetch()} /></div>
          : query.data && query.data.items.length > 0 ? (
            <>
              <Table>
                <THead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Last login</Th><Th className="text-right">Actions</Th></tr></THead>
                <tbody>
                  {query.data.items.map(u => (
                    <Tr key={u.id}>
                      <Td className="font-medium text-slate-900">{u.name}</Td>
                      <Td>{u.email}</Td>
                      <Td><Badge tone={u.role === 'super_admin' ? 'violet' : u.role === 'gym_admin' ? 'blue' : u.role === 'member' ? 'slate' : 'amber'}>{ROLE_LABELS[u.role]}</Badge></Td>
                      <Td>{u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}</Td>
                      <Td>{formatDateTime(u.lastLoginAt)}</Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditing(u)}><Pencil /></Button>
                          {u.isActive && <Button variant="ghost" size="icon" title="Deactivate" onClick={() => setConfirmId(u.id)}><UserX className="text-red-500" /></Button>}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <div className="px-4"><Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onChange={setPage} /></div>
            </>
          ) : <EmptyState title="No users found" />}
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create user account">
        <form onSubmit={handleSubmit(v => create.mutate(v))} className="space-y-4">
          <div><Label>Full name *</Label><Input {...register('name')} /><FieldError message={errors.name?.message} /></div>
          <div><Label>Email *</Label><Input type="email" {...register('email')} /><FieldError message={errors.email?.message} /></div>
          <div><Label>Password *</Label><Input type="password" {...register('password')} /><FieldError message={errors.password?.message} /></div>
          <div>
            <Label>Role *</Label>
            <Select {...register('role')}>
              <option value="receptionist">Receptionist</option>
              <option value="gym_admin">Gym Admin</option>
              <option value="trainer">Trainer</option>
              <option value="member">Member</option>
              <option value="super_admin">Super Admin</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create user'}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit user">
        {editing && (
          <form onSubmit={e => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            update.mutate({
              name: String(fd.get('name')),
              role: String(fd.get('role')) as Role,
              isActive: fd.get('isActive') === 'true',
            });
          }} className="space-y-4">
            <div><Label>Full name</Label><Input name="name" defaultValue={editing.name} /></div>
            <div>
              <Label>Role</Label>
              <Select name="role" defaultValue={editing.role}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div>
              <Label>Account status</Label>
              <Select name="isActive" defaultValue={String(editing.isActive)}>
                <option value="true">Active</option>
                <option value="false">Deactivated</option>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save changes'}</Button>
            </div>
          </form>
        )}
      </Dialog>

      <ConfirmDialog open={Boolean(confirmId)} onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && remove.mutate(confirmId)} busy={remove.isPending}
        title="Deactivate user" message="This user will no longer be able to log in. Continue?" confirmLabel="Deactivate" />
    </div>
  );
}
