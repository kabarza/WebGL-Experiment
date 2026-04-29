// ============================================================
// Globe 1 — Standalone IIFE entry for Webflow export
// Mirrors experiment.ts (Three.js + Line2) with baked params.
// ============================================================

import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

declare const __BAKED_PARAMS__: Record<string, unknown>;

type Country = { name: string; lat: number; lon: number };

const DEFAULT_COUNTRIES: Country[] = [
  { name: 'NORWEGEN', lat: 57, lon: 0 },
  { name: 'NIEDERLANDE', lat: 48, lon: -10 },
  { name: 'BELGIEN', lat: 38, lon: -20 },
  { name: 'DEUTSCHLAND', lat: 38, lon: 18 },
  { name: 'LUXEMBURG', lat: 28, lon: -10 },
  { name: 'FRANKREICH', lat: 20, lon: -28 },
  { name: 'SCHWEIZ', lat: 10, lon: 0 },
  { name: 'ÖSTERREICH', lat: 20, lon: 28 },
];

const FALLBACK: Record<string, unknown> = {
  bgColor: '#000000',
  lineColor: '#5a5a52',
  crossColor: '#ffffff',
  labelColor: '#cfcfcf',
  accentColor: '#ffffff',
  lonSegments: 21,
  latSegments: 19,
  lineOpacity: 0.45,
  showLines: true,
  showCountries: true,
  showLabels: true,
  showSnake: true,
  zoom: 0.84,
  fov: 25,
  basePitchDeg: 25,
  baseYawDeg: -10,
  snapMode: 'intersection',
  crossSize: 0.045,
  crossOnSurface: true,
  labelSize: 11,
  labelOffsetY: 18,
  dragSensitivity: 0.26,
  dragSpring: { type: 'spring', stiffness: 110, damping: 18, mass: 1 },
  autoSpin: false,
  autoSpinSpeed: 0.15,
  autoSpinAxis: 'Y (yaw)',
  pauseSpinOnDrag: true,
  snakeIntervalMin: 0.1,
  snakeIntervalMax: 0.6,
  snakeSpeed: 0.82,
  snakeTrailLength: 93,
  snakeWidth: 1,
  snakeFlashDuration: 1.6,
  snakeIntensity: 0.1,
  snakeEase: { type: 'easing', duration: 0.3, ease: [0.34, 0.45, 0.5, 1] },
  countriesJson: JSON.stringify(DEFAULT_COUNTRIES),
};

const BP: Record<string, unknown> =
  typeof __BAKED_PARAMS__ !== 'undefined'
    ? { ...FALLBACK, ...__BAKED_PARAMS__ }
    : FALLBACK;

const GLOBE_RADIUS = 1.0;
// Crosses and snake-path samples share this exact shell so they
// project to identical pixels (no radial parallax). depthTest:false
// + renderOrder handles draw order against the wireframe.
const MARKER_RADIUS = GLOBE_RADIUS;

type SnapMode = 'nearest line' | 'intersection' | 'meridian' | 'parallel' | 'free';

