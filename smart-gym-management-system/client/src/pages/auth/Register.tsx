import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dumbbell, Eye, EyeOff } from 'lucide-react';
import { useAuth, homePathForRole } from '../../context/AuthContext';
import { apiErrorMessage } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input, Label, FieldError } from '../../components/ui/input';

const schema = z.object({
  name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().min(5, 'Enter a valid phone number').optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine(values => values.password === values.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
type FormValues = z.infer<typeof schema>;

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setError('');
    try {
      const user = await registerUser(values.name, values.email, values.password, values.phone?.trim() || undefined);
      navigate(homePathForRole(user.role), { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Sign up failed'));
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
          <h2 className="text-2xl font-bold text-slate-900">Create your account</h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">Sign up as a member to get started</p>
          {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" type="text" placeholder="Your name" {...register('name')} />
              <FieldError message={errors.name?.message} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
              <FieldError message={errors.email?.message} />
            </div>
            <div>
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" type="tel" placeholder="03xx xxxxxxx" {...register('phone')} />
              <FieldError message={errors.phone?.message} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="At least 8 characters" {...register('password')} />
                <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowPassword(s => !s)} aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <FieldError message={errors.password?.message} />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input id="confirmPassword" type="password" placeholder="Repeat your password" {...register('confirmPassword')} />
              <FieldError message={errors.confirmPassword?.message} />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create account'}</Button>
          </form>
          <p className="text-sm text-slate-500 mt-6 text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 hover:underline font-medium">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
