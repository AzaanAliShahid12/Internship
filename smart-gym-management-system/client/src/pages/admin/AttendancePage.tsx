import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Users } from 'lucide-react';
import { attendanceApi } from '../../services/api';
import { downloadCsv } from '../../lib/csv';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Input, Select } from '../../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, THead, Th, Td, Tr } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Pagination } from '../../components/ui/pagination';
import { StatCard } from '../../components/ui/stat-card';
import { PageLoading, EmptyState, ErrorState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { getSocket } from '../../lib/socket';
import { formatDateTime } from '../../lib/utils';
import { CalendarCheck, XCircle, LogIn } from 'lucide-react';

export default function AttendancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('');
  const [result, setResult] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['attendance', date, method, result, search, page],
    queryFn: () => attendanceApi.list({
      date: date || undefined, method: method || undefined,
      result: result || undefined, search: search || undefined, page, limit: 12,
    }),
  });
  const today = useQuery({ queryKey: ['attendance-today-summary'], queryFn: () => attendanceApi.today({ limit: 1 }) });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance-today-summary'] });
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

  const exportCsv = async () => {
    try {
      const csv = await attendanceApi.exportCsv({ from: date, to: date, method: method || undefined });
      downloadCsv(`attendance-${date}.csv`, csv);
    } catch (err) { toast('error', apiErrorMessage(err, 'Export failed')); }
  };

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Every check-in and check-out, with live updates from the entrance"
        action={<Button variant="secondary" onClick={exportCsv}><Download /> Export CSV</Button>} />
      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard title="Check-ins Today" value={today.data?.total ?? 0} icon={LogIn} tone="blue" />
        <StatCard title="Inside Gym Now" value={today.data?.occupancy ?? 0} icon={Users} tone="green" />
        <StatCard title="Rejected Today" value={today.data?.rejectedToday ?? 0} icon={XCircle} tone="red" />
      </div>
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input type="date" className="w-44" value={date} onChange={e => { setDate(e.target.value); setPage(1); }} />
          <Input className="w-56" placeholder="Search member name…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          <Select className="w-40" value={method} onChange={e => { setMethod(e.target.value); setPage(1); }}>
            <option value="">All methods</option>
            <option value="QR">QR</option><option value="FACE">Face</option><option value="MANUAL">Manual</option>
          </Select>
          <Select className="w-40" value={result} onChange={e => { setResult(e.target.value); setPage(1); }}>
            <option value="">All results</option>
            <option value="success">Successful</option>
            <option value="rejected">Rejected</option>
          </Select>
        </div>
      </Card>
      <Card>
        <CardHeader><CardTitle><span className="inline-flex items-center gap-2"><CalendarCheck className="size-4" /> Records</span></CardTitle></CardHeader>
        <CardContent className="px-0 py-0">
          {query.isLoading ? <PageLoading /> : query.isError ? <div className="p-4"><ErrorState message="Could not load attendance" onRetry={() => void query.refetch()} /></div>
            : query.data && query.data.items.length > 0 ? (
              <>
                <Table>
                  <THead><tr><Th>Member</Th><Th>Check-in</Th><Th>Check-out</Th><Th>Method</Th><Th>Result</Th><Th>Session</Th></tr></THead>
                  <tbody>
                    {query.data.items.map(a => {
                      const m = typeof a.member === 'object' ? a.member : null;
                      return (
                        <Tr key={a._id}>
                          <Td><span className="font-medium text-slate-900">{m?.fullName ?? '—'}</span><span className="block text-xs text-slate-400">{m?.memberId}</span></Td>
                          <Td>{formatDateTime(a.checkInAt)}</Td>
                          <Td>{a.checkOutAt ? formatDateTime(a.checkOutAt) : '—'}</Td>
                          <Td><Badge tone={a.method === 'FACE' ? 'violet' : a.method === 'QR' ? 'blue' : 'slate'}>{a.method}</Badge></Td>
                          <Td>{a.verificationResult === 'success' ? <Badge tone="green">Success</Badge> : <Badge tone="red">{a.rejectionReason ?? 'Rejected'}</Badge>}</Td>
                          <Td>{a.verificationResult === 'success' ? (a.status === 'checked_in' ? <Badge tone="green">Inside</Badge> : <Badge tone="slate">Completed</Badge>) : '—'}</Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
                <div className="px-4"><Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onChange={setPage} /></div>
              </>
            ) : <EmptyState title="No attendance records" message="No records match these filters for the selected date." />}
        </CardContent>
      </Card>
    </div>
  );
}
