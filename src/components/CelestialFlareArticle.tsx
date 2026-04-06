// ============================================================
// CelestialFlareArticle — Rich technical deep-dive on the shader
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

function LayerStackDiagram() {
  const layers = [
    { label: 'Film Grain', desc: 'Animated multi-scale hash noise', color: 'rgba(255,255,255,0.3)' },
    { label: 'Lens Flares', desc: 'Chromatic rainbow streaks', color: 'rgba(255,180,100,0.5)', highlight: true },
    { label: 'Particle Circle', desc: 'Polar hash-grid ring', color: 'rgba(200,200,200,0.4)' },
    { label: 'Wave Gradient', desc: 'Sine superposition + color blend', color: 'rgba(123,76,192,0.5)', highlight: true },
    { label: 'Background', desc: 'Solid dark base', color: 'rgba(255,255,255,0.1)' },
  ];

  const layerH = 44;
  const padY = 30;
  const padX = 40;
  const w = 460;
  const h = padY + layers.length * layerH + 20;
  const rectW = 260;
  const rectH = 28;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} fill="none" role="img" aria-label="Layer compositing stack" style={{ maxWidth: 480 }}>
      <text x={w / 2} y="16" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>
        top (drawn last)
      </text>
      {layers.map((l, i) => {
        const y = padY + i * layerH;
        const x = padX + i * 8;
        const hl = (l as { highlight?: boolean }).highlight;
        return (
          <g key={i}>
            <rect
              x={x} y={y} width={rectW} height={rectH} rx="6"
              fill={l.color}
              stroke={hl ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}
              strokeWidth="1"
            />
            <text x={x + 12} y={y + 18} fill={hl ? '#e8e8e8' : 'rgba(255,255,255,0.6)'} fontSize="13" fontWeight={hl ? '600' : '400'} style={{ fontFamily: 'var(--font-body)' }}>
              {l.label}
            </text>
            <text x={x + rectW + 14} y={y + 18} fill="rgba(255,255,255,0.2)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>
              {l.desc}
            </text>
            {i < layers.length - 1 && (
              <line x1={x + rectW / 2} y1={y + rectH + 2} x2={x + 8 + rectW / 2} y2={y + layerH - 2} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            )}
          </g>
        );
      })}
      <text x={w / 2} y={h - 2} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>
        bottom (drawn first)
      </text>
    </svg>
  );
}

function SineInterferenceDiagram() {
  const w = 500, h = 290, pts = 120, padX = 50, drawW = w - padX * 2;
  const wave = (i: number, freqX: number, freqY: number, phase: number, amp: number) =>
    Math.sin(i * freqX * 0.05 + phase) * amp + Math.cos(i * freqY * 0.03 + phase * 0.7) * amp * 0.3;

  const makePath = (fn: (i: number) => number, yBase: number) => {
    const d: string[] = [];
    for (let i = 0; i <= pts; i++) {
      const x = padX + (i / pts) * drawW;
      const y = yBase + fn(i);
      d.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return d.join(' ');
  };

  const w1 = (i: number) => wave(i, 2.1, 1.8, 0, 20);
  const w2 = (i: number) => wave(i, 3.3, 2.7, 3, 10);
  const w3 = (i: number) => wave(i, 4.5, 3.9, 7, 5);
  const combined = (i: number) => (w1(i) + w2(i) + w3(i)) * 0.7;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} fill="none" role="img" aria-label="Sine wave interference diagram">
      <text x="12" y="48" fill="#555" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>w1</text>
      <text x={w - 12} y="48" textAnchor="end" fill="rgba(255,255,255,0.15)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>amp=1.0 freq=2.1/1.8</text>
      <path d={makePath(w1, 45)} stroke="rgba(123,76,192,0.55)" strokeWidth="1.5" />

      <text x={w / 2} y="78" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="16">+</text>

      <text x="12" y="108" fill="#555" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>w2</text>
      <text x={w - 12} y="108" textAnchor="end" fill="rgba(255,255,255,0.15)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>amp=0.5 freq=3.3/2.7</text>
      <path d={makePath(w2, 105)} stroke="rgba(123,76,192,0.4)" strokeWidth="1.5" />

      <text x={w / 2} y="138" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="16">+</text>

      <text x="12" y="168" fill="#555" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>w3</text>
      <text x={w - 12} y="168" textAnchor="end" fill="rgba(255,255,255,0.15)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>amp=0.25 freq=4.5/3.9</text>
      <path d={makePath(w3, 165)} stroke="rgba(123,76,192,0.25)" strokeWidth="1.5" />

      <line x1={padX} y1="198" x2={w - padX} y2="198" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <text x={w / 2} y="195" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="13">=</text>

      <text x="12" y="240" fill="#999" fontSize="10" fontWeight="600" style={{ fontFamily: 'var(--font-mono)' }}>warp</text>
      <path d={makePath(combined, 237)} stroke="rgba(212,160,232,0.7)" strokeWidth="2" />
    </svg>
  );
}

