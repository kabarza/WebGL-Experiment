import type { Landmark, TrackedHand } from './types';
import { HAND_LANDMARK } from './types';

export function dist2d(a: Pick<Landmark, 'x' | 'y'>, b: Pick<Landmark, 'x' | 'y'>): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function midpoint2d(
  a: Pick<Landmark, 'x' | 'y'>,
  b: Pick<Landmark, 'x' | 'y'>,
): [number, number] {
  return [(a.x + b.x) * 0.5, (a.y + b.y) * 0.5];
}

export function wristDistance(a: TrackedHand, b: TrackedHand): number {
  return dist2d(a.landmarks[HAND_LANDMARK.WRIST], b.landmarks[HAND_LANDMARK.WRIST]);
}

export function wristMidpoint(a: TrackedHand, b: TrackedHand): [number, number] {
  return midpoint2d(a.landmarks[HAND_LANDMARK.WRIST], b.landmarks[HAND_LANDMARK.WRIST]);
}

// Stable per-hand scale for normalizing thresholds that should be
// invariant to how close the hand is to the camera.
export function handScale(hand: TrackedHand): number {
  return dist2d(
    hand.landmarks[HAND_LANDMARK.WRIST],
    hand.landmarks[HAND_LANDMARK.MIDDLE_MCP],
  );
}

export function pickPair(hands: TrackedHand[]): [TrackedHand, TrackedHand] | null {
  if (hands.length < 2) return null;
  const primary = hands.find((h) => h.stableLabel === 'Primary');
  const secondary = hands.find((h) => h.stableLabel === 'Secondary');
  if (!primary || !secondary) return null;
  return [primary, secondary];
}

export function palmCenter(hand: TrackedHand): [number, number] {
  const wrist = hand.landmarks[HAND_LANDMARK.WRIST];
  const midMCP = hand.landmarks[HAND_LANDMARK.MIDDLE_MCP];
  return [(wrist.x + midMCP.x) * 0.5, (wrist.y + midMCP.y) * 0.5];
}

// Average fingertip-to-centroid distance, normalized by hand scale.
// Open hand ≈ 0.9–1.2, relaxed ≈ 0.5–0.7, bouquet/closed ≈ 0.15–0.25.
export function fingertipSpread(hand: TrackedHand): number {
  const tips = [
    hand.landmarks[HAND_LANDMARK.THUMB_TIP],
    hand.landmarks[HAND_LANDMARK.INDEX_TIP],
    hand.landmarks[HAND_LANDMARK.MIDDLE_TIP],
    hand.landmarks[HAND_LANDMARK.RING_TIP],
    hand.landmarks[HAND_LANDMARK.PINKY_TIP],
  ];
  const cx = tips.reduce((a, t) => a + t.x, 0) / 5;
  const cy = tips.reduce((a, t) => a + t.y, 0) / 5;
  const avgDist = tips.reduce((a, t) => a + Math.hypot(t.x - cx, t.y - cy), 0) / 5;
  const scale = handScale(hand);
  return avgDist / Math.max(scale, 1e-4);
}
