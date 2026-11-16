import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth, homePathForRole } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';

export default function Unauthorized() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="text-center max-w-sm">
        <ShieldAlert className="size-14 text-amber-500 mx-auto" />
        <h1 className="text-2xl font-bold text-slate-900 mt-4">Access denied</h1>
        <p className="text-sm text-slate-500 mt-2">You don't have permission to view this page with your current role.</p>
        <Link to={user ? homePathForRole(user.role) : '/login'}>
          <Button className="mt-5">Go to my dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
