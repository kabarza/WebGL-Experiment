// ============================================================
// Vectorise a scalar field into SVG paths.
// Marching squares (with linear interpolation + saddle handling)
// → edge-keyed contour joining → RDP simplification → smooth
// quadratic path output. Coordinates are emitted top-down in the
// requested output size.
// ============================================================

import type { FieldReadback } from './types.ts';

export interface VectorizeOptions {
  threshold: number;
  /** Output size in px. */
  width: number;
  height: number;
  /** Simplification tolerance in field pixels (0 = keep everything). */
  tolerance?: number;
  /** Emit smooth quadratic curves instead of straight segments. */
  smooth?: boolean;
  /** Drop contours with fewer points than this. */
  minPoints?: number;
}

export interface Contour {
  points: Float32Array; // x0,y0,x1,y1,... in field coords (bottom-up)
  closed: boolean;
}

export function extractContours(field: FieldReadback, threshold: number): Contour[] {
  const { width: W, height: H, data } = field;
  const cols = W + 1;
  // Edge keys: h(x,y) = (y*cols + x)*2, v(x,y) = (y*cols + x)*2 + 1
  const keyCount = cols * (H + 1) * 2;
  const pts = new Float32Array(keyCount * 2);
  const hasPt = new Uint8Array(keyCount);
  const nbr = new Int32Array(keyCount * 2).fill(-1);

  const hKey = (x: number, y: number) => (y * cols + x) * 2;
  const vKey = (x: number, y: number) => (y * cols + x) * 2 + 1;

  const lerpH = (x: number, y: number, a: number, b: number) => {
    const k = hKey(x, y);
    if (!hasPt[k]) {
      const t = (threshold - a) / ((b - a) || 1e-9);
      pts[k * 2] = x + Math.min(1, Math.max(0, t));
      pts[k * 2 + 1] = y;
      hasPt[k] = 1;
    }
    return k;
  };
  const lerpV = (x: number, y: number, a: number, d: number) => {
    const k = vKey(x, y);
    if (!hasPt[k]) {
      const t = (threshold - a) / ((d - a) || 1e-9);
      pts[k * 2] = x;
      pts[k * 2 + 1] = y + Math.min(1, Math.max(0, t));
      hasPt[k] = 1;
    }
    return k;
  };
  const link = (k1: number, k2: number) => {
    if (nbr[k1 * 2] === -1) nbr[k1 * 2] = k2; else nbr[k1 * 2 + 1] = k2;
    if (nbr[k2 * 2] === -1) nbr[k2 * 2] = k1; else nbr[k2 * 2 + 1] = k1;
  };

  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const a = data[y * W + x];
      const b = data[y * W + x + 1];
      const c = data[(y + 1) * W + x + 1];
      const d = data[(y + 1) * W + x];
      const idx = (a > threshold ? 1 : 0) | (b > threshold ? 2 : 0) | (c > threshold ? 4 : 0) | (d > threshold ? 8 : 0);
      if (idx === 0 || idx === 15) continue;

      // Edge points (lazily computed)
      const E0 = () => lerpH(x, y, a, b);          // bottom
      const E1 = () => lerpV(x + 1, y, b, c);      // right
      const E2 = () => lerpH(x, y + 1, d, c);      // top
      const E3 = () => lerpV(x, y, a, d);          // left

      switch (idx) {
        case 1: case 14: link(E3(), E0()); break;
        case 2: case 13: link(E0(), E1()); break;
        case 3: case 12: link(E3(), E1()); break;
        case 4: case 11: link(E1(), E2()); break;
        case 6: case 9: link(E0(), E2()); break;
        case 7: case 8: link(E3(), E2()); break;
        case 5: {
          const center = (a + b + c + d) * 0.25;
          if (center > threshold) { link(E3(), E2()); link(E1(), E0()); }
          else { link(E3(), E0()); link(E1(), E2()); }
          break;
        }
        case 10: {
          const center = (a + b + c + d) * 0.25;
          if (center > threshold) { link(E0(), E3()); link(E2(), E1()); }
          else { link(E0(), E1()); link(E2(), E3()); }
          break;
        }
      }
    }
  }

  // Walk chains
  const visited = new Uint8Array(keyCount);
  const contours: Contour[] = [];
  const walk = (start: number, closed: boolean) => {
    const out: number[] = [];
    let prev = -1;
    let cur = start;
    while (cur !== -1 && !visited[cur]) {
      visited[cur] = 1;
      out.push(pts[cur * 2], pts[cur * 2 + 1]);
      const n0 = nbr[cur * 2];
      const n1 = nbr[cur * 2 + 1];
      const next = n0 !== prev && n0 !== -1 ? n0 : n1 !== prev ? n1 : -1;
      prev = cur;
      cur = next;
      if (cur === start) break;
    }
    if (out.length >= 4) contours.push({ points: Float32Array.from(out), closed });
  };
  // Open chains first (endpoints with one neighbour)
  for (let k = 0; k < keyCount; k++) {
    if (hasPt[k] && !visited[k] && (nbr[k * 2] === -1 || nbr[k * 2 + 1] === -1)) walk(k, false);
  }
  for (let k = 0; k < keyCount; k++) {
    if (hasPt[k] && !visited[k]) walk(k, true);
  }
  return contours;
}

