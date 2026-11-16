import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, QrCode, ScanFace, CalendarCheck, Wallet } from 'lucide-react';
import { membersApi, membershipsApi, plansApi } from '../../services/api';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, THead, Th, Td, Tr } from '../../components/ui/table';
import { Badge, statusBadge } from '../../components/ui/badge';
import { Dialog } from '../../components/ui/dialog';
import { Select, Label } from '../../components/ui/input';
import { Pagination } from '../../components/ui/pagination';
import { PageLoading, ErrorState, EmptyState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { formatDate, formatDateTime, formatMoney, daysUntil } from '../../lib/utils';

export default function MemberDetails() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [planId, setPlanId] = useState('');
  const [attPage, setAttPage] = useState(1);
  const [payPage, setPayPage] = useState(1);

  const member = useQuery({ queryKey: ['member', id], queryFn: () => membersApi.get(id) });
  const plans = useQuery({ queryKey: ['plans-active'], queryFn: () => plansApi.list('active') });
  const attendance = useQuery({ queryKey: ['member-attendance', id, attPage], queryFn: () => membersApi.attendance(id, { page: attPage, limit: 8 }) });
  const payments = useQuery({ queryKey: ['member-payments', id, payPage], queryFn: () => membersApi.payments(id, { page: payPage, limit: 8 }) });

  const assign = useMutation({
    mutationFn: () => membershipsApi.assign({ memberId: id, planId }),
    onSuccess: () => {
      toast('success', 'Membership assigned');
      setAssignOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['member', id] });
    },
    onError: err => toast('error', apiErrorMessage(err)),
  });
  const renew = useMutation({
    mutationFn: (membershipId: string) => membershipsApi.renew(membershipId),
    onSuccess: () => {
      toast('success', 'Membership renewed');
      void queryClient.invalidateQueries({ queryKey: ['member', id] });
    },
    onError: err => toast('error', apiErrorMessage(err)),
  });

  if (member.isLoading) return <PageLoading />;
  if (member.isError || !member.data) return <ErrorState message="Member not found" />;
  const m = member.data;
  const cm = m.currentMembership;
  const remaining = daysUntil(m.membershipExpiryDate);

  return (
    <div>
      <PageHeader
        title={m.fullName}
        subtitle={`Member ${m.memberId} · joined ${formatDate(m.registrationDate)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(`/members/${id}/edit`)}><Pencil /> Edit</Button>
            <Link to={`/qr-generator?member=${id}`}><Button variant="secondary"><QrCode /> QR Code</Button></Link>
            <Link to={`/face-enroll?member=${id}`}><Button variant="secondary"><ScanFace /> Face Enrollment</Button></Link>
            <Button onClick={() => setAssignOpen(true)}>Assign / Change Plan</Button>
          </div>
        }
      />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex justify-center pb-2">
              {m.profilePicture
                ? <img src={m.profilePicture} alt="" className="size-24 rounded-full object-cover" />
                : <span className="size-24 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-3xl font-bold">{m.fullName.charAt(0)}</span>}
            </div>
            <Row k="Email" v={m.email} /><Row k="Phone" v={m.phone} />
            <Row k="Gender" v={m.gender ?? '—'} /><Row k="Date of birth" v={formatDate(m.dateOfBirth)} />
            <Row k="Address" v={m.address ?? '—'} />
            <Row k="Emergency contact" v={m.emergencyContact?.name ? `${m.emergencyContact.name} (${m.emergencyContact.phone ?? ''})` : '—'} />
            <Row k="Trainer" v={typeof m.assignedTrainer === 'object' && m.assignedTrainer ? m.assignedTrainer.fullName : '—'} />
            <div className="flex justify-between"><span className="text-slate-500">Account status</span>{statusBadge(m.status)}</div>
            <div className="flex justify-between"><span className="text-slate-500">Face enrollment</span>{m.faceEnrolled ? <Badge tone="green">Enrolled</Badge> : <Badge tone="slate">Not enrolled</Badge>}</div>
            {m.notes && <p className="text-slate-500 pt-1">{m.notes}</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Current Membership</CardTitle></CardHeader>
          <CardContent>
            {cm ? (
              <div className="space-y-2.5 text-sm">
                <Row k="Plan" v={(typeof cm.plan === 'object' ? cm.plan?.name : m.membershipPlan) ?? '—'} />
                <div className="flex justify-between"><span className="text-slate-500">Status</span>{statusBadge(m.membershipStatus ?? cm.status)}</div>
                <Row k="Start date" v={formatDate(cm.startDate)} />
                <Row k="Expiry date" v={formatDate(cm.expiryDate)} />
                <Row k="Remaining" v={remaining !== null ? (remaining >= 0 ? `${remaining} day(s)` : 'Expired') : '—'} />
                <Row k="Price paid" v={formatMoney(cm.pricePaid)} />
                <div className="pt-2">
                  <Button size="sm" onClick={() => renew.mutate(cm._id)} disabled={renew.isPending}>
                    {renew.isPending ? 'Renewing…' : 'Renew membership'}
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState title="No membership assigned" message="Assign a plan so this member can check in."
                action={<Button onClick={() => setAssignOpen(true)}>Assign plan</Button>} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader><CardTitle><span className="inline-flex items-center gap-2"><CalendarCheck className="size-4" /> Attendance history</span></CardTitle></CardHeader>
          <CardContent className="px-0 py-0">
            {attendance.isLoading ? <PageLoading /> : attendance.data && attendance.data.items.length > 0 ? (
              <>
                <Table>
                  <THead><tr><Th>Date</Th><Th>Check-in</Th><Th>Check-out</Th><Th>Method</Th><Th>Result</Th></tr></THead>
                  <tbody>
                    {attendance.data.items.map(a => (
                      <Tr key={a._id}>
                        <Td>{a.date}</Td><Td>{formatDateTime(a.checkInAt)}</Td><Td>{formatDateTime(a.checkOutAt)}</Td>
                        <Td>{a.method}</Td>
                        <Td>{a.verificationResult === 'success' ? <Badge tone="green">Success</Badge> : <Badge tone="red">{a.rejectionReason ?? 'Rejected'}</Badge>}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
                <div className="px-4"><Pagination page={attendance.data.page} totalPages={attendance.data.totalPages} onChange={setAttPage} /></div>
              </>
            ) : <EmptyState title="No attendance yet" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><span className="inline-flex items-center gap-2"><Wallet className="size-4" /> Payment history</span></CardTitle></CardHeader>
          <CardContent className="px-0 py-0">
            {payments.isLoading ? <PageLoading /> : payments.data && payments.data.items.length > 0 ? (
              <>
                <Table>
                  <THead><tr><Th>Payment ID</Th><Th>Date</Th><Th>Amount</Th><Th>Method</Th><Th>Status</Th></tr></THead>
                  <tbody>
                    {payments.data.items.map(p => (
                      <Tr key={p._id}>
                        <Td>{p.paymentId}</Td><Td>{formatDate(p.paidAt)}</Td>
                        <Td>{formatMoney(p.amount - p.discount)}</Td><Td className="capitalize">{p.method.replace('_', ' ')}</Td>
                        <Td>{statusBadge(p.status)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
                <div className="px-4"><Pagination page={payments.data.page} totalPages={payments.data.totalPages} onChange={setPayPage} /></div>
              </>
            ) : <EmptyState title="No payments yet" />}
          </CardContent>
        </Card>
      </div>

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign / change membership plan">
        <div className="space-y-4">
          <div>
            <Label>Plan</Label>
            <Select value={planId} onChange={e => setPlanId(e.target.value)}>
              <option value="">Select a plan…</option>
              {plans.data?.map(p => <option key={p._id} value={p._id}>{p.name} — {formatMoney(p.price)} / {p.durationDays} days</option>)}
            </Select>
          </div>
          <p className="text-xs text-slate-500">Assigning a new plan closes the current membership and starts the new one today at the plan price.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button disabled={!planId || assign.isPending} onClick={() => assign.mutate()}>{assign.isPending ? 'Assigning…' : 'Assign plan'}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><span className="text-slate-500">{k}</span><span className="font-medium text-slate-800 text-right">{v}</span></div>;
}
