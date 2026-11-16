import { useQuery } from '@tanstack/react-query';
import { trainersApi } from '../../services/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/card';
import { Table, THead, Th, Td, Tr } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { PageLoading, ErrorState, EmptyState } from '../../components/ui/feedback';
import { formatDate } from '../../lib/utils';

export default function TrainerMembers() {
  const query = useQuery({ queryKey: ['trainer-my-members'], queryFn: () => trainersApi.myMembers() });
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data) return <ErrorState message="No trainer profile is linked to your account yet." />;
  const { members } = query.data;
  return (
    <div>
      <PageHeader title="My Members" subtitle="Members assigned to you for training" />
      <Card>
        {members.length > 0 ? (
          <Table>
            <THead><tr><Th>Member</Th><Th>Member ID</Th><Th>Contact</Th><Th>Plan</Th><Th>Membership</Th><Th>Expiry</Th><Th>Face</Th></tr></THead>
            <tbody>
              {members.map(m => (
                <Tr key={m._id}>
                  <Td className="font-medium text-slate-900">{m.fullName}</Td>
                  <Td>{m.memberId}</Td>
                  <Td>{m.email}<span className="block text-xs text-slate-400">{m.phone}</span></Td>
                  <Td>{m.membershipPlan ?? '—'}</Td>
                  <Td>{m.membershipStatus && m.membershipStatus !== 'none' ? <Badge tone={m.membershipStatus === 'active' ? 'green' : 'red'}>{m.membershipStatus}</Badge> : <Badge tone="slate">None</Badge>}</Td>
                  <Td>{formatDate(m.membershipExpiryDate)}</Td>
                  <Td>{m.faceEnrolled ? <Badge tone="green">Enrolled</Badge> : <Badge tone="slate">No</Badge>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState title="No members assigned" message="An admin can assign members to you from the Trainers page." />}
      </Card>
    </div>
  );
}