function PolarGridDiagram() {
  const cx = 200, cy = 130, r = 80;
  const w = 400, h = 280;

  // Draw some particles around the circle edge
  const particles: { x: number; y: number; r: number; opacity: number }[] = [];
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2;
    const hash = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    const frac = hash - Math.floor(hash);
    if (frac > 0.45) {
      const radialOffset = (Math.sin(i * 3.7 + 1.3) * 0.5 + 0.5) * 12 - 6;
      const px = cx + Math.cos(angle) * (r + radialOffset);
      const py = cy + Math.sin(angle) * (r + radialOffset);
      const size = 1 + frac * 2;
      particles.push({ x: px, y: py, r: size, opacity: 0.3 + frac * 0.5 });
    }
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} fill="none" role="img" aria-label="Polar coordinate particle grid">
      {/* Circle outline */}
      <circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
      <circle cx={cx} cy={cy} r={r - 10} stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="2 4" />
      <circle cx={cx} cy={cy} r={r + 10} stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="2 4" />

      {/* Radial lines showing polar grid */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const x1 = cx + Math.cos(angle) * (r - 16);
        const y1 = cy + Math.sin(angle) * (r - 16);
        const x2 = cx + Math.cos(angle) * (r + 16);
        const y2 = cy + Math.sin(angle) * (r + 16);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />;
      })}

      {/* Particles */}
      {particles.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={`rgba(220,215,210,${p.opacity})`} />
      ))}

      {/* Labels */}
      <text x={cx} y={cy + 4} textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>center</text>

      {/* Angle label */}
      <path d={`M ${cx + 30} ${cy} A 30 30 0 0 1 ${cx + 30 * Math.cos(0.8)} ${cy - 30 * Math.sin(0.8)}`} stroke="rgba(123,76,192,0.3)" strokeWidth="1" fill="none" />
      <text x={cx + 44} y={cy - 12} fill="rgba(123,76,192,0.4)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>angle</text>

      {/* Radius label */}
      <line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <text x={cx + r / 2} y={cy + 16} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>radius</text>

      {/* Edge zone annotation */}
      <text x={cx + r + 24} y={cy - 20} fill="rgba(255,180,100,0.4)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>edge zone</text>
      <line x1={cx + r + 10} y1={cy - 6} x2={cx + r + 10} y2={cy + 6} stroke="rgba(255,180,100,0.2)" strokeWidth="8" strokeLinecap="round" />

      {/* Legend */}
      <text x="20" y={h - 20} fill="rgba(255,255,255,0.25)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>
        Hash grid cells in polar space create scattered particles near the edge
      </text>
    </svg>
  );
}

function ChromaticDiagram() {
  const w = 460, h = 180;
  const cx = 230, cy = 90;
  const streakW = 180, barH = 50;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} fill="none" role="img" aria-label="Chromatic aberration diagram">
      {/* Labels */}
      <text x="20" y="20" fill="rgba(255,255,255,0.25)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>
        perpendicular cross-section of a single flare streak
      </text>

      {/* Gaussian curves for R, G, B */}
      <defs>
        <linearGradient id="chrR" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,80,80,0)" />
          <stop offset="30%" stopColor="rgba(255,80,80,0.6)" />
          <stop offset="50%" stopColor="rgba(255,80,80,0.8)" />
          <stop offset="70%" stopColor="rgba(255,80,80,0.6)" />
          <stop offset="100%" stopColor="rgba(255,80,80,0)" />
        </linearGradient>
        <linearGradient id="chrG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(80,255,80,0)" />
          <stop offset="30%" stopColor="rgba(80,255,80,0.6)" />
          <stop offset="50%" stopColor="rgba(80,255,80,0.8)" />
          <stop offset="70%" stopColor="rgba(80,255,80,0.6)" />
          <stop offset="100%" stopColor="rgba(80,255,80,0)" />
        </linearGradient>
        <linearGradient id="chrB" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(100,100,255,0)" />
          <stop offset="30%" stopColor="rgba(100,100,255,0.6)" />
          <stop offset="50%" stopColor="rgba(100,100,255,0.8)" />
          <stop offset="70%" stopColor="rgba(100,100,255,0.6)" />
          <stop offset="100%" stopColor="rgba(100,100,255,0)" />
        </linearGradient>
        {/* Combined rainbow gradient for result bar */}
        <linearGradient id="rainbowBar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" />
          <stop offset="10%" stopColor="#400000" />
          <stop offset="20%" stopColor="#ff2200" />
          <stop offset="30%" stopColor="#ffaa00" />
          <stop offset="40%" stopColor="#aaff00" />
          <stop offset="50%" stopColor="#00ff44" />
          <stop offset="60%" stopColor="#00aaff" />
          <stop offset="70%" stopColor="#0022ff" />
          <stop offset="80%" stopColor="#4400aa" />
          <stop offset="90%" stopColor="#220044" />
          <stop offset="100%" stopColor="#000" />
        </linearGradient>
      </defs>

      {/* Channel bars — offset from each other */}
      <rect x={cx - streakW / 2 - 20} y={cy - barH / 2 - 3} width={streakW} height={8} rx="4" fill="url(#chrR)" opacity="0.7" />
      <text x={cx - streakW / 2 - 28} y={cy - barH / 2 + 5} fill="rgba(255,80,80,0.5)" fontSize="10" textAnchor="end" style={{ fontFamily: 'var(--font-mono)' }}>R</text>

      <rect x={cx - streakW / 2} y={cy - 4} width={streakW} height={8} rx="4" fill="url(#chrG)" opacity="0.7" />
      <text x={cx - streakW / 2 - 8} y={cy + 4} fill="rgba(80,255,80,0.5)" fontSize="10" textAnchor="end" style={{ fontFamily: 'var(--font-mono)' }}>G</text>

      <rect x={cx - streakW / 2 + 20} y={cy + barH / 2 - 5} width={streakW} height={8} rx="4" fill="url(#chrB)" opacity="0.7" />
      <text x={cx - streakW / 2 + 12} y={cy + barH / 2 + 3} fill="rgba(100,100,255,0.5)" fontSize="10" textAnchor="end" style={{ fontFamily: 'var(--font-mono)' }}>B</text>

      {/* Offset arrows */}
      <text x={cx + streakW / 2 + 20} y={cy - barH / 2 + 5} fill="rgba(255,255,255,0.15)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>- offset</text>
      <text x={cx + streakW / 2 + 20} y={cy + 4} fill="rgba(255,255,255,0.15)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>center</text>
      <text x={cx + streakW / 2 + 40} y={cy + barH / 2 + 3} fill="rgba(255,255,255,0.15)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>+ offset</text>

      {/* Result rainbow bar */}
      <rect x={cx - streakW / 2 - 10} y={h - 36} width={streakW + 20} height={12} rx="6" fill="url(#rainbowBar)" />
      <text x={cx} y={h - 8} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>
        combined result: visible rainbow spectrum
      </text>
    </svg>
  );
}

