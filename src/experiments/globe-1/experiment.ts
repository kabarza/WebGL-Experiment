// ============================================================
// Globe 1 — Three.js wireframe globe with snake network animation
// Thin entry point: composes helpers + marker + snake + icon +
// inline editor + scroll-pitch tracker, runs the per-frame loop.
// ============================================================

import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type {
  Experiment,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { meta } from './meta.ts';
import { controls, DEFAULT_COUNTRIES, type Country, type SnapMode } from './params.ts';
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
import { mountInlineCountriesEditor } from './inline-editor.ts';
import { createScrollPitchTracker } from './scroll-pitch.ts';

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { canvas, params } = ctx;
  const reducedMotion = prefersReducedMotion();

  ensureLabelStyles(
    (params.labelColor as string) ?? '#cfcfcf',
    (params.labelSize as number) ?? 11,
    (params.labelOffsetY as number) ?? 14,
  );

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.autoClear = true;
  renderer.setClearColor('#000000', 1);

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
  const overlayParent = canvas.parentElement ?? document.body;
  overlayParent.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 20);
  camera.position.set(0, 0, 4.5);

  const world = new THREE.Group();
  scene.add(world);

  // Solid black halo (just inside the wireframe). Opaque so back-side
  // grid lines are properly occluded by the depth pass — that's what
  // prevented the bright dots at grid crossings.
  const haloGeom = new THREE.SphereGeometry(GLOBE_RADIUS * 0.998, 64, 32);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const halo = new THREE.Mesh(haloGeom, haloMat);
  world.add(halo);

  // Wireframe — one Line2 per meridian / parallel, all sharing one
  // LineMaterial. Two reasons for this layout:
  //   1) THREE.LineBasicMaterial's `linewidth` is silently ignored in
  //      WebGL (always 1px), so we use LineMaterial which draws thick
  //      lines as screen-space quads through a shader.
  //   2) LineMaterial only joins consecutive vertices smoothly within
  //      one Line2. If we put every grid line into a single LineSegments2
  //      the 64 sub-divisions per arc each get their own end-caps and
  //      show up as visible dots — so each arc has to be its own
  //      continuous polyline.
  // Material is opaque + alphaToCoverage: semi-transparent lines
  // double-blend at crossings, leaving a brighter dot. Going opaque
  // lets the dimness come from the COLOR, so a crossing is just the
  // same pixel written twice — no brightening.
  const lineMat = new LineMaterial({
    color: new THREE.Color('#5a5a52').getHex(),
    linewidth: 2,
    transparent: false,
    worldUnits: false,
    depthTest: true,
    depthWrite: true,
    dashed: false,
    alphaToCoverage: true,
  });
  lineMat.resolution.set(window.innerWidth, window.innerHeight);

  const wireframe = new THREE.Group();
  const wireframeLines: Line2[] = [];
  world.add(wireframe);

  let currentLonSeg = -1;
  let currentLatSeg = -1;
  function rebuildGrid(lonSeg: number, latSeg: number) {
    if (lonSeg === currentLonSeg && latSeg === currentLatSeg) return;
    currentLonSeg = lonSeg;
    currentLatSeg = latSeg;
    for (const line of wireframeLines) {
      wireframe.remove(line);
      line.geometry.dispose();
    }
    wireframeLines.length = 0;
    const polylines = buildGridPolylines(lonSeg, latSeg);
    for (const pts of polylines) {
      const geom = new LineGeometry();
      geom.setPositions(Array.from(pts));
      const line = new Line2(geom, lineMat);
      line.frustumCulled = false;
      wireframe.add(line);
      wireframeLines.push(line);
    }
  }

  // Markers
  const crossTex = makeCrossTexture();
  let countryList: Country[] = parseCountries(
    params.countriesJson as string,
    DEFAULT_COUNTRIES,
  );
  let snappedCountries: Country[] = countryList;
  const markers: CountryMarker[] = [];
  let lastSnapMode: SnapMode | '' = '';
  let lastCountriesJson = params.countriesJson as string;
  let lastSurface = !!params.crossOnSurface;

  function rebuildMarkers() {
    for (const m of markers) {
      world.remove(m.group);
      m.dispose();
    }
    markers.length = 0;
    const lonSeg = Math.max(3, Math.round(params.lonSegments as number));
    const latSeg = Math.max(2, Math.round(params.latSegments as number));
    const mode = (params.snapMode as SnapMode) ?? 'nearest line';
    const surface = !!params.crossOnSurface;
    lastSurface = surface;
    snappedCountries = countryList.map((c) => ({
      name: c.name,
      ...snapCountry(c.lat, c.lon, lonSeg, latSeg, mode),
    }));
    for (const c of snappedCountries) {
      const m = new CountryMarker(c, crossTex, surface);
      m.setPosition(c.lat, c.lon);
      m.setColors(params.crossColor as string, params.labelColor as string);
      m.setSize(params.crossSize as number);
      world.add(m.group);
      markers.push(m);
    }
  }

  // Snake
  const snake = new SnakeController(
    params.snakeTrailDetail as number,
    params.accentColor as string,
  );
  world.add(snake.line);

  // Snake head icon
  const snakeIcon = new SnakeIcon();
  snakeIcon.setColor(params.snakeIconColor as string);
  snakeIcon.setSize(params.snakeIconSize as number);
  snakeIcon.setRotationOffset(params.snakeIconRotationOffset as number);
  snakeIcon.setVisible(false);
  world.add(snakeIcon.obj);

  rebuildGrid(
    Math.round(params.lonSegments as number),
    Math.round(params.latSegments as number),
  );
  rebuildMarkers();
  lastSnapMode = (params.snapMode as SnapMode) ?? 'nearest line';

  // ── Drag interaction ──
  let isDragging = false;
  const lastPointer = { x: 0, y: 0 };
  let yawOffset = 0;
  let pitchOffset = 0;
  let yawVel = 0;
  let pitchVel = 0;
  let autoYaw = 0;
  let autoPitch = 0;

  const handlePointerDown = (e: PointerEvent) => {
    isDragging = true;
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    yawVel = 0;
    pitchVel = 0;
    canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = 'grabbing';
  };
  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPointer.x;
    const dy = e.clientY - lastPointer.y;
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    const sens = (params.dragSensitivity as number) * 0.005;
    yawOffset += dx * sens;
    pitchOffset += dy * sens;
    pitchOffset = THREE.MathUtils.clamp(pitchOffset, -Math.PI * 0.55, Math.PI * 0.55);
  };
  const handlePointerUp = (e: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    canvas.style.cursor = 'grab';
    try {
      canvas.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);

  // ── Scroll-pitch tracker ──
  const scrollTracker = createScrollPitchTracker(canvas.parentElement ?? canvas);

  // ── Visibility (front/back of globe) ──
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

  // ── Resize ──
  function doResize(w: number, h: number, dpr: number) {
    const cssW = w / dpr;
    const cssH = h / dpr;
    if (cssW < 1 || cssH < 1) return; // zero-size guard (Webflow flex / hidden tabs)
    renderer.setPixelRatio(dpr);
    renderer.setSize(cssW, cssH, false);
    camera.aspect = cssW / Math.max(1, cssH);
    camera.updateProjectionMatrix();
    labelRenderer.setSize(cssW, cssH);
    snake.setResolution(cssW * dpr, cssH * dpr);
    lineMat.resolution.set(cssW * dpr, cssH * dpr);
  }

  // ── Inline DialKit-panel country editor ──
  const inlineEditor = mountInlineCountriesEditor(meta.title, DEFAULT_COUNTRIES);

  // Cached values for skip-on-equality writes.
  let lastLineColor = '';
  let lastLineOpacity = NaN;
  let lastLineWidth = NaN;
  let lastAccentColor = '';
  let lastSnakeWidth = NaN;
  let lastBgColor = '';
  let lastFov = NaN;
  let lastZoom = NaN;
  const _baseLineCol = new THREE.Color();

  // ── Render loop ──
  let lastTime = -1;
  let scheduledOnce = false;
  let prunedAt = 0;

  return {
    render(time: number) {
      // Zero-size guard for the render path itself.
      if (renderer.domElement.width < 1 || renderer.domElement.height < 1) return;

      const dt = lastTime < 0 ? 1 / 60 : Math.min(time - lastTime, 0.1);
      lastTime = time;

      // Sync grid density / snap mode / country list (rebuild on change)
      const lonSeg = Math.max(3, Math.round(params.lonSegments as number));
      const latSeg = Math.max(2, Math.round(params.latSegments as number));
      const snapMode = ((params.snapMode as SnapMode) ?? 'nearest line') as SnapMode;
      const currentJson = params.countriesJson as string;
      let needsMarkers = false;
      if (lonSeg !== currentLonSeg || latSeg !== currentLatSeg) {
        rebuildGrid(lonSeg, latSeg);
        needsMarkers = true;
      }
      if (snapMode !== lastSnapMode) {
        lastSnapMode = snapMode;
        needsMarkers = true;
      }
      if (currentJson !== lastCountriesJson) {
        lastCountriesJson = currentJson;
        countryList = parseCountries(currentJson, DEFAULT_COUNTRIES);
        needsMarkers = true;
      }
      const surface = !!params.crossOnSurface;
      if (surface !== lastSurface) needsMarkers = true;
      if (needsMarkers) rebuildMarkers();

      // Sync snake config
      const detail = Math.max(4, Math.round(params.snakeTrailDetail as number));
      if (detail !== snake.trailDetail) snake.setTrailDetail(detail);
      const accent = params.accentColor as string;
      if (accent !== lastAccentColor) {
        snake.setAccentColor(accent);
        lastAccentColor = accent;
      }
      const snakeW = params.snakeWidth as number;
      if (snakeW !== lastSnakeWidth) {
        snake.setWidth(snakeW);
        lastSnakeWidth = snakeW;
      }

      // Sync line color (lineOpacity baked into rendered color since
      // material is opaque) and width.
      const lineColor = params.lineColor as string;
      const lineOpacity = THREE.MathUtils.clamp(params.lineOpacity as number, 0, 1);
      const lineWidth = params.lineWidth as number;
      if (lineColor !== lastLineColor || lineOpacity !== lastLineOpacity) {
        _baseLineCol.set(lineColor);
        lineMat.color.setRGB(
          _baseLineCol.r * lineOpacity,
          _baseLineCol.g * lineOpacity,
          _baseLineCol.b * lineOpacity,
        );
        lastLineColor = lineColor;
        lastLineOpacity = lineOpacity;
      }
      if (lineWidth !== lastLineWidth) {
        lineMat.linewidth = lineWidth;
        lastLineWidth = lineWidth;
      }

      const cs = params.crossSize as number;
      const crossColor = params.crossColor as string;
      const labelColor = params.labelColor as string;
      for (const m of markers) {
        m.setColors(crossColor, labelColor);
        m.setSize(cs);
      }
      ensureLabelStyles(
        labelColor,
        params.labelSize as number,
        params.labelOffsetY as number,
      );

      // FOV / zoom
      const fov = params.fov as number;
      if (fov !== lastFov && Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
        lastFov = fov;
      }
      const zoom = params.zoom as number;
      if (zoom !== lastZoom) {
        camera.position.setLength(4.5 / Math.max(0.01, zoom));
        lastZoom = zoom;
      }

      // Layer toggles
      wireframe.visible = (params.showLines as boolean) !== false;
      const showCountries = (params.showCountries as boolean) !== false;
      const showLabels = (params.showLabels as boolean) !== false;
      for (const m of markers) {
        m.group.visible = showCountries;
        m.labelEl.style.display = showLabels ? '' : 'none';
      }
      const showSnake = (params.showSnake as boolean) !== false;

      // Background
      const bg = params.bgColor as string;
      if (bg !== lastBgColor) {
        renderer.setClearColor(bg, 1);
        haloMat.color.set(bg);
        lastBgColor = bg;
      }

      // Auto spin (suppressed when user prefers reduced motion).
      const spinPaused =
        (params.pauseSpinOnDrag as boolean) !== false && isDragging;
      if (
        !reducedMotion &&
        (params.autoSpin as boolean) &&
        !spinPaused
      ) {
        const speed = params.autoSpinSpeed as number;
        const axis = params.autoSpinAxis as string;
        if (axis === 'X (pitch)') autoPitch += speed * dt;
        else if (axis === 'Both') {
          autoYaw += speed * dt;
          autoPitch += speed * dt * 0.4;
        } else autoYaw += speed * dt;
      }

      // Drag spring
      if (!isDragging) {
        const sp = (params.dragSpring as unknown as SpringValue) ?? { type: 'spring' };
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
        if (
          Math.abs(yawOffset) < 1e-4 && Math.abs(pitchOffset) < 1e-4 &&
          Math.abs(yawVel) < 1e-4 && Math.abs(pitchVel) < 1e-4
        ) {
          yawOffset = pitchOffset = yawVel = pitchVel = 0;
        }
      }

      // Scroll-pitch tracker (cheap; reads cached scroll target).
      scrollTracker.update(dt, {
        enabled: (params.scrollPitchEnabled as boolean) === true,
        rangeDeg: params.scrollPitchRangeDeg as number,
        smoothing: params.scrollPitchSmoothing as number,
      });

      // Apply rotations: base + drag + auto-spin + scroll-pitch.
      const basePitch = THREE.MathUtils.degToRad(params.basePitchDeg as number);
      const baseYaw = THREE.MathUtils.degToRad(params.baseYawDeg as number);
      world.rotation.set(
        basePitch + pitchOffset + autoPitch + scrollTracker.currentPitch,
        baseYaw + yawOffset + autoYaw,
        0,
      );

      // Snake animation
      if (showSnake) {
        if (!snake.active) {
          if (!scheduledOnce) {
            snake.schedule(
              time,
              params.snakeIntervalMin as number,
              params.snakeIntervalMax as number,
            );
            scheduledOnce = true;
          } else if (snake.scheduled !== null && time >= snake.scheduled) {
            snake.scheduled = null;
            snake.begin(time, snappedCountries);
          }
        }
        const easeCfg = params.snakeEase as unknown as TransitionValue | undefined;
        const ease = makeEaseFn(easeCfg);
        const continuous = (params.snakeContinuous as boolean) === true;
        const arrived = snake.update(
          time,
          dt,
          params.snakeSpeed as number,
          params.snakeIntensity as number,
          ease,
          {
            continuous,
            pauseMin: params.snakeIntervalMin as number,
            pauseMax: params.snakeIntervalMax as number,
            countries: snappedCountries,
            trailMin: params.snakeTrailMin as number,
            trailLength: params.snakeTrailLength as number,
            trailFollow: params.snakeTrailFollow as number,
            legMinDuration: params.snakeLegMinDuration as number,
          },
        );
        if (arrived >= 0 && arrived < markers.length) {
          markers[arrived].flash(time, params.snakeFlashDuration as number);
          if (!continuous) {
            snake.schedule(
              time,
              params.snakeIntervalMin as number,
              params.snakeIntervalMax as number,
            );
          }
        }
        // Periodically prune the path so a long-running continuous
        // session doesn't grow unbounded memory.
        if (time - prunedAt > 30) {
          snake.prunePath();
          prunedAt = time;
        }
      } else {
        snake.active = null;
        snake.line.visible = false;
      }

      // Marker flash decay — short-circuit when no markers are flashing.
      let anyFlashing = false;
      for (const m of markers) {
        if (m.flashUntil > 0) { anyFlashing = true; break; }
      }
      if (anyFlashing) {
        const flashDur = params.snakeFlashDuration as number;
        for (const m of markers) {
          m.updateFlash(time, flashDur, crossColor, accent);
        }
      }

      camera.updateMatrixWorld();
      world.updateMatrixWorld();
      updateMarkerVisibility();

      // Snake head icon
      const showIcon =
        showSnake &&
        (params.showSnakeIcon as boolean) !== false &&
        !!snake.active;
      if (showIcon && snake.active) {
        snakeIcon.setColor(params.snakeIconColor as string);
        snakeIcon.setSize(params.snakeIconSize as number);
        snakeIcon.setRotationOffset(params.snakeIconRotationOffset as number);

        const ok = snake.sampleHeadAndTangent(_iconHead, _iconTangent);
        if (ok) {
          snakeIcon.setLocalPosition(_iconHead);

          _iconHeadWorld.copy(_iconHead).applyMatrix4(world.matrixWorld);
          _iconTipWorld.copy(_iconHead).add(_iconTangent).applyMatrix4(world.matrixWorld);
          // .project() mutates in place — no .clone() needed.
          _iconHeadNDC.copy(_iconHeadWorld).project(camera);
          _iconTipNDC.copy(_iconTipWorld).project(camera);
          const dx = _iconTipNDC.x - _iconHeadNDC.x;
          const dy = _iconTipNDC.y - _iconHeadNDC.y;
          if (Math.hypot(dx, dy) > 1e-5) {
            const headingDeg = Math.atan2(dx, dy) * 180 / Math.PI;
            snakeIcon.setHeading(headingDeg);
          }

          _iconHeadView.copy(_iconHeadWorld).applyMatrix4(camera.matrixWorldInverse);
          _iconCenterView.set(0, 0, 0)
            .applyMatrix4(world.matrixWorld)
            .applyMatrix4(camera.matrixWorldInverse);
          const limb = (_iconHeadView.z - _iconCenterView.z) / GLOBE_RADIUS;
          const op = THREE.MathUtils.smoothstep(limb, 0.05, 0.35) *
            (params.snakeIconOpacity as number);
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
    },

    resize(w: number, h: number, dpr: number) {
      doResize(w, h, dpr);
    },

    dispose() {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      canvas.style.cursor = '';

      scrollTracker.dispose();
      inlineEditor.destroy();

      for (const m of markers) {
        world.remove(m.group);
        m.dispose();
      }
      markers.length = 0;

      world.remove(snakeIcon.obj);
      snakeIcon.dispose();

      for (const line of wireframeLines) {
        wireframe.remove(line);
        line.geometry.dispose();
      }
      wireframeLines.length = 0;
      lineMat.dispose();

      snake.dispose();
      haloGeom.dispose();
      haloMat.dispose();
      crossTex.dispose();

      if (labelRenderer.domElement.parentElement) {
        labelRenderer.domElement.parentElement.removeChild(labelRenderer.domElement);
      }
      renderer.dispose();
    },
  };
}

export const globe1Experiment: Experiment = {
  meta,
  controls,
  initGL,
};
