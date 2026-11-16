import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { membersApi } from '../../services/api';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardContent } from '../../components/ui/card';
import { MemberForm, toMemberPayload, MemberFormValues } from './MemberForm';
import { PageLoading, ErrorState } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';

export default function EditMember() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const query = useQuery({ queryKey: ['member', id], queryFn: () => membersApi.get(id) });
  const update = useMutation({
    mutationFn: (values: MemberFormValues) => membersApi.update(id, toMemberPayload(values)),
    onSuccess: () => { toast('success', 'Member updated'); navigate(`/members/${id}`); },
    onError: err => toast('error', apiErrorMessage(err, 'Could not update member')),
  });
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data) return <ErrorState message="Member not found" />;
  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit Member" subtitle={`${query.data.fullName} · ${query.data.memberId}`} />
      <Card><CardContent>
        <MemberForm initial={query.data} onSubmit={v => update.mutate(v)} submitting={update.isPending} submitLabel="Save changes" />
      </CardContent></Card>
    </div>
  );
}
