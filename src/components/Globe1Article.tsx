// ============================================================
// Globe1Article — Beginner-friendly deep dive on the wireframe globe
// ============================================================
//
// The technical claims in this article were cross-checked against the
// Three.js source (build/three.module.js, examples/jsm/lines/Line2.js,
// examples/jsm/renderers/CSS2DRenderer.js) and against the experiment's
// own implementation. Where something is wrong, partial, or has caveats
// we say so honestly rather than glossing over it.

import { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { useChrome } from './ChromeContext.tsx';

/* ── Code block helper ─────────────────────────────── */

function CodeBlock({ code, caption }: { code: string; caption?: string }) {
  const lines = code.replace(/^\n+|\n+$/g, '').split('\n');
  return (
    <figure className="article-code-figure">
      {caption && <figcaption className="article-code-caption">{caption}</figcaption>}
      <pre className="article-code-block">
        <code>
          {lines.map((line, i) => (
            <div key={i} className="code-line">
              <span className="code-line-number">{i + 1}</span>
              <span className="code-line-content">{line}</span>
            </div>
          ))}
        </code>
      </pre>
    </figure>
  );
}

/* ── SVG Diagrams ──────────────────────────────────── */

// A simple diagram showing the four "layers" stacked together.
function LayerStackDiagram() {
  const layers = [
    { label: 'Wireframe lines', desc: 'LineSegments — meridians + parallels' },
    { label: 'Country crosses', desc: 'Sprite or tangent-plane Mesh' },
    { label: 'Country labels', desc: 'CSS2DRenderer (real DOM, not WebGL)' },
    { label: 'Snake trail', desc: 'Line2 — screen-space thick line', highlight: true },
  ];
  const stepH = 56;
  const startY = 16;
  const h = startY + layers.length * stepH;

  return (
    <svg
      viewBox={`0 0 460 ${h}`}
      fill="none"
      role="img"
      aria-label="Render layer stack"
      style={{ maxWidth: 460 }}
    >
      {layers.map((s, i) => {
        const y = startY + i * stepH;
        const hl = (s as { highlight?: boolean }).highlight;
        return (
          <g key={i}>
            <rect
              x="2"
              y={y - 12}
              width="456"
              height="42"
              rx="6"
              fill={hl ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)'}
              stroke={hl ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)'}
              strokeWidth="1"
            />
            <text
              x="20"
              y={y + 4}
              fill={hl ? '#f3f3f3' : 'rgba(255,255,255,0.78)'}
              fontSize="14"
              fontWeight={hl ? 600 : 400}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {s.label}
            </text>
            <text
              x="20"
              y={y + 22}
              fill="rgba(255,255,255,0.32)"
              fontSize="11"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {s.desc}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Coordinate diagram: lat/lon → 3D point on a sphere.
function LatLonDiagram() {
  return (
    <svg viewBox="0 0 480 280" role="img" aria-label="Latitude / longitude to 3D point">
      {/* Globe outline */}
      <circle cx="240" cy="140" r="110" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      {/* Equator */}
      <ellipse cx="240" cy="140" rx="110" ry="22" fill="none" stroke="rgba(255,255,255,0.16)" strokeDasharray="3 4" />
      {/* Prime meridian */}
      <ellipse cx="240" cy="140" rx="22" ry="110" fill="none" stroke="rgba(255,255,255,0.16)" strokeDasharray="3 4" />
      {/* Sample point ~ (lat 35, lon -25) */}
      <circle cx="207" cy="100" r="4" fill="#fff" />
      <line x1="240" y1="140" x2="207" y2="100" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
      {/* Labels */}
      <text x="14" y="20" fill="rgba(255,255,255,0.7)" fontSize="12" style={{ fontFamily: 'var(--font-mono)' }}>
        +Y (north pole)
      </text>
      <text x="14" y="270" fill="rgba(255,255,255,0.4)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        x = cos(lat) · sin(lon)
      </text>
      <text x="200" y="270" fill="rgba(255,255,255,0.4)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        y = sin(lat)
      </text>
      <text x="320" y="270" fill="rgba(255,255,255,0.4)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        z = cos(lat) · cos(lon)
      </text>
      <text x="215" y="92" fill="#fff" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        lat / lon
      </text>
    </svg>
  );
}

// L-path diagram: snake travels meridian then parallel.
function SnakePathDiagram() {
  return (
    <svg viewBox="0 0 460 240" role="img" aria-label="Snake L-shaped grid path">
      {/* Grid */}
      {[40, 100, 160, 220, 280, 340, 400].map((x) => (
        <line key={`v${x}`} x1={x} y1="20" x2={x} y2="220" stroke="rgba(255,255,255,0.08)" />
      ))}
      {[20, 60, 100, 140, 180, 220].map((y) => (
        <line key={`h${y}`} x1="20" y1={y} x2="440" y2={y} stroke="rgba(255,255,255,0.08)" />
      ))}
      {/* Start cross */}
      <g transform="translate(100, 60)">
        <line x1="-6" y1="0" x2="6" y2="0" stroke="#fff" strokeWidth="1.5" />
        <line x1="0" y1="-6" x2="0" y2="6" stroke="#fff" strokeWidth="1.5" />
      </g>
      <text x="80" y="40" fill="#fff" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        start
      </text>
      {/* End cross */}
      <g transform="translate(340, 180)">
        <line x1="-6" y1="0" x2="6" y2="0" stroke="#fff" strokeWidth="1.5" />
        <line x1="0" y1="-6" x2="0" y2="6" stroke="#fff" strokeWidth="1.5" />
      </g>
      <text x="320" y="208" fill="#fff" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        end
      </text>
      {/* L path */}
      <path
        d="M100 60 L100 180 L340 180"
        stroke="#9ed8ff"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Annotations */}
      <text x="60" y="125" fill="rgba(158,216,255,0.85)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        meridian (lon fixed)
      </text>
      <text x="200" y="172" fill="rgba(158,216,255,0.85)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        parallel (lat fixed)
      </text>
    </svg>
  );
}

// Spring response diagram — settling oscillator.
function SpringDiagram() {
  // Simulate an underdamped oscillator settling to 0 from x=1.
  const samples: { x: number; y: number }[] = [];
  const k = 110;
  const c = 18;
  const m = 1;
  let x = 1;
  let v = 0;
  const dt = 1 / 240; // tiny step for a clean curve
  const endT = 1.6;
  for (let t = 0; t <= endT; t += dt) {
    const a = (-k * x - c * v) / m;
    v += a * dt;
    x += v * dt;
    samples.push({ x: t, y: x });
  }
  const w = 460;
  const h = 200;
  const padX = 36;
  const padY = 16;
  const xMax = endT;
  const yMax = 0.8; // visual bounds
  const yMin = -0.4;
  const sx = (t: number) => padX + (t / xMax) * (w - 2 * padX);
  const sy = (yy: number) => padY + ((yMax - yy) / (yMax - yMin)) * (h - 2 * padY);
  const path = samples
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Spring settling response">
      {/* Zero line */}
      <line x1={padX} y1={sy(0)} x2={w - padX} y2={sy(0)} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
      <text x={w - padX + 4} y={sy(0) + 4} fill="rgba(255,255,255,0.5)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        rest
      </text>
      {/* Start label */}
      <text x={padX} y={padY - 4} fill="rgba(255,255,255,0.6)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        x = 1 (just released)
      </text>
      {/* Curve */}
      <path d={path} stroke="#9ed8ff" strokeWidth="1.6" fill="none" />
      <text x={w / 2} y={h - 2} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        time →
      </text>
    </svg>
  );
}

// Parallax diagram — two shells render to different pixels.
function ParallaxDiagram() {
  return (
    <svg viewBox="0 0 460 240" role="img" aria-label="Two-shell parallax">
      {/* Inner sphere */}
      <circle cx="240" cy="120" r="80" fill="none" stroke="rgba(255,255,255,0.2)" />
      {/* Outer sphere */}
      <circle cx="240" cy="120" r="92" fill="none" stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
      {/* Camera */}
      <circle cx="40" cy="120" r="5" fill="#fff" />
      <text x="20" y="148" fill="rgba(255,255,255,0.7)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        camera
      </text>
      {/* Two points along same direction at different radii */}
      <circle cx="295" cy="62" r="3.5" fill="#9ed8ff" />
      <text x="300" y="58" fill="#9ed8ff" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        snake (R=1.0)
      </text>
      <circle cx="304" cy="55" r="3.5" fill="#ffb09e" />
      <text x="312" y="40" fill="#ffb09e" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        cross (R=1.005)
      </text>
      {/* Rays from camera */}
      <line x1="40" y1="120" x2="295" y2="62" stroke="rgba(158,216,255,0.55)" strokeWidth="1" />
      <line x1="40" y1="120" x2="304" y2="55" stroke="rgba(255,176,158,0.55)" strokeWidth="1" />
      <text x="100" y="225" fill="rgba(255,255,255,0.4)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        Two points along the same direction at different radii project to different screen pixels.
      </text>
    </svg>
  );
}

/* ── Code excerpts (kept short — details are in experiment.ts) ──── */

const CODE_LATLON = `function latLonToVec3(latDeg, lonDeg, radius, out) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const c = Math.cos(lat);
  out.set(
    c * Math.sin(lon) * radius,   // x
    Math.sin(lat) * radius,       // y (north pole = +Y)
    c * Math.cos(lon) * radius,   // z
  );
  return out;
}`;

const CODE_GRID = `// Build the wireframe as one big LineSegments buffer:
// each meridian and parallel sampled at 64 points,
// emitted as consecutive vertex pairs.
function buildGridPositions(lonSeg, latSeg) {
  const subdiv = 64;
  const pairs = [];
  // Meridians (vertical, lon fixed)
  for (let i = 0; i < lonSeg; i++) {
    const lon = -180 + (360 * i) / lonSeg;
    let prev = null;
    for (let j = 0; j <= subdiv; j++) {
      const lat = -90 + 180 * (j / subdiv);
      const p = latLonToVec3(lat, lon, 1);
      if (prev) pairs.push(prev.x,prev.y,prev.z, p.x,p.y,p.z);
      prev = p.clone();
    }
  }
  // Parallels (horizontal, lat fixed) — same idea, skip the poles.
  // ...
  return new Float32Array(pairs);
}`;

const CODE_SNAP = `// Snap to the actual drawn grid lattice:
//   meridians at  -180 + k·lonStep
//   parallels at   -90 + k·latStep   (poles excluded)
const snapLon = (l) => {
  let k = Math.round((l + 180) / lonStep);
  k = ((k % lonSeg) + lonSeg) % lonSeg;     // wrap the 180/-180 seam
  return -180 + k * lonStep;
};
const snapLat = (l) => {
  const k = Math.max(1, Math.min(latSeg - 1,
    Math.round((l + 90) / latStep),
  ));
  return -90 + k * latStep;
};`;

const CODE_SNAKE_PATH = `function buildSnakePath(start, end, samples = 80) {
  const path = [];

  // Segment 1 — travel along the meridian at start.lon
  // (lat varies, lon fixed). This *is* the wireframe meridian arc.
  const seg1 = Math.max(4, Math.round(samples * 0.5));
  for (let i = 0; i <= seg1; i++) {
    const t = i / seg1;
    const lat = THREE.MathUtils.lerp(start.lat, end.lat, t);
    path.push(latLonToVec3(lat, start.lon, MARKER_RADIUS));
  }

  // Pick the shorter direction in longitude
  let dLon = end.lon - start.lon;
  if (dLon > 180)  dLon -= 360;
  if (dLon < -180) dLon += 360;

  // Segment 2 — travel along the parallel at end.lat
  // (lon varies, lat fixed). Matches the wireframe parallel.
  const seg2 = Math.max(4, Math.round(samples * 0.5));
  for (let i = 1; i <= seg2; i++) {
    const t = i / seg2;
    path.push(latLonToVec3(end.lat, start.lon + dLon * t, MARKER_RADIUS));
  }
  return path;
}`;

const CODE_TAIL = `// The tail is a damped harmonic oscillator pulled toward
//   target = headDist − minGap   (while travelling / paused)
//   target = headDist             (during wind-up so the trail closes)
// Sub-stepped 4× per frame so the spring stays stable when dt spikes.
const stiffness = 10 + trailFollow * 200;
const damping   = 0.7 * 2 * Math.sqrt(stiffness);
const target = phase === 'wind-up' ? headDist : headDist - minGap;

const STEPS = 4;
const h = dt / STEPS;
for (let s = 0; s < STEPS; s++) {
  const error = target - tailDist;
  const accel = stiffness * error - damping * tailVel;
  tailVel  += accel * h;
  tailDist += tailVel * h;
}

// Clamp gap to [minGap, maxGap] in non-wind-up phases.
if (phase !== 'wind-up') {
  if (tailDist > headDist - minGap) tailDist = headDist - minGap;
  if (tailDist < headDist - maxGap) tailDist = headDist - maxGap;
}`;

const CODE_SPRING = `// Semi-implicit (symplectic) Euler — update v from x first,
// then x from the new v. More stable than explicit Euler for
// linear oscillators. Sub-stepped 4× per frame so a stiff
// spring doesn't blow up if dt spikes (tab refocus, GC pause).
const steps = 4;
const h = dt / steps;
for (let i = 0; i < steps; i++) {
  const aYaw   = (-stiffness * yawOffset   - damping * yawVel)   / mass;
  const aPitch = (-stiffness * pitchOffset - damping * pitchVel) / mass;
  yawVel   += aYaw * h;
  pitchVel += aPitch * h;
  yawOffset   += yawVel * h;
  pitchOffset += pitchVel * h;
}`;

const CODE_BEZIER = `// Cubic-bezier easing(u): solve x(t) = u for t (Newton, 6 iters),
// then return y(t). Same idea CSS uses for cubic-bezier(c1x,c1y,c2x,c2y).
function cubicBezier(c1x, c1y, c2x, c2y) {
  const cx = (t) => 3*(1-t)**2*t*c1x + 3*(1-t)*t**2*c2x + t**3;
  const cy = (t) => 3*(1-t)**2*t*c1y + 3*(1-t)*t**2*c2y + t**3;
  return (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let t = u;                                 // good initial guess
    for (let i = 0; i < 6; i++) {
      const x = cx(t);
      const dx = 3*(1-t)**2*c1x + 6*(1-t)*t*(c2x-c1x) + 3*t*t*(1-c2x);
      if (Math.abs(dx) < 1e-6) break;          // avoid divide-by-zero
      t -= (x - u) / dx;
      if (t < 0) t = 0; if (t > 1) t = 1;
    }
    return cy(t);
  };
}`;

const CODE_LABEL_WRAP = `// CSS2DRenderer rewrites element.style.transform every frame
// to project a world point to screen pixels. So if we put our
// labelOffsetY translate on the same element, it gets clobbered.
// Solution: wrap. The wrapper gets the projection. The inner
// span carries our offset.
const wrap = document.createElement('div');
wrap.style.pointerEvents = 'none';
this.labelEl = document.createElement('span');
this.labelEl.className = 'globe-1-label-root';   // transform: translateY(...)
this.labelEl.textContent = country.name;
wrap.appendChild(this.labelEl);
this.label = new CSS2DObject(wrap);`;

const CODE_RADIUS = `// One radius for both — no parallax between cross and snake.
const GLOBE_RADIUS = 1.0;
const MARKER_RADIUS = GLOBE_RADIUS;

// Cross sits exactly on the sphere shell:
latLonToVec3(latDeg, lonDeg, MARKER_RADIUS, this.basePosition);

// Snake-path samples sit on the same shell:
path.push(latLonToVec3(lat, start.lon, MARKER_RADIUS));`;

/* ── TOC ─────────────────────────────────────────────── */

export const TOC_SECTIONS = [
  { id: 'overview', label: 'The Big Picture' },
  { id: 'why-three', label: 'Why Three.js Here' },
  { id: 'coordinates', label: 'Lat/Lon to 3D' },
  { id: 'wireframe', label: 'The Wireframe' },
  { id: 'crosses', label: 'The Crosses' },
  { id: 'labels', label: 'The Labels' },
  { id: 'snap', label: 'Snapping to Lines' },
  { id: 'snake', label: 'The Snake Animation' },
  { id: 'easing', label: 'Easing Curves' },
  { id: 'drag', label: 'Drag + Spring' },
  { id: 'parallax', label: 'The Parallax Bug' },
  { id: 'caveats', label: 'Honest Caveats' },
] as const;

function useActiveSection(scrollRef: React.RefObject<HTMLElement | null>) {
  const [activeId, setActiveId] = useState<string>(TOC_SECTIONS[0].id);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { root: container, rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    );
    for (const { id } of TOC_SECTIONS) {
      const el = container.querySelector(`#${id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [scrollRef]);
  return activeId;
}

/* ── Main Article ──────────────────────────────────── */

export function Globe1Article() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeSection = useActiveSection(scrollRef);
  const { setActiveSection, setTocSections, scrollToSectionRef } = useChrome();

  const scrollTo = useCallback((id: string) => {
    const el = scrollRef.current?.querySelector(`#${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    setTocSections([...TOC_SECTIONS]);
    return () => setTocSections([]);
  }, [setTocSections]);

  useEffect(() => {
    setActiveSection(activeSection);
  }, [activeSection, setActiveSection]);

  useEffect(() => {
    scrollToSectionRef.current = scrollTo;
    return () => {
      scrollToSectionRef.current = null;
    };
  }, [scrollTo, scrollToSectionRef]);

  return (
    <motion.div
      className="article-page"
      ref={scrollRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* ── Hero ── */}
      <header className="article-hero">
        <p className="article-hero-eyebrow">Deep Dive</p>
        <h1>How the Globe Works</h1>
        <p className="article-hero-lead">
          A thorough, beginner-friendly walk through everything that goes into the wireframe globe — the geometry, the labels, the snake animation, the drag-and-release spring, and the bugs we caught along the way.
        </p>
      </header>

      {/* ── TOC sidebar ── */}
      <aside className="article-toc">
        <ul className="article-toc-list">
          {TOC_SECTIONS.map(({ id, label }) => (
            <li key={id} className="article-toc-item">
              <button
                className={`article-toc-link${activeSection === id ? ' active' : ''}`}
                onClick={() => scrollTo(id)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Body ── */}
      <div className="article-body">
        {/* ────────────────────────────────────────── */}
        <span className="article-section-num">01</span>
        <h2 id="overview">The Big Picture</h2>

        <p>
          What you see is a <strong>3D scene</strong> — a sphere centred at the world origin, with a wireframe of latitude and longitude lines drawn on it, country markers placed at specific lat/lon coordinates, and an animated trail that periodically lights up between random country pairs. The whole thing is rendered through <a href="https://threejs.org/" target="_blank" rel="noreferrer">Three.js</a>, which is a JavaScript library that wraps WebGL — the browser's low-level interface to your GPU.
        </p>
        <p>
          Unlike many of the other experiments in this gallery, this one is not "a fragment shader running on a fullscreen quad". It's a regular 3D scene with meshes, lines, sprites, and a camera. The reason will be clearer once we get into the weeds, but the short version is: drawing labels with crisp text, picking which country a click lands on, and spinning the globe with a mouse drag are all dramatically easier when you have an actual 3D scene to work with than when you're computing every pixel from scratch in a shader.
        </p>
        <p>
          The visible result is composed of four overlapping layers, each a separate Three.js object. The order they draw in is what makes the snake appear to glow over the wireframe rather than under it:
        </p>

        <div className="article-diagram-wrapper">
          <LayerStackDiagram />
        </div>

        <p>
          We'll build them up one at a time. Along the way we'll hit a few real bugs we had to fix, and a couple of things that look right but are technically "wrong-but-it-works" — those are honest about what's happening rather than papering over it.
        </p>

        <hr className="article-divider" />

        {/* ────────────────────────────────────────── */}
        <span className="article-section-num">02</span>
        <h2 id="why-three">Why Three.js Instead of a Shader</h2>

        <p>
          In a fragment-shader scene, the GPU runs the same program for every pixel and you compute that pixel's colour from scratch. That's incredibly powerful for procedural patterns like noise fields and aurora — but it's a lousy fit for jobs where you need:
        </p>
        <ul>
          <li><strong>Crisp text labels.</strong> Drawing real type with kerning and antialiasing inside a shader is technically possible but expensive and error-prone. The browser already has the world's best text renderer — we'd rather use that.</li>
          <li><strong>Mouse picking.</strong> "Which country is the cursor over?" is straightforward in a 3D scene (project to screen, check distance) but requires extra work in a pure shader.</li>
          <li><strong>Multiple coordinate systems.</strong> The wireframe is on a sphere. The labels are pixel-positioned overlays. The mouse is in screen pixels. The drag-rotation is a quaternion. Three.js has matrix and projection plumbing for all of this; doing it ourselves in a shader uniform would mean re-deriving viewing transforms by hand.</li>
        </ul>
        <p>
          So we treat WebGL as a 3D engine, not a giant shader sandbox. Three.js gives us a <code>Scene</code>, a <code>PerspectiveCamera</code>, and a <code>WebGLRenderer</code> that draws the scene each frame. The framework also provides specialised objects we lean on heavily: <code>LineSegments</code> for the wireframe, <code>Sprite</code> for billboarded crosses, <code>CSS2DRenderer</code> for HTML labels, and a thicker line called <code>Line2</code> for the snake trail.
        </p>

        <hr className="article-divider" />

        {/* ────────────────────────────────────────── */}
        <span className="article-section-num">03</span>
        <h2 id="coordinates">Latitude / Longitude → 3D Point</h2>

        <p>
          Every country has a <strong>latitude</strong> (how far north or south of the equator, in degrees from -90 at the south pole to +90 at the north) and a <strong>longitude</strong> (how far east or west of the prime meridian, in degrees from -180 to +180). The grid lines on the globe are isolines: a meridian is a vertical arc where longitude is constant; a parallel is a horizontal circle where latitude is constant.
        </p>
        <p>
          To place a marker, we need to convert these two angles into a 3D point on a unit sphere. The formula is the standard spherical-to-Cartesian mapping with Y as the polar axis:
        </p>

        <div className="article-diagram-wrapper">
          <LatLonDiagram />
        </div>

        <CodeBlock code={CODE_LATLON} caption="src/experiments/globe-1/experiment.ts — latLonToVec3" />

        <p>
          The choice of "Y is up, +Z is the prime meridian" is a convention; some engines use Z-up. What matters is consistency: whatever convention the marker uses, the wireframe must use the same one, otherwise the cross will land in the wrong place. We use this same function for all three uses: drawing the grid, positioning country crosses, and sampling the snake's path.
        </p>

        <hr className="article-divider" />

        {/* ────────────────────────────────────────── */}
        <span className="article-section-num">04</span>
        <h2 id="wireframe">The Wireframe</h2>

        <p>
          The wireframe is one big <code>THREE.LineSegments</code> mesh. We could have used a <code>THREE.SphereGeometry</code> and drawn just its edges — but we want artistic control over how many meridians and parallels appear, separately from each other, and we want to skip the poles cleanly. So we build the geometry by hand.
        </p>
        <p>
          For each of <code>lonSegments</code> meridians, we sample the arc from the south pole to the north pole at 64 points and emit consecutive vertex pairs (so each pair becomes one drawn segment). Same for each of <code>latSegments</code> parallels (skipping the actual poles, where all longitudes collapse to a single point):
        </p>

        <CodeBlock code={CODE_GRID} caption="experiment.ts — buildGridPositions" />

        <p>
          A note on line width: <strong>WebGL doesn't reliably let you draw lines thicker than 1 CSS pixel.</strong> The spec only requires implementations to support a width of 1.0, and every desktop browser clamps to that. Three.js does call <code>gl.lineWidth(...)</code> internally, but on the web that call is effectively ignored. So our wireframe is always 1 px wide.
        </p>
        <p>
          That's actually fine for the wireframe — we want it subtle. But it would be a problem for the snake trail, where we want a visibly thicker glowing line. We'll come back to that.
        </p>

        <hr className="article-divider" />

        {/* ────────────────────────────────────────── */}
        <span className="article-section-num">05</span>
        <h2 id="crosses">The Crosses</h2>

        <p>
          The little <code>+</code> at each country can be drawn two ways. The toggle in the panel — "Cross On Surface" — picks between them.
        </p>
        <h3>Mode A — billboard (Sprite)</h3>
        <p>
          A <code>THREE.Sprite</code> is a quad that's always rotated to face the camera. The Sprite's vertex shader takes the translation column of the model-view matrix and ignores the rotation, so no matter where you swing the camera, the quad's flat face stays perpendicular to the view. That's perfect for icons that should stay legible at any angle.
        </p>
        <p>
          The texture is a tiny canvas — 64×64 pixels — drawn once at startup with two thin white lines making a <code>+</code>. Three.js uploads that as a <code>CanvasTexture</code> and the sprite material samples it each frame.
        </p>
        <h3>Mode B — tangent plane (Mesh)</h3>
        <p>
          For a more "stuck to the surface" look, we replace the Sprite with a tiny <code>PlaneGeometry</code> oriented so its surface normal aligns with the sphere's surface normal at that lat/lon. Same texture, same colour, same size — only the orientation differs. Near the centre of the visible disc, the plane is flat-on to the camera and looks similar to the Sprite. Near the limb, the plane foreshortens and reads like a sticker on a globe.
        </p>
        <p>
          We orient the plane with <code>mesh.lookAt(0, 0, 0)</code>, which targets the world origin (= sphere centre). One small subtlety: <code>Object3D.lookAt</code> on a <code>Mesh</code> orients local <strong>+Z toward the target</strong> (it's only on cameras and lights that the convention is reversed to look at things from behind). So <code>lookAt(0,0,0)</code> actually points the plane's "front" inward — but that's harmless because the plane uses <code>side: THREE.DoubleSide</code>, so it's visible from either direction. The plane is tangent regardless of which face is outward.
        </p>
        <p>
          A single shared <code>PlaneGeometry</code> instance is reused across all the country meshes. Three.js uploads the geometry once to the GPU and each mesh draws it at its own world position — that's the standard way to share static geometry.
        </p>

        <hr className="article-divider" />

        {/* ────────────────────────────────────────── */}
        <span className="article-section-num">06</span>
        <h2 id="labels">The Labels (with a Real Bug Story)</h2>

        <p>
          The text under each cross is not drawn by WebGL at all. It's a real DOM element — an HTML <code>{'<span>'}</code> — positioned over the canvas by an overlay called <code>CSS2DRenderer</code>. Each frame, the renderer takes a Three.js world point, projects it through the camera matrix to a screen-space pixel, and writes that pixel position to the element's CSS transform. The browser then paints the text the same way it paints any other DOM, so we get high-quality kerning, antialiasing, font hinting, and accessibility for free.
        </p>
        <p>
          That projection is exactly the bit that bit us. Here's the bug — it's worth understanding because it's the kind of thing that's invisible until it's obvious:
        </p>
        <p>
          We initially put the styled <code>{'<span>'}</code> directly under <code>CSS2DObject</code>, with our own <code>transform: translateY(labelOffsetY)</code> on it via a CSS class. The labelOffsetY slider in the panel did nothing — the labels stayed glued to the cross. The reason: <strong>CSS2DRenderer assigns its own inline <code>transform</code> to the same element every single frame</strong>, and inline styles always beat CSS-class styles. Our offset got overwritten 60 times a second.
        </p>
        <p>
          The fix is structural, not a hack: wrap the styled span in a container div, hand <em>the container</em> to CSS2DRenderer, and put our offset on the inner span. The container gets the per-frame projection; the span keeps our offset and is rendered relative to the (now correctly-projected) container.
        </p>

        <CodeBlock code={CODE_LABEL_WRAP} caption="experiment.ts — wrapping the label so the offset survives" />

        <p>
          This is the kind of thing you only learn by hitting it. The lesson: when something silently doesn't take effect, suspect that something else is overwriting it before you suspect your own logic.
        </p>

        <hr className="article-divider" />

        {/* ────────────────────────────────────────── */}
        <span className="article-section-num">07</span>
        <h2 id="snap">Snapping Countries to Grid Lines</h2>

        <p>
          A country in the input JSON is just <code>{'{'} name, lat, lon {'}'}</code>. But the wireframe has a discrete grid: meridians every <code>360/lonSegments</code> degrees, parallels every <code>180/latSegments</code> degrees. If you type lat=57 and the grid only has parallels at multiples of 9.47°, where does the cross go?
        </p>
        <p>
          That's controlled by the <strong>snap mode</strong>. There are five:
        </p>
        <ul>
          <li><code>free</code> — no snap. Cross goes exactly where you typed.</li>
          <li><code>meridian</code> — snap longitude only. Cross sits on a vertical grid line, latitude free.</li>
          <li><code>parallel</code> — snap latitude only. Cross sits on a horizontal grid line, longitude free.</li>
          <li><code>intersection</code> — snap both. Cross lands at a grid corner.</li>
          <li><code>nearest line</code> — snap whichever axis is closer. Cross is on <em>a</em> line, not necessarily a corner.</li>
        </ul>
        <p>
          The snap was originally buggy. It rounded to multiples of <code>step</code> starting from zero (so 0, ±step, ±2·step, …), which only matches the actual grid when 180° is divisible by <code>step</code>. For 24×12 (15° intervals) it happened to work; for 21×19 (17.14° / 9.47°) the snap landed dead-centre <em>between</em> grid lines and every country drifted into the middle of a cell.
        </p>
        <p>
          The fix was to snap to the actual lattice the wireframe is drawn on:
        </p>

        <CodeBlock code={CODE_SNAP} caption="experiment.ts — snap to the real grid lattice" />

        <p>
          This is a <em>fundamental</em> fix, not an offset. The grid was always at <code>-180 + k·step</code>; we now snap to the same expression. Both the cross's position <em>and</em> the snake's path endpoints use the same snapped values, so when the snake travels "along the meridian Norwegen sits on", it really does follow the grid line, not a parallel ghost lattice.
        </p>

        <hr className="article-divider" />

        {/* ────────────────────────────────────────── */}
        <span className="article-section-num">08</span>
        <h2 id="snake">The Snake Animation</h2>

        <p>
          Periodically, two random countries are picked and a glowing trail traces a path between them along the grid. The path is L-shaped: it travels the meridian at the start country down (or up) to the destination's latitude, then travels the parallel sideways to the destination's longitude.
        </p>

        <div className="article-diagram-wrapper">
          <SnakePathDiagram />
        </div>

        <p>
          Why an L-shape? Because the path stays exactly on the wireframe. Holding longitude constant while sweeping latitude traces the meridian arc that's already drawn. Holding latitude constant while sweeping longitude traces the parallel circle that's already drawn. Neither is a great-circle path between the two cities (that would cut diagonally across cells), but visually it looks like the snake is slithering through the grid, which is the effect we want.
        </p>

        <CodeBlock code={CODE_SNAKE_PATH} caption="experiment.ts — buildSnakePath" />

        <h3>Why a Line2 and not a regular Line</h3>
        <p>
          As we noted earlier, the WebGL <code>LINE</code> primitive is stuck at 1 CSS pixel wide. For the wireframe that's fine. For the snake — which we want visibly thicker so it reads as a glowing trail — we use <code>Line2</code>, an extension shipped in <code>three/examples/jsm/lines/</code>. Line2 doesn't draw real lines: it draws each segment as a <strong>thin quad</strong> (two triangles) sized in screen-space pixels. That's what makes <code>linewidth</code> actually work.
        </p>
        <p>
          The trade-off is it costs more — instanced quads with vertex math in the shader — but for one polyline of ~93 points (the trail length) it's negligible. The material has a <code>resolution</code> uniform that <em>must</em> be set whenever the canvas resizes, otherwise the line renders at the wrong width. We do that in the resize handler.
        </p>

        <h3>How the head and tail are coupled</h3>
        <p>
          The trail is a window of N sample points behind a moving head — but the simple "tail = head − fixed length" approach feels robotic when the head accelerates and decelerates. Instead, the tail is a <strong>damped harmonic oscillator</strong> pulled toward the head, with a minimum gap so it never overlaps and a maximum gap so it can't drift arbitrarily far behind. When the head accelerates, the tail can't keep up so the trail visibly stretches; when the head pauses or stops, the tail catches up exponentially-ish, briefly continuing forward before settling — that overshoot is what kills the "rigid" feel.
        </p>

        <CodeBlock code={CODE_TAIL} caption="experiment.ts — spring tail with min/max gap clamping" />

        <p>
          Three knobs in the panel control this: <code>snakeTrailMin</code> is the resting gap (the trail can't shrink below it), <code>snakeTrailLength</code> is the stretch cap (it can't grow past it), and <code>snakeTrailFollow</code> is a single tightness slider that maps to a stiffness/damping pair. A higher follow value = stiffer spring = the tail tracks the head closely; lower = lazy/very stretchy.
        </p>

        <h3>Continuous mode (one path that grows)</h3>
        <p>
          When <code>snakeContinuous</code> is on, the snake doesn't wind up and restart between routes. Instead, the head <em>pauses</em> at each destination for a random short interval, then a new leg is appended to the same path array. The trail is a fixed-length window behind the head along the cumulative-length axis, so it flows seamlessly across each leg's join — there's no visible "restart" because nothing actually restarts. After many minutes of operation we periodically prune the front of the path (everything behind the tail is no longer needed) so memory doesn't grow unbounded.
        </p>

        <h3>The GPS-arrow icon</h3>
        <p>
          A small SVG arrow rides at the snake's head, oriented to face the direction of travel. It's a <code>CSS2DObject</code> parented to the same group as the globe, so its position auto-tracks rotation. Each frame we project both the head and a point slightly behind it through the camera matrix, take the screen-space delta, and rotate the SVG by <code>atan2(dx, dy)</code> in CSS rotation convention (clockwise from up). The icon fades out smoothly when the head wraps around to the back hemisphere, using the same limb test as the country crosses.
        </p>

        <hr className="article-divider" />

        {/* ────────────────────────────────────────── */}
        <span className="article-section-num">09</span>
        <h2 id="easing">Easing — Cubic Bezier &amp; Springs</h2>

        <p>
          The snake doesn't move at constant speed. It accelerates from rest, decelerates as it approaches the destination, and the curve of that motion is a <strong>cubic Bezier easing</strong>, the same kind CSS uses with <code>cubic-bezier(c1x, c1y, c2x, c2y)</code>. The DialKit easing control even lets you drag the two control points visually.
        </p>
        <p>
          A cubic Bezier curve from (0,0) to (1,1) with two intermediate control points has parametric form
          <em> x(t), y(t) </em> for <em>t ∈ [0,1]</em>. To use it as an easing function, we want <em>y</em> as a function of <em>x</em>: given a normalised time <em>u</em>, find <em>t</em> such that <em>x(t) = u</em>, then return <em>y(t)</em>. There's no closed form for that inversion, so we do <strong>Newton's method</strong>:
        </p>

        <CodeBlock code={CODE_BEZIER} caption="experiment.ts — cubic-bezier easing solver" />

        <p>
          Six iterations is plenty in practice. The Newton step squares the error each time on smooth functions, so starting from <code>t = u</code> (already a good initial guess) we end up with sub-millionth precision in five or six steps. The browser's reference implementation in WebKit uses four iterations plus a bisection fallback — six is safer but still cheap.
        </p>
        <p>
          <strong>Honest caveat.</strong> If a user picks a Bezier where <code>c1x</code> or <code>c2x</code> falls outside <code>[0,1]</code>, the curve <code>x(t)</code> can be non-monotonic — meaning Newton can stall or oscillate at a point where the derivative crosses zero. We clamp <code>t</code> to <code>[0,1]</code> and bail when the derivative shrinks below <code>1e-6</code>, but in pathological cases the result can silently be off. DialKit's easing UI keeps both control points inside <code>[0,1]</code>, so this is latent rather than active. If we ever expose those values directly, we'd want to fall back to bisection.
        </p>

        <h3>Springs (the other transition mode)</h3>
        <p>
          DialKit's transition control also offers a "spring" flavour — instead of a curve, you give a <code>visualDuration</code> and a <code>bounce</code> parameter, and the system simulates an underdamped harmonic oscillator. For the snake we use the easing curve, but for the drag-and-release behaviour (next section), we use a real spring.
        </p>

        <hr className="article-divider" />

        {/* ────────────────────────────────────────── */}
        <span className="article-section-num">10</span>
        <h2 id="drag">Drag Rotation + Spring-Back</h2>

        <p>
          You can grab the globe with the mouse or finger and rotate it. When you let go, the globe springs back to its base orientation — not instantly, but with a soft bounce. That's a real physical simulation, not a CSS transition.
        </p>
        <p>
          The maths is the textbook damped harmonic oscillator: a mass on a spring with friction. There's a stiffness <em>k</em> (how aggressively the spring pulls), a damping coefficient <em>c</em> (how aggressively friction resists motion), and a mass <em>m</em>. The position satisfies
        </p>
        <pre className="article-equation">
          m · ẍ = − k · x − c · ẋ
        </pre>
        <p>
          We integrate this every frame with <strong>semi-implicit Euler</strong> (also called symplectic Euler): update velocity first using the current position, then update position using the new velocity. That ordering is more stable than explicit Euler — it conserves energy bounds for linear oscillators, so the spring won't blow up over many steps.
        </p>

        <CodeBlock code={CODE_SPRING} caption="experiment.ts — drag spring sub-stepped 4× per frame" />

        <p>
          The shape of the response when you release at offset 1.0 (with default stiffness 110, damping 18, mass 1) looks like this:
        </p>

        <div className="article-diagram-wrapper">
          <SpringDiagram />
        </div>

        <h3>Why sub-stepping</h3>
        <p>
          A spring of natural angular frequency <em>ω = √(k/m)</em> needs an integration step <em>h</em> roughly smaller than <em>2/ω</em> to stay stable. With our defaults that's about 190 ms — easily satisfied by a 16 ms frame. But frame deltas can spike: a tab that lost focus can be paused for a second, a garbage-collection pause can stall for 100 ms, and on a slow phone you can see 33+ ms frames. By dividing each frame into four sub-steps, we keep <em>h</em> small enough that even a 100 ms hiccup doesn't make the spring explode.
        </p>
        <p>
          <strong>Honest caveat.</strong> Four sub-steps is comfortable at default stiffness. At extreme stiffness — say <em>k</em> = 10,000 — the natural frequency is 100 rad/s and the boundary becomes <em>h</em> &lt; 0.02 s; a 33 ms frame split four ways gives <em>h</em> ≈ 8.3 ms, which is over the boundary. The integrator would start to misbehave. We don't adaptively pick the sub-step count from the current stiffness, so cranking the slider to a pathological value <em>can</em> cause the simulation to blow up. The DialKit slider's max keeps you well under that, so it's a latent issue.
        </p>

        <hr className="article-divider" />

        {/* ────────────────────────────────────────── */}
        <span className="article-section-num">11</span>
        <h2 id="parallax">The Parallax Bug</h2>

        <p>
          For a long time, when you watched closely, the snake's glowing trail was always about 1 pixel offset from the cross it was supposedly arriving at. The offset was tiny near the centre of the visible globe and biggest near the limb — a tell-tale parallax fingerprint. The fix is worth dwelling on because the symptom looks like a rendering bug and the cause is a maths bug.
        </p>

        <div className="article-diagram-wrapper">
          <ParallaxDiagram />
        </div>

        <p>
          The crosses had been positioned at <code>radius * 1.005</code> — a small "lift" off the surface, originally to avoid z-fighting with the wireframe. The snake-path samples were at <code>radius * 1.0</code>. Both used the same lat/lon, but they were on <em>different shells</em>, so when the camera projected them to the screen, "the same direction in world space" produced two slightly different pixel coordinates.
        </p>
        <p>
          The lift wasn't actually doing any z-fighting work either, because both materials use <code>depthTest: false</code> and <code>renderOrder</code>: the order they draw in is decided explicitly, not by depth comparisons. So the lift was costing us alignment for no benefit.
        </p>
        <p>
          The fix is one shared constant:
        </p>

        <CodeBlock code={CODE_RADIUS} caption="experiment.ts — one shell for both" />

        <p>
          Now any country's cross and any snake-path sample at the same lat/lon project to the <em>same pixel</em>, every frame, every viewing angle. The lesson: when two things are supposed to overlap exactly, they should compute their world position from <em>exactly the same expression</em>. Any subtle drift between the two calculations becomes a visible bug at oblique angles.
        </p>

        <hr className="article-divider" />

        {/* ────────────────────────────────────────── */}
        <span className="article-section-num">12</span>
        <h2 id="caveats">Honest Caveats</h2>

        <p>
          A complete picture wouldn't be honest if we only described the wins. A few things are working but worth flagging:
        </p>

        <h3>The country editor is custom DOM, not native DialKit</h3>
        <p>
          The inline editor that lives inside the Countries folder of the dial panel — the one with one row per country — is implemented by injecting our own <code>{'<div>'}</code> into the panel's DOM and styling it to match DialKit's CSS variables. DialKit doesn't expose a public "custom control" API, so we use a <code>MutationObserver</code> to wait for the panel to mount, find the Countries folder by its title text, and append our editor inside it. This works today; it would break if DialKit changed its internal class names.
        </p>
        <p>
          We considered the more "native" approach: one DialKit folder per country with sliders inside. The reason we didn't ship that: the framework's caching layer flattens nested folder values by leaf-key name, so <code>lat</code> in 8 country folders all collide. Either each country gets prefixed keys (<code>norLat</code>, <code>nieLat</code>, ugly labels) or the framework has to learn to handle nested folders. The custom-DOM editor is the lesser of those two evils — but it's worth knowing the trade-off you'd face if you tried the same.
        </p>

        <h3>Newton on user-supplied bezier control points</h3>
        <p>
          As mentioned above, the cubic-bezier solver assumes monotonic <code>x(t)</code>. DialKit's UI keeps the user inside that range, but if a preset ever shipped with control points outside <code>[0,1]</code>, the solver could silently return slightly wrong values. We'd want a bisection fallback if we exposed those values directly.
        </p>

        <h3>Spring stability at extreme stiffness</h3>
        <p>
          Four-step sub-integration is stable for the slider range we expose, but not infinitely. At stiffness much higher than ~1000 (orders of magnitude beyond the slider max), the spring-back can blow up if a frame delta is large.
        </p>

        <h3>Cross-on-surface side: DoubleSide is a workaround, not a fix</h3>
        <p>
          The tangent-plane mesh uses <code>side: THREE.DoubleSide</code> because <code>Object3D.lookAt</code>, when called on a Mesh, orients local +Z toward the target — meaning <code>lookAt(0,0,0)</code> points the plane's "front face" inward. Visually it doesn't matter because both sides are visible, but if we ever cared about back-face culling for performance, we'd need to negate the lookAt target (e.g. <code>lookAt(2 · position − origin)</code>) so +Z faces outward. For 8 country crosses it doesn't matter; for thousands of markers it might.
        </p>

        <h3>WebGL line width</h3>
        <p>
          The wireframe is permanently 1 CSS pixel because that's what the browser supports. If you ever wanted thicker grid lines, you'd swap the wireframe from <code>LineSegments</code> to <code>Line2</code> (the same thing the snake uses) and pay the screen-space-quad cost on potentially hundreds of grid edges. For the current visual style, 1 px is what we want anyway.
        </p>

        <h3>Country count is small</h3>
        <p>
          We use 8 countries. None of the per-marker work — projection, visibility test, flash colour interpolation — is in any way optimised for thousands of markers. If you wanted a globe with 5,000 cities, you'd want to switch to <code>InstancedMesh</code> for the crosses, drop CSS2DRenderer in favour of an atlas-based label system, and probably do the front/back occlusion test in a shader rather than per-marker JavaScript.
        </p>

        <hr className="article-divider" />

        <p className="article-outro">
          That's the whole picture. Every bug described above was a real one we hit, every "best for performance" claim was checked against the Three.js source, and every honest caveat is honest. If something here is still wrong, it's because we missed it — not because we hand-waved.
        </p>
      </div>
    </motion.div>
  );
}