/* ── Code snippets ─────────────────────────────────── */

const CODE_WAVE = `// Three layers of sine-based displacement
vec2 w1 = vec2(
  sin(p.y * 2.1 * u_warpScale + wt * 0.7),
  cos(p.x * 1.8 * u_warpScale + wt * 0.6 + 1.0)
);
vec2 w2 = vec2(
  sin((p.x + p.y) * 3.3 * u_warpScale + wt * 0.5 + 3.0),
  cos((p.x - p.y) * 2.7 * u_warpScale + wt * 0.4 + 5.0)
) * 0.5;
vec2 w3 = vec2(
  cos(p.x * 4.5 * u_warpScale + p.y * 1.3 + wt * 0.35 + 7.0),
  sin(p.y * 3.9 * u_warpScale + p.x * 0.9 + wt * 0.3 + 9.0)
) * 0.25;

vec2 wP = p + u_warpStrength * (w1 + w2 + w3);`;

const CODE_COLOR = `// Two gradient signals for three-color blending
float timeShift = u_colorShift * t * 0.012;
float n1 = sin(wP.x * u_blendWidth + wP.y * 0.7 + timeShift) * 0.5 + 0.5;
float n2 = sin(wP.y * u_blendWidth * 0.9 + wP.x * 0.5
             + timeShift * 0.8 + 1.5708) * 0.5 + 0.5;

vec3 waveColor = mix(u_col1, u_col2, n1);
waveColor = mix(waveColor, u_col3, n2 * 0.4);
color = mix(u_bgColor, waveColor, u_waveIntensity);`;

const CODE_CIRCLE_SETUP = `// Circle SDF — distance from circumference
vec2 cPos = vec2(u_circlePos.x * aspect, u_circlePos.y);
float cDist = length(st - cPos);
float ringDist = cDist - u_circleRadius;

// Soft base ring glow
float edgeW = u_circleEdge * 0.08;
float ringGlow = exp(-ringDist * ringDist / (edgeW * edgeW));

// Edge proximity mask — particles only appear near the edge
float edgeMask = exp(-ringDist * ringDist / (edgeW * edgeW * 6.0));

// Convert to polar for particle placement
float cAngle = atan(st.y - cPos.y, st.x - cPos.x);`;

const CODE_PARTICLES = `for (int layer = 0; layer < 3; layer++) {
  float fi = float(layer);
  float scale = u_circleDensity * (12.0 + fi * 6.0);
  float tOff = t * u_circleSpeed * (0.4 + fi * 0.2);

  // Polar-space grid: angle along x, radial distance along y
  vec2 gridUV = vec2(
    (cAngle / TAU + 0.5) * scale + tOff,
    ringDist * scale * 4.0 + fi * 17.3
  );

  vec2 cell = floor(gridUV);
  vec2 f = fract(gridUV);

  // Hash determines: does this cell have a particle?
  float h = hash21(cell + fi * 137.0);
  float exists = step(0.55 + fi * 0.1, h);

  // Animate brightness with sin wave
  float phase = hash21(cell + fi * 137.0 + 47.0) * TAU + t * u_circleSpeed * 1.5;
  float fade = 0.3 + 0.7 * max(0.0, sin(phase));

  // Jittered center within cell
  float hx = hash21(cell + fi * 137.0 + 11.0);
  float hy = hash21(cell + fi * 137.0 + 23.0);
  vec2 center = vec2(0.15 + hx * 0.7, 0.15 + hy * 0.7);
  float d = length(f - center);
  float size = u_circleParticleSize * (0.08 + h * 0.12);

  totalParticles += exists * (1.0 - smoothstep(0.0, size, d)) * fade;
}`;

