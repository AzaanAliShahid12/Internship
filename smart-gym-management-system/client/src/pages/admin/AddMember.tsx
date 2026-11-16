import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { membersApi } from '../../services/api';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardContent } from '../../components/ui/card';
import { MemberForm, toMemberPayload, MemberFormValues } from './MemberForm';
import { useToast } from '../../components/ui/toast';

export default function AddMember() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const create = useMutation({
    mutationFn: (values: MemberFormValues) => membersApi.create(toMemberPayload(values)),
    onSuccess: member => {
      toast('success', `Member ${member.fullName} created (${member.memberId})`);
      navigate(`/members/${member._id}`);
    },
    onError: err => toast('error', apiErrorMessage(err, 'Could not create member')),
  });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add Member" subtitle="Register a new gym member" />
      <Card><CardContent>
        <MemberForm onSubmit={v => create.mutate(v)} submitting={create.isPending} submitLabel="Create member" />
      </CardContent></Card>
    </div>
  );
}
