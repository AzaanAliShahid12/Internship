import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dumbbell, Eye, EyeOff } from 'lucide-react';
import { useAuth, homePathForRole } from '../../context/AuthContext';
import { apiErrorMessage } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input, Label, FieldError } from '../../components/ui/input';

const schema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Password is required') });
type FormValues = z.infer<typeof schema>;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setError('');
    try {
      const user = await login(values.email, values.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : homePathForRole(user.role), { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Login failed'));
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-[45%] bg-sidebar text-white flex-col justify-between p-10">
        <div className="flex items-center gap-2.5">
          <div className="bg-brand-600 rounded-lg p-2"><Dumbbell className="size-5" /></div>
          <span className="font-bold text-lg">Smart Gym</span>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">Train smarter.<br />Manage smarter.</h1>
          <p className="text-slate-400 mt-3 max-w-md">QR code & AI face-recognition check-ins, memberships, payments and real-time attendance — one platform for your entire gym.</p>
        </div>
        <p className="text-xs text-slate-500">Smart Gym Management System</p>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">Log in to your account to continue</p>
          {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@gym.com" {...register('email')} />
              <FieldError message={errors.email?.message} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...register('password')} />
                <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowPassword(s => !s)} aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <FieldError message={errors.password?.message} />
            </div>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-brand-600 hover:underline">Forgot password?</Link>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>{isSubmitting ? 'Logging in…' : 'Log in'}</Button>
          </form>
          <p className="text-sm text-slate-500 mt-6 text-center">
            New to Smart Gym?{' '}
            <Link to="/register" className="text-brand-600 hover:underline font-medium">Create an account</Link>
          </p>
          <div className="mt-6 rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
            <p className="font-semibold mb-1">Demo accounts (after seeding)</p>
            <p>admin@gym.com / Admin@123 · reception@gym.com / Staff@123</p>
            <p>trainer@gym.com / Trainer@123 · member@gym.com / Member@123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
