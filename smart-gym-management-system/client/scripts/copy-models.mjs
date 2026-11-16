// Copies the face-api.js model weights from the installed @vladmandic/face-api
// package into public/models so the browser can load them from /models.
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, '..', 'node_modules', '@vladmandic', 'face-api', 'model');
const dest = path.join(root, '..', 'public', 'models');
const files = [
  'tiny_face_detector_model-weights_manifest.json', 'tiny_face_detector_model.bin',
  'face_landmark_68_model-weights_manifest.json', 'face_landmark_68_model.bin',
  'face_recognition_model-weights_manifest.json', 'face_recognition_model.bin',
];
if (!existsSync(src)) {
  console.warn('[copy-models] @vladmandic/face-api not installed yet — skipping');
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const f of files) copyFileSync(path.join(src, f), path.join(dest, f));
console.log(`[copy-models] copied ${files.length} face model files to public/models`);
