import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import * as THREE from 'three';
import { useExperimentParams } from '../../hooks/useExperimentParams';
import { useChrome } from '../../components/ChromeContext';
import { CameraPermission } from './CameraPermission';
import { CameraManager } from '../core/CameraManager';
import { HandTracker } from '../core/HandTracker';
import { HandState } from '../core/HandState';
import { ClapDetector, type ClapState } from '../core/gestures/clap';
import { DoublePinchDetector, type DoublePinchState } from '../core/gestures/doublePinch';
import { VideoPlane } from '../scene/VideoPlane';
import { HandDebugOverlay } from '../scene/HandDebugOverlay';
import { findVisionExperiment } from '../registry';
import type { VisionExperimentInstance } from '../core/VisionExperiment';
import type { TrackedHand } from '../core/types';

interface VisionViewProps {
  slug: string;
  onBack: () => void;
}

type Stage = 'permission' | 'loading' | 'ready' | 'error';

const IDLE_CLAP: ClapState = {
  mode: 'idle',
  clapJustFired: false,
  effectActive: false,
  effectCenter: null,
  effectSize: 0,
  inwardVelocity: 0,
  wristDistance: 0,
  msSinceClap: Infinity,
  msSincePairSeen: Infinity,
  handsSeen: 0,
};

const IDLE_DOUBLE_PINCH: DoublePinchState = {
  active: false,
  toggleJustFired: false,
  armed: false,
  center: null,
  size: 0,
  pinchDistance: 0,
  sizeDistance: 0,
  phase: 'open',
  msSincePulse: Infinity,
  pulseCount: 0,
  minPinchRecent: Infinity,
  handsSeen: 0,
};

