import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Camera, ShieldCheck, Trash2, RefreshCw } from 'lucide-react';
import { faceApi, membersApi } from '../../services/api';
import { loadFaceModels, startCamera, stopCamera, collectSamples } from '../../lib/face';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ConfirmDialog } from '../../components/ui/dialog';
import { PageLoading, Spinner } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';

export default function FaceEnroll() {
  const [params] = useSearchParams();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelRef = useRef({ cancelled: false });
  const [search, setSearch] = useState('');
  const [memberId, setMemberId] = useState(params.get('member') ?? '');
  const [consent, setConsent] = useState(false);
  const [modelStatus, setModelStatus] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [samples, setSamples] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const searchQuery = useQuery({ queryKey: ['face-member-search', search], queryFn: () => membersApi.list({ search: search || undefined, limit: 8 }) });
  const member = useQuery({ queryKey: ['face-member', memberId], queryFn: () => membersApi.get(memberId), enabled: Boolean(memberId) });
  const status = useQuery({ queryKey: ['face-status', memberId], queryFn: () => faceApi.status(memberId), enabled: Boolean(memberId) });

  const enroll = useMutation({
    mutationFn: (samplesData: number[][]) => faceApi.enroll(memberId, samplesData),
    onSuccess: () => { toast('success', 'Face enrolled successfully'); void status.refetch(); void member.refetch(); },
    onError: err => toast('error', apiErrorMessage(err, 'Enrollment failed')),
  });
  const remove = useMutation({
    mutationFn: () => faceApi.remove(memberId),
    onSuccess: () => { toast('success', 'Biometric data deleted'); setDeleteOpen(false); void status.refetch(); void member.refetch(); },
    onError: err => toast('error', apiErrorMessage(err)),
  });

  const openCamera = async () => {
    try {
      setModelStatus('Loading AI models…');
      await loadFaceModels(setModelStatus);
      setModelStatus('');
      if (videoRef.current) {
        streamRef.current = await startCamera(videoRef.current);
        setCameraOn(true);
      }
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Camera failed to start');
      setModelStatus('');
    }
  };

  const closeCamera = () => {
    cancelRef.current.cancelled = true;
    stopCamera(streamRef.current);
    streamRef.current = null;
    setCameraOn(false);
  };
  useEffect(() => () => stopCamera(streamRef.current), []);

  const capture = async () => {
    if (!videoRef.current || !consent) return;
    cancelRef.current = { cancelled: false };
    setCapturing(true);
    setSamples(0);
    try {
      const data = await collectSamples(videoRef.current, 5, setSamples, cancelRef.current);
      if (data.length >= 3) {
        enroll.mutate(data);
      } else if (!cancelRef.current.cancelled) {
        toast('error', 'Could not capture enough clear samples. Improve lighting, face the camera and try again.');
      }
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div>
      <PageHeader title="Face Enrollment" subtitle="Enroll a member's face for AI check-in. Descriptors are encrypted on the server; raw photos are never stored." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <label className="text-sm font-medium text-slate-700">Find member</label>
            <Input className="mt-1.5" placeholder="Search by name, member ID, phone…" value={search} onChange={e => setSearch(e.target.value)} />
            <div className="mt-3 divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {searchQuery.isLoading ? <PageLoading /> : searchQuery.data?.items.map(m => (
                <button key={m._id} onClick={() => { setMemberId(m._id); setConsent(false); }}
                  className={`w-full flex items-center justify-between px-2 py-2.5 rounded-md text-left hover:bg-slate-50 ${memberId === m._id ? 'bg-brand-50' : ''}`}>
                  <span>
                    <span className="block text-sm font-medium text-slate-800">{m.fullName}</span>
                    <span className="text-xs text-slate-400">{m.memberId} · {m.phone}</span>
                  </span>
                  {m.faceEnrolled ? <Badge tone="green">Enrolled</Badge> : <Badge tone="slate">Not enrolled</Badge>}
                </button>
              ))}
            </div>
            {memberId && status.data && (
              <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm space-y-1">
                <p><span className="text-slate-500">Member:</span> <span className="font-medium">{member.data?.fullName}</span></p>
                <p><span className="text-slate-500">Status:</span> {status.data.enrolled ? `Enrolled (${status.data.samplesCount} samples)` : 'Not enrolled'}</p>
                <p><span className="text-slate-500">Consent on file:</span> {status.data.consentGiven ? 'Yes' : 'No'}</p>
                {status.data.enrolled && (
                  <Button variant="danger" size="sm" className="mt-2" onClick={() => setDeleteOpen(true)}>
                    <Trash2 /> Delete biometric data
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <div className="relative rounded-lg overflow-hidden bg-slate-900 aspect-[4/3] flex items-center justify-center">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {!cameraOn && <p className="absolute text-slate-400 text-sm px-4 text-center">Camera is off. Select a member, then open the camera.</p>}
              {capturing && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-3 py-1.5 rounded-full">
                  Capturing samples… {samples}/5 — look at the camera, turn your head slightly
                </div>
              )}
            </div>
            {modelStatus && <p className="text-sm text-slate-500 flex items-center gap-2"><Spinner className="size-4" /> {modelStatus}</p>}
            <label className="flex items-start gap-2.5 text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-md p-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={consent} onChange={e => setConsent(e.target.checked)} />
              <span>
                <span className="font-medium inline-flex items-center gap-1"><ShieldCheck className="size-4 text-emerald-600" /> Biometric consent</span><br />
                The member explicitly agrees to facial biometric enrollment for gym entry. They can withdraw consent and delete their biometric data at any time. QR and manual check-in remain available as alternatives.
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {!cameraOn
                ? <Button onClick={openCamera} disabled={!memberId}><Camera /> Open camera</Button>
                : <Button variant="secondary" onClick={closeCamera}>Close camera</Button>}
              <Button onClick={capture} disabled={!cameraOn || !consent || capturing || enroll.isPending}>
                <RefreshCw /> {status.data?.enrolled ? 'Re-enroll face' : 'Capture & enroll'} (5 samples)
              </Button>
            </div>
            {!consent && memberId && <p className="text-xs text-slate-500">Consent must be confirmed before capturing.</p>}
            <p className="text-xs text-slate-400">Tip: good lighting matters. Ask the member to face the camera and turn their head slightly between samples. Enrollment stores one encrypted template built from the samples — no photos are saved.</p>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={() => remove.mutate()}
        busy={remove.isPending} title="Delete biometric data"
        message="This permanently removes the member's face template. Face check-in will stop working for them (QR and manual check-in still work). Continue?" confirmLabel="Delete" />
    </div>
  );
}
