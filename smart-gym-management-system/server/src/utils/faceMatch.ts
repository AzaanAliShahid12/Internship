/** Euclidean distance between two equal-length face descriptors. */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Descriptor length mismatch');
  let sum = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; sum += d * d; }
  return Math.sqrt(sum);
}

/** Average multiple sample descriptors into one template descriptor. */
export function averageDescriptors(samples: number[][]): number[] {
  if (samples.length === 0) throw new Error('No samples provided');
  const len = samples[0].length;
  const out = new Array<number>(len).fill(0);
  for (const s of samples) {
    if (s.length !== len) throw new Error('Descriptor length mismatch');
    for (let i = 0; i < len; i++) out[i] += s[i] / samples.length;
  }
  return out;
}

export interface FaceCandidate { memberId: string; descriptor: number[]; }
export interface FaceMatchResult { memberId: string; distance: number; }

/** Find the closest candidate under the threshold, or null when no face matches. */
export function findBestMatch(query: number[], candidates: FaceCandidate[], threshold: number): FaceMatchResult | null {
  let best: FaceMatchResult | null = null;
  for (const c of candidates) {
    const d = euclideanDistance(query, c.descriptor);
    if (!best || d < best.distance) best = { memberId: c.memberId, distance: d };
  }
  return best && best.distance <= threshold ? best : null;
}
