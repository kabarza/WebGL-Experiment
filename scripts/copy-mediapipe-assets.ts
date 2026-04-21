// Copies MediaPipe WASM runtime from node_modules and downloads the
// hand-landmarker model into public/vision/ so they're served locally.
// Self-hosting gives us long cache headers and no hard dep on Google's CDN.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const wasmSrc = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const wasmDest = resolve(root, 'public/vision/wasm');
const taskDest = resolve(root, 'public/vision/hand_landmarker.task');
const taskUrl =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

if (!existsSync(wasmSrc)) {
  console.error('[mediapipe] wasm source missing — did @mediapipe/tasks-vision install?');
  process.exit(1);
}

mkdirSync(wasmDest, { recursive: true });
cpSync(wasmSrc, wasmDest, { recursive: true });
console.log(`[mediapipe] WASM copied → public/vision/wasm/`);

if (existsSync(taskDest)) {
  console.log('[mediapipe] hand_landmarker.task already present, skipping download');
} else {
  console.log('[mediapipe] downloading hand_landmarker.task (~8MB)…');
  const res = await fetch(taskUrl);
  if (!res.ok) {
    console.error(`[mediapipe] download failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(taskDest, buf);
  console.log(`[mediapipe] saved ${(buf.length / 1024 / 1024).toFixed(1)}MB → public/vision/hand_landmarker.task`);
}