export function VisionView({ slug, onBack: _onBack }: VisionViewProps) {
  const definition = findVisionExperiment(slug);
  const [stage, setStage] = useState<Stage>('permission');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // One-way trigger for boot. Flips false→true when camera is acquired;
  // decoupled from `stage` so setStage('ready') doesn't invalidate the boot effect.
  const [cameraReady, setCameraReady] = useState(false);
  const { visionDebugVisible } = useChrome();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { visionHudRef } = useChrome();

  const cameraRef = useRef<CameraManager | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const experimentRef = useRef<VisionExperimentInstance | null>(null);
  const rafRef = useRef<number | null>(null);

  const debugVisibleRef = useRef(visionDebugVisible);
  useEffect(() => {
    debugVisibleRef.current = visionDebugVisible;
  }, [visionDebugVisible]);

  const { params } = useExperimentParams(
    definition?.meta.title ?? 'Vision',
    definition?.controls.dialConfig,
    definition?.controls.defaults ?? {},
    `vision-${slug}`,
    undefined,
    definition?.controls.visibility,
    definition?.controls.presets,
    { defaultPresetName: 'DoublePinch' },
  );

  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const handleCameraReady = useCallback((camera: CameraManager) => {
    cameraRef.current = camera;
    setStage('loading');
    setCameraReady(true);
  }, []);

  useEffect(() => {
    if (!cameraReady) return;
    if (!definition) {
      setErrorMsg(`Experiment "${slug}" not found`);
      setStage('error');
      return;
    }
    const camera = cameraRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!camera || !canvas || !container) return;

    let disposed = false;
    let teardown: (() => void) | null = null;

    (async () => {
      try {
        const video = camera.video;
        if (!video.videoWidth) {
          await new Promise<void>((resolve) => {
            if (video.videoWidth > 0) {
              resolve();
              return;
            }
            const handler = () => {
              video.removeEventListener('loadedmetadata', handler);
              resolve();
            };
            video.addEventListener('loadedmetadata', handler);
          });
        }
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        rendererRef.current = renderer;

        const scene = new THREE.Scene();
        const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
        cam.position.z = 1;

        const videoPlane = new VideoPlane({ video, mirror: true });
        scene.add(videoPlane.mesh);

        const debugOverlay = new HandDebugOverlay({
          visible: debugVisibleRef.current,
          mirror: true,
        });
        scene.add(debugOverlay.group);

        const measure = () => {
          const w = container.clientWidth;
          const h = container.clientHeight;
          renderer.setSize(w, h, false);
          const vpAspect = w / h;
          const vidAspect = video.videoWidth / Math.max(video.videoHeight, 1);
          videoPlane.setAspect(vpAspect, vidAspect);
          debugOverlay.setAspect(vpAspect, vidAspect);
          experimentRef.current?.resize(w, h);
        };
        measure();

        const resizeObs = new ResizeObserver(measure);
        resizeObs.observe(container);

        const handStateObj = new HandState();
        const clapDetector = new ClapDetector();
        const doublePinchDetector = new DoublePinchDetector();
        let currentHands: TrackedHand[] = [];
        let currentClap: ClapState = IDLE_CLAP;
        let currentDoublePinch: DoublePinchState = IDLE_DOUBLE_PINCH;

        // HUD stats
        let clapCount = 0;
        let doublePinchCount = 0;
        let trackerFrameCount = 0;
        let trackerFpsWindowStart = performance.now();
        let trackerFps = 0;

        const tracker = await HandTracker.create({
          video,
          numHands: 2,
          onResult: (hands, t) => {
            const p = paramsRef.current;
            doublePinchDetector.setOptions({
              activateThreshold: Number(p.pinchActivate ?? 0.45),
              releaseThreshold: Number(p.pinchRelease ?? 0.65),
              doubleWindowMs: Number(p.doublePinchWindowMs ?? 2000),
              pulseDebounceMs: Number(p.pinchDebounceMs ?? 50),
            });
            currentHands = handStateObj.update(hands, t);
            currentClap = clapDetector.update(currentHands, t);
            currentDoublePinch = doublePinchDetector.update(currentHands, t);

            if (currentClap.clapJustFired) clapCount += 1;
            if (currentDoublePinch.toggleJustFired) doublePinchCount += 1;

            trackerFrameCount += 1;
            const elapsed = t - trackerFpsWindowStart;
            if (elapsed > 500) {
              trackerFps = Math.round((trackerFrameCount * 1000) / elapsed);
              trackerFrameCount = 0;
              trackerFpsWindowStart = t;
            }
          },
        });
        if (disposed) {
          tracker.dispose();
          return;
        }
        trackerRef.current = tracker;
        tracker.start();

        const instance = await definition.init({
          scene,
          camera: cam,
          renderer,
          videoTexture: videoPlane.texture,
          video,
          getViewportAspect: () => container.clientWidth / Math.max(container.clientHeight, 1),
          getVideoAspect: () => video.videoWidth / Math.max(video.videoHeight, 1),
          isMirrored: () => videoPlane.isMirrored,
        });
        if (disposed) {
          instance.dispose();
          return;
        }
        experimentRef.current = instance;

        let lastTime = performance.now();
        const tick = (now: number) => {
          const delta = now - lastTime;
          lastTime = now;

          debugOverlay.setVisible(debugVisibleRef.current);
          debugOverlay.update(currentHands);

          instance.update({
            time: now,
            delta,
            hands: currentHands,
            clap: currentClap,
            doublePinch: currentDoublePinch,
            params: paramsRef.current,
          });

          renderer.render(scene, cam);

          const hud = visionHudRef.current;
          if (hud) {
            // Pre-pad every value so the chip width stays fixed as numbers
            // change. Paired with `white-space: pre` on the value spans.
            const padR = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
            const padL = (s: string, n: number) => (s.length >= n ? s : ' '.repeat(n - s.length) + s);

            // Always 4 chars: "N CC" (digit + space + handedness slot)
            const h0 = (currentHands[0]?.handedness ?? '').charAt(0);
            const h1 = (currentHands[1]?.handedness ?? '').charAt(0);
            const chars = [h0, h1].filter(Boolean).sort().join('');
            const handsText = `${currentHands.length} ${padR(chars, 2)}`;

            const setText = (sel: string, text: string) => {
              const el = hud.querySelector(sel);
              if (el && el.textContent !== text) el.textContent = text;
            };

            setText('[data-vh="hands"]', handsText);

            // state padded to 6, d/v fixed 4-char decimals, v reserves a sign slot
            const mode = padR(currentClap.mode, 6);
            const d = padL(currentClap.wristDistance.toFixed(2), 4);
            const v = padL(currentClap.inwardVelocity.toFixed(2), 5);
            setText('[data-vh="clap"]', `${mode} d·${d} v·${v}`);

            const pPhase = padR(currentDoublePinch.phase, 6);
            const onOff = currentDoublePinch.active ? 'on ' : 'off';
            const armed = currentDoublePinch.armed ? '★' : ' ';
            const pd = padL(currentDoublePinch.pinchDistance.toFixed(2), 4);
            const mn = padL(
              Number.isFinite(currentDoublePinch.minPinchRecent)
                ? currentDoublePinch.minPinchRecent.toFixed(2)
                : '—',
              4,
            );
            const pc = padL(String(currentDoublePinch.pulseCount), 2);
            setText(
              '[data-vh="pinch"]',
              `${pPhase} ${onOff} ${armed} p·${pd} min·${mn} x${pc}`,
            );

            setText('[data-vh="claps"]', padL(String(clapCount), 3));
            setText('[data-vh="trk"]', padL(String(trackerFps), 3));
          }

          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);

        setStage('ready');

        teardown = () => {
          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          resizeObs.disconnect();
          instance.dispose();
          experimentRef.current = null;
          tracker.dispose();
          trackerRef.current = null;
          debugOverlay.dispose();
          videoPlane.dispose();
          renderer.dispose();
          rendererRef.current = null;
        };
      } catch (err) {
        console.error('[VisionView] boot failed', err);
        if (!disposed) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to start vision experiment');
          setStage('error');
        }
      }
    })();

    return () => {
      disposed = true;
      teardown?.();
    };
  }, [cameraReady, slug, definition]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      experimentRef.current?.dispose();
      experimentRef.current = null;
      trackerRef.current?.dispose();
      trackerRef.current = null;
      rendererRef.current?.dispose();
      rendererRef.current = null;
      cameraRef.current?.dispose();
      cameraRef.current = null;
    };
  }, []);

  return (
    <motion.div
      ref={containerRef}
      className="vision-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <canvas ref={canvasRef} className="vision-canvas" />
      {stage === 'permission' && <CameraPermission onReady={handleCameraReady} />}
      {stage === 'loading' && (
        <div className="vision-loading">
          <div className="vision-loading-spinner" />
          <span>Loading hand tracking…</span>
        </div>
      )}
      {stage === 'error' && errorMsg && (
        <div className="vision-error">
          <p className="vision-error-message">{errorMsg}</p>
        </div>
      )}
    </motion.div>
  );
}
