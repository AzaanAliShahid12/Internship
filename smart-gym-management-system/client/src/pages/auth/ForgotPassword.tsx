import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dumbbell } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input, Label, FieldError } from '../../components/ui/input';

const schema = z.object({ email: z.string().email('Enter a valid email') });

export default function ForgotPassword() {
  const [done, setDone] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: { email: string }) => {
    setError('');
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setDevToken((res.data as { resetToken?: string }).resetToken ?? null);
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="bg-brand-600 rounded-lg p-2 text-white"><Dumbbell className="size-5" /></div>
          <span className="font-bold text-lg">Smart Gym</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Forgot password</h2>
        <p className="text-sm text-slate-500 mt-1 mb-6">Enter your account email and we will send you a password reset link.</p>
        {done ? (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-3">
            If an account exists for that email, a reset link has been sent.
            {devToken && (
              <p className="mt-2 break-all">Development mode — reset link: <Link className="underline font-medium" to={`/reset-password?token=${devToken}`}>click here to reset</Link></p>
            )}
            <p className="mt-3"><Link to="/login" className="underline font-medium">Back to login</Link></p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              <FieldError message={errors.email?.message} />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>{isSubmitting ? 'Sending…' : 'Send reset link'}</Button>
            <p className="text-center text-sm"><Link to="/login" className="text-brand-600 hover:underline">Back to login</Link></p>
          </form>
        )}
      </div>
    </div>
  );
}
