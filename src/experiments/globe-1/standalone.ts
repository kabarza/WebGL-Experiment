// ============================================================
// Globe 1 — Standalone IIFE entry for Webflow export
// Uses shared modules with the gallery experiment so behavior
// stays in lockstep. Adds the embed-side concerns: multi-instance
// per page, zero-size guard, IntersectionObserver pause when
// off-screen, and prefers-reduced-motion.
// ============================================================

import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import {
  GLOBE_RADIUS,
  buildGridPolylines,
  makeCrossTexture,
  makeEaseFn,
  parseCountries,
  prefersReducedMotion,
  snapCountry,
  type SpringValue,
  type TransitionValue,
} from './helpers.ts';
import { CountryMarker, ensureLabelStyles } from './marker.ts';
import { SnakeController } from './snake.ts';
import { SnakeIcon } from './snake-icon.ts';
import { createScrollPitchTracker } from './scroll-pitch.ts';
import { controls, DEFAULT_COUNTRIES, type Country, type SnapMode } from './params.ts';

declare const __BAKED_PARAMS__: Record<string, unknown>;

// Single source of truth: defaults come from params.ts, baked params
// (set at build time via --params) override per-deploy, and a runtime
// `window.__GLOBE_1_CONFIG__` gives the Webflow JSON export a way to
// override params at the page level without rebuilding the bundle.
const FALLBACK: Record<string, unknown> = { ...controls.defaults };

const RUNTIME_OVERRIDES: Record<string, unknown> =
  typeof window !== 'undefined' &&
  (window as unknown as { __GLOBE_1_CONFIG__?: Record<string, unknown> })
    .__GLOBE_1_CONFIG__
    ? { ...((window as unknown as { __GLOBE_1_CONFIG__: Record<string, unknown> }).__GLOBE_1_CONFIG__) }
    : {};

const BP: Record<string, unknown> =
  typeof __BAKED_PARAMS__ !== 'undefined'
    ? { ...FALLBACK, ...__BAKED_PARAMS__, ...RUNTIME_OVERRIDES }
    : { ...FALLBACK, ...RUNTIME_OVERRIDES };