function latLonToVec3(latDeg: number, lonDeg: number, r: number, out = new THREE.Vector3()) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const c = Math.cos(lat);
  out.set(c * Math.sin(lon) * r, Math.sin(lat) * r, c * Math.cos(lon) * r);
  return out;
}
function snapCountry(latDeg: number, lonDeg: number, lonSeg: number, latSeg: number, mode: SnapMode) {
  const lonStep = 360 / lonSeg, latStep = 180 / latSeg;
  // Snap to the actual drawn grid lattice (meridians at -180 + k·step,
  // parallels at -90 + k·step; poles excluded from k).
  const sLon = (l: number) => {
    let k = Math.round((l + 180) / lonStep);
    k = ((k % lonSeg) + lonSeg) % lonSeg;
    return -180 + k * lonStep;
  };
  const sLat = (l: number) => {
    const k = Math.max(1, Math.min(latSeg - 1, Math.round((l + 90) / latStep)));
    return -90 + k * latStep;
  };
  if (mode === 'free') return { lat: latDeg, lon: lonDeg };
  if (mode === 'meridian') return { lat: latDeg, lon: sLon(lonDeg) };
  if (mode === 'parallel') return { lat: sLat(latDeg), lon: lonDeg };
  if (mode === 'intersection') return { lat: sLat(latDeg), lon: sLon(lonDeg) };
  const aLat = sLat(latDeg), aLon = sLon(lonDeg);
  return Math.abs(latDeg - aLat) <= Math.abs(lonDeg - aLon)
    ? { lat: aLat, lon: lonDeg }
    : { lat: latDeg, lon: aLon };
}
function buildGridPositions(lonSeg: number, latSeg: number) {
  const subdiv = 64; const arr: number[] = []; const tmp = new THREE.Vector3();
  for (let i = 0; i < lonSeg; i++) {
    const lon = -180 + (360 * i) / lonSeg;
    let prev: THREE.Vector3 | null = null;
    for (let j = 0; j <= subdiv; j++) {
      const lat = -90 + 180 * (j / subdiv);
      latLonToVec3(lat, lon, GLOBE_RADIUS, tmp);
      if (prev) arr.push(prev.x, prev.y, prev.z, tmp.x, tmp.y, tmp.z);
      prev = prev ? prev.copy(tmp) : tmp.clone();
    }
  }
  for (let i = 1; i < latSeg; i++) {
    const lat = -90 + (180 * i) / latSeg;
    let prev: THREE.Vector3 | null = null;
    for (let j = 0; j <= subdiv; j++) {
      const lon = -180 + 360 * (j / subdiv);
      latLonToVec3(lat, lon, GLOBE_RADIUS, tmp);
      if (prev) arr.push(prev.x, prev.y, prev.z, tmp.x, tmp.y, tmp.z);
      prev = prev ? prev.copy(tmp) : tmp.clone();
    }
  }
  return new Float32Array(arr);
}
function buildSnakePath(start: Country, end: Country, samples = 80) {
  const path: THREE.Vector3[] = [];
  const seg1 = Math.max(4, Math.round(samples * 0.5));
  for (let i = 0; i <= seg1; i++) {
    const t = i / seg1;
    path.push(latLonToVec3(THREE.MathUtils.lerp(start.lat, end.lat, t), start.lon, MARKER_RADIUS));
  }
  let dLon = end.lon - start.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const seg2 = Math.max(4, Math.round(samples * 0.5));
  for (let i = 1; i <= seg2; i++) {
    const t = i / seg2;
    path.push(latLonToVec3(end.lat, start.lon + dLon * t, MARKER_RADIUS));
  }
  return path;
}
function makeCrossTexture() {
  const size = 64; const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#ffffff'; g.lineWidth = 2.5;
  const mid = size / 2, arm = size * 0.32;
  g.beginPath();
  g.moveTo(mid - arm, mid); g.lineTo(mid + arm, mid);
  g.moveTo(mid, mid - arm); g.lineTo(mid, mid + arm);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  return tex;
}
function cubicBezier(c1x: number, c1y: number, c2x: number, c2y: number) {
  const cx = (t: number) => 3 * (1 - t) * (1 - t) * t * c1x + 3 * (1 - t) * t * t * c2x + t * t * t;
  const cy = (t: number) => 3 * (1 - t) * (1 - t) * t * c1y + 3 * (1 - t) * t * t * c2y + t * t * t;
  return (u: number) => {
    if (u <= 0) return 0; if (u >= 1) return 1;
    let t = u;
    for (let i = 0; i < 6; i++) {
      const x = cx(t);
      const dx = 3 * (1 - t) * (1 - t) * c1x + 6 * (1 - t) * t * (c2x - c1x) + 3 * t * t * (1 - c2x);
      if (Math.abs(dx) < 1e-6) break;
      t -= (x - u) / dx;
      if (t < 0) t = 0; if (t > 1) t = 1;
    }
    return cy(t);
  };
}
function springEase(visualDuration: number, bounce: number) {
  const dur = Math.max(0.05, visualDuration);
  const b = Math.min(0.99, Math.max(0, bounce));
  const zeta = Math.max(0.05, 1 - b);
  const omega = (2 * Math.PI) / dur;
  return (u: number) => {
    if (u <= 0) return 0; if (u >= 1) return 1;
    const t = u * dur;
    let x: number;
    if (zeta >= 1) x = 1 - (1 + omega * t) * Math.exp(-omega * t);
    else {
      const root = Math.sqrt(1 - zeta * zeta);
      const omegaD = omega * root;
      const env = Math.exp(-zeta * omega * t);
      x = 1 - env * (Math.cos(omegaD * t) + (zeta / root) * Math.sin(omegaD * t));
    }
    return Math.min(1, Math.max(0, x));
  };
}
function makeEaseFn(cfg: any): (u: number) => number {
  if (!cfg) return (u) => u;
  if (cfg.type === 'easing' && cfg.ease) return cubicBezier(cfg.ease[0], cfg.ease[1], cfg.ease[2], cfg.ease[3]);
  if (cfg.type === 'spring') return springEase(cfg.visualDuration ?? 0.5, cfg.bounce ?? 0);
  return (u) => u;
}

