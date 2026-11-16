import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Dumbbell, Clock } from 'lucide-react';
import { trainersApi } from '../../services/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { StatCard } from '../../components/ui/stat-card';
import { Badge } from '../../components/ui/badge';
import { PageLoading, ErrorState, EmptyState } from '../../components/ui/feedback';

export default function TrainerDashboard() {
  const query = useQuery({ queryKey: ['trainer-my-members'], queryFn: () => trainersApi.myMembers() });

  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data) {
    return (
      <div>
        <PageHeader title="Trainer Dashboard" />
        <ErrorState message="No trainer profile is linked to your account yet. Ask an admin to link your trainer profile to this login." />
      </div>
    );
  }
  const { trainer, members } = query.data;
  const active = members.filter(m => m.status === 'active').length;
  const withFace = members.filter(m => m.faceEnrolled).length;

  return (
    <div>
      <PageHeader title={`Welcome, ${trainer.fullName}`} subtitle={`${trainer.specialization} · ${trainer.trainerId}`} />
      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard title="Assigned Members" value={members.length} icon={Users} tone="blue" />
        <StatCard title="Active Members" value={active} icon={Dumbbell} tone="green" />
        <StatCard title="Face Enrolled" value={withFace} icon={Clock} tone="violet" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>My members</CardTitle>
          <Link to="/trainer-members" className="text-sm text-brand-600 hover:underline">View all</Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.length === 0 ? <EmptyState title="No members assigned yet" /> : members.slice(0, 6).map(m => (
            <div key={m._id} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0">
              <div>
                <p className="text-sm font-medium text-slate-800">{m.fullName} <span className="text-slate-400 font-normal">({m.memberId})</span></p>
                <p className="text-xs text-slate-500">{m.membershipPlan ?? 'No plan'} · {m.phone}</p>
              </div>
              {m.membershipStatus ? <Badge tone={m.membershipStatus === 'active' ? 'green' : 'red'}>{m.membershipStatus}</Badge> : <Badge tone="slate">no plan</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
