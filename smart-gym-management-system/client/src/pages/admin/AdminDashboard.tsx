import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users, UserCheck, UserX, AlarmClock, CalendarCheck, Activity, Dumbbell, Banknote, Hourglass, UserPlus,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { dashboardApi } from '../../services/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatCard } from '../../components/ui/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { PageLoading, ErrorState, EmptyState } from '../../components/ui/feedback';
import { formatMoney, formatDateTime } from '../../lib/utils';
import { getSocket } from '../../lib/socket';
import type { Attendance } from '../../types';

const PIE_COLORS = ['#1c72f1', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const stats = useQuery({ queryKey: ['dashboard-stats'], queryFn: () => dashboardApi.stats() });
  const attendance = useQuery({ queryKey: ['dashboard-attendance'], queryFn: () => dashboardApi.attendance(14) });
  const revenue = useQuery({ queryKey: ['dashboard-revenue'], queryFn: () => dashboardApi.revenue(6) });

  // Real-time: refresh when check-ins happen anywhere in the gym.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-attendance'] });
    };
    socket.on('dashboard:refresh', refresh);
    socket.on('attendance:checkin', refresh);
    socket.on('attendance:checkout', refresh);
    return () => {
      socket.off('dashboard:refresh', refresh);
      socket.off('attendance:checkin', refresh);
      socket.off('attendance:checkout', refresh);
    };
  }, [queryClient]);

  if (stats.isLoading) return <PageLoading />;
  if (stats.isError || !stats.data) return <ErrorState message="Could not load dashboard statistics" onRetry={() => void stats.refetch()} />;
  const s = stats.data;
  const ra = s.recentActivity;

  const memberName = (a: Attendance) => (typeof a.member === 'object' ? a.member.fullName : '—');
  const memberCode = (a: Attendance) => (typeof a.member === 'object' ? a.member.memberId : '');

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live overview of your gym — updates in real time as members check in" />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard title="Total Members" value={s.totalMembers} icon={Users} tone="blue" />
        <StatCard title="Active Members" value={s.activeMembers} icon={UserCheck} tone="green" />
        <StatCard title="Expired Memberships" value={s.expiredMemberships} icon={UserX} tone="red" />
        <StatCard title="Expiring in 7 days" value={s.expiringSoon} icon={AlarmClock} tone="amber" />
        <StatCard title="Today's Check-ins" value={s.todaysCheckIns} icon={CalendarCheck} tone="blue" />
        <StatCard title="Inside Gym Now" value={s.currentOccupancy} icon={Activity} tone="green" sub="Live occupancy" />
        <StatCard title="Trainers" value={s.totalTrainers} icon={Dumbbell} tone="violet" />
        <StatCard title="Revenue (This Month)" value={formatMoney(s.monthlyRevenue)} icon={Banknote} tone="green" />
        <StatCard title="Pending Payments" value={s.pendingPayments} icon={Hourglass} tone="amber" />
        <StatCard title="New Members (Month)" value={s.newMembersThisMonth} icon={UserPlus} tone="blue" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Attendance — last 14 days</CardTitle></CardHeader>
          <CardContent>
            {attendance.data && attendance.data.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={attendance.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" name="Check-ins" stroke="#1c72f1" fill="#1c72f1" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No attendance yet" message="Check-ins will appear here once members start entering the gym." />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Membership Distribution</CardTitle></CardHeader>
          <CardContent>
            {revenue.data && revenue.data.membershipDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={revenue.data.membershipDistribution} dataKey="count" nameKey="plan" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {revenue.data.membershipDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No memberships yet" message="Assign plans to members to see the distribution." />}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Revenue — last 6 months</CardTitle></CardHeader>
          <CardContent>
            {revenue.data && revenue.data.revenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={revenue.data.revenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: unknown) => formatMoney(Number(v))} />
                  <Bar dataKey="total" name="Revenue" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No revenue recorded" message="Completed payments will appear here." />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-slate-700 mb-1.5">Latest check-ins</p>
              {ra.checkIns.length === 0 ? <p className="text-slate-400 text-xs">None yet</p> : ra.checkIns.map(a => (
                <div key={a._id} className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                  <span>{memberName(a)} <span className="text-slate-400">({memberCode(a)})</span></span>
                  <Badge tone={a.method === 'FACE' ? 'violet' : a.method === 'QR' ? 'blue' : 'slate'}>{a.method}</Badge>
                </div>
              ))}
            </div>
            <div>
              <p className="font-medium text-slate-700 mb-1.5">Rejected attempts</p>
              {ra.rejected.length === 0 ? <p className="text-slate-400 text-xs">None</p> : ra.rejected.map(a => (
                <div key={a._id} className="py-1 border-b border-slate-50 last:border-0">
                  <span>{memberName(a)}</span>
                  <span className="block text-xs text-red-600">{a.rejectionReason} · {formatDateTime(a.checkInAt)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="font-medium text-slate-700 mb-1.5">New registrations</p>
              {ra.registrations.length === 0 ? <p className="text-slate-400 text-xs">None yet</p> : ra.registrations.map(m => (
                <div key={m._id} className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                  <span>{m.fullName}</span><span className="text-xs text-slate-400">{m.memberId}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
