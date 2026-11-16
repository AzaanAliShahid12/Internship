import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="text-center">
        <p className="text-6xl font-extrabold text-slate-300">404</p>
        <h1 className="text-xl font-bold text-slate-900 mt-2">Page not found</h1>
        <p className="text-sm text-slate-500 mt-1">The page you are looking for doesn't exist.</p>
        <Link to="/"><Button className="mt-5">Back to home</Button></Link>
      </div>
    </div>
  );
}
