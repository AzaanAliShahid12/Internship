import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QrCode, CalendarCheck, CreditCard, Bell, RefreshCw } from 'lucide-react';
import { portalApi, notificationsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge, statusBadge } from '../../components/ui/badge';
import { StatCard } from '../../components/ui/stat-card';
import { PageLoading, ErrorState, EmptyState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { formatDate, formatDateTime } from '../../lib/utils';

export default function MemberDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const profile = useQuery({ queryKey: ['portal-profile'], queryFn: () => portalApi.profile() });
  const attendance = useQuery({ queryKey: ['portal-attendance', 1], queryFn: () => portalApi.attendance({ page: 1, limit: 5 }) });
  const notifications = useQuery({ queryKey: ['portal-notifications'], queryFn: () => notificationsApi.list({ limit: 5 }) });

  if (profile.isLoading) return <PageLoading />;
  if (profile.isError || !profile.data) {
    return (
      <div>
        <PageHeader title={`Welcome, ${user?.name ?? ''}`} />
        <ErrorState message="No member profile is linked to this account yet. Please ask the gym front desk to link your membership to this login." />
      </div>
    );
  }
  const m = profile.data;
  const remaining = m.membershipExpiryDate ? Math.ceil((new Date(m.membershipExpiryDate).getTime() - Date.now()) / (24 * 3600 * 1000)) : null;

  const requestRenewal = async () => {
    try {
      const res = await portalApi.requestRenewal();
      toast('success', res.message);
    } catch { toast('error', 'Could not send the renewal request'); }
  };

  return (
    <div>
      <PageHeader title={`Welcome back, ${m.fullName.split(' ')[0]}!`} subtitle={`Member ${m.memberId}`} />
      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        <StatCard title="Total Visits" value={attendance.data?.stats.totalVisits ?? 0} icon={CalendarCheck} tone="blue" />
        <StatCard title="Visits This Month" value={attendance.data?.stats.thisMonth ?? 0} icon={CalendarCheck} tone="green" />
        <StatCard title="Days Remaining" value={remaining !== null ? Math.max(0, remaining) : '—'} icon={CreditCard} tone={remaining !== null && remaining <= 7 ? 'amber' : 'violet'}
          sub={m.membershipExpiryDate ? `Expires ${formatDate(m.membershipExpiryDate)}` : 'No active plan'} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>My Membership</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex justify-between"><span className="text-slate-500">Plan</span><span className="font-medium">{m.membershipPlan ?? 'No plan assigned'}</span></p>
            <p className="flex justify-between items-center"><span className="text-slate-500">Status</span>{m.membershipStatus && m.membershipStatus !== 'none' ? statusBadge(m.membershipStatus) : <Badge tone="slate">None</Badge>}</p>
            <p className="flex justify-between"><span className="text-slate-500">Expiry</span><span className="font-medium">{formatDate(m.membershipExpiryDate)}</span></p>
            <p className="flex justify-between"><span className="text-slate-500">Face check-in</span>{m.faceEnrolled ? <Badge tone="green">Enrolled</Badge> : <Badge tone="slate">Not enrolled</Badge>}</p>
            <div className="flex gap-2 pt-2">
              <Link to="/portal/qr"><Button size="sm"><QrCode /> My QR Code</Button></Link>
              <Button size="sm" variant="secondary" onClick={requestRenewal}><RefreshCw /> Request renewal</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent check-ins</CardTitle><Link to="/portal/attendance" className="text-sm text-brand-600 hover:underline">View all</Link></CardHeader>
          <CardContent className="space-y-2">
            {attendance.data && attendance.data.items.length > 0 ? attendance.data.items.map(a => (
              <div key={a._id} className="flex justify-between text-sm border-b border-slate-50 pb-2 last:border-0">
                <span>{formatDateTime(a.checkInAt)}</span>
                <Badge tone={a.method === 'FACE' ? 'violet' : a.method === 'QR' ? 'blue' : 'slate'}>{a.method}</Badge>
              </div>
            )) : <EmptyState title="No check-ins yet" message="Your visits will appear here." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle><span className="inline-flex items-center gap-2"><Bell className="size-4" /> Notifications</span></CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {notifications.data && notifications.data.items.length > 0 ? notifications.data.items.map(n => (
              <div key={n._id} className="border-b border-slate-50 pb-2 last:border-0">
                <p className="text-sm font-medium text-slate-800">{n.title}</p>
                <p className="text-xs text-slate-500">{n.message}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(n.createdAt)}</p>
              </div>
            )) : <EmptyState title="No notifications" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
