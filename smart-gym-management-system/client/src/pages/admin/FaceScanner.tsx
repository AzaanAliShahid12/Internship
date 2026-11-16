import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, CameraOff, ScanFace, Eye } from 'lucide-react';
import { devicesApi, faceApi } from '../../services/api';
import { loadFaceModels, startCamera, stopCamera, detectSingleFaceDescriptor, waitForBlink } from '../../lib/face';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/button';
import { Label, Select } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { CheckInResultCard, ResultPlaceholder } from '../../components/CheckInResultCard';
import { Spinner } from '../../components/ui/feedback';
import { useToast } from '../../components/ui/toast';
import type { CheckInResult } from '../../types';

type Phase = 'idle' | 'loading-models' | 'ready' | 'detecting' | 'liveness' | 'verifying';

export default function FaceScanner() {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef({ running: false });
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [livenessEnabled, setLivenessEnabled] = useState(true);
  const [hint, setHint] = useState('');

  const devices = useQuery({ queryKey: ['devices'], queryFn: () => devicesApi.list() });

  const stop = () => {
    loopRef.current.running = false;
    stopCamera(streamRef.current);
    streamRef.current = null;
    setPhase('idle');
  };
  useEffect(() => () => stop(), []);

  const start = async () => {
    try {
      setPhase('loading-models');
      await loadFaceModels(() => {});
      if (!videoRef.current) return;
      streamRef.current = await startCamera(videoRef.current);
      setPhase('ready');
      loopRef.current.running = true;
      void detectionLoop();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not start face check-in');
      setPhase('idle');
    }
  };

  const detectionLoop = async () => {
    while (loopRef.current.running) {
      const video = videoRef.current;
      if (!video || video.readyState < 2) { await delay(250); continue; }
      setPhase('detecting');
      setHint('Looking for a face… stand in front of the camera');
      let detected;
      try {
        detected = await detectSingleFaceDescriptor(video);
      } catch { await delay(300); continue; }
      if (!loopRef.current.running) break;
      if (detected === 'none') { setHint('No face detected — move closer and face the camera'); await delay(250); continue; }
      if (detected === 'multiple') { setHint('Multiple faces detected — only one person at a time, please'); await delay(600); continue; }

      if (livenessEnabled) {
        setPhase('liveness');
        setHint('Liveness check: please BLINK now');
        const blinked = await waitForBlink(video, 9000);
        if (!blinked) {
          setResult({ allowed: false, reason: 'Liveness check failed — blink was not detected. Please try again.' });
          setHint('');
          await delay(2500);
          continue;
        }
      }

      setPhase('verifying');
      setHint('Face captured — verifying with the server…');
      try {
        const res = await faceApi.verify(detected.descriptor, deviceId || undefined);
        setResult(res);
      } catch (err) {
        toast('error', apiErrorMessage(err, 'Face verification failed'));
      }
      setHint('');
      setPhase('ready');
      await delay(3000); // pause before scanning the next person
    }
  };

  return (
    <div>
      <PageHeader title="Face Recognition Check-In" subtitle="AI face matching runs against encrypted templates on the server. Unknown faces are rejected automatically." />
      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="w-64">
                <Label>Entry device (optional)</Label>
                <Select value={deviceId} onChange={e => setDeviceId(e.target.value)}>
                  <option value="">This device</option>
                  {devices.data?.filter(d => d.isActive).map(d => <option key={d._id} value={d._id}>{d.name}{d.location ? ` — ${d.location}` : ''}</option>)}
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 pb-2 cursor-pointer">
                <input type="checkbox" className="size-4 accent-brand-600" checked={livenessEnabled} onChange={e => setLivenessEnabled(e.target.checked)} />
                <Eye className="size-4" /> Blink liveness challenge
              </label>
            </div>
            <div className="relative rounded-lg overflow-hidden bg-slate-900 aspect-[4/3] flex items-center justify-center">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {phase === 'idle' && <p className="absolute text-slate-400 text-sm">Camera is off</p>}
              {phase === 'loading-models' && (
                <div className="absolute inset-0 bg-slate-900/70 flex flex-col items-center justify-center text-white gap-2">
                  <Spinner className="size-8 text-white" /><p className="text-sm">Loading AI face models…</p>
                </div>
              )}
              {hint && phase !== 'idle' && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-full whitespace-nowrap">{hint}</div>
              )}
            </div>
            <div className="flex gap-2">
              {phase === 'idle'
                ? <Button onClick={start}><Camera /> Start face check-in</Button>
                : <Button variant="danger" onClick={stop}><CameraOff /> Stop</Button>}
              <span className="text-xs text-slate-400 self-center inline-flex items-center gap-1">
                <ScanFace className="size-4" /> Matching threshold is configured on the server (FACE_MATCH_THRESHOLD).
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Privacy: only a numeric face descriptor leaves this device — never a photo. Blink detection is a basic
              anti-spoofing aid against printed photos; it is not certified liveness and is honestly labelled as such.
              Low light reduces accuracy — keep the entrance well lit.
            </p>
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          {result ? <CheckInResultCard result={result} /> : <ResultPlaceholder />}
        </div>
      </div>
    </div>
  );
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
