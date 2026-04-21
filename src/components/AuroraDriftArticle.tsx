// ============================================================
// AuroraDriftArticle — Deep dive on the aurora drift shader
// ============================================================

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

function PipelineDiagram() {
  const stages = [
    { label: 'Screen UV', desc: 'vUv * 2 - 1, aspect correct' },
    { label: 'Soft Mouse Mode', desc: 'Whole-field modulation (no focus point)', highlight: true },
    { label: 'Click Shockwave', desc: 'Expanding ring pulse', highlight: true },
    { label: 'FBM Warp', desc: 'Simplex noise displacement' },
    { label: 'Tile Modulo', desc: 'Periodic blob field' },
    { label: 'SDF Blobs', desc: 'Distance-to-center color blend' },
    { label: 'Color Shift', desc: 'Time-based YIQ hue rotation' },
    { label: 'Film Grain', desc: 'Time-stepped value noise' },
    { label: 'gl_FragColor', desc: 'Final pixel' },
  ];

  const stepH = 42;
  const startY = 14;
  const h = startY + stages.length * stepH;

  return (
    <svg viewBox={`0 0 420 ${h}`} fill="none" role="img" aria-label="Shader pipeline stages" style={{ maxWidth: 420 }}>
      {stages.map((s, i) => {
        const y = startY + i * stepH;
        const hl = (s as { highlight?: boolean }).highlight;
        return (
          <g key={i}>
            <circle
              cx="8" cy={y} r={hl ? 5.5 : 4}
              fill={hl ? 'rgba(120,255,200,0.15)' : 'rgba(255,255,255,0.04)'}
              stroke={hl ? 'rgba(120,255,200,0.4)' : 'rgba(255,255,255,0.1)'}
              strokeWidth="1"
            />
            {hl && <circle cx="8" cy={y} r="2" fill="rgba(120,255,200,0.6)" />}
            <text x="26" y={y + 5} fill={hl ? '#e8e8e8' : 'rgba(255,255,255,0.7)'} fontSize="14" fontWeight={hl ? '600' : '400'} style={{ fontFamily: 'var(--font-body)' }}>
              {s.label}
            </text>
            <text x="26" y={y + 20} fill="rgba(255,255,255,0.25)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
              {s.desc}
            </text>
            {i < stages.length - 1 && (
              <line x1="8" y1={y + (hl ? 7 : 5)} x2="8" y2={y + stepH - 5} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function TileModuloDiagram() {
  const w = 520, h = 260;
  const sp = 40;
  const cx = w / 2, cy = h / 2;

  const dots: { x: number; y: number }[] = [];
  for (let gx = -3; gx <= 3; gx++) {
    for (let gy = -2; gy <= 2; gy++) {
      dots.push({ x: cx + gx * sp * 2, y: cy + gy * sp * 2 });
    }
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} fill="none" role="img" aria-label="Tile modulo diagram">
      <text x={w / 2} y="16" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        op = mod(pos - sp, vec2(sp * 2.0)) - sp
      </text>

      {Array.from({ length: 9 }, (_, i) => {
        const x = (i - 4) * sp * 2 + cx;
        return <line key={`v${i}`} x1={x} y1="30" x2={x} y2={h - 30} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 3" />;
      })}
      {Array.from({ length: 6 }, (_, i) => {
        const y = (i - 2.5) * sp * 2 + cy;
        return <line key={`h${i}`} x1="30" y1={y} x2={w - 30} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 3" />;
      })}

      {dots.map((d, i) => (
        <g key={i}>
          <circle cx={d.x} cy={d.y} r="18" fill="rgba(80,255,180,0.12)" />
          <circle cx={d.x} cy={d.y} r="10" fill="rgba(80,255,180,0.25)" />
          <circle cx={d.x} cy={d.y} r="4" fill="rgba(80,255,180,0.7)" />
        </g>
      ))}

      <text x={w - 30} y={h - 20} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>
        one SDF blob tiles across infinite space
      </text>
    </svg>
  );
}

/**
 * Renders a vector field with background fill that shows "influence strength"
 * as opacity. This is the key visual for the soft modes — the field never has
 * a hard edge.
 */
function SoftModeDiagram({
  title,
  describe,
  field,
  strength,
  accent,
}: {
  title: string;
  describe: string;
  field: (x: number, y: number) => [number, number];
  strength: (x: number, y: number) => number;
  accent: string;
}) {
  const w = 260, h = 180;
  const cx = w / 2, cy = h / 2;
  const cols = 11, rows = 7;
  const dx = (w - 40) / (cols - 1);
  const dy = (h - 50) / (rows - 1);

  const arrows: { x: number; y: number; ex: number; ey: number; alpha: number }[] = [];
  const bg: { x: number; y: number; alpha: number }[] = [];

  // Background strength grid (shows that influence extends everywhere)
  const bgCols = 22, bgRows = 13;
  const bx = (w - 20) / (bgCols - 1);
  const by = (h - 40) / (bgRows - 1);
  for (let i = 0; i < bgCols; i++) {
    for (let j = 0; j < bgRows; j++) {
      const px = 10 + i * bx;
      const py = 25 + j * by;
      const rx = (px - cx) / (w / 2);
      const ry = (py - cy) / (h / 2);
      bg.push({ x: px, y: py, alpha: strength(rx, ry) });
    }
  }

  // Vector field arrows
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const px = 20 + i * dx;
      const py = 30 + j * dy;
      const rx = (px - cx) / (w / 2);
      const ry = (py - cy) / (h / 2);
      const [fx, fy] = field(rx, ry);
      const len = Math.min(Math.hypot(fx, fy), 1);
      arrows.push({
        x: px,
        y: py,
        ex: px + fx * 12,
        ey: py + fy * 12,
        alpha: 0.2 + len * 0.5,
      });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <svg viewBox={`0 0 ${w} ${h}`} fill="none" role="img" aria-label={`${title} influence field`}>
        <rect x="0" y="0" width={w} height={h} fill="rgba(255,255,255,0.015)" rx="6" />

        {bg.map((b, i) => (
          <circle key={`bg${i}`} cx={b.x} cy={b.y} r="2.2" fill={accent} opacity={b.alpha * 0.35} />
        ))}

        <text x={w / 2} y="16" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="11" fontWeight="600" style={{ fontFamily: 'var(--font-body)' }}>
          {title}
        </text>

        <circle cx={cx} cy={cy} r="3" fill={accent} />

        {arrows.map((a, i) => (
          <line
            key={i}
            x1={a.x} y1={a.y}
            x2={a.ex} y2={a.ey}
            stroke={accent}
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity={a.alpha}
          />
        ))}
      </svg>
      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
        {describe}
      </p>
    </div>
  );
}

function ShockwaveTimelineDiagram() {
  const w = 560, h = 170;
  const padL = 40, padR = 20;
  const innerW = w - padL - padR;
  const baseline = h - 40;

  const stages = [
    { t: 0.0, label: 't=0', r: 6, alpha: 1 },
    { t: 0.25, label: 't=0.25s', r: 22, alpha: 0.72 },
    { t: 0.5, label: 't=0.5s', r: 42, alpha: 0.45 },
    { t: 0.75, label: 't=0.75s', r: 62, alpha: 0.22 },
    { t: 1.0, label: 't=1s', r: 80, alpha: 0.05 },
  ];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} fill="none" role="img" aria-label="Click shockwave expansion">
      <text x={w / 2} y="16" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
        ringR = pulseAge × pulseSpeed    strength ∝ fade³
      </text>
      <line x1={padL} y1={baseline} x2={w - padR} y2={baseline} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      {stages.map((s, i) => {
        const x = padL + (i / (stages.length - 1)) * innerW;
        return (
          <g key={i}>
            <circle cx={x} cy={baseline - s.r * 0.55} r={s.r} stroke={`rgba(120,255,200,${s.alpha * 0.6})`} strokeWidth="1.4" fill={`rgba(120,255,200,${s.alpha * 0.1})`} />
            <circle cx={x} cy={baseline - s.r * 0.55} r="1.5" fill="rgba(120,255,200,0.9)" />
            <text x={x} y={baseline + 15} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>
              {s.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Code snippets ─────────────────────────────────── */

const CODE_TILE = `// Single SDF blob tiled across space via modulo
vec2 op = pos - vec2(u_blobOffsetX, u_blobOffsetY);
float sp = u_tileSpacing;
op = mod(op - sp, vec2(sp * 2.0)) - sp;

float totalRot = u_blobRotation + u_autoRotation * t;
op = rot2d(op, -totalRot);

op /= max(u_blobSize, 0.01);
op *= vec2(1.0 / max(u_blobSpread, 0.01), 1.0);

// N blobs stacked vertically, blended by SDF distance
float halfSpan = cs * (u_blobCount - 1.0) * 0.5;
col = mix(u_color1, col, smoothstep(0.0, bs, distance(op, vec2(0.0, halfSpan))));
// ... additional blobs with color2, color3, color4 ...`;

const CODE_FBM = `float fbm(vec3 p, int octaves) {
  float val = 0.0, amp = 0.55, freq = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    val += amp * snoise(p * freq);
    freq *= 1.9;
    amp *= 0.48;
  }
  return val;
}

float d1 = fbm(vec3(pos * u_warpScale + 0.5, animSeed), oct);
float d2 = fbm(vec3(pos * u_warpScale + 0.5 + 5.3, animSeed + 1.7), oct);
pos += vec2(d1, d2) * u_warpStrength * warpBoost;  // warpBoost is 1.0 except in Swell mode`;

const CODE_BREEZE = `// JS — wind vector accumulates velocity, decays each frame
windX = windX * decay + input.velocity.x * gain;
windY = windY * decay + input.velocity.y * gain;

// GLSL — the same offset is applied to EVERY pixel
pos += u_mouseWind * u_mouseStr;`;

const CODE_SWELL = `// Proximity is a broad gaussian — NEVER zero, just smaller
float sigma2 = max(u_mouseRadius * u_mouseRadius, 0.04);
float proximity = exp(-mDist * mDist / sigma2);

// No displacement. Instead, boost the amplitude of the FBM warp.
warpBoost = 1.0 + proximity * u_mouseStr * 2.5;
// (applied later: pos += fbm * u_warpStrength * warpBoost)`;

const CODE_TIDE = `// Newtonian soft-well: 1 / (1 + r²·0.8)
// No smoothstep radius — influence decays smoothly but never cuts off.
vec2 dir = mDist > 1e-5 ? toCursor / mDist : vec2(0.0);
float grav = 1.0 / (1.0 + mDist * mDist * 0.8);
pos -= dir * grav * u_mouseStr * 0.55;`;

const CODE_PARALLAX = `// Absolute cursor position pans the viewport. Pure translation,
// same offset for every pixel — feels like the camera is moving.
vec2 delta = (u_mousePos - vec2(0.5)) * 2.0;
delta = aspectCorrect(delta, aspect);
pos += delta * u_mouseStr * 0.6;`;

const CODE_SHIMMER = `// Broad gaussian (same as Swell) scales the amplitude of a
// high-frequency noise layer. The noise itself is global;
// what varies with the cursor is HOW MUCH of it is added.
float sh1 = snoise(vec3(pos * u_warpScale * 3.5 + vec2(4.7, 2.1), t * 0.6));
float sh2 = snoise(vec3(pos * u_warpScale * 3.5 + vec2(11.2, 8.3), t * 0.6 + 5.5));
pos += vec2(sh1, sh2) * proximity * u_mouseStr * 0.4;`;

const CODE_PULSE = `// Click pulse — the only LOCAL effect, because that's what clicks
// should feel like: a dramatic, bounded event.
if (u_pulseStr > 0.001) {
  vec2 pdir = screenUV - pulseScreen;
  float pDist = length(pdir);
  vec2 pdirN = pDist > 1e-5 ? pdir / pDist : vec2(0.0);

  float ringR     = u_pulseAge * u_pulseSpeed;
  float ringDelta = pDist - ringR;
  float ringMask  = exp(-(ringDelta * ringDelta) /
                        (u_pulseWidth * u_pulseWidth));

  pos += pdirN * ringMask * u_pulseStr;
}`;

const CODE_PULSE_JS = `// experiment.ts — edge-triggered pulse on each click
if (input.isDown && !prevIsDown) {
  pulseX = input.mouse.x;
  pulseY = input.mouse.y;
  pulseAge = 0;
  pulseActive = true;
}
prevIsDown = input.isDown;

if (pulseActive) {
  pulseAge += dt;
  const life = pulseAge / P.pulseDecay;
  if (life >= 1) pulseActive = false;
  else {
    const fade = 1 - life;
    currentPulseStr = P.pulseStrength * fade * fade * fade;
  }
}`;

/* ── TOC sections ──────────────────────────────────── */

export const TOC_SECTIONS = [
  { id: 'overview', label: 'The Big Picture' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'tiled', label: 'Tiled Blob Field' },
  { id: 'fbm', label: 'FBM Domain Warp' },
  { id: 'softness', label: 'Soft Input Philosophy' },
  { id: 'modes', label: 'Five Soft Modes' },
  { id: 'shockwave', label: 'Click Shockwave' },
  { id: 'finish', label: 'Color & Finish' },
] as const;

function useActiveSection(scrollRef: React.RefObject<HTMLElement | null>) {
  const [activeId, setActiveId] = useState<string>(TOC_SECTIONS[0].id);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      {
        root: container,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      },
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

export function AuroraDriftArticle() {
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
    return () => { scrollToSectionRef.current = null; };
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
      <header className="article-hero">
        <p className="article-hero-eyebrow">Deep Dive</p>
        <h1>How the Aurora Drift Works</h1>
        <p className="article-hero-lead">
          A tiled SDF blob field, fractional Brownian motion, and five soft cursor modes that treat the aurora like an atmosphere, not a canvas.
        </p>
      </header>

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

      <div className="article-body">

        {/* ── 01 Overview ── */}
        <span className="article-section-num">01</span>
        <h2 id="overview">The Big Picture</h2>

        <p>
          Every frame, the GPU runs a single <strong>fragment shader</strong> once per pixel. There are no textures, no meshes, no physics simulation &mdash; just a function that takes a UV coordinate and returns a color.
        </p>
        <p>
          The shape comes from tiling one SDF blob stack through space with a <code className="c">mod()</code> and warping the whole sampling coordinate with <strong>fractional Brownian motion</strong>. The interactivity is where this experiment differs from most: the cursor is treated as an <em>atmospheric influence</em>, not a widget. Every cursor mode affects the whole canvas &mdash; never a bounded region &mdash; so the aurora keeps its soft, diffuse character.
        </p>
        <div className="article-callout">
          <p>
            <strong>The governing idea:</strong> if the visual is soft, the inputs have to be soft too. A hard cursor radius on a soft phenomenon looks like a spotlight on fog. Every hover mode in this shader uses either a global transform (no position-dependence), an unbounded falloff (never reaches zero), or <em>parameter modulation</em> instead of <em>sample displacement</em>.
          </p>
        </div>

        {/* ── 02 Pipeline ── */}
        <hr className="article-divider" />
        <span className="article-section-num">02</span>
        <h2 id="pipeline">Pipeline</h2>

        <p>
          Each pixel travels through the same sequence of transforms. The highlighted stages are the ones that respond to input:
        </p>

        <div className="article-breakout">
          <div className="article-diagram">
            <PipelineDiagram />
            <p className="article-diagram-caption">
              Nine stages, per pixel, every frame. The cursor mode and click shockwave modify the sampling coordinate <em>before</em> it reaches the blob field &mdash; so they deform the entire aurora, not just a post-effect overlay.
            </p>
          </div>
        </div>

        {/* ── 03 Tiled blobs ── */}
        <hr className="article-divider" />
        <span className="article-section-num">03</span>
        <h2 id="tiled">The Tiled Blob Field</h2>

        <p>
          The visible color comes from a simple construct: 2&ndash;6 soft circles stacked vertically, blended by a <strong>signed distance function</strong>. On its own, this would render a single ribbon in the middle of the screen. The <code className="c">mod()</code> operator tiles it infinitely.
        </p>

        <CodeBlock code={CODE_TILE} caption="Tile & blob field &mdash; shader.glsl" />

        <div className="article-breakout">
          <div className="article-diagram">
            <TileModuloDiagram />
            <p className="article-diagram-caption">
              <code className="c">mod()</code> remaps every pixel's coordinate into a single canonical cell. One math block draws an infinite field.
            </p>
          </div>
        </div>

        <p>
          <code className="c">distance(op, vec2(0.0, y<sub>i</sub>))</code> is a straight Euclidean SDF; <code className="c">smoothstep(0.0, bs, d)</code> gives a soft falloff. Each <code className="c">mix()</code> blends the background with a blob color by proximity. The anisotropic <code className="c">blobSpread</code> stretches each circle into a horizontal bar of light that reads as an aurora curtain once warped.
        </p>

        {/* ── 04 FBM warp ── */}
        <hr className="article-divider" />
        <span className="article-section-num">04</span>
        <h2 id="fbm">FBM Domain Warping</h2>

        <p>
          Straight tiled bars would look like a barcode. Before sampling the tile grid, the coordinate is displaced by two independent <strong>fractional Brownian motion</strong> samples &mdash; one for x, one for y.
        </p>

        <CodeBlock code={CODE_FBM} caption="FBM: stacked simplex-noise octaves" />

        <p>
          FBM sums noise samples at geometrically increasing frequencies. Three octaves give one big slow wobble, a medium wobble, and a fine ripple &mdash; a natural-looking displacement field. Two uncorrelated samples (offset by <code className="c">+5.3</code>) drive x and y independently; using the same sample for both would produce only diagonal displacement. The <code className="c">animSeed</code> on the z axis scrolls through the 3D noise, morphing the 2D field smoothly over time.
        </p>
        <p>
          The <code className="c">warpBoost</code> multiplier is where the <em>Swell</em> cursor mode plugs in. By default it's 1.0; under Swell, cursor proximity lifts it above 1.0 with a very broad gaussian &mdash; so the aurora intensifies without any visible circle of influence.
        </p>

        {/* ── 05 Softness philosophy ── */}
        <hr className="article-divider" />
        <span className="article-section-num">05</span>
        <h2 id="softness">Soft Input Philosophy</h2>

        <p>
          The earlier iteration of this experiment had a <code className="c">smoothstep(r - s, r + s, d)</code> radius that gated every cursor effect. Within that radius: displacement. Outside: nothing. The problem is that a hard edge on a displacement field is <em>visible</em> &mdash; the aurora warped in a circle, and the circle followed the cursor like a magnifying glass. It felt like pointing at the aurora, not being part of it.
        </p>

        <div className="article-callout">
          <p>
            <strong>Three ways to make an input soft:</strong>
          </p>
          <ul style={{ margin: '8px 0 0' }}>
            <li><strong>Global</strong> &mdash; no position dependence at all. Same effect on every pixel. (Breeze, Parallax)</li>
            <li><strong>Unbounded falloff</strong> &mdash; influence decays smoothly but never reaches zero. 1/(1+r²·k) is the canonical shape. (Tide)</li>
            <li><strong>Parameter modulation</strong> &mdash; the cursor doesn't displace anything, it changes a parameter. A broad gaussian on the parameter means influence everywhere, strongest near the cursor. (Swell, Shimmer)</li>
          </ul>
        </div>

        <p>
          All five modes in this shader use one of those three strategies. None of them uses a <code className="c">smoothstep</code> radius mask. The only local effect in the whole shader is the click shockwave &mdash; because a click <em>should</em> feel like a bounded event.
        </p>

        {/* ── 06 Five modes ── */}
        <hr className="article-divider" />
        <span className="article-section-num">06</span>
        <h2 id="modes">Five Soft Modes</h2>

        <div className="article-breakout">
          <div className="article-diagram" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            <SoftModeDiagram
              title="Breeze"
              accent="rgba(180,230,255,0.85)"
              describe="Global drift from accumulated velocity — same offset everywhere"
              strength={() => 0.55}
              field={() => {
                const a = Math.sin(Date.now() * 0.0005) * 0.7;
                return [a, a * 0.4];
              }}
            />
            <SoftModeDiagram
              title="Swell"
              accent="rgba(255,200,160,0.85)"
              describe="Proximity modulates warp amplitude globally (no displacement)"
              strength={(x, y) => {
                const d2 = x * x + y * y;
                return Math.exp(-d2 / 0.6);
              }}
              field={() => [0, 0]}
            />
            <SoftModeDiagram
              title="Tide"
              accent="rgba(160,220,200,0.85)"
              describe="Unbounded 1/(1 + r²·0.8) pull — smooth decay, never zero"
              strength={(x, y) => {
                const d2 = x * x + y * y;
                return 1 / (1 + d2 * 0.8);
              }}
              field={(x, y) => {
                const d = Math.hypot(x, y);
                const mag = 1 / (1 + d * d * 0.8);
                if (d < 1e-5) return [0, 0];
                return [-(x / d) * mag, -(y / d) * mag];
              }}
            />
            <SoftModeDiagram
              title="Parallax"
              accent="rgba(200,180,255,0.85)"
              describe="Cursor offset pans the whole viewport — same vector everywhere"
              strength={() => 0.55}
              field={() => [0.6, 0.3]}
            />
            <SoftModeDiagram
              title="Shimmer"
              accent="rgba(255,180,220,0.85)"
              describe="Proximity scales a global high-frequency noise layer"
              strength={(x, y) => {
                const d2 = x * x + y * y;
                return Math.exp(-d2 / 0.6);
              }}
              field={(x, y) => {
                const d2 = x * x + y * y;
                const m = Math.exp(-d2 / 0.6);
                const a = Math.sin(x * 6 + 1.2) * Math.cos(y * 5 + 3.1) * m;
                const b = Math.cos(x * 5 + 2.7) * Math.sin(y * 6 - 0.5) * m;
                return [a, b];
              }}
            />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', padding: '12px 14px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 6, display: 'flex', alignItems: 'center', lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>
              The background dot-field shows <strong style={{ color: 'rgba(255,255,255,0.55)' }}>influence strength</strong> at each position. Compare: every mode has influence across the whole canvas. No spotlight.
            </div>
          </div>
        </div>

        <h3>Breeze &mdash; velocity as wind</h3>
        <p>
          The mouse's velocity is accumulated into a decaying wind vector on the JS side. That vector &mdash; a single <code className="c">vec2</code> &mdash; is added to every pixel's position. There's no distance-dependence at all: stop moving and the wind dies; drag fast and the whole aurora streaks in that direction.
        </p>
        <CodeBlock code={CODE_BREEZE} caption="Breeze &mdash; global drift from wind vector" />

        <h3>Swell &mdash; proximity as amplitude</h3>
        <p>
          Instead of displacing the sampling coordinate, Swell modulates the FBM warp's amplitude. The cursor proximity becomes a broad gaussian multiplier on <code className="c">warpBoost</code>. Near the cursor, the aurora breathes harder; far away, it keeps its baseline motion. No circle is ever visible because there's no displacement gate &mdash; only an amplitude curve.
        </p>
        <CodeBlock code={CODE_SWELL} caption="Swell &mdash; amplitude modulation" />

        <h3>Tide &mdash; unbounded soft pull</h3>
        <p>
          A single term &mdash; <code className="c">1 / (1 + r²·0.8)</code> &mdash; produces a radial pull that has no visible edge. Mathematically it never reaches zero; visually it decays below the noise floor at some distance, but there's no sharp boundary. The whole aurora leans toward the cursor.
        </p>
        <CodeBlock code={CODE_TIDE} caption="Tide &mdash; soft-well falloff" />

        <h3>Parallax &mdash; cursor pans the viewport</h3>
        <p>
          Absolute cursor position becomes a translation applied to every pixel. It's exactly a camera pan: move the cursor right and the aurora shifts right. Because the offset is constant across the canvas, there's no locality at all &mdash; the effect is maximally diffuse.
        </p>
        <CodeBlock code={CODE_PARALLAX} caption="Parallax &mdash; absolute position as camera offset" />

        <h3>Shimmer &mdash; proximity as noise amplitude</h3>
        <p>
          A high-frequency simplex noise layer is always present in Shimmer mode. Cursor proximity scales <em>how much of it</em> is applied. The noise pattern itself is global and animated; what changes with cursor position is the amplitude curve over space.
        </p>
        <CodeBlock code={CODE_SHIMMER} caption="Shimmer &mdash; modulated HF noise" />

        {/* ── 07 Shockwave ── */}
        <hr className="article-divider" />
        <span className="article-section-num">07</span>
        <h2 id="shockwave">The Click Shockwave</h2>

        <p>
          Hovering is meant to feel atmospheric. Clicking is meant to feel punchy &mdash; so the click is the <em>only</em> effect in the shader that's deliberately local.
        </p>

        <CodeBlock code={CODE_PULSE_JS} caption="JS: edge-triggered click tracking" />

        <p>
          The JS side tracks click position, elapsed time, and the fading amplitude. The cubed fade (<code className="c">fade&sup3;</code>) produces a "slam and settle" feel. Each frame the values are sent to the shader as uniforms.
        </p>

        <CodeBlock code={CODE_PULSE} caption="Shader: Gaussian ring at radius (pulseAge × pulseSpeed)" />

        <div className="article-breakout">
          <div className="article-diagram">
            <ShockwaveTimelineDiagram />
            <p className="article-diagram-caption">
              The ring radius is <code className="c">ringR = pulseAge × pulseSpeed</code>. A Gaussian around that radius gives the ring its thickness. Amplitude follows a cubic fade.
            </p>
          </div>
        </div>

        {/* ── 08 Finish ── */}
        <hr className="article-divider" />
        <span className="article-section-num">08</span>
        <h2 id="finish">Color &amp; Finish</h2>

        <p>
          The presets in the selector &mdash; Boreal Green, Arctic Glacier, Peach Blossom, Ember Glow, Mint Lilac, Orchid Spark, Tide Pool, Rose Copper, Velvet Rose, Amber Glass, Nebula Drift &mdash; each name the palette plainly so you can pick by mood. All default to the Swell mode (cursor-proximity intensifies the warp amplitude globally) and can be swapped to any other mode from the panel. "Version 1" in the dropdown is the Harbor Dusk baseline.
        </p>
        <p>
          <strong>Color shift</strong> is a YIQ-space hue rotation over time &mdash; subtle chromatic drift without luminance change. <strong>Film grain</strong> is 2D value noise re-seeded in discrete time steps (<code className="c">floor(t × grainSpeed)</code>), so the texture <em>flickers</em> like film rather than smoothly interpolating.
        </p>

        {/* ── Wrap ── */}
        <hr className="article-divider" />

        <div className="article-summary">
          <h3>Wrapping Up</h3>
          <p>
            The lesson isn't really about aurora shaders &mdash; it's about how to hook an input into a soft visual. Three strategies, one rule: <strong>no hard radius</strong>.
          </p>
          <ul>
            <li><strong>Global</strong> transforms &mdash; wind vector, viewport pan.</li>
            <li><strong>Unbounded falloff</strong> &mdash; 1/(1+r²·k). Never reaches zero.</li>
            <li><strong>Parameter modulation</strong> &mdash; broad gaussian on an amplitude, not on a displacement.</li>
          </ul>
          <p>
            Clicks are allowed to be local because clicks are events. Hovering is ambient, so it stays ambient &mdash; the aurora keeps its softness whether you're moving or still.
          </p>
        </div>

      </div>
    </motion.div>
  );
}
