import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dumbbell } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input, Label, FieldError } from '../../components/ui/input';

const schema = z.object({
  password: z.string().min(8, 'At least 8 characters'),
  confirm: z.string().min(1),
}).refine(d => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password: values.password });
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Reset failed. The link may have expired.'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="bg-brand-600 rounded-lg p-2 text-white"><Dumbbell className="size-5" /></div>
          <span className="font-bold text-lg">Smart Gym</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Reset password</h2>
        {!token && <div className="mt-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">This page needs a reset token. Please use the link from the forgot-password flow.</div>}
        {done ? (
          <div className="mt-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-3">
            Your password has been reset. <Link to="/login" className="underline font-medium">Log in now</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
            {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
            <div>
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" {...register('password')} />
              <FieldError message={errors.password?.message} />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" {...register('confirm')} />
              <FieldError message={errors.confirm?.message} />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || !token}>{isSubmitting ? 'Resetting…' : 'Reset password'}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