const CODE_FLARE = `// Procedural flare position from hash
vec2 flarePos = vec2(
  hash21(vec2(seed, 1.0)) * aspect,
  hash21(vec2(seed, 2.0))
);

// Subtle drift over time
flarePos += vec2(
  sin(t * u_flareSpeed * 0.08 + fi * 2.3) * 0.03,
  cos(t * u_flareSpeed * 0.1 + fi * 1.9) * 0.02
);

float flareAng = u_flareAngle + hash21(vec2(seed, 3.0)) * 3.14159;
float flareLen = (0.2 + hash21(vec2(seed, 4.0)) * 0.4) * u_flareLength;

// Direction vectors for the streak
vec2 dir = vec2(cos(flareAng), sin(flareAng));
vec2 perp = vec2(-dir.y, dir.x);
vec2 delta = st - flarePos;
float along = dot(delta, dir);      // position along streak
float perpDist = dot(delta, perp);   // distance from streak center`;

const CODE_CHROMATIC = `// Streak width
float w = u_flareSpread * (0.003 + fi * 0.001);

// Chromatic aberration — offset R, G, B channels perpendicular to streak
float chrOffset = u_flareRainbow * w * 3.0;
vec3 chrFlare;
chrFlare.r = exp(-(perpDist - chrOffset) * (perpDist - chrOffset) / (w * w));
chrFlare.g = exp(-perpDist * perpDist / (w * w));
chrFlare.b = exp(-(perpDist + chrOffset) * (perpDist + chrOffset) / (w * w));

// Fade along streak length
float lenFade = smoothstep(flareLen, flareLen * 0.1, abs(along));
chrFlare *= lenFade;

// Warm central glow
float glowDist = length(delta);
float glow = exp(-glowDist * glowDist / (0.015 + fi * 0.003));
vec3 warmGlow = vec3(1.0, 0.7, 0.3) * glow * 0.15;`;

const CODE_GRAIN = `float grainT = floor(u_time * u_grainSpeed);
vec2 gUV = vUv * u_resolution;

// Fine grain
float g1 = hash21(floor(gUV / u_grainSize) + grainT * 17.13);
float g2 = hash31(vec3(floor(gUV / u_grainSize) * 1.37, grainT * 23.71));

// Coarser grain for film-like size variation
float coarseScale = u_grainSize * (2.0 + u_grainVariation * 5.0);
float g3 = hash21(floor(gUV / coarseScale) + grainT * 31.57 + 100.0);
float g4 = hash31(vec3(floor(gUV / coarseScale).yx * 0.97, grainT * 41.23));

float fineGrain = (g1 + g2) * 0.5 - 0.5;
float coarseGrain = (g3 + g4) * 0.5 - 0.5;
float grain = mix(fineGrain, coarseGrain, u_grainVariation * 0.4) * u_grainAmount;
color += grain;`;

const CODE_POST = `// Saturation: blend between grayscale and color
float luma = dot(color, vec3(0.299, 0.587, 0.114));
color = mix(vec3(luma), color, u_saturation);

// Brightness + Contrast
color *= u_brightness;
color = (color - 0.5) * u_contrast + 0.5;

color = clamp(color, 0.0, 1.0);
gl_FragColor = vec4(color, 1.0);`;

const CODE_UNIFORMS = `render(time: number, _deltaTime: number) {
  const P = params;
  gl.useProgram(prog);

  gl.uniform1f(U.u_time, time);
  gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

  // Layer toggles — each layer can be disabled independently
  gl.uniform1f(U.u_waveOn, P.waveOn ? 1.0 : 0.0);
  gl.uniform1f(U.u_circleOn, P.circleOn ? 1.0 : 0.0);
  gl.uniform1f(U.u_flareOn, P.flareOn ? 1.0 : 0.0);
  gl.uniform1f(U.u_grainOn, P.grainOn ? 1.0 : 0.0);

  // Colors: hex strings to RGB floats
  const c1 = hex2rgb(P.color1);  // '#593e03' -> [0.35, 0.24, 0.01]
  gl.uniform3f(U.u_col1, c1[0], c1[1], c1[2]);

  // Circle position: two params combined into one vec2
  gl.uniform2f(U.u_circlePos, P.circleX, P.circleY);

  // ... 35+ other uniforms ...
}`;

const CODE_HASH = `// Hash functions — pseudo-random, deterministic
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash31(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}`;

/* ── TOC sections ──────────────────────────────────── */

