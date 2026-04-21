import * as THREE from 'three';
import { landmarkToNDC } from '../core/CoordMapper';
import { HAND_CONNECTIONS, type TrackedHand } from '../core/types';

const MAX_HANDS = 2;
const LANDMARKS_PER_HAND = 21;

export interface HandDebugOverlayOptions {
  visible?: boolean;
  mirror?: boolean;
  landmarkColor?: THREE.ColorRepresentation;
  connectionColor?: THREE.ColorRepresentation;
  pointSize?: number;
  lineWidth?: number;
}

export class HandDebugOverlay {
  readonly group = new THREE.Group();
  private readonly points: THREE.Points;
  private readonly lines: THREE.LineSegments;
  private mirror: boolean;
  private viewportAspect = 1;
  private videoAspect = 1;

  constructor(opts: HandDebugOverlayOptions = {}) {
    this.mirror = opts.mirror ?? true;

    const pointGeo = new THREE.BufferGeometry();
    const pointPositions = new Float32Array(MAX_HANDS * LANDMARKS_PER_HAND * 3);
    pointGeo.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
    pointGeo.setDrawRange(0, 0);
    const pointMat = new THREE.PointsMaterial({
      color: opts.landmarkColor ?? 0xff3333,
      size: opts.pointSize ?? 10,
      sizeAttenuation: false,
      depthTest: false,
      transparent: true,
    });
    this.points = new THREE.Points(pointGeo, pointMat);
    this.points.renderOrder = 20;
    this.points.frustumCulled = false;

    const lineGeo = new THREE.BufferGeometry();
    const linePositions = new Float32Array(MAX_HANDS * HAND_CONNECTIONS.length * 2 * 3);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeo.setDrawRange(0, 0);
    const lineMat = new THREE.LineBasicMaterial({
      color: opts.connectionColor ?? 0x4ade80,
      linewidth: opts.lineWidth ?? 2,
      depthTest: false,
      transparent: true,
    });
    this.lines = new THREE.LineSegments(lineGeo, lineMat);
    this.lines.renderOrder = 19;
    this.lines.frustumCulled = false;

    this.group.add(this.lines);
    this.group.add(this.points);
    this.group.visible = opts.visible ?? true;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  get isVisible(): boolean {
    return this.group.visible;
  }

  setMirror(mirror: boolean): void {
    this.mirror = mirror;
  }

  setAspect(viewportAspect: number, videoAspect: number): void {
    this.viewportAspect = viewportAspect;
    this.videoAspect = videoAspect;
  }

  update(hands: TrackedHand[]): void {
    const ctx = {
      viewportAspect: this.viewportAspect,
      videoAspect: this.videoAspect,
      mirror: this.mirror,
    };

    const pointPos = this.points.geometry.attributes.position.array as Float32Array;
    const linePos = this.lines.geometry.attributes.position.array as Float32Array;

    let pointIdx = 0;
    let lineIdx = 0;
    const handCount = Math.min(hands.length, MAX_HANDS);

    for (let h = 0; h < handCount; h++) {
      const hand = hands[h];
      for (const lm of hand.landmarks) {
        const [nx, ny] = landmarkToNDC(lm, ctx);
        pointPos[pointIdx++] = nx;
        pointPos[pointIdx++] = ny;
        pointPos[pointIdx++] = 0.5;
      }
      for (const [a, b] of HAND_CONNECTIONS) {
        const [ax, ay] = landmarkToNDC(hand.landmarks[a], ctx);
        const [bx, by] = landmarkToNDC(hand.landmarks[b], ctx);
        linePos[lineIdx++] = ax;
        linePos[lineIdx++] = ay;
        linePos[lineIdx++] = 0.5;
        linePos[lineIdx++] = bx;
        linePos[lineIdx++] = by;
        linePos[lineIdx++] = 0.5;
      }
    }

    this.points.geometry.setDrawRange(0, handCount * LANDMARKS_PER_HAND);
    this.points.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.setDrawRange(0, handCount * HAND_CONNECTIONS.length * 2);
    this.lines.geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
  }
}