/** Ramer–Douglas–Peucker on an interleaved xy array. */
export function simplify(points: Float32Array, tolerance: number): Float32Array {
  const n = points.length / 2;
  if (tolerance <= 0 || n < 3) return points;
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[n - 1] = 1;
  const stack: Array<[number, number]> = [[0, n - 1]];
  const tol2 = tolerance * tolerance;
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const sx = points[s * 2], sy = points[s * 2 + 1];
    const ex = points[e * 2], ey = points[e * 2 + 1];
    const dx = ex - sx, dy = ey - sy;
    const len2 = dx * dx + dy * dy;
    let maxD = 0, maxI = -1;
    for (let i = s + 1; i < e; i++) {
      const px = points[i * 2] - sx, py = points[i * 2 + 1] - sy;
      let d2: number;
      if (len2 === 0) d2 = px * px + py * py;
      else {
        const t = Math.min(1, Math.max(0, (px * dx + py * dy) / len2));
        const qx = px - t * dx, qy = py - t * dy;
        d2 = qx * qx + qy * qy;
      }
      if (d2 > maxD) { maxD = d2; maxI = i; }
    }
    if (maxD > tol2 && maxI > 0) {
      keep[maxI] = 1;
      stack.push([s, maxI], [maxI, e]);
    }
  }
  let count = 0;
  for (let i = 0; i < n; i++) if (keep[i]) count++;
  const out = new Float32Array(count * 2);
  let j = 0;
  for (let i = 0; i < n; i++) if (keep[i]) { out[j++] = points[i * 2]; out[j++] = points[i * 2 + 1]; }
  return out;
}

function fmt(v: number): string {
  return (Math.round(v * 100) / 100).toString();
}

/** Convert contours to a single SVG path `d` string. */
export function contoursToPath(
  contours: Contour[],
  field: { width: number; height: number },
  opts: VectorizeOptions,
): string {
  const sx = opts.width / (field.width - 1);
  const sy = opts.height / (field.height - 1);
  const tol = opts.tolerance ?? 0.35;
  const minPts = opts.minPoints ?? 4;
  const parts: string[] = [];

  for (const c of contours) {
    const p = simplify(c.points, tol);
    const n = p.length / 2;
    if (n < minPts) continue;
    const X = (i: number) => fmt(p[i * 2] * sx);
    const Y = (i: number) => fmt(opts.height - p[i * 2 + 1] * sy);

    if (opts.smooth !== false && n >= 3) {
      // Quadratic through midpoints — smooth, tangent-continuous
      const mx = (i: number, j: number) => fmt((p[i * 2] + p[j * 2]) * 0.5 * sx);
      const my = (i: number, j: number) => fmt(opts.height - (p[i * 2 + 1] + p[j * 2 + 1]) * 0.5 * sy);
      let d: string;
      if (c.closed) {
        d = `M${mx(n - 1, 0)} ${my(n - 1, 0)}`;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          d += `Q${X(i)} ${Y(i)} ${mx(i, j)} ${my(i, j)}`;
        }
        d += 'Z';
      } else {
        d = `M${X(0)} ${Y(0)}`;
        for (let i = 1; i < n - 1; i++) {
          d += `Q${X(i)} ${Y(i)} ${mx(i, i + 1)} ${my(i, i + 1)}`;
        }
        d += `L${X(n - 1)} ${Y(n - 1)}`;
      }
      parts.push(d);
    } else {
      let d = `M${X(0)} ${Y(0)}`;
      for (let i = 1; i < n; i++) d += `L${X(i)} ${Y(i)}`;
      if (c.closed) d += 'Z';
      parts.push(d);
    }
  }
  return parts.join('');
}

export function vectorizeField(field: FieldReadback, opts: VectorizeOptions): { d: string; contours: number } {
  const contours = extractContours(field, opts.threshold);
  const d = contoursToPath(contours, field, opts);
  return { d, contours: contours.length };
}
