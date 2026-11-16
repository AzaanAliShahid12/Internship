import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Users, XCircle, ScanLine, ScanFace, UserPlus, LogOut } from 'lucide-react';
import { attendanceApi } from '../../services/api';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, THead, Th, Td, Tr } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { StatCard } from '../../components/ui/stat-card';
import { PageLoading, EmptyState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { getSocket } from '../../lib/socket';
import { formatDateTime } from '../../lib/utils';

export default function ReceptionDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = useQuery({ queryKey: ['reception-today'], queryFn: () => attendanceApi.today({ limit: 10 }) });
  const inside = useQuery({ queryKey: ['reception-occupancy'], queryFn: () => attendanceApi.occupancy() });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['reception-today'] });
      void queryClient.invalidateQueries({ queryKey: ['reception-occupancy'] });
    };
    socket.on('attendance:checkin', refresh);
    socket.on('attendance:checkout', refresh);
    socket.on('attendance:rejected', refresh);
    return () => {
      socket.off('attendance:checkin', refresh);
      socket.off('attendance:checkout', refresh);
      socket.off('attendance:rejected', refresh);
    };
  }, [queryClient]);

  const checkOut = async (memberDbId: string) => {
    try {
      await attendanceApi.checkOut(memberDbId);
      toast('success', 'Member checked out');
      void queryClient.invalidateQueries({ queryKey: ['reception-today'] });
      void queryClient.invalidateQueries({ queryKey: ['reception-occupancy'] });
    } catch (err) { toast('error', apiErrorMessage(err)); }
  };

  return (
    <div>
      <PageHeader title="Reception Desk" subtitle="Live entrance activity for today" />
      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard title="Check-ins Today" value={today.data?.total ?? 0} icon={CalendarCheck} tone="blue" />
        <StatCard title="Inside Gym Now" value={inside.data?.count ?? 0} icon={Users} tone="green" />
        <StatCard title="Rejected Today" value={today.data?.rejectedToday ?? 0} icon={XCircle} tone="red" />
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Link to="/qr-scanner"><Button><ScanLine /> Open QR Scanner</Button></Link>
        <Link to="/face-scanner"><Button variant="secondary"><ScanFace /> Open Face Check-In</Button></Link>
        <Link to="/members/new"><Button variant="secondary"><UserPlus /> Register Member</Button></Link>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Inside the gym now</CardTitle></CardHeader>
          <CardContent className="px-0 py-0">
            {inside.isLoading ? <PageLoading /> : inside.data && inside.data.members.length > 0 ? (
              <Table>
                <THead><tr><Th>Member</Th><Th>Since</Th><Th>Method</Th><Th /></tr></THead>
                <tbody>
                  {inside.data.members.map(a => {
                    const m = typeof a.member === 'object' ? a.member : null;
                    return (
                      <Tr key={a._id}>
                        <Td className="font-medium">{m?.fullName} <span className="text-slate-400 font-normal">({m?.memberId})</span></Td>
                        <Td>{formatDateTime(a.checkInAt)}</Td>
                        <Td><Badge tone={a.method === 'FACE' ? 'violet' : 'blue'}>{a.method}</Badge></Td>
                        <Td className="text-right">{m && <Button size="sm" variant="ghost" onClick={() => void checkOut(m._id)}><LogOut /> Check out</Button>}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : <EmptyState title="The gym is empty" message="Checked-in members will appear here." />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Today's check-ins</CardTitle></CardHeader>
          <CardContent className="px-0 py-0">
            {today.isLoading ? <PageLoading /> : today.data && today.data.items.length > 0 ? (
              <Table>
                <THead><tr><Th>Member</Th><Th>Time</Th><Th>Method</Th><Th>Status</Th></tr></THead>
                <tbody>
                  {today.data.items.map(a => {
                    const m = typeof a.member === 'object' ? a.member : null;
                    return (
                      <Tr key={a._id}>
                        <Td className="font-medium">{m?.fullName}</Td>
                        <Td>{formatDateTime(a.checkInAt)}</Td>
                        <Td>{a.method}</Td>
                        <Td>{a.status === 'checked_in' ? <Badge tone="green">Inside</Badge> : <Badge tone="slate">Left</Badge>}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : <EmptyState title="No check-ins yet today" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
