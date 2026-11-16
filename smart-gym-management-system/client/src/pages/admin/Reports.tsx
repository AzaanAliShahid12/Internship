import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import { Download, Printer } from 'lucide-react';
import { reportsApi, attendanceApi } from '../../services/api';
import { downloadCsv } from '../../lib/csv';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, THead, Th, Td, Tr } from '../../components/ui/table';
import { PageLoading, EmptyState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { formatMoney } from '../../lib/utils';

const COLORS = ['#1c72f1', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
type Tab = 'attendance' | 'revenue' | 'memberships' | 'occupancy';

export default function Reports() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('attendance');
  const [from, setFrom] = useState(new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const range = useMemo(() => ({ from, to }), [from, to]);

  const attendance = useQuery({ queryKey: ['report-attendance', range], queryFn: () => reportsApi.attendance(range), enabled: tab === 'attendance' });
  const rejected = useQuery({ queryKey: ['report-rejected', range], queryFn: () => reportsApi.rejected(range), enabled: tab === 'attendance' });
  const registrations = useQuery({ queryKey: ['report-registrations', range], queryFn: () => reportsApi.registrations(range), enabled: tab === 'attendance' });
  const revenue = useQuery({ queryKey: ['report-revenue', range], queryFn: () => reportsApi.revenue(range), enabled: tab === 'revenue' });
  const memberships = useQuery({ queryKey: ['report-memberships'], queryFn: () => reportsApi.memberships(), enabled: tab === 'memberships' });
  const occupancy = useQuery({ queryKey: ['report-occupancy', range], queryFn: () => reportsApi.occupancy(range), enabled: tab === 'occupancy' });

  const exportAttendance = async () => {
    try {
      downloadCsv(`attendance-report-${from}-to-${to}.csv`, await attendanceApi.exportCsv(range));
    } catch (err) { toast('error', apiErrorMessage(err, 'Export failed')); }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'attendance', label: 'Attendance' },
    { id: 'revenue', label: 'Revenue & Payments' },
    { id: 'memberships', label: 'Memberships' },
    { id: 'occupancy', label: 'Occupancy' },
  ];

  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle="Attendance, revenue, memberships and occupancy — filter by date range and export"
        action={
          <div className="flex gap-2 no-print">
            <Button variant="secondary" onClick={exportAttendance}><Download /> Attendance CSV</Button>
            <Button variant="secondary" onClick={() => window.print()}><Printer /> Print report</Button>
          </div>
        } />
      <div className="flex flex-wrap items-end gap-3 mb-4 no-print">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === t.id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" /></div>
        <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" /></div>
      </div>

      {tab === 'attendance' && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Daily attendance (check-in methods compared)</CardTitle></CardHeader>
            <CardContent>
              {attendance.isLoading ? <PageLoading /> : attendance.data && attendance.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={attendance.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="qr" name="QR" stackId="a" fill="#1c72f1" />
                    <Bar dataKey="face" name="Face" stackId="a" fill="#8b5cf6" />
                    <Bar dataKey="manual" name="Manual" stackId="a" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState title="No attendance in this range" />}
              {attendance.data && attendance.data.length > 0 && (
                <div className="mt-3 max-h-56 overflow-y-auto">
                  <Table>
                    <THead><tr><Th>Date</Th><Th>Total</Th><Th>Success</Th><Th>Rejected</Th><Th>QR</Th><Th>Face</Th><Th>Manual</Th></tr></THead>
                    <tbody>
                      {attendance.data.map(r => (
                        <Tr key={String(r.date)}>
                          <Td>{String(r.date)}</Td><Td>{Number(r.total)}</Td><Td>{Number(r.success)}</Td>
                          <Td>{Number(r.rejected)}</Td><Td>{Number(r.qr)}</Td><Td>{Number(r.face)}</Td><Td>{Number(r.manual)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Rejected entry reasons</CardTitle></CardHeader>
              <CardContent>
                {rejected.data && rejected.data.length > 0 ? rejected.data.map(r => (
                  <div key={r.reason} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0 text-sm">
                    <span className="text-slate-600">{r.reason}</span><span className="font-semibold">{r.count}</span>
                  </div>
                )) : <EmptyState title="No rejections in this range" />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>New member registrations</CardTitle></CardHeader>
              <CardContent>
                {registrations.data && registrations.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={registrations.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" name="Registrations" stroke="#16a34a" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyState title="No registrations in this range" />}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'revenue' && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle>Revenue summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {revenue.isLoading ? <PageLoading /> : revenue.data ? <>
                <p className="flex justify-between"><span className="text-slate-500">Total revenue (completed)</span><span className="font-bold text-lg">{formatMoney(revenue.data.totalRevenue)}</span></p>
                <p className="flex justify-between"><span className="text-slate-500">Completed transactions</span><span className="font-medium">{revenue.data.completedTransactions}</span></p>
              </> : <EmptyState title="No data" />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>By payment method</CardTitle></CardHeader>
            <CardContent>
              {revenue.data && revenue.data.byMethod.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={revenue.data.byMethod} dataKey="total" nameKey="method" innerRadius={50} outerRadius={80}>
                      {revenue.data.byMethod.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => formatMoney(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyState title="No payments in this range" />}
              {revenue.data?.byMethod.map(m => (
                <p key={m.method} className="flex justify-between text-sm py-1 border-b border-slate-50 last:border-0 capitalize">
                  <span>{m.method.replace('_', ' ')} ({m.count})</span><span className="font-medium">{formatMoney(m.total)}</span>
                </p>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>By status</CardTitle></CardHeader>
            <CardContent>
              {revenue.data?.byStatus.map(s => (
                <p key={s.status} className="flex justify-between text-sm py-1.5 border-b border-slate-50 last:border-0 capitalize">
                  <span>{s.status} ({s.count})</span><span className="font-medium">{formatMoney(s.total)}</span>
                </p>
              ))}
              {revenue.data && revenue.data.byStatus.length === 0 && <EmptyState title="No payments in this range" />}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'memberships' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Active vs expired memberships</CardTitle></CardHeader>
            <CardContent>
              {memberships.isLoading ? <PageLoading /> : memberships.data ? <>
                {Object.entries(memberships.data.statusCounts).map(([k, v]) => (
                  <p key={k} className="flex justify-between text-sm py-1.5 border-b border-slate-50 last:border-0 capitalize">
                    <span>{k}</span><span className="font-semibold">{v}</span>
                  </p>
                ))}
                <p className="flex justify-between text-sm py-1.5"><span>Total members</span><span className="font-semibold">{memberships.data.totalMembers}</span></p>
              </> : <EmptyState title="No data" />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Members by plan</CardTitle></CardHeader>
            <CardContent>
              {memberships.data && memberships.data.byPlan.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={memberships.data.byPlan} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="plan" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="count" name="Members" fill="#1c72f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState title="No memberships yet" />}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'occupancy' && (
        <Card>
          <CardHeader><CardTitle>Gym occupancy — daily check-ins & unique members</CardTitle></CardHeader>
          <CardContent>
            {occupancy.isLoading ? <PageLoading /> : occupancy.data && occupancy.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={occupancy.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="checkIns" name="Check-ins" fill="#1c72f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="uniqueMembers" name="Unique members" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No occupancy data in this range" />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