(function () {
  const wrapper = document.querySelector('[data-webgl-experiment="globe-1"]');
  if (!wrapper) return;
  const canvasMaybe = wrapper.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvasMaybe) return;
  const canvas: HTMLCanvasElement = canvasMaybe;

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .globe-1-label-root {
      display: inline-block;
      position: relative; pointer-events: none;
      transform: translateY(${BP.labelOffsetY as number}px);
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: ${BP.labelSize as number}px; letter-spacing: 0.12em; text-transform: uppercase;
      color: ${BP.labelColor as string}; white-space: nowrap;
      transition: opacity 200ms ease, color 240ms ease;
      text-align: center; line-height: 1;
    }
    .globe-1-label-root.is-flash { color: #fff; text-shadow: 0 0 12px rgba(255,255,255,0.75); }
  `;
  document.head.appendChild(styleEl);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(BP.bgColor as string, 1);

  const labelRenderer = new CSS2DRenderer();
  Object.assign(labelRenderer.domElement.style, {
    position: 'absolute', top: '0', left: '0',
    width: '100%', height: '100%',
    pointerEvents: 'none', userSelect: 'none',
  });
  (canvas.parentElement ?? document.body).appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(BP.fov as number, 1, 0.01, 20);
  camera.position.set(0, 0, 4.5 / Math.max(0.01, BP.zoom as number));

  const world = new THREE.Group();
  scene.add(world);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS * 0.998, 64, 32),
    new THREE.MeshBasicMaterial({ color: BP.bgColor as string, transparent: true, opacity: 0.92 }),
  );
  world.add(halo);

  const lonSeg = Math.max(3, Math.round(BP.lonSegments as number));
  const latSeg = Math.max(2, Math.round(BP.latSegments as number));
  const lineGeom = new THREE.BufferGeometry();
  lineGeom.setAttribute('position', new THREE.BufferAttribute(buildGridPositions(lonSeg, latSeg), 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: BP.lineColor as string, transparent: true, opacity: BP.lineOpacity as number,
  });
  const wireframe = new THREE.LineSegments(lineGeom, lineMat);
  wireframe.visible = (BP.showLines as boolean) !== false;
  world.add(wireframe);

  // Markers
  const crossTex = makeCrossTexture();
  let countryList: Country[] = DEFAULT_COUNTRIES;
  try {
    const parsed = JSON.parse(BP.countriesJson as string);
    if (Array.isArray(parsed)) countryList = parsed;
  } catch { /* fallback */ }
  const snapMode = (BP.snapMode as SnapMode) ?? 'nearest line';
  const snapped = countryList.map((c) => ({
    name: c.name,
    ...snapCountry(c.lat, c.lon, lonSeg, latSeg, snapMode),
  }));

  type MarkerH = { sprite: THREE.Object3D; material: THREE.SpriteMaterial | THREE.MeshBasicMaterial; label: HTMLElement; flashUntil: number };
  const markers: MarkerH[] = [];
  const surfaceCross = !!BP.crossOnSurface;
  const planeGeom = surfaceCross ? new THREE.PlaneGeometry(1, 1) : null;
  for (const c of snapped) {
    let mat: THREE.SpriteMaterial | THREE.MeshBasicMaterial;
    let cross: THREE.Object3D;
    if (surfaceCross && planeGeom) {
      mat = new THREE.MeshBasicMaterial({ map: crossTex, color: BP.crossColor as string, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
      cross = new THREE.Mesh(planeGeom, mat);
    } else {
      mat = new THREE.SpriteMaterial({ map: crossTex, color: BP.crossColor as string, transparent: true, depthWrite: false, depthTest: false });
      cross = new THREE.Sprite(mat);
    }
    cross.scale.set(BP.crossSize as number, BP.crossSize as number, 1);
    const pos = latLonToVec3(c.lat, c.lon, MARKER_RADIUS);
    cross.position.copy(pos);
    if (surfaceCross) cross.lookAt(0, 0, 0);
    // Wrap the styled span so CSS2DRenderer's per-frame inline
    // transform doesn't clobber our labelOffsetY translate.
    const wrap = document.createElement('div');
    wrap.style.pointerEvents = 'none';
    const div = document.createElement('span');
    div.className = 'globe-1-label-root';
    div.textContent = c.name;
    div.style.color = BP.labelColor as string;
    if ((BP.showLabels as boolean) === false) div.style.display = 'none';
    wrap.appendChild(div);
    const lo = new CSS2DObject(wrap);
    lo.position.copy(pos);
    if ((BP.showCountries as boolean) !== false) {
      world.add(cross); world.add(lo);
    }
    markers.push({ sprite: cross, material: mat, label: div, flashUntil: 0 });
  }

  // Snake (Line2)
  const trailN = Math.max(4, Math.round(BP.snakeTrailLength as number));
  let scratch = new Float32Array(trailN * 3);
  const lineGeom2 = new LineGeometry();
  lineGeom2.setPositions(scratch);
  const lineMat2 = new LineMaterial({
    color: new THREE.Color(BP.accentColor as string).getHex(),
    linewidth: BP.snakeWidth as number,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexColors: true,
    dashed: false,
  });
  lineMat2.blending = THREE.AdditiveBlending;
  lineMat2.resolution.set(window.innerWidth, window.innerHeight);
  const trailLine = new Line2(lineGeom2, lineMat2);
  trailLine.frustumCulled = false;
  trailLine.visible = false;
  trailLine.renderOrder = 5;
  world.add(trailLine);

  let snake: { sIdx: number; eIdx: number; path: THREE.Vector3[]; cum: number[]; total: number; startedAt: number; flashed: boolean } | null = null;
  let scheduledAt: number | null = null;

  // Drag + auto-spin state
  let dragging = false; let lastX = 0, lastY = 0;
  let yawOff = 0, pitchOff = 0, yawVel = 0, pitchVel = 0;
  let autoYaw = 0, autoPitch = 0;

  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY; yawVel = pitchVel = 0;
    canvas.setPointerCapture?.(e.pointerId); canvas.style.cursor = 'grabbing';
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    const sens = (BP.dragSensitivity as number) * 0.005;
    yawOff += dx * sens; pitchOff += dy * sens;
    pitchOff = THREE.MathUtils.clamp(pitchOff, -Math.PI * 0.55, Math.PI * 0.55);
  });
  const endDrag = () => { dragging = false; canvas.style.cursor = 'grab'; };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // Resize
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    renderer.setPixelRatio(dpr);
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
    labelRenderer.setSize(rect.width, rect.height);
    lineMat2.resolution.set(rect.width * dpr, rect.height * dpr);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // Visibility
  const _wp = new THREE.Vector3();
  function updateVisibility() {
    camera.updateMatrixWorld();
    const mInv = camera.matrixWorldInverse;
    const center = new THREE.Vector3(0, 0, 0).applyMatrix4(mInv).z;
    for (const m of markers) {
      m.sprite.getWorldPosition(_wp);
      const z = _wp.applyMatrix4(mInv).z;
      const limb = (z - center) / GLOBE_RADIUS;
      const op = THREE.MathUtils.smoothstep(limb, 0.05, 0.35);
      m.material.opacity = op;
      m.label.style.opacity = String(op);
      m.sprite.visible = op > 0.02;
    }
  }
  function sampleAt(d: number, s: NonNullable<typeof snake>) {
    if (d <= 0) return s.path[0];
    if (d >= s.cum[s.cum.length - 1]) return s.path[s.path.length - 1];
    let lo = 0, hi = s.cum.length - 1;
    while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (s.cum[mid] <= d) lo = mid; else hi = mid; }
    const span = s.cum[hi] - s.cum[lo] || 1;
    const t = (d - s.cum[lo]) / span;
    return new THREE.Vector3().lerpVectors(s.path[lo], s.path[hi], t);
  }

  const ease = makeEaseFn(BP.snakeEase);

  let lastTime = performance.now();
  let acc = 0;
  let scheduledOnce = false;

  function frame() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now; acc += dt;

    // Auto spin
    const spinPaused = (BP.pauseSpinOnDrag as boolean) !== false && dragging;
    if ((BP.autoSpin as boolean) && !spinPaused) {
      const speed = BP.autoSpinSpeed as number;
      const axis = BP.autoSpinAxis as string;
      if (axis === 'X (pitch)') autoPitch += speed * dt;
      else if (axis === 'Both') { autoYaw += speed * dt; autoPitch += speed * dt * 0.4; }
      else autoYaw += speed * dt;
    }

    // Drag spring
    if (!dragging) {
      const sp = BP.dragSpring as { stiffness?: number; damping?: number; mass?: number };
      const stiffness = sp.stiffness ?? 110;
      const damping = sp.damping ?? 18;
      const mass = Math.max(0.05, sp.mass ?? 1);
      const steps = 4; const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const aYaw = (-stiffness * yawOff - damping * yawVel) / mass;
        const aPitch = (-stiffness * pitchOff - damping * pitchVel) / mass;
        yawVel += aYaw * h; pitchVel += aPitch * h;
        yawOff += yawVel * h; pitchOff += pitchVel * h;
      }
    }

    const basePitch = THREE.MathUtils.degToRad(BP.basePitchDeg as number);
    const baseYaw = THREE.MathUtils.degToRad(BP.baseYawDeg as number);
    world.rotation.set(basePitch + pitchOff + autoPitch, baseYaw + yawOff + autoYaw, 0);

    // Snake
    if ((BP.showSnake as boolean) !== false) {
      if (!snake && !scheduledOnce) {
        scheduledAt = acc + (BP.snakeIntervalMin as number) + Math.random() * Math.max(0, (BP.snakeIntervalMax as number) - (BP.snakeIntervalMin as number));
        scheduledOnce = true;
      }
      if (!snake && scheduledAt !== null && acc >= scheduledAt && snapped.length >= 2) {
        scheduledAt = null;
        let s = Math.floor(Math.random() * snapped.length);
        let e = Math.floor(Math.random() * snapped.length);
        if (e === s) e = (e + 1) % snapped.length;
        const path = buildSnakePath(snapped[s], snapped[e]);
        const cum = [0]; let total = 0;
        for (let i = 1; i < path.length; i++) { total += path[i].distanceTo(path[i - 1]); cum.push(total); }
        snake = { sIdx: s, eIdx: e, path, cum, total, startedAt: acc, flashed: false };
        trailLine.visible = true;
      }
      if (snake) {
        const speed = BP.snakeSpeed as number;
        const journey = snake.total / Math.max(0.01, speed);
        const elapsed = acc - snake.startedAt;
        const trailLen = Math.max(0.04, speed * 0.4);

        let headDist: number;
        if (elapsed < journey) headDist = ease(elapsed / journey) * snake.total;
        else headDist = snake.total;

        let tailDist: number;
        if (elapsed < journey) tailDist = Math.max(0, headDist - trailLen);
        else {
          const tAfter = elapsed - journey;
          tailDist = Math.min(snake.total, (snake.total - trailLen) + tAfter * speed);
        }

        const N = trailN;
        const colors = new Float32Array(N * 3);
        const baseCol = new THREE.Color(BP.accentColor as string);
        const intensity = BP.snakeIntensity as number;
        for (let i = 0; i < N; i++) {
          const tt = i / (N - 1);
          const d = THREE.MathUtils.lerp(tailDist, headDist, tt);
          const p = sampleAt(d, snake);
          scratch[i * 3 + 0] = p.x; scratch[i * 3 + 1] = p.y; scratch[i * 3 + 2] = p.z;
          const a = Math.pow(tt, 1.4);
          colors[i * 3 + 0] = baseCol.r * intensity * (0.25 + 1.5 * a);
          colors[i * 3 + 1] = baseCol.g * intensity * (0.25 + 1.5 * a);
          colors[i * 3 + 2] = baseCol.b * intensity * (0.25 + 1.5 * a);
        }
        lineGeom2.setPositions(scratch);
        lineGeom2.setColors(colors);
        trailLine.computeLineDistances();
        if (!snake.flashed && headDist >= snake.total - 1e-4) {
          snake.flashed = true;
          const m = markers[snake.eIdx];
          if (m) { m.flashUntil = acc + (BP.snakeFlashDuration as number); m.label.classList.add('is-flash'); }
        }
        if (tailDist >= snake.total - 1e-4) {
          snake = null; trailLine.visible = false;
          scheduledAt = acc + (BP.snakeIntervalMin as number) + Math.random() * Math.max(0, (BP.snakeIntervalMax as number) - (BP.snakeIntervalMin as number));
        }
      }
    }

    // Flash decay
    for (const m of markers) {
      if (m.flashUntil <= 0) continue;
      const remaining = m.flashUntil - acc;
      const dur = BP.snakeFlashDuration as number;
      if (remaining <= 0) {
        m.flashUntil = 0;
        m.material.color.set(BP.crossColor as string);
        m.label.classList.remove('is-flash');
      } else {
        const t = remaining / dur;
        m.material.color.copy(new THREE.Color(BP.crossColor as string).lerp(new THREE.Color(BP.accentColor as string), t));
      }
    }

    updateVisibility();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
