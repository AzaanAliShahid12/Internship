import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck } from 'lucide-react';
import { portalApi } from '../../services/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardContent } from '../../components/ui/card';
import { Table, THead, Th, Td, Tr } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Pagination } from '../../components/ui/pagination';
import { StatCard } from '../../components/ui/stat-card';
import { PageLoading, ErrorState, EmptyState } from '../../components/ui/feedback';
import { formatDateTime } from '../../lib/utils';

export default function MemberAttendance() {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['portal-attendance', page], queryFn: () => portalApi.attendance({ page, limit: 12 }) });
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data) return <ErrorState message="Could not load your attendance" onRetry={() => void query.refetch()} />;
  return (
    <div>
      <PageHeader title="My Attendance" subtitle="Your gym visit history" />
      <div className="grid grid-cols-2 gap-4 mb-4 max-w-lg">
        <StatCard title="Total Visits" value={query.data.stats.totalVisits} icon={CalendarCheck} tone="blue" />
        <StatCard title="Visits This Month" value={query.data.stats.thisMonth} icon={CalendarCheck} tone="green" />
      </div>
      <Card>
        <CardContent className="px-0 py-0">
          {query.data.items.length > 0 ? (
            <>
              <Table>
                <THead><tr><Th>Date</Th><Th>Check-in</Th><Th>Check-out</Th><Th>Method</Th><Th>Session</Th></tr></THead>
                <tbody>
                  {query.data.items.map(a => (
                    <Tr key={a._id}>
                      <Td>{a.date}</Td>
                      <Td>{formatDateTime(a.checkInAt)}</Td>
                      <Td>{a.checkOutAt ? formatDateTime(a.checkOutAt) : '—'}</Td>
                      <Td><Badge tone={a.method === 'FACE' ? 'violet' : a.method === 'QR' ? 'blue' : 'slate'}>{a.method}</Badge></Td>
                      <Td>{a.status === 'checked_in' ? <Badge tone="green">Inside</Badge> : <Badge tone="slate">Completed</Badge>}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <div className="px-4"><Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onChange={setPage} /></div>
            </>
          ) : <EmptyState title="No visits yet" message="Check in at the entrance with your QR code or face to start your history." />}
        </CardContent>
      </Card>
    </div>
  );
}
