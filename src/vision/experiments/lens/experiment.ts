import * as THREE from 'three';
import fragGLSL from './effect.glsl';
import { meta } from './meta';
import { controls, SHAPE_ID, type ShapeName } from './params';
import type { ActivationMode } from '../../core/modes';
import type {
  VisionExperimentContext,
  VisionExperimentDefinition,
  VisionExperimentInstance,
  VisionFrame,
} from '../../core/VisionExperiment';
import { landmarkToNDC } from '../../core/CoordMapper';
import {
  fingertipSpread,
  handScale,
  palmCenter,
  pickPair,
  wristDistance,
  wristMidpoint,
} from '../../core/handMath';

const VS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function hexToVec3(hex: string): THREE.Vector3 {
  const clean = hex.replace('#', '');
  return new THREE.Vector3(
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  );
}

interface ResolvedTarget {
  active: boolean;
  center: [number, number] | null;
  size: number;
  justFired: boolean;
}

export const lens: VisionExperimentDefinition = {
  meta,
  controls,
  async init(ctx: VisionExperimentContext): Promise<VisionExperimentInstance> {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uVideoTexture: { value: ctx.videoTexture },
        uViewportAspect: { value: ctx.getViewportAspect() },
        uVideoAspect: { value: ctx.getVideoAspect() },
        uMirror: { value: ctx.isMirrored() ? 1 : 0 },
        uLensCenter: { value: new THREE.Vector2(0, 0) },
        uLensRadius: { value: 0.3 },
        uLensActive: { value: 0 },
        uLensPulse: { value: 0 },
        uTime: { value: 0 },
        uShape: { value: 0 },
        uDistortion: { value: 0.45 },
        uChromaticAberration: { value: 0.025 },
        uNoiseWarp: { value: 0.035 },
        uNoiseScale: { value: 6.0 },
        uNoiseSpeed: { value: 0.4 },
        uRimWidth: { value: 0.08 },
        uRimColor: { value: new THREE.Vector3(0.5, 0.85, 1.0) },
        uRimIntensity: { value: 1.1 },
        uInnerTint: { value: new THREE.Vector3(0.8, 0.95, 1.2) },
        uInnerTintMix: { value: 0.3 },
      },
      vertexShader: VS,
      fragmentShader: fragGLSL,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    ctx.scene.add(mesh);

    let smoothedActive = 0;
    let pulseValue = 0;
    let lastLoggedMode: ActivationMode | null = null;

    let smoothedCenter: [number, number] = [0.5, 0.5];
    let smoothedSize = 0;
    let wasActive = false;

    let stickyActive = false;
    let stickyCenter: [number, number] = [0.5, 0.5];
    let stickySize = 0;
    let stickyLastHandTime = -Infinity;

    function resolveTarget(frame: VisionFrame, mode: ActivationMode): ResolvedTarget {
      if (mode === 'DoublePinch') {
        const dp = frame.doublePinch;
        if (!dp.active || !dp.center) {
          return {
            active: false,
            center: null,
            size: 0,
            justFired: dp.toggleJustFired,
          };
        }
        // size = handScale × (base + sizeDistance × range). handScale keeps
        // the radius roughly stable as the user moves closer/farther from the
        // camera; sizeDistance is already hand-scale-normalized, so the full
        // expression converts back to the same units Clap mode uses.
        const base = Number(frame.params.pinchSizeBase ?? 0.15);
        const range = Number(frame.params.pinchSizeRange ?? 1.4);
        const handRef = frame.hands.find((h) => h.stableLabel === 'Primary') ?? frame.hands[0];
        const hs = handRef ? handScale(handRef) : 0.15;
        const size = hs * (base + dp.sizeDistance * range);
        return {
          active: true,
          center: dp.center,
          size,
          justFired: dp.toggleJustFired,
        };
      }

      // Clap (with sticky handoff): a clap activates, effect then follows
      // whichever hand remains — pair midpoint with both, palm-center with
      // one, size controlled by fingertip spread when only one is left.
      if (frame.clap.clapJustFired) {
        stickyActive = true;
      }

      const pair = pickPair(frame.hands);
      if (pair) {
        stickyCenter = wristMidpoint(pair[0], pair[1]);
        stickySize = wristDistance(pair[0], pair[1]);
        stickyLastHandTime = frame.time;
      } else if (frame.hands.length > 0) {
        const hand = frame.hands[0];
        stickyCenter = palmCenter(hand);
        const scale = handScale(hand);
        const spread = fingertipSpread(hand);
        const base = Number(frame.params.oneHandSizeBase ?? 1.0);
        const range = Number(frame.params.oneHandSizeRange ?? 3.0);
        stickySize = scale * (base + spread * range);
        stickyLastHandTime = frame.time;
      } else {
        const graceMs = Number(frame.params.stickyGraceMs ?? 1500);
        if (stickyActive && frame.time - stickyLastHandTime > graceMs) {
          stickyActive = false;
        }
      }

      return {
        active: stickyActive,
        center: stickyActive ? stickyCenter : null,
        size: stickySize,
        justFired: frame.clap.clapJustFired,
      };
    }

    return {
      update(frame) {
        const p = frame.params;
        const shape = (p.shape as ShapeName) ?? 'Circle';
        // Migrate legacy stored values (old "Pinch" mode) and default to
        // DoublePinch — that's what the UI shows by default now.
        const rawMode = String(p.activationMode ?? '');
        const activationMode: ActivationMode =
          rawMode === 'DoublePinch' || rawMode === 'Clap'
            ? rawMode
            : 'DoublePinch';
        if (activationMode !== lastLoggedMode) {
          console.log(
            `[Lens] activation mode: ${activationMode}` +
              (rawMode && rawMode !== activationMode ? ` (migrated from legacy "${rawMode}")` : ''),
          );
          lastLoggedMode = activationMode;
        }

        material.uniforms.uShape.value = SHAPE_ID[shape] ?? 0;
        material.uniforms.uDistortion.value = Number(p.distortion ?? 0.45);
        material.uniforms.uChromaticAberration.value = Number(p.chromaticAberration ?? 0.025);
        material.uniforms.uNoiseWarp.value = Number(p.noiseWarp ?? 0.035);
        material.uniforms.uNoiseScale.value = Number(p.noiseScale ?? 6.0);
        material.uniforms.uNoiseSpeed.value = Number(p.noiseSpeed ?? 0.4);
        material.uniforms.uRimWidth.value = Number(p.rimWidth ?? 0.08);
        material.uniforms.uRimIntensity.value = Number(p.rimIntensity ?? 1.1);
        material.uniforms.uInnerTintMix.value = Number(p.innerTintMix ?? 0.3);

        const rim = hexToVec3((p.rimColor as string) ?? '#80d8ff');
        material.uniforms.uRimColor.value.copy(rim);
        const tint = hexToVec3((p.innerTint as string) ?? '#ccf2ff');
        material.uniforms.uInnerTint.value.copy(tint);

        const vpAspect = ctx.getViewportAspect();
        const videoAsp = ctx.getVideoAspect();
        material.uniforms.uViewportAspect.value = vpAspect;
        material.uniforms.uVideoAspect.value = videoAsp;
        material.uniforms.uMirror.value = ctx.isMirrored() ? 1 : 0;
        material.uniforms.uTime.value = frame.time / 1000;

        const target = resolveTarget(frame, activationMode);

        if (target.center) {
          const smoothMs = Math.max(Number(p.trackingSmoothMs ?? 140), 0);
          const snap = !wasActive || target.justFired || smoothMs < 1;
          if (snap) {
            smoothedCenter[0] = target.center[0];
            smoothedCenter[1] = target.center[1];
            smoothedSize = target.size;
          } else {
            const k = 1 - Math.exp(-frame.delta / smoothMs);
            smoothedCenter[0] += (target.center[0] - smoothedCenter[0]) * k;
            smoothedCenter[1] += (target.center[1] - smoothedCenter[1]) * k;
            smoothedSize += (target.size - smoothedSize) * k;
          }

          const [nx, ny] = landmarkToNDC(
            { x: smoothedCenter[0], y: smoothedCenter[1] },
            { viewportAspect: vpAspect, videoAspect: videoAsp, mirror: ctx.isMirrored() },
          );
          // Offset in NDC. X compensates for the mirror flag so a positive
          // value always reads as "screen right"; Y is already up-positive.
          const offsetX = Number(p.offsetX ?? 0);
          const offsetY = Number(p.offsetY ?? 0.35);
          const offsetScale = Number(p.offsetScale ?? 1);
          const mirrorSign = ctx.isMirrored() ? -1 : 1;
          const finalX = nx + mirrorSign * offsetX * offsetScale;
          const finalY = ny + offsetY * offsetScale;
          material.uniforms.uLensCenter.value.set(finalX, finalY);

          const sizeMul = Number(p.sizeMultiplier ?? 0.7);
          const targetRadius = smoothedSize * sizeMul * vpAspect;
          material.uniforms.uLensRadius.value = Math.max(targetRadius, 0.04);
        }
        wasActive = target.active;

        const wantActive = target.active ? 1 : 0;
        const fadeIn = Math.max(Number(p.activation ?? 0.12), 0.02);
        const fadeOut = Math.max(Number(p.decay ?? 0.6), 0.05);
        const easeTime = wantActive > smoothedActive ? fadeIn : fadeOut;
        const alpha = Math.min(frame.delta / 1000 / easeTime, 1);
        smoothedActive += (wantActive - smoothedActive) * alpha;
        material.uniforms.uLensActive.value = smoothedActive;

        if (target.justFired) pulseValue = Number(p.clapPulseStrength ?? 1.0);
        pulseValue *= Math.exp(-frame.delta / 400);
        material.uniforms.uLensPulse.value = pulseValue;
      },

      resize() {
        material.uniforms.uViewportAspect.value = ctx.getViewportAspect();
      },

      dispose() {
        ctx.scene.remove(mesh);
        material.dispose();
        mesh.geometry.dispose();
      },
    };
  },
};