function bootInstance(wrapper: HTMLElement) {
  const canvasMaybe = wrapper.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvasMaybe) return;
  const canvas: HTMLCanvasElement = canvasMaybe;

  const reducedMotion = prefersReducedMotion();

  ensureLabelStyles(
    BP.labelColor as string,
    BP.labelSize as number,
    BP.labelOffsetY as number,
  );

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(BP.bgColor as string, 1);

  const labelRenderer = new CSS2DRenderer();
  Object.assign(labelRenderer.domElement.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    userSelect: 'none',
  });
  wrapper.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(BP.fov as number, 1, 0.01, 20);
  camera.position.set(0, 0, 4.5 / Math.max(0.01, BP.zoom as number));

  const world = new THREE.Group();
  scene.add(world);

  // Halo (opaque so back-side wireframe lines are properly occluded).
  const haloGeom = new THREE.SphereGeometry(GLOBE_RADIUS * 0.998, 64, 32);
  const haloMat = new THREE.MeshBasicMaterial({ color: BP.bgColor as string });
  const halo = new THREE.Mesh(haloGeom, haloMat);
  world.add(halo);

  // Wireframe — same Line2-per-polyline approach as the gallery.
  const lineMat = new LineMaterial({
    color: new THREE.Color(BP.lineColor as string).getHex(),
    linewidth: (BP.lineWidth as number) ?? 2,
    transparent: false,
    worldUnits: false,
    depthTest: true,
    depthWrite: true,
    dashed: false,
    alphaToCoverage: true,
  });
  // Disable LineMaterial's round end-caps. Each polyline segment is
  // drawn as a screen-space quad with rounded caps at both ends; at
  // every internal vertex of a polyline, two consecutive caps overlap
  // and form a small visible "dot". For full-circle wireframe arcs we
  // don't need endpoint caps either — discarding the cap region kills
  // the artifact cleanly.
  lineMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      /\bvoid main\(\)\s*\{/,
      'void main() {\n  if (abs(vUv.y) > 1.0) discard;',
    );
  };
  // Set immediately to a sane value; the real resize() updates it.
  lineMat.resolution.set(window.innerWidth, window.innerHeight);

  const wireframe = new THREE.Group();
  const wireframeLines: Line2[] = [];
  world.add(wireframe);
  const lonSeg = Math.max(3, Math.round(BP.lonSegments as number));
  const latSeg = Math.max(2, Math.round(BP.latSegments as number));
  const polylines = buildGridPolylines(lonSeg, latSeg);
  for (const pts of polylines) {
    const geom = new LineGeometry();
    geom.setPositions(Array.from(pts));
    const line = new Line2(geom, lineMat);
    line.frustumCulled = false;
    wireframe.add(line);
    wireframeLines.push(line);
  }
  wireframe.visible = (BP.showLines as boolean) !== false;

  // Bake lineOpacity into the line color (material is opaque to
  // avoid bright dots at crossings — see gallery experiment.ts).
  {
    const baseLineCol = new THREE.Color(BP.lineColor as string);
    const lineOp = THREE.MathUtils.clamp(BP.lineOpacity as number, 0, 1);
    lineMat.color.setRGB(
      baseLineCol.r * lineOp,
      baseLineCol.g * lineOp,
      baseLineCol.b * lineOp,
    );
  }

  // Markers
  const crossTex = makeCrossTexture();
  let countryList: Country[] = parseCountries(
    BP.countriesJson as string,
    DEFAULT_COUNTRIES,
  );
  const snapMode = (BP.snapMode as SnapMode) ?? 'nearest line';
  const snappedCountries = countryList.map((c) => ({
    name: c.name,
    ...snapCountry(c.lat, c.lon, lonSeg, latSeg, snapMode),
  }));
  const surface = !!BP.crossOnSurface;
  const markers: CountryMarker[] = [];
  const showCountries = (BP.showCountries as boolean) !== false;
  const showLabelsBp = (BP.showLabels as boolean) !== false;
  for (const c of snappedCountries) {
    const m = new CountryMarker(c, crossTex, surface);
    m.setPosition(c.lat, c.lon);
    m.setColors(BP.crossColor as string, BP.labelColor as string);
    m.setSize(BP.crossSize as number);
    m.group.visible = showCountries;
    if (!showLabelsBp) m.labelEl.style.display = 'none';
    world.add(m.group);
    markers.push(m);
  }

  // Snake
  const snake = new SnakeController(
    Math.max(4, Math.round((BP.snakeTrailDetail as number) ?? 31)),
    BP.accentColor as string,
  );
  snake.setWidth(BP.snakeWidth as number);
  world.add(snake.line);

  // Snake head icon
  const snakeIcon = new SnakeIcon();
  snakeIcon.setColor(BP.snakeIconColor as string);
  snakeIcon.setSize(BP.snakeIconSize as number);
  snakeIcon.setRotationOffset(BP.snakeIconRotationOffset as number);
  snakeIcon.setVisible(false);
  world.add(snakeIcon.obj);

  // ── Drag interaction (pointer-id scoped, not window-global, so
  //    multiple embeds on one page don't cross-fire) ──
  let isDragging = false;
  let activePointerId: number | null = null;
  const lastPointer = { x: 0, y: 0 };
  let yawOffset = 0;
  let pitchOffset = 0;
  let yawVel = 0;
  let pitchVel = 0;
  let autoYaw = 0;
  let autoPitch = 0;

  const onPointerDown = (e: PointerEvent) => {
    isDragging = true;
    activePointerId = e.pointerId;
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    yawVel = 0;
    pitchVel = 0;
    canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = 'grabbing';
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging || e.pointerId !== activePointerId) return;
    const dx = e.clientX - lastPointer.x;
    const dy = e.clientY - lastPointer.y;
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    const sens = (BP.dragSensitivity as number) * 0.005;
    yawOffset += dx * sens;
    pitchOffset += dy * sens;
    pitchOffset = THREE.MathUtils.clamp(pitchOffset, -Math.PI * 0.55, Math.PI * 0.55);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    isDragging = false;
    activePointerId = null;
    canvas.style.cursor = 'grab';
    try {
      canvas.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  canvas.style.cursor = 'grab';
  // Listeners on the canvas so multi-instance pages don't cross-fire.
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  // Scroll-pitch tracker
  const scrollTracker = createScrollPitchTracker(wrapper);

  // Resize (zero-size guarded)
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    renderer.setPixelRatio(dpr);
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
    labelRenderer.setSize(rect.width, rect.height);
    lineMat.resolution.set(rect.width * dpr, rect.height * dpr);
    snake.setResolution(rect.width * dpr, rect.height * dpr);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // IntersectionObserver — when wrapper is off-screen, stop running
  // the heavy frame body. RAF still loops (cheap); we just early-out.
  let inView = true;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) inView = entry.isIntersecting;
    },
    { rootMargin: '100px', threshold: 0 },
  );
  io.observe(wrapper);

  // Visibility scratch vectors
  const _wp = new THREE.Vector3();
  const _iconHead = new THREE.Vector3();
  const _iconTangent = new THREE.Vector3();
  const _iconHeadWorld = new THREE.Vector3();
  const _iconTipWorld = new THREE.Vector3();
  const _iconHeadNDC = new THREE.Vector3();
  const _iconTipNDC = new THREE.Vector3();
  const _iconHeadView = new THREE.Vector3();
  const _iconCenterView = new THREE.Vector3();
  const _centerScratch = new THREE.Vector3();
  function updateMarkerVisibility() {
    camera.updateMatrixWorld();
    const mInv = camera.matrixWorldInverse;
    const centerZ = _centerScratch.set(0, 0, 0).applyMatrix4(mInv).z;
    for (const m of markers) {
      m.getSpriteWorldPos(_wp);
      const z = _wp.applyMatrix4(mInv).z;
      const limb = (z - centerZ) / GLOBE_RADIUS;
      const op = THREE.MathUtils.smoothstep(limb, 0.05, 0.35);
      m.setOpacity(op);
      m.setVisible(op > 0.02);
      m.setLabelVisible(op > 0.05);
    }
  }

  const ease = makeEaseFn(BP.snakeEase as TransitionValue);

  // Render loop — `time` in seconds (matching gallery convention).
  let lastTime = -1;
  let scheduledOnce = false;
  let prunedAt = 0;
  let rafId = 0;

  function frame(now: number) {
    rafId = requestAnimationFrame(frame);
    if (!inView) return;
    if (renderer.domElement.width < 1 || renderer.domElement.height < 1) return;

    const time = now / 1000;
    const dt = lastTime < 0 ? 1 / 60 : Math.min(time - lastTime, 0.1);
    lastTime = time;

    // Auto spin (suppressed under reduced motion).
    const spinPaused = (BP.pauseSpinOnDrag as boolean) !== false && isDragging;
    if (!reducedMotion && (BP.autoSpin as boolean) && !spinPaused) {
      const speed = BP.autoSpinSpeed as number;
      const axis = BP.autoSpinAxis as string;
      if (axis === 'X (pitch)') autoPitch += speed * dt;
      else if (axis === 'Both') {
        autoYaw += speed * dt;
        autoPitch += speed * dt * 0.4;
      } else autoYaw += speed * dt;
    }

    // Drag spring
    if (!isDragging) {
      const sp = (BP.dragSpring as unknown as SpringValue) ?? { type: 'spring' };
      const stiffness = sp.stiffness ?? 110;
      const damping = sp.damping ?? 18;
      const mass = Math.max(0.05, sp.mass ?? 1);
      const steps = 4;
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const aYaw = (-stiffness * yawOffset - damping * yawVel) / mass;
        const aPitch = (-stiffness * pitchOffset - damping * pitchVel) / mass;
        yawVel += aYaw * h;
        pitchVel += aPitch * h;
        yawOffset += yawVel * h;
        pitchOffset += pitchVel * h;
      }
    }

    // Scroll-pitch tracker
    scrollTracker.update(dt, {
      enabled: (BP.scrollPitchEnabled as boolean) === true,
      rangeDeg: (BP.scrollPitchRangeDeg as number) ?? 30,
      smoothing: (BP.scrollPitchSmoothing as number) ?? 8,
    });

    const basePitch = THREE.MathUtils.degToRad(BP.basePitchDeg as number);
    const baseYaw = THREE.MathUtils.degToRad(BP.baseYawDeg as number);
    world.rotation.set(
      basePitch + pitchOffset + autoPitch + scrollTracker.currentPitch,
      baseYaw + yawOffset + autoYaw,
      0,
    );

    // Snake
    if ((BP.showSnake as boolean) !== false) {
      if (!snake.active) {
        if (!scheduledOnce) {
          snake.schedule(
            time,
            BP.snakeIntervalMin as number,
            BP.snakeIntervalMax as number,
          );
          scheduledOnce = true;
        } else if (snake.scheduled !== null && time >= snake.scheduled) {
          snake.scheduled = null;
          snake.begin(time, snappedCountries);
        }
      }
      const continuous = (BP.snakeContinuous as boolean) === true;
      const arrived = snake.update(
        time,
        dt,
        BP.snakeSpeed as number,
        BP.snakeIntensity as number,
        ease,
        {
          continuous,
          pauseMin: BP.snakeIntervalMin as number,
          pauseMax: BP.snakeIntervalMax as number,
          countries: snappedCountries,
          trailMin: BP.snakeTrailMin as number,
          trailLength: BP.snakeTrailLength as number,
          trailFollow: BP.snakeTrailFollow as number,
          legMinDuration: (BP.snakeLegMinDuration as number) ?? 0,
        },
      );
      if (arrived >= 0 && arrived < markers.length) {
        markers[arrived].flash(time, BP.snakeFlashDuration as number);
        if (!continuous) {
          snake.schedule(
            time,
            BP.snakeIntervalMin as number,
            BP.snakeIntervalMax as number,
          );
        }
      }
      if (time - prunedAt > 30) {
        snake.prunePath();
        prunedAt = time;
      }
    }

    // Marker flash decay
    let anyFlashing = false;
    for (const m of markers) {
      if (m.flashUntil > 0) { anyFlashing = true; break; }
    }
    if (anyFlashing) {
      const flashDur = BP.snakeFlashDuration as number;
      for (const m of markers) {
        m.updateFlash(time, flashDur, BP.crossColor as string, BP.accentColor as string);
      }
    }

    camera.updateMatrixWorld();
    world.updateMatrixWorld();
    updateMarkerVisibility();

    // Snake head icon
    const showIcon =
      (BP.showSnake as boolean) !== false &&
      (BP.showSnakeIcon as boolean) !== false &&
      !!snake.active;
    if (showIcon && snake.active) {
      const ok = snake.sampleHeadAndTangent(_iconHead, _iconTangent);
      if (ok) {
        snakeIcon.setLocalPosition(_iconHead);

        _iconHeadWorld.copy(_iconHead).applyMatrix4(world.matrixWorld);
        _iconTipWorld.copy(_iconHead).add(_iconTangent).applyMatrix4(world.matrixWorld);
        _iconHeadNDC.copy(_iconHeadWorld).project(camera);
        _iconTipNDC.copy(_iconTipWorld).project(camera);
        const dx = _iconTipNDC.x - _iconHeadNDC.x;
        const dy = _iconTipNDC.y - _iconHeadNDC.y;
        if (Math.hypot(dx, dy) > 1e-5) {
          snakeIcon.setHeading(Math.atan2(dx, dy) * 180 / Math.PI);
        }

        _iconHeadView.copy(_iconHeadWorld).applyMatrix4(camera.matrixWorldInverse);
        _iconCenterView.set(0, 0, 0)
          .applyMatrix4(world.matrixWorld)
          .applyMatrix4(camera.matrixWorldInverse);
        const limb = (_iconHeadView.z - _iconCenterView.z) / GLOBE_RADIUS;
        const op = THREE.MathUtils.smoothstep(limb, 0.05, 0.35) *
          (BP.snakeIconOpacity as number);
        snakeIcon.setOpacity(op);
        snakeIcon.setVisible(op > 0.02);
      } else {
        snakeIcon.setVisible(false);
      }
    } else {
      snakeIcon.setVisible(false);
    }

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  rafId = requestAnimationFrame(frame);

  // Tear-down hook (not exposed to consumers, but useful if Webflow
  // ever calls it via a custom data attribute).
  (wrapper as HTMLElement & { __dispose?: () => void }).__dispose = () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    io.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    scrollTracker.dispose();
    for (const m of markers) m.dispose();
    snakeIcon.dispose();
    snake.dispose();
    for (const line of wireframeLines) line.geometry.dispose();
    lineMat.dispose();
    haloGeom.dispose();
    haloMat.dispose();
    crossTex.dispose();
    if (labelRenderer.domElement.parentElement) {
      labelRenderer.domElement.parentElement.removeChild(labelRenderer.domElement);
    }
    renderer.dispose();
  };
}

(function () {
  // Multi-instance discovery. Two supported wrapper patterns:
  //   1) <div data-webgl-experiment="globe-1"><canvas/></div>
  //      (HTML Embed tab — manual pastes use this attribute on the wrapper)
  //   2) <div class="globe-1"><canvas data-flow-globe-1/></div>
  //      (Webflow JSON tab — generated JSON puts the marker attribute
  //       on the canvas, with the wrapper class matching the slug)
  // De-dupe so a wrapper that matches both isn't booted twice.
  const wrappers = new Set<HTMLElement>();
  document
    .querySelectorAll<HTMLElement>('[data-webgl-experiment="globe-1"]')
    .forEach((el) => wrappers.add(el));
  document
    .querySelectorAll<HTMLCanvasElement>('canvas[data-flow-globe-1]')
    .forEach((c) => {
      if (c.parentElement) wrappers.add(c.parentElement);
    });
  for (const wrapper of wrappers) {
    bootInstance(wrapper);
  }
})();
