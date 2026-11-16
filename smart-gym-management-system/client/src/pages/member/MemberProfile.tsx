import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { portalApi, faceApi } from '../../services/api';
import { api, apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Input, Label, FieldError, Select } from '../../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ConfirmDialog } from '../../components/ui/dialog';
import { PageLoading, ErrorState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { useState } from 'react';

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().min(5),
  address: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyRelationship: z.string().optional(),
});
type Values = z.infer<typeof schema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  confirm: z.string().min(1),
}).refine(d => d.newPassword === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export default function MemberProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteFaceOpen, setDeleteFaceOpen] = useState(false);
  const profile = useQuery({ queryKey: ['portal-profile'], queryFn: () => portalApi.profile() });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });
  const pw = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    if (profile.data) {
      const m = profile.data;
      reset({
        name: m.fullName, phone: m.phone, address: m.address ?? '',
        gender: (m.gender as Values['gender']) ?? '',
        dateOfBirth: m.dateOfBirth ? m.dateOfBirth.slice(0, 10) : '',
        emergencyName: m.emergencyContact?.name ?? '',
        emergencyPhone: m.emergencyContact?.phone ?? '',
        emergencyRelationship: m.emergencyContact?.relationship ?? '',
      });
    }
  }, [profile.data, reset]);

  const save = useMutation({
    mutationFn: (v: Values) => portalApi.updateProfile({
      name: v.name, phone: v.phone, address: v.address || undefined,
      gender: v.gender || undefined, dateOfBirth: v.dateOfBirth || undefined,
      emergencyContact: { name: v.emergencyName || undefined, phone: v.emergencyPhone || undefined, relationship: v.emergencyRelationship || undefined },
    }),
    onSuccess: () => { toast('success', 'Profile updated'); void queryClient.invalidateQueries({ queryKey: ['portal-profile'] }); },
    onError: err => toast('error', apiErrorMessage(err)),
  });
  const changePw = useMutation({
    mutationFn: (v: z.infer<typeof passwordSchema>) => api.post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword }),
    onSuccess: () => { toast('success', 'Password changed'); pw.reset(); },
    onError: err => toast('error', apiErrorMessage(err)),
  });
  const deleteFace = useMutation({
    mutationFn: () => faceApi.remove(profile.data!._id),
    onSuccess: () => {
      toast('success', 'Your biometric data has been deleted');
      setDeleteFaceOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['portal-profile'] });
    },
    onError: err => toast('error', apiErrorMessage(err)),
  });

  if (profile.isLoading) return <PageLoading />;
  if (profile.isError || !profile.data) return <ErrorState message="No member profile is linked to this account." />;
  const m = profile.data;

  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader title="My Profile" subtitle={`Member ${m.memberId} · ${m.email}`} />
      <Card>
        <CardHeader><CardTitle>Personal details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(v => save.mutate(v))} className="grid sm:grid-cols-2 gap-4">
            <div><Label>Full name</Label><Input {...register('name')} /><FieldError message={errors.name?.message} /></div>
            <div><Label>Phone</Label><Input {...register('phone')} /><FieldError message={errors.phone?.message} /></div>
            <div><Label>Gender</Label>
              <Select {...register('gender')}>
                <option value="">Select…</option><option value="male">Male</option>
                <option value="female">Female</option><option value="other">Other</option>
              </Select>
            </div>
            <div><Label>Date of birth</Label><Input type="date" {...register('dateOfBirth')} /></div>
            <div className="sm:col-span-2"><Label>Address</Label><Input {...register('address')} /></div>
            <div><Label>Emergency contact name</Label><Input {...register('emergencyName')} /></div>
            <div><Label>Emergency contact phone</Label><Input {...register('emergencyPhone')} /></div>
            <div><Label>Relationship</Label><Input {...register('emergencyRelationship')} /></div>
            <div className="flex items-end"><Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save changes'}</Button></div>
          </form>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={pw.handleSubmit(v => changePw.mutate(v))} className="space-y-3">
              <div><Label>Current password</Label><Input type="password" {...pw.register('currentPassword')} /><FieldError message={pw.formState.errors.currentPassword?.message} /></div>
              <div><Label>New password</Label><Input type="password" {...pw.register('newPassword')} /><FieldError message={pw.formState.errors.newPassword?.message} /></div>
              <div><Label>Confirm new password</Label><Input type="password" {...pw.register('confirm')} /><FieldError message={pw.formState.errors.confirm?.message} /></div>
              <Button type="submit" disabled={changePw.isPending}>{changePw.isPending ? 'Changing…' : 'Change password'}</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Face check-in & privacy</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex justify-between items-center"><span className="text-slate-500">Enrollment status</span>
              {m.faceEnrolled ? <Badge tone="green">Enrolled</Badge> : <Badge tone="slate">Not enrolled</Badge>}</p>
            <p className="text-slate-500">
              Your face template is stored encrypted on the gym server and is only used to verify you at the entrance.
              No photos are stored. You can withdraw consent at any time — your biometric data is deleted immediately
              and QR / manual check-in keep working.
            </p>
            {m.faceEnrolled && (
              <Button variant="danger" onClick={() => setDeleteFaceOpen(true)}>
                <ShieldAlert /> Withdraw consent & delete my face data
              </Button>
            )}
            {!m.faceEnrolled && <p className="text-slate-400">To enroll, visit the front desk — enrollment requires your in-person consent.</p>}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog open={deleteFaceOpen} onClose={() => setDeleteFaceOpen(false)}
        onConfirm={() => deleteFace.mutate()} busy={deleteFace.isPending}
        title="Delete biometric data"
        message="Your encrypted face template will be permanently deleted and face check-in will stop working for you. QR and manual check-in are unaffected. Continue?"
        confirmLabel="Delete my face data" />
    </div>
  );
}
