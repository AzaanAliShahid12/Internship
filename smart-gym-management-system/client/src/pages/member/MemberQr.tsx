import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { portalApi } from '../../services/api';
import { downloadDataUrl } from '../../lib/csv';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { PageLoading, ErrorState, EmptyState } from '../../components/ui/feedback';

export default function MemberQr() {
  const query = useQuery({ queryKey: ['portal-qr'], queryFn: () => portalApi.qr() });
  if (query.isLoading) return <PageLoading />;
  if (query.isError) return <ErrorState message="Could not load your QR code" onRetry={() => void query.refetch()} />;
  const data = query.data;

  const printQr = () => {
    if (!data?.qrImage) return;
    const w = window.open('', '_blank', 'width=420,height=560');
    if (!w) return;
    w.document.write(`<html><head><title>My Gym QR</title></head><body style="font-family:sans-serif;text-align:center;padding:24px">
      <h2>${data.fullName ?? ''}</h2><p>Member ID: ${data.memberId ?? ''}</p>
      <img src="${data.qrImage}" width="300" /><p>Smart Gym — scan at the entrance</p></body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="max-w-lg">
      <PageHeader title="My QR Code" subtitle="Show this code at the entrance scanner to check in" />
      <Card>
        <CardContent className="text-center py-8">
          {data?.hasCredential && data.qrImage ? (
            <>
              <img src={data.qrImage} alt="Your gym QR code" className="mx-auto size-64 rounded-lg border border-slate-200" />
              <p className="font-semibold text-slate-900 mt-4">{data.fullName}</p>
              <p className="text-sm text-slate-500">Member ID: {data.memberId}</p>
              <div className="flex justify-center gap-2 mt-4">
                <Button onClick={() => downloadDataUrl(`${data.memberId}-qr.png`, data.qrImage!)}>Download QR</Button>
                <Button variant="secondary" onClick={printQr}><Printer /> Print</Button>
              </div>
              <p className="text-xs text-slate-400 mt-4 max-w-sm mx-auto">
                Keep this code private — anyone holding it can check in as you. If it is lost or shared,
                ask the front desk to regenerate it; the old code stops working immediately.
              </p>
            </>
          ) : (
            <EmptyState title="No QR code yet" message={data?.message ?? 'Ask the front desk to generate your QR code.'} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
