import * as faceapi from '@vladmandic/face-api';

/**
 * Face recognition runs in the browser with face-api.js (TensorFlow.js).
 * Models are served from /models (copied from the @vladmandic/face-api package).
 * The browser only extracts a 128-number descriptor; matching happens on the
 * server against AES-encrypted stored templates. Raw images never leave the device.
 */

let loaded = false;
let loading: Promise<void> | null = null;

export async function loadFaceModels(onProgress?: (msg: string) => void): Promise<void> {
  if (loaded) return;
  if (!loading) {
    loading = (async () => {
      onProgress?.('Loading face detection model…');
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      onProgress?.('Loading face landmarks model…');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      onProgress?.('Loading face recognition model…');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      loaded = true;
    })();
  }
  await loading;
}

export interface FaceDetectionResult {
  descriptor: number[];
  score: number;
  expressions?: Record<string, number>;
}

/** Detect exactly one face in a video/image element and extract its descriptor. */
export async function detectSingleFaceDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<FaceDetectionResult | 'none' | 'multiple'> {
  const all = await faceapi
    .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (all.length === 0) return 'none';
  if (all.length > 1) return 'multiple';
  return {
    descriptor: Array.from(all[0].descriptor),
    score: all[0].detection.score,
  };
}

/** Collect N good samples from a live video (used for enrollment). */
export async function collectSamples(
  video: HTMLVideoElement,
  count: number,
  onSample: (n: number) => void,
  signal: { cancelled: boolean }
): Promise<number[][]> {
  const samples: number[][] = [];
  let last = 0;
  while (samples.length < count && !signal.cancelled) {
    const now = Date.now();
    if (now - last > 450) {
      last = now;
      const result = await detectSingleFaceDescriptor(video);
      if (result !== 'none' && result !== 'multiple' && result.score > 0.6) {
        // Avoid near-duplicate samples: require some distance from the previous one.
        const prev = samples[samples.length - 1];
        if (!prev || euclidean(prev, result.descriptor) > 0.08) {
          samples.push(result.descriptor);
          onSample(samples.length);
        }
      }
    }
    await new Promise(r => setTimeout(r, 60));
  }
  return samples;
}

function euclidean(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

/**
 * Basic liveness challenge: asks the user to blink.
 * Uses the eye aspect ratio (EAR) from 68-point landmarks.
 * NOTE: browser blink detection is a *basic* anti-spoofing signal only —
 * it raises the bar against printed photos but is not certified liveness.
 */
export async function waitForBlink(video: HTMLVideoElement, timeoutMs = 12000): Promise<boolean> {
  const start = Date.now();
  let sawOpen = false;
  let sawClosed = false;
  while (Date.now() - start < timeoutMs) {
    const det = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks();
    if (det) {
      const left = det.landmarks.getLeftEye();
      const right = det.landmarks.getRightEye();
      const ear = (eyeAspectRatio(left) + eyeAspectRatio(right)) / 2;
      if (ear > 0.24) sawOpen = true;
      if (sawOpen && ear < 0.17) sawClosed = true;
      if (sawOpen && sawClosed && ear > 0.24) return true;
    }
    await new Promise(r => setTimeout(r, 90));
  }
  return false;
}

function eyeAspectRatio(eye: faceapi.Point[]): number {
  const dist = (a: faceapi.Point, b: faceapi.Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const v1 = dist(eye[1], eye[5]);
  const v2 = dist(eye[2], eye[4]);
  const h = dist(eye[0], eye[3]);
  return h === 0 ? 0 : (v1 + v2) / (2 * h);
}

/** Start the camera; throws a friendly error when permission is denied. */
export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera is not available. Face features require HTTPS (or localhost) and a camera-enabled device.');
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 720, height: 560, facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    await video.play();
    return stream;
  } catch {
    throw new Error('Camera permission denied. Please allow camera access in your browser and try again.');
  }
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach(t => t.stop());
}