export const TOC_SECTIONS = [
  { id: 'overview', label: 'The Big Picture' },
  { id: 'layers', label: 'Layer Architecture' },
  { id: 'wave', label: 'Wave Gradient' },
  { id: 'color', label: 'Color Palette' },
  { id: 'circle', label: 'Particle Circle' },
  { id: 'particles', label: 'Particle Animation' },
  { id: 'flares', label: 'Lens Flares' },
  { id: 'chromatic', label: 'Chromatic Dispersion' },
  { id: 'grain', label: 'Film Grain' },
  { id: 'post', label: 'Post-Processing' },
  { id: 'bridge', label: 'Uniform Bridge' },
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

export function CelestialFlareArticle() {
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
      {/* ── Hero ── */}
      <header className="article-hero">
        <p className="article-hero-eyebrow">Deep Dive</p>
        <h1>How the Celestial Flare Works</h1>
        <p className="article-hero-lead">
          A layer-by-layer breakdown of a composited WebGL shader &mdash; sine-wave gradients, procedural particle circles, chromatic lens flares, and animated film grain, all computed per-pixel in real time.
        </p>
      </header>

      {/* ── Table of contents (fixed sidebar) ── */}
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

      {/* ── Article body ── */}
      <div className="article-body">

        {/* ────────────────────────────────────────── */}
        <span className="article-section-num">01</span>
        <h2 id="overview">The Big Picture</h2>

        <p>
          Celestial Flare is a <strong>fragment shader</strong> that runs on your GPU and computes the color of every pixel, independently, every frame. There are no images loaded, no video files, no 3D models. The entire visual is <strong>pure math</strong>.
        </p>
        <p>
          What makes this experiment different from a typical noise shader is its <strong>compositing architecture</strong>. Instead of one monolithic computation, the shader renders four distinct visual layers that stack on top of each other like transparent sheets of film. Each layer uses a different mathematical technique, and each can be toggled on or off independently.
        </p>
        <p>
          The result is a cinematic, atmospheric effect: warm gradients, a ghostly particle ring, rainbow lens streaks, and subtle film grain &mdash; all moving, all controllable with 40+ parameters.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">02</span>
        <h2 id="layers">Layer Architecture</h2>

        <p>
          The shader processes each pixel through four independent layers, composited from bottom to top using additive blending:
        </p>

        <div className="article-breakout">
          <div className="article-diagram">
            <LayerStackDiagram />
            <p className="article-diagram-caption">
              Four layers stack additively. Each layer can be toggled via a boolean uniform.
            </p>
          </div>
        </div>

        <p>
          Each layer has a <strong>toggle uniform</strong> (<code className="c">u_waveOn</code>, <code className="c">u_circleOn</code>, etc.) that gates the entire computation with a simple <code className="c">if</code> check. When a layer is off, the GPU skips its math entirely &mdash; this isn't just a visual hide, it's a genuine performance optimization.
        </p>
        <p>
          The compositing is straightforward: start with the background color, then add each layer's contribution. The wave gradient uses a <code className="c">mix()</code> to blend with the background, while the circle, flares, and grain use <strong>additive blending</strong> (<code className="c">color += layer</code>). This means bright elements glow through whatever is behind them, like light on film.
        </p>

        <div className="article-callout">
          <p>
            <strong>Why additive?</strong> Lens flares and particle glows are emissive &mdash; they add light to the scene rather than occluding it. Additive blending naturally produces the ethereal, transparent look of light phenomena. The wave gradient is the only layer that replaces the background rather than adding to it.
          </p>
        </div>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">03</span>
        <h2 id="wave">The Wave Gradient</h2>

        <p>
          The foundation layer creates flowing, organic shapes using <strong>sine-wave superposition</strong> &mdash; a technique borrowed from physics. Instead of sampling expensive noise textures, this layer generates complex patterns by stacking simple trigonometric functions at different frequencies and phases.
        </p>
        <p>
          Three displacement layers are combined, each at decreasing amplitude:
        </p>

        <CodeBlock code={CODE_WAVE} caption="Sine-wave displacement &mdash; shader.glsl" />

        <div className="article-breakout">
          <div className="article-diagram">
            <SineInterferenceDiagram />
            <p className="article-diagram-caption">
              Three sine layers at increasing frequency and decreasing amplitude. Their sum produces organic, flowing interference patterns.
            </p>
          </div>
        </div>

        <p>
          Each layer uses <strong>both sin and cos</strong> with different frequencies for the x and y components. This is critical: if both components used the same function and frequency, the displacement would be diagonal and repetitive. By mixing sin/cos and varying the frequencies, the waves create <strong>interference patterns</strong> that look natural rather than mechanical.
        </p>
        <p>
          The three layers are weighted: <code className="c">w1</code> at full strength, <code className="c">w2</code> at half, <code className="c">w3</code> at a quarter. This follows the same principle as FBM octaves in noise &mdash; high-frequency detail gets lower amplitude. The combined displacement is applied to the sampling position, which is what creates the flowing, warped look.
        </p>

        <div className="article-callout">
          <p>
            <strong>Why sines instead of noise?</strong> Simplex noise involves permutation tables, gradient lookups, and interpolation &mdash; roughly 40+ operations per sample. Sine waves are single GPU instructions. For the flowing gradient look needed here, sine superposition produces visually similar organic shapes at a fraction of the computational cost. The trade-off: sine patterns are periodic (they repeat), while noise doesn't. At the scales used here, the periodicity isn't visible.
          </p>
        </div>

        <p>
          Each layer's time offset (<code className="c">wt * 0.7</code>, <code className="c">wt * 0.5</code>, <code className="c">wt * 0.35</code>) animates at a different speed. This creates a sense of depth &mdash; the large shapes move slowly like distant clouds, while the fine detail ripples faster.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">04</span>
        <h2 id="color">Painting with Math: Color Palette</h2>

        <p>
          The displaced coordinates from the wave layer produce two gradient signals that drive a <strong>three-color palette</strong>:
        </p>

        <CodeBlock code={CODE_COLOR} caption="Color blending &mdash; shader.glsl" />

        <p>
          The <code className="c">sin()</code> function converts the warped position into a smoothly oscillating blend factor. The <code className="c">* 0.5 + 0.5</code> shifts sin's output from [-1, 1] to [0, 1], giving us a 0-to-1 blend weight.
        </p>
        <p>
          Two different blend signals (<code className="c">n1</code> and <code className="c">n2</code>) are computed from different projections of the warped position. <code className="c">n1</code> drives the primary blend between <code className="c">col1</code> and <code className="c">col2</code>. <code className="c">n2</code> mixes in <code className="c">col3</code> at 40% influence, adding a third color accent that follows a different spatial pattern.
        </p>
        <p>
          The <code className="c">blendWidth</code> parameter controls how many oscillation cycles you get across the noise field. A small value produces broad, gradual color transitions. A large value creates tight, ribboned bands where colors alternate rapidly.
        </p>
        <p>
          Finally, <code className="c">waveIntensity</code> controls how much the colored gradient replaces the background. At 0, you see only the dark base. At 1, the full gradient shows. The default is tuned low (0.25) so the gradient is subtle and atmospheric rather than overwhelming.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">05</span>
        <h2 id="circle">The Particle Circle</h2>

        <p>
          The second layer creates a circle made of <strong>scattered, glowing particles</strong> along its circumference. The circle isn't drawn as a solid shape &mdash; it's an <em>implied</em> circle that emerges from hundreds of tiny dots clustered near a ring-shaped boundary.
        </p>
        <p>
          The setup begins with a simple <strong>signed distance field</strong> (SDF): compute the distance from each pixel to the circle's center, subtract the radius, and you get <code className="c">ringDist</code> &mdash; a value that's zero on the circumference, negative inside, and positive outside.
        </p>

        <CodeBlock code={CODE_CIRCLE_SETUP} caption="Circle SDF and ring glow" />

        <div className="article-breakout">
          <div className="article-diagram">
            <PolarGridDiagram />
            <p className="article-diagram-caption">
              The circle edge becomes a grid in polar coordinates. Each cell either spawns a particle or stays empty, based on a hash threshold.
            </p>
          </div>
        </div>

        <p>
          The <code className="c">ringGlow</code> uses a gaussian falloff (<code className="c">exp(-x^2)</code>) centered on the circumference. This creates a soft, even glow around the ring &mdash; the "base" of the circle that's always visible regardless of particle density.
        </p>
        <p>
          The <code className="c">edgeMask</code> uses a wider gaussian. It defines the zone where particles can appear &mdash; any particle contribution is multiplied by this mask, so particles naturally fade out as they get further from the ring edge.
        </p>
        <p>
          The <code className="c">atan()</code> function converts the pixel's position relative to the circle center into a polar angle, which becomes one axis of the particle grid.
        </p>

        <div className="article-callout">
          <p>
            <strong>Circle position is unbounded.</strong> The <code className="c">circleX</code> and <code className="c">circleY</code> parameters use DialKit's unbounded scrub input type, letting you drag the circle freely to any position &mdash; even partially or fully off-screen. The default places it at (0.5, 1.17), meaning the center sits above the visible area so only the bottom arc of particles is visible.
          </p>
        </div>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">06</span>
        <h2 id="particles">Particle Animation</h2>

        <p>
          The particle scatter runs in three layers, each producing particles at a different scale and speed. This creates visual variety &mdash; fine dust particles mixed with slightly larger ones:
        </p>

        <CodeBlock code={CODE_PARTICLES} caption="Hash-grid particle generation" />

        <h3>The polar grid</h3>
        <p>
          The key insight is mapping the problem to a <strong>2D grid in polar coordinates</strong>. The grid's x-axis is the angle around the circle (scaled by density). The y-axis is the radial distance from the circumference (scaled to create cells near the edge). Each cell in this grid is a potential particle location.
        </p>

        <h3>Hash-based existence</h3>
        <p>
          For each cell, <code className="c">hash21(cell)</code> returns a pseudo-random value between 0 and 1. The <code className="c">step(threshold, h)</code> function returns 1 if the hash exceeds the threshold, 0 otherwise. This gives each cell a binary "has particle" / "empty" state. Higher layers use higher thresholds (0.55, 0.65, 0.75), so they produce fewer, sparser particles.
        </p>

        <h3>Jittered positions</h3>
        <p>
          If every particle sat exactly at its cell center, they'd form a visible grid pattern. Two additional hash lookups (<code className="c">hx</code>, <code className="c">hy</code>) jitter each particle's position within its cell by up to 70%. This randomization breaks the grid regularity.
        </p>

        <h3>Fade animation</h3>
        <p>
          Each particle has a unique phase (from another hash) and fades in and out with a <code className="c">sin(phase + time)</code> oscillation. The <code className="c">max(0.0, sin(...))</code> clips the negative half, so particles spend time fully invisible between pulses. The result: particles wink in and out like distant stars.
        </p>
        <p>
          The <code className="c">tOff</code> (time offset) applied to the grid x-coordinate makes the entire grid slowly rotate, causing particles to drift along the circumference. Different layers drift at different speeds, adding to the sense of depth.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">07</span>
        <h2 id="flares">Lens Flares</h2>

        <p>
          The flare layer renders up to 8 <strong>directional light streaks</strong> that mimic the chromatic aberration you see when light hits a camera lens at an angle. Each flare has a procedurally generated position, angle, length, and intensity.
        </p>

        <CodeBlock code={CODE_FLARE} caption="Flare geometry &mdash; position and direction" />

        <p>
          Each flare's position is determined by hashing its index. This means the layout is deterministic &mdash; the same seed always produces the same arrangement &mdash; but appears random. A subtle sine/cosine drift makes each flare slowly wander over time.
        </p>
        <p>
          The streak's geometry is computed using <strong>dot products</strong>. Given a direction vector <code className="c">dir</code> and a perpendicular vector <code className="c">perp</code>, any pixel's position relative to the flare breaks down into two numbers: <code className="c">along</code> (how far along the streak) and <code className="c">perpDist</code> (how far from the streak's center line). These two values are all we need to shape the streak.
        </p>

        <div className="article-callout">
          <p>
            <strong>Flare angle uses ring input.</strong> The <code className="c">flareAngle</code> parameter uses DialKit's unbounded ring slider (<code className="c">ub-3</code>), which is ideal for rotational values &mdash; you can spin it continuously in either direction without hitting min/max bounds.
          </p>
        </div>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">08</span>
        <h2 id="chromatic">Chromatic Dispersion</h2>

        <p>
          The rainbow effect comes from a technique borrowed from real optics: <strong>chromatic aberration</strong>. In a real camera lens, different wavelengths of light bend at slightly different angles, causing red, green, and blue to separate spatially. The shader simulates this by rendering each color channel with a small <strong>perpendicular offset</strong>:
        </p>

        <CodeBlock code={CODE_CHROMATIC} caption="Chromatic aberration &mdash; RGB channel offset" />

        <div className="article-breakout">
          <div className="article-diagram">
            <ChromaticDiagram />
            <p className="article-diagram-caption">
              The R, G, B channels are offset perpendicular to the streak. Where they overlap, you see white. Where they separate, the full rainbow spectrum emerges.
            </p>
          </div>
        </div>

        <p>
          Each channel uses the same gaussian shape (<code className="c">exp(-x^2/w^2)</code>), but the red channel is shifted to one side by <code className="c">chrOffset</code> and the blue channel to the other. Green stays centered. The result:
        </p>
        <ul>
          <li>Where all three overlap: <strong>white</strong> (near the streak center)</li>
          <li>Red side: red fading through yellow to green</li>
          <li>Blue side: blue fading through cyan to green</li>
          <li>The full visible spectrum appears as a natural rainbow band</li>
        </ul>
        <p>
          The <code className="c">u_flareRainbow</code> parameter controls the offset distance. At 0, all channels overlap perfectly and the streak is white. At 1, maximum dispersion creates a wide, vivid rainbow.
        </p>
        <p>
          On top of the chromatic streak, each flare adds a <strong>warm central glow</strong> &mdash; a soft orange dot at the flare's source position. This mimics the diffuse glow you see around bright light sources in real lens photography.
        </p>
        <p>
          A <code className="c">shimmer</code> factor modulates each flare's brightness over time with a slow sine wave, so the flares pulse gently rather than staying static.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">09</span>
        <h2 id="grain">Film Grain</h2>

        <p>
          The final visual layer adds <strong>animated film grain</strong> &mdash; the subtle texture that gives the image a photographic, analog quality. Unlike simple white noise, real film grain has <strong>varying sizes</strong>: some grains are tiny silver halide crystals, others form larger clumps.
        </p>

        <CodeBlock code={CODE_GRAIN} caption="Multi-scale film grain" />

        <h3>Two-scale approach</h3>
        <p>
          The grain is built from two scales of hash noise. The <strong>fine grain</strong> operates at <code className="c">u_grainSize</code> pixels per cell &mdash; typically 1.5 to 2 pixels. The <strong>coarse grain</strong> uses cells 2 to 7 times larger, controlled by <code className="c">u_grainVariation</code>. Both are computed by flooring the pixel coordinate to create a grid, then hashing the cell index.
        </p>
        <p>
          Each scale uses two independent hash functions (<code className="c">hash21</code> and <code className="c">hash31</code>) and averages them. Using two hashes instead of one reduces visible directional artifacts &mdash; a single hash can produce subtle line patterns, but averaging two with different constants cancels those out.
        </p>

        <h3>Temporal animation</h3>
        <p>
          The <code className="c">grainT = floor(u_time * u_grainSpeed)</code> quantizes time into discrete steps. At a speed of 30, the grain pattern changes 30 times per second. This creates the characteristic <strong>flickering</strong> of film grain, where each frame has a different random texture. The <code className="c">floor()</code> ensures the grain holds steady between updates rather than smoothly interpolating, which would look like a blur.
        </p>

        <h3>Centered around zero</h3>
        <p>
          The <code className="c">- 0.5</code> offset is important. Without it, the grain would only brighten pixels. By centering around zero, the grain both adds and subtracts from the base color, creating true film-like grain that darkens some areas and brightens others.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">10</span>
        <h2 id="post">Post-Processing</h2>

        <p>
          After all four layers are composited, three adjustments polish the final image:
        </p>

        <CodeBlock code={CODE_POST} caption="Post-processing &mdash; saturation, contrast, clamp" />

        <h3>Saturation</h3>
        <p>
          The luminance weights <code className="c">(0.299, 0.587, 0.114)</code> reflect how the human eye perceives brightness &mdash; green appears much brighter than blue. Mixing between the grayscale (luma) and the full color gives a natural saturation control. Below 1 desaturates; above 1 pushes colors further from gray.
        </p>

        <h3>Brightness &amp; Contrast</h3>
        <p>
          Brightness is a simple multiplication. Contrast scales the color's distance from mid-gray: <code className="c">(color - 0.5) * contrast + 0.5</code>. Above 1, darks get darker and brights get brighter. The default brightness of 3.0 might seem extreme, but it compensates for the intentionally low <code className="c">waveIntensity</code> &mdash; the gradient layer is deliberately dim so that brightness can be used as a global exposure control.
        </p>

        <div className="article-callout">
          <p>
            <strong>The final clamp.</strong> <code className="c">clamp(color, 0.0, 1.0)</code> isn't just safety &mdash; it's essential. Additive blending from the flare and circle layers can push values above 1.0. Without the clamp, the GPU would still display them correctly (modern displays clip to [0,1]), but the intermediate values would affect the contrast calculation unpredictably.
          </p>
        </div>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />
        <span className="article-section-num">11</span>
        <h2 id="bridge">The Bridge: JavaScript to GPU</h2>

        <p>
          Every parameter in the control panel &mdash; colors, positions, intensities, toggle states &mdash; needs to cross from JavaScript into the shader. This happens through <strong>uniforms</strong>: named values that the CPU writes to GPU memory every frame.
        </p>

        <CodeBlock code={CODE_UNIFORMS} caption="Uniform update loop &mdash; experiment.ts" />

        <p>
          The data flow works like this:
        </p>
        <ol>
          <li><strong>DialKit</strong> renders the control panel. Dragging a slider or changing a color updates a flat JavaScript object.</li>
          <li>Every frame (60 times per second), the <code className="c">render()</code> function reads that object and writes each value to the GPU using <code className="c">gl.uniform*</code> calls.</li>
          <li>The GPU reads these values at the start of each fragment shader invocation. In the shader, they appear as the <code className="c">u_*</code> variables you've seen throughout.</li>
        </ol>

        <h3>Type conversions</h3>
        <p>
          Some values need conversion across the bridge. Colors are stored as hex strings in the UI (<code className="c">'#593e03'</code>) but the shader needs RGB floats (<code className="c">vec3(0.35, 0.24, 0.01)</code>). The circle position comes from two separate parameters (<code className="c">circleX</code>, <code className="c">circleY</code>) that get combined into a single <code className="c">vec2</code> uniform. Boolean toggles are sent as <code className="c">1.0</code> or <code className="c">0.0</code> floats, since GLSL has no native boolean uniform type in WebGL.
        </p>

        <CodeBlock code={CODE_HASH} caption="Hash functions used throughout the shader" />

        <p>
          These hash functions appear in three of the four layers: particles, flares, and grain. They're <strong>deterministic</strong> &mdash; the same input always produces the same output &mdash; but the output <em>appears</em> random with no visible patterns. The magic numbers (<code className="c">0.1031</code>, <code className="c">33.33</code>, etc.) were found empirically to minimize directional bias. This implementation comes from the Dave Hoskins hash collection, widely used in shader programming.
        </p>

        {/* ────────────────────────────────────────── */}
        <hr className="article-divider" />

        <div className="article-summary">
          <h3>Wrapping Up</h3>
          <p>
            Every pixel you see is computed independently by a single fragment shader. The visual complexity emerges from <strong>four composited layers</strong>, each using a different mathematical technique:
          </p>
          <ul>
            <li><strong>Wave gradient</strong> uses sine-wave superposition to create flowing organic shapes without expensive noise lookups.</li>
            <li><strong>Particle circle</strong> scatters hash-grid dots in polar coordinates around a ring SDF, with animated fade and drift.</li>
            <li><strong>Lens flares</strong> render chromatic rainbow streaks by offsetting the R, G, B channels of gaussian curves perpendicular to each streak's direction.</li>
            <li><strong>Film grain</strong> blends fine and coarse hash noise with temporal animation for a photographic texture.</li>
          </ul>
          <p>
            All four layers can be toggled independently, and every visual parameter &mdash; 40+ of them &mdash; is controllable in real time through the DialKit panel. The shader is a machine with knobs for everything from circle position to rainbow dispersion to grain texture.
          </p>
        </div>

      {/* close article-body */}
      </div>
    </motion.div>
  );
}
