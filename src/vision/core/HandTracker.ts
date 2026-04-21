import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import type { Handedness, Landmark } from './types';
import type { RawHand } from './HandState';

const WASM_PATH = '/vision/wasm';
const MODEL_PATH = '/vision/hand_landmarker.task';

export interface HandTrackerOptions {
  video: HTMLVideoElement;
  numHands?: number;
  minHandDetectionConfidence?: number;
  minHandPresenceConfidence?: number;
  minTrackingConfidence?: number;
  delegate?: 'GPU' | 'CPU';
  onResult?: (hands: RawHand[], timestampMs: number) => void;
}

function toRaw(result: HandLandmarkerResult): RawHand[] {
  const out: RawHand[] = [];
  const n = result.landmarks?.length ?? 0;
  for (let i = 0; i < n; i++) {
    const lms = result.landmarks[i] as Landmark[];
    const handedness = (result.handedness[i]?.[0]?.categoryName as Handedness | undefined) ?? 'Right';
    const confidence = result.handedness[i]?.[0]?.score ?? 0;
    out.push({ landmarks: lms, handedness, confidence });
  }
  return out;
}

export class HandTracker {
  private readonly video: HTMLVideoElement;
  private readonly onResult?: (hands: RawHand[], ts: number) => void;
  private landmarker: HandLandmarker;
  private rafHandle: number | null = null;
  private rvfcHandle: number | null = null;
  private running = false;
  private disposed = false;

  private constructor(landmarker: HandLandmarker, opts: HandTrackerOptions) {
    this.landmarker = landmarker;
    this.video = opts.video;
    this.onResult = opts.onResult;
  }

  static async create(opts: HandTrackerOptions): Promise<HandTracker> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    const landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_PATH,
        delegate: opts.delegate ?? 'GPU',
      },
      numHands: opts.numHands ?? 2,
      runningMode: 'VIDEO',
      minHandDetectionConfidence: opts.minHandDetectionConfidence ?? 0.5,
      minHandPresenceConfidence: opts.minHandPresenceConfidence ?? 0.5,
      minTrackingConfidence: opts.minTrackingConfidence ?? 0.5,
    });
    return new HandTracker(landmarker, opts);
  }

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.rvfcHandle !== null && 'cancelVideoFrameCallback' in this.video) {
      this.video.cancelVideoFrameCallback(this.rvfcHandle);
      this.rvfcHandle = null;
    }
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
    this.landmarker.close();
  }

  private schedule(): void {
    if (!this.running || this.disposed) return;

    const supportsRvfc = 'requestVideoFrameCallback' in this.video;
    if (supportsRvfc) {
      this.rvfcHandle = this.video.requestVideoFrameCallback(() => this.tick());
    } else {
      this.rafHandle = requestAnimationFrame(() => this.tick());
    }
  }

  private tick(): void {
    if (!this.running || this.disposed) return;

    const video = this.video;
    const ready = video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
    if (ready) {
      const ts = performance.now();
      try {
        const result = this.landmarker.detectForVideo(video, ts);
        this.onResult?.(toRaw(result), ts);
      } catch (err) {
        console.error('[HandTracker] detectForVideo failed', err);
      }
    }
    this.schedule();
  }
}
