import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, MonitorSmartphone } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';
import { auditApi, devicesApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Input, Label, FieldError, Select } from '../../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, THead, Th, Td, Tr } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Dialog, ConfirmDialog } from '../../components/ui/dialog';
import { Pagination } from '../../components/ui/pagination';
import { PageLoading, EmptyState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { formatDateTime } from '../../lib/utils';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(8, 'At least 8 characters'),
  confirm: z.string().min(1),
}).refine(d => d.newPassword === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

const deviceSchema = z.object({
  name: z.string().min(2),
  location: z.string().optional(),
  type: z.enum(['qr_scanner', 'face_terminal', 'reception_desk', 'other']),
});

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [confirmDevice, setConfirmDevice] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);

  const devices = useQuery({ queryKey: ['devices'], queryFn: () => devicesApi.list() });
  const audit = useQuery({ queryKey: ['audit-logs', auditPage], queryFn: () => auditApi.list({ page: auditPage, limit: 10 }) });

  const nameForm = useForm<{ name: string }>({ defaultValues: { name: user?.name ?? '' } });
  const saveName = useMutation({
    mutationFn: (name: string) => api.put('/auth/profile', { name }),
    onSuccess: () => toast('success', 'Profile updated — refresh to see your new name everywhere'),
    onError: err => toast('error', apiErrorMessage(err)),
  });

  const pwForm = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });
  const changePassword = useMutation({
    mutationFn: (v: z.infer<typeof passwordSchema>) => api.post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword }),
    onSuccess: () => { toast('success', 'Password changed'); pwForm.reset(); },
    onError: err => toast('error', apiErrorMessage(err)),
  });

  const deviceForm = useForm<z.infer<typeof deviceSchema>>({ resolver: zodResolver(deviceSchema), defaultValues: { type: 'qr_scanner' } });
  const createDevice = useMutation({
    mutationFn: (v: z.infer<typeof deviceSchema>) => devicesApi.create(v),
    onSuccess: () => {
      toast('success', 'Device registered');
      setDeviceOpen(false);
      deviceForm.reset();
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: err => toast('error', apiErrorMessage(err)),
  });
  const deleteDevice = useMutation({
    mutationFn: (id: string) => devicesApi.remove(id),
    onSuccess: () => { toast('success', 'Device removed'); setConfirmDevice(null); void queryClient.invalidateQueries({ queryKey: ['devices'] }); },
    onError: err => toast('error', apiErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile, security, entrance devices and the audit trail" />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={nameForm.handleSubmit(v => saveName.mutate(v.name))} className="space-y-3">
                <div><Label>Display name</Label><Input {...nameForm.register('name')} /></div>
                <div><Label>Email</Label><Input value={user?.email ?? ''} disabled /></div>
                <div><Label>Role</Label><Input value={user?.role.replace('_', ' ') ?? ''} disabled className="capitalize" /></div>
                <Button type="submit" disabled={saveName.isPending}>{saveName.isPending ? 'Saving…' : 'Save profile'}</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={pwForm.handleSubmit(v => changePassword.mutate(v))} className="space-y-3">
                <div><Label>Current password</Label><Input type="password" {...pwForm.register('currentPassword')} /><FieldError message={pwForm.formState.errors.currentPassword?.message} /></div>
                <div><Label>New password</Label><Input type="password" {...pwForm.register('newPassword')} /><FieldError message={pwForm.formState.errors.newPassword?.message} /></div>
                <div><Label>Confirm new password</Label><Input type="password" {...pwForm.register('confirm')} /><FieldError message={pwForm.formState.errors.confirm?.message} /></div>
                <Button type="submit" disabled={changePassword.isPending}>{changePassword.isPending ? 'Changing…' : 'Change password'}</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle><span className="inline-flex items-center gap-2"><MonitorSmartphone className="size-4" /> Entrance Devices</span></CardTitle>
              <Button size="sm" onClick={() => setDeviceOpen(true)}><Plus /> Register device</Button>
            </CardHeader>
            <CardContent className="px-0 py-0">
              {devices.isLoading ? <PageLoading /> : devices.data && devices.data.length > 0 ? (
                <Table>
                  <THead><tr><Th>Name</Th><Th>Type</Th><Th>Location</Th><Th>Last seen</Th><Th>Status</Th><Th /></tr></THead>
                  <tbody>
                    {devices.data.map(d => (
                      <Tr key={d._id}>
                        <Td className="font-medium">{d.name}</Td>
                        <Td className="capitalize">{d.type.replace('_', ' ')}</Td>
                        <Td>{d.location ?? '—'}</Td>
                        <Td>{formatDateTime(d.lastSeenAt)}</Td>
                        <Td>{d.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="slate">Inactive</Badge>}</Td>
                        <Td className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setConfirmDevice(d._id)}><Trash2 className="size-4 text-red-500" /></Button>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              ) : <EmptyState title="No devices registered" message="Register the entrance scanner/terminal devices so check-ins can be tagged with the entry point used." />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Audit Log</CardTitle></CardHeader>
            <CardContent className="px-0 py-0">
              {audit.isLoading ? <PageLoading /> : audit.data && audit.data.items.length > 0 ? (
                <>
                  <Table>
                    <THead><tr><Th>When</Th><Th>Actor</Th><Th>Action</Th><Th>Entity</Th></tr></THead>
                    <tbody>
                      {audit.data.items.map((log, i) => {
                        const actor = log.actor as { name?: string } | undefined;
                        return (
                          <Tr key={String(log._id ?? i)}>
                            <Td>{formatDateTime(log.createdAt as string)}</Td>
                            <Td>{actor?.name ?? 'System'}</Td>
                            <Td className="font-mono text-xs">{String(log.action)}</Td>
                            <Td>{String(log.entity)}</Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </Table>
                  <div className="px-4"><Pagination page={audit.data.page} totalPages={audit.data.totalPages} onChange={setAuditPage} /></div>
                </>
              ) : <EmptyState title="No audit entries yet" />}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={deviceOpen} onClose={() => setDeviceOpen(false)} title="Register entrance device">
        <form onSubmit={deviceForm.handleSubmit(v => createDevice.mutate(v))} className="space-y-4">
          <div><Label>Device name *</Label><Input {...deviceForm.register('name')} placeholder="e.g. Main Entrance QR Scanner" /><FieldError message={deviceForm.formState.errors.name?.message} /></div>
          <div><Label>Location</Label><Input {...deviceForm.register('location')} placeholder="e.g. Entrance" /></div>
          <div>
            <Label>Type</Label>
            <Select {...deviceForm.register('type')}>
              <option value="qr_scanner">QR scanner</option>
              <option value="face_terminal">Face terminal</option>
              <option value="reception_desk">Reception desk</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeviceOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createDevice.isPending}>{createDevice.isPending ? 'Saving…' : 'Register device'}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog open={Boolean(confirmDevice)} onClose={() => setConfirmDevice(null)}
        onConfirm={() => confirmDevice && deleteDevice.mutate(confirmDevice)} busy={deleteDevice.isPending}
        title="Remove device" message="This device record will be removed. Past check-ins keep their history. Continue?" confirmLabel="Remove" />
    </div>
  );
}
