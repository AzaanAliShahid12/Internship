import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { trainersApi } from '../../services/api';
import { Button } from '../../components/ui/button';
import { Input, Label, FieldError, Select, Textarea } from '../../components/ui/input';
import type { Member } from '../../types';

export const memberFormSchema = z.object({
  fullName: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(5, 'Phone is required'),
  gender: z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  assignedTrainer: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyRelationship: z.string().optional(),
  notes: z.string().optional(),
});
export type MemberFormValues = z.infer<typeof memberFormSchema>;

export function toMemberPayload(v: MemberFormValues) {
  return {
    fullName: v.fullName,
    email: v.email,
    phone: v.phone,
    gender: v.gender || undefined,
    dateOfBirth: v.dateOfBirth || undefined,
    address: v.address || undefined,
    assignedTrainer: v.assignedTrainer || null,
    status: v.status,
    notes: v.notes || undefined,
    emergencyContact: {
      name: v.emergencyName || undefined,
      phone: v.emergencyPhone || undefined,
      relationship: v.emergencyRelationship || undefined,
    },
  };
}

export function MemberForm({ initial, onSubmit, submitting, submitLabel }: {
  initial?: Member;
  onSubmit: (values: MemberFormValues) => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const trainers = useQuery({ queryKey: ['trainers-select'], queryFn: () => trainersApi.list({ limit: 100 }) });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
  });

  useEffect(() => {
    if (initial) {
      reset({
        fullName: initial.fullName,
        email: initial.email,
        phone: initial.phone,
        gender: (initial.gender as MemberFormValues['gender']) ?? '',
        dateOfBirth: initial.dateOfBirth ? initial.dateOfBirth.slice(0, 10) : '',
        address: initial.address ?? '',
        assignedTrainer: typeof initial.assignedTrainer === 'object' ? initial.assignedTrainer?._id : initial.assignedTrainer ?? '',
        status: initial.status,
        emergencyName: initial.emergencyContact?.name ?? '',
        emergencyPhone: initial.emergencyContact?.phone ?? '',
        emergencyRelationship: initial.emergencyContact?.relationship ?? '',
        notes: initial.notes ?? '',
      });
    }
  }, [initial, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid sm:grid-cols-2 gap-4">
      <div>
        <Label>Full name *</Label>
        <Input {...register('fullName')} placeholder="e.g. Ahmed Khan" />
        <FieldError message={errors.fullName?.message} />
      </div>
      <div>
        <Label>Email *</Label>
        <Input type="email" {...register('email')} placeholder="member@example.com" />
        <FieldError message={errors.email?.message} />
      </div>
      <div>
        <Label>Phone *</Label>
        <Input {...register('phone')} placeholder="+92 3xx xxxxxxx" />
        <FieldError message={errors.phone?.message} />
      </div>
      <div>
        <Label>Gender</Label>
        <Select {...register('gender')}>
          <option value="">Select…</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </Select>
      </div>
      <div>
        <Label>Date of birth</Label>
        <Input type="date" {...register('dateOfBirth')} />
      </div>
      <div>
        <Label>Assigned trainer</Label>
        <Select {...register('assignedTrainer')}>
          <option value="">None</option>
          {trainers.data?.items.filter(t => t.isActive).map(t => (
            <option key={t._id} value={t._id}>{t.fullName} — {t.specialization}</option>
          ))}
        </Select>
      </div>
      <div className="sm:col-span-2">
        <Label>Address</Label>
        <Input {...register('address')} placeholder="Street, city" />
      </div>
      <div>
        <Label>Emergency contact name</Label>
        <Input {...register('emergencyName')} />
      </div>
      <div>
        <Label>Emergency contact phone</Label>
        <Input {...register('emergencyPhone')} />
      </div>
      <div>
        <Label>Relationship</Label>
        <Input {...register('emergencyRelationship')} placeholder="e.g. Brother" />
      </div>
      {initial && (
        <div>
          <Label>Account status</Label>
          <Select {...register('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </Select>
        </div>
      )}
      <div className="sm:col-span-2">
        <Label>Notes</Label>
        <Textarea {...register('notes')} placeholder="Optional notes about this member" />
      </div>
      <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  );
}
