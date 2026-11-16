import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useQuery } from '@tanstack/react-query';
import { Camera, CameraOff, Keyboard, LogOut } from 'lucide-react';
import { attendanceApi, qrApi, devicesApi, membersApi } from '../../services/api';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Input, Label, Select } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { CheckInResultCard, ResultPlaceholder } from '../../components/CheckInResultCard';
import { useToast } from '../../components/ui/toast';
import type { CheckInResult } from '../../types';

function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.08;
    osc.start();
    setTimeout(() => { osc.stop(); void ctx.close(); }, ok ? 180 : 350);
  } catch { /* audio not available */ }
}

export default function QrScanner() {
  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [checkoutCode, setCheckoutCode] = useState('');

  const devices = useQuery({ queryKey: ['devices'], queryFn: () => devicesApi.list() });
  const inside = useQuery({ queryKey: ['occupancy'], queryFn: () => attendanceApi.occupancy(), refetchInterval: 15000 });
  const memberLookup = useQuery({
    queryKey: ['manual-lookup', checkoutCode],
    queryFn: () => membersApi.list({ search: checkoutCode, limit: 5 }),
    enabled: checkoutCode.length >= 2,
  });

  const verify = async (token: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await qrApi.verify(token.trim(), deviceId || undefined);
      setResult(res);
      beep(res.allowed);
      void inside.refetch();
    } catch (err) {
      toast('error', apiErrorMessage(err, 'Verification failed'));
    } finally {
      setTimeout(() => { busyRef.current = false; }, 1200);
    }
  };

  const startScanner = async () => {
    setCameraError('');
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        decoded => { void verify(decoded); },
        () => { /* per-frame decode errors are expected while searching */ }
      );
      setScanning(true);
    } catch {
      setCameraError('Could not start the camera. Check camera permission — scanning requires HTTPS (or localhost) and an allowed camera.');
    }
  };

  const stopScanner = async () => {
    try { await scannerRef.current?.stop(); scannerRef.current?.clear(); } catch { /* already stopped */ }
    setScanning(false);
  };

  useEffect(() => () => { void stopScanner(); }, []);

  const manualCheckOut = async (memberDbId: string) => {
    try {
      await attendanceApi.checkOut(memberDbId);
      toast('success', 'Member checked out');
      void inside.refetch();
    } catch (err) { toast('error', apiErrorMessage(err)); }
  };

  return (
    <div>
      <PageHeader title="QR Scanner — Entrance" subtitle="Scan a member's QR code to verify entry. Results appear instantly and the dashboard updates in real time." />
      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardContent className="space-y-4">
            <div className="max-w-xs">
              <Label>Entry device (optional)</Label>
              <Select value={deviceId} onChange={e => setDeviceId(e.target.value)}>
                <option value="">This device</option>
                {devices.data?.filter(d => d.isActive).map(d => <option key={d._id} value={d._id}>{d.name}{d.location ? ` — ${d.location}` : ''}</option>)}
              </Select>
            </div>
            <div id="qr-reader" className="rounded-lg overflow-hidden bg-slate-900 min-h-[280px] flex items-center justify-center text-slate-400 text-sm">
              {!scanning && <span>Camera preview will appear here</span>}
            </div>
            {cameraError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{cameraError}</p>}
            <div className="flex gap-2">
              {!scanning
                ? <Button onClick={startScanner}><Camera /> Start camera</Button>
                : <Button variant="danger" onClick={stopScanner}><CameraOff /> Stop camera</Button>}
            </div>
            <div className="border-t border-slate-100 pt-4">
              <Label><span className="inline-flex items-center gap-1.5"><Keyboard className="size-4" /> Manual code entry</span></Label>
              <div className="flex gap-2 mt-1.5">
                <Input placeholder="Paste the QR token (gymqr_…)" value={manualCode} onChange={e => setManualCode(e.target.value)} />
                <Button variant="secondary" disabled={!manualCode} onClick={() => void verify(manualCode)}>Verify</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {result ? <CheckInResultCard result={result} /> : <ResultPlaceholder />}
          <Card>
            <CardHeader><CardTitle>Inside the gym now ({inside.data?.count ?? 0})</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-72 overflow-y-auto">
              {inside.data && inside.data.members.length > 0 ? inside.data.members.map(a => {
                const m = typeof a.member === 'object' ? a.member : null;
                return (
                  <div key={a._id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2 last:border-0">
                    <span>{m?.fullName} <span className="text-slate-400">({m?.memberId})</span>
                      <span className="block text-xs text-slate-400">via {a.method} · {new Date(a.checkInAt).toLocaleTimeString()}</span></span>
                    {m && <Button size="sm" variant="ghost" onClick={() => void manualCheckOut(m._id)}><LogOut /> Out</Button>}
                  </div>
                );
              }) : <p className="text-sm text-slate-400">Nobody is checked in right now.</p>}
              <div className="pt-2 border-t border-slate-100">
                <Label>Manual member lookup / check-in</Label>
                <Input placeholder="Type member name or ID…" value={checkoutCode} onChange={e => setCheckoutCode(e.target.value)} />
                {memberLookup.data?.items.map(m => (
                  <div key={m._id} className="flex items-center justify-between py-1.5 text-sm">
                    <span>{m.fullName} <span className="text-slate-400">({m.memberId})</span></span>
                    <span className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={async () => {
                        try {
                          const r = await attendanceApi.checkIn(m._id);
                          if (r.allowed) { toast('success', `${m.fullName} checked in manually`); void inside.refetch(); }
                          else toast('error', r.reason ?? 'Check-in denied');
                        } catch (err) { toast('error', apiErrorMessage(err)); }
                      }}>Check in</Button>
                      <Button size="sm" variant="ghost" onClick={() => void manualCheckOut(m._id)}>Check out</Button>
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
