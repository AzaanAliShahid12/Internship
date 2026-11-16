import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { QrCode, Printer, Ban, RefreshCw } from 'lucide-react';
import { membersApi, qrApi } from '../../services/api';
import { downloadDataUrl } from '../../lib/csv';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ConfirmDialog } from '../../components/ui/dialog';
import { PageLoading } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import { formatDate } from '../../lib/utils';

export default function QrGenerator() {
  const [params] = useSearchParams();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>(params.get('member') ?? '');
  const [generated, setGenerated] = useState<{ qrImage: string; token: string } | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const searchQuery = useQuery({
    queryKey: ['qr-member-search', search],
    queryFn: () => membersApi.list({ search: search || undefined, limit: 8 }),
  });
  const member = useQuery({
    queryKey: ['qr-member', selectedId],
    queryFn: () => membersApi.get(selectedId),
    enabled: Boolean(selectedId),
  });
  const status = useQuery({
    queryKey: ['qr-status', selectedId],
    queryFn: () => qrApi.status(selectedId),
    enabled: Boolean(selectedId),
  });

  useEffect(() => { setGenerated(null); }, [selectedId]);

  const generate = useMutation({
    mutationFn: () => qrApi.generate(selectedId),
    onSuccess: data => {
      setGenerated({ qrImage: data.qrImage, token: data.token });
      toast('success', 'New QR code generated. The previous code (if any) has been revoked.');
      void status.refetch();
    },
    onError: err => toast('error', apiErrorMessage(err)),
  });
  const revoke = useMutation({
    mutationFn: () => qrApi.revoke(selectedId),
    onSuccess: () => { toast('success', 'QR credential revoked'); setRevokeOpen(false); setGenerated(null); void status.refetch(); },
    onError: err => toast('error', apiErrorMessage(err)),
  });

  const printQr = () => {
    if (!generated || !member.data) return;
    const w = window.open('', '_blank', 'width=420,height=560');
    if (!w) return;
    w.document.write(`<html><head><title>QR — ${member.data.fullName}</title></head><body style="font-family:sans-serif;text-align:center;padding:24px">
      <h2>${member.data.fullName}</h2><p>Member ID: ${member.data.memberId}</p>
      <img src="${generated.qrImage}" width="300" /><p>Smart Gym — scan at the entrance</p></body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div>
      <PageHeader title="QR Code Generator" subtitle="Each member gets a unique, revocable QR credential. The QR contains only a random token — no personal data." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <label className="text-sm font-medium text-slate-700">Find member</label>
            <Input className="mt-1.5" placeholder="Search by name, member ID, phone…" value={search} onChange={e => setSearch(e.target.value)} />
            <div className="mt-3 divide-y divide-slate-50 max-h-80 overflow-y-auto">
              {searchQuery.isLoading ? <PageLoading /> : searchQuery.data?.items.map(m => (
                <button key={m._id} onClick={() => setSelectedId(m._id)}
                  className={`w-full flex items-center justify-between px-2 py-2.5 rounded-md text-left hover:bg-slate-50 ${selectedId === m._id ? 'bg-brand-50' : ''}`}>
                  <span>
                    <span className="block text-sm font-medium text-slate-800">{m.fullName}</span>
                    <span className="text-xs text-slate-400">{m.memberId} · {m.phone}</span>
                  </span>
                  {m.membershipStatus ? <Badge tone={m.membershipStatus === 'active' ? 'green' : 'red'}>{m.membershipStatus}</Badge> : null}
                </button>
              ))}
              {searchQuery.data && searchQuery.data.items.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No members match</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            {!selectedId ? (
              <div className="text-center py-14 text-slate-400">
                <QrCode className="size-12 mx-auto mb-2" />
                <p className="text-sm">Select a member to manage their QR code</p>
              </div>
            ) : member.isLoading || status.isLoading ? <PageLoading /> : member.data ? (
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-slate-900">{member.data.fullName} <span className="text-slate-400 font-normal">({member.data.memberId})</span></p>
                  <p className="text-sm text-slate-500">Membership: {member.data.membershipPlan ?? 'No plan'} · status {member.data.membershipStatus ?? 'none'} · expires {formatDate(member.data.membershipExpiryDate)}</p>
                  <p className="text-sm mt-1">
                    {status.data?.hasActiveCredential
                      ? <Badge tone="green">Active QR credential since {formatDate(status.data.credentialCreatedAt)}</Badge>
                      : <Badge tone="slate">No active QR credential</Badge>}
                  </p>
                </div>
                {generated ? (
                  <div className="text-center">
                    <img src={generated.qrImage} alt="Member QR code" className="mx-auto size-56 rounded-lg border border-slate-200" />
                    <p className="text-xs text-slate-500 mt-2">Show this to the member now — download or print it. Generating again will revoke this code.</p>
                    <div className="flex justify-center gap-2 mt-3">
                      <Button variant="secondary" onClick={() => downloadDataUrl(`${member.data!.memberId}-qr.png`, generated.qrImage)}>Download</Button>
                      <Button variant="secondary" onClick={printQr}><Printer /> Print</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 bg-slate-50 rounded-md p-3">
                    {status.data?.hasActiveCredential
                      ? 'This member already has an active QR code (shown in their member portal). Generating a new one revokes the old code immediately.'
                      : 'This member has no QR code yet. Generate one so they can check in at the entrance.'}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
                    <RefreshCw /> {status.data?.hasActiveCredential ? 'Regenerate QR' : 'Generate QR'}
                  </Button>
                  {status.data?.hasActiveCredential && (
                    <Button variant="danger" onClick={() => setRevokeOpen(true)}><Ban /> Revoke</Button>
                  )}
                </div>
              </div>
            ) : <p className="text-sm text-red-600">Member not found</p>}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog open={revokeOpen} onClose={() => setRevokeOpen(false)} onConfirm={() => revoke.mutate()}
        busy={revoke.isPending} title="Revoke QR code"
        message="The member's current QR code will stop working immediately. They will need a new one to enter. Continue?" confirmLabel="Revoke" />
    </div>
  );
}
