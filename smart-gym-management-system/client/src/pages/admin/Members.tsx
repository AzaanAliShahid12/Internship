import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Download, Eye, Pencil, Trash2 } from 'lucide-react';
import { membersApi, plansApi } from '../../services/api';
import { downloadCsv } from '../../lib/csv';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Input, Select } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Table, THead, Th, Td, Tr } from '../../components/ui/table';
import { Badge, statusBadge } from '../../components/ui/badge';
import { Pagination } from '../../components/ui/pagination';
import { ConfirmDialog } from '../../components/ui/dialog';
import { PageLoading, EmptyState, ErrorState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { formatDate } from '../../lib/utils';

export default function Members() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const plans = useQuery({ queryKey: ['plans'], queryFn: () => plansApi.list() });
  const query = useQuery({
    queryKey: ['members', search, status, plan, page],
    queryFn: () => membersApi.list({ search: search || undefined, status: status || undefined, plan: plan || undefined, page, limit: 10 }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => membersApi.remove(id),
    onSuccess: () => {
      toast('success', 'Member deactivated');
      setConfirmId(null);
      void queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: err => toast('error', apiErrorMessage(err)),
  });

  const exportCsv = async () => {
    try {
      const csv = await membersApi.exportCsv();
      downloadCsv('members.csv', csv);
    } catch (err) { toast('error', apiErrorMessage(err, 'Export failed')); }
  };

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle="Manage gym members, their plans and entry credentials"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportCsv}><Download /> Export CSV</Button>
            <Link to="/members/new"><Button><Plus /> Add Member</Button></Link>
          </div>
        }
      />
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search name, email, phone or member ID…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); setParams(e.target.value ? { search: e.target.value } : {}); }} />
          </div>
          <Select className="w-44" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All account statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </Select>
          <Select className="w-48" value={plan} onChange={e => { setPlan(e.target.value); setPage(1); }}>
            <option value="">All plans</option>
            {plans.data?.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </Select>
        </div>
      </Card>

      <Card>
        {query.isLoading ? <PageLoading /> : query.isError ? (
          <div className="p-4"><ErrorState message="Could not load members" onRetry={() => void query.refetch()} /></div>
        ) : query.data && query.data.items.length > 0 ? (
          <>
            <Table>
              <THead>
                <tr><Th>Member</Th><Th>Member ID</Th><Th>Contact</Th><Th>Plan</Th><Th>Membership</Th><Th>Expiry</Th><Th>Face</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr>
              </THead>
              <tbody>
                {query.data.items.map(m => (
                  <Tr key={m._id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        {m.profilePicture
                          ? <img src={m.profilePicture} alt="" className="size-9 rounded-full object-cover" />
                          : <span className="size-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-semibold">{m.fullName.charAt(0)}</span>}
                        <span className="font-medium text-slate-900">{m.fullName}</span>
                      </div>
                    </Td>
                    <Td>{m.memberId}</Td>
                    <Td><span className="block">{m.email}</span><span className="text-xs text-slate-400">{m.phone}</span></Td>
                    <Td>{m.membershipPlan ?? <span className="text-slate-400">No plan</span>}</Td>
                    <Td>{m.membershipStatus && m.membershipStatus !== 'none' ? statusBadge(m.membershipStatus) : <Badge tone="slate">None</Badge>}</Td>
                    <Td>{formatDate(m.membershipExpiryDate)}</Td>
                    <Td>{m.faceEnrolled ? <Badge tone="green">Enrolled</Badge> : <Badge tone="slate">Not enrolled</Badge>}</Td>
                    <Td>{statusBadge(m.status)}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="View" onClick={() => navigate(`/members/${m._id}`)}><Eye /></Button>
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => navigate(`/members/${m._id}/edit`)}><Pencil /></Button>
                        <Button variant="ghost" size="icon" title="Deactivate" onClick={() => setConfirmId(m._id)}><Trash2 className="text-red-500" /></Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <div className="px-4">
              <Pagination page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onChange={setPage} />
            </div>
          </>
        ) : (
          <EmptyState title="No members found" message="Try a different search, or add your first member."
            action={<Link to="/members/new"><Button><Plus /> Add Member</Button></Link>} />
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(confirmId)} onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && remove.mutate(confirmId)}
        title="Deactivate member" busy={remove.isPending}
        message="This member will be deactivated and will no longer be able to check in. Their history is kept. Continue?"
        confirmLabel="Deactivate"
      />
    </div>
  );
}
