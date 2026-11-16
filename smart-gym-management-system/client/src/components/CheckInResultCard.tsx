import { CheckCircle2, XCircle } from 'lucide-react';
import type { CheckInResult } from '../types';
import { formatDate, formatDateTime } from '../lib/utils';
import { cn } from '../lib/utils';

/** Big success / denied panel shown at the entrance after QR or face verification. */
export function CheckInResultCard({ result }: { result: CheckInResult }) {
  if (result.allowed) {
    return (
      <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-5 text-center pulse-success animate-fade-in">
        <CheckCircle2 className="size-14 text-emerald-600 mx-auto" />
        <p className="text-2xl font-extrabold text-emerald-700 tracking-wide mt-2">SUCCESS — ENTRY ALLOWED</p>
        {result.member?.profilePicture && (
          <img src={result.member.profilePicture} alt="" className="size-20 rounded-full object-cover mx-auto mt-3 border-2 border-emerald-300" />
        )}
        <p className="text-lg font-semibold text-slate-900 mt-2">{result.member?.fullName}</p>
        <p className="text-sm text-slate-600">Member ID: {result.member?.memberId} · Method: {result.method}</p>
        {result.plan && <p className="text-sm text-slate-600">Plan: {result.plan} · Expires: {formatDate(result.expiryDate)}</p>}
        <p className="text-sm text-slate-500">Checked in at {formatDateTime(result.checkInAt)}</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border-2 border-red-500 bg-red-50 p-5 text-center animate-fade-in">
      <XCircle className="size-14 text-red-600 mx-auto" />
      <p className="text-2xl font-extrabold text-red-700 tracking-wide mt-2">DENIED — ENTRY REJECTED</p>
      <p className="text-base font-medium text-red-800 mt-1">{result.reason ?? 'Verification failed'}</p>
      {result.member && <p className="text-sm text-slate-600 mt-1">{result.member.fullName} ({result.member.memberId})</p>}
    </div>
  );
}

export function ResultPlaceholder() {
  return (
    <div className={cn('rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 text-center text-slate-400')}>
      <p className="text-sm">Verification results will appear here</p>
    </div>
  );
}
