import type * as THREE from 'three';
import type { ExperimentControls, ExperimentMeta } from '../../core/Experiment';
import type { TrackedHand } from './types';
import type { ClapState } from './gestures/clap';
import type { DoublePinchState } from './gestures/doublePinch';

export interface VisionExperimentContext {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  videoTexture: THREE.VideoTexture;
  video: HTMLVideoElement;
  getViewportAspect: () => number;
  getVideoAspect: () => number;
  isMirrored: () => boolean;
}

export interface VisionFrame {
  time: number;
  delta: number;
  hands: TrackedHand[];
  clap: ClapState;
  doublePinch: DoublePinchState;
  params: Record<string, unknown>;
}

export interface VisionExperimentInstance {
  update(frame: VisionFrame): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export interface VisionExperimentDefinition {
  meta: ExperimentMeta;
  controls: ExperimentControls;
  init(ctx: VisionExperimentContext): Promise<VisionExperimentInstance>;
}
