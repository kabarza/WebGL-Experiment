// ============================================================
// ClapLensArticle — Deep dive on the clap-lens experiment
// ============================================================

import { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { useChrome } from './ChromeContext.tsx';

/* ── SVG Diagrams ──────────────────────────────────── */

function HandLandmarksDiagram() {
  // Approximate landmark positions for a right hand, palm-forward, rendered
  // in SVG units — mirrors MediaPipe's 21-point convention so readers can
  // follow any landmark index (0 = wrist, 4 = thumb tip, 8 = index tip, …).
  const points: Array<[number, number]> = [
    [150, 270],
    [120, 252], [95, 232], [72, 214], [52, 200],
    [115, 188], [114, 146], [114, 108], [114, 72],
    [150, 176], [150, 128], [150, 82], [150, 40],
    [185, 186], [186, 144], [186, 106], [186, 76],
    [218, 198], [220, 162], [221, 132], [222, 104],
  ];
  const connections: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17],
  ];
  const labels: Record<number, string> = {
    0: 'wrist',
    4: 'thumb tip',
    8: 'index tip',
    12: 'middle tip',
    16: 'ring tip',
    20: 'pinky tip',
    9: 'middle MCP',
  };
  return (
    <svg viewBox="0 0 300 320" fill="none" role="img" aria-label="MediaPipe 21-point hand landmarks" style={{ maxWidth: 600 }}>
      {connections.map(([a, b], i) => (
        <line
          key={i}
          x1={points[a][0]}
          y1={points[a][1]}
          x2={points[b][0]}
          y2={points[b][1]}
          stroke="rgba(120,255,200,0.35)"
          strokeWidth="2"
        />
      ))}
      {points.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5" fill="#ff5c5c" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
          <text
            x={x + 8}
            y={y + 4}
            fill="rgba(255,255,255,0.45)"
            fontSize="9"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {i}
          </text>
          {labels[i] && (
            <text
              x={x < 140 ? x - 10 : x + 18}
              y={y - 6}
              fill="rgba(255,255,255,0.35)"
              fontSize="9"
              textAnchor={x < 140 ? 'end' : 'start'}
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {labels[i]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function ClapStateMachine() {
  return (
    <svg viewBox="0 0 520 220" fill="none" role="img" aria-label="Clap detector state machine" style={{ maxWidth: 900 }}>
      {/* IDLE */}
      <rect x="40" y="80" width="140" height="60" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
      <text x="110" y="110" textAnchor="middle" fill="#e8e8e8" fontSize="14" fontWeight="500" style={{ fontFamily: 'var(--font-body)' }}>IDLE</text>
      <text x="110" y="128" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>no lens</text>

      {/* ACTIVE */}
      <rect x="340" y="80" width="140" height="60" rx="8" fill="rgba(120,255,200,0.08)" stroke="rgba(120,255,200,0.4)" strokeWidth="1.5" />
      <text x="410" y="110" textAnchor="middle" fill="#a0f0d8" fontSize="14" fontWeight="500" style={{ fontFamily: 'var(--font-body)' }}>ACTIVE</text>
      <text x="410" y="128" textAnchor="middle" fill="rgba(160,240,216,0.55)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>lens rendered</text>

      {/* Forward: IDLE → ACTIVE */}
      <line x1="180" y1="100" x2="334" y2="100" stroke="rgba(120,255,200,0.65)" strokeWidth="1.5" />
      <polygon points="339,100 330,95 330,105" fill="rgba(120,255,200,0.65)" />
      <text x="257" y="86" textAnchor="middle" fill="rgba(120,255,200,0.85)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>clap fires</text>
      <text x="257" y="72" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>d &lt; 0.25 ∧ v &gt; 0.5</text>

      {/* Reverse: ACTIVE → IDLE (curved) */}
      <path d="M 336 130 Q 260 195 184 130" stroke="rgba(255,130,130,0.55)" strokeWidth="1.5" fill="none" />
      <polygon points="184,130 192,125 192,135" fill="rgba(255,130,130,0.55)" />
      <text x="260" y="185" textAnchor="middle" fill="rgba(255,185,185,0.85)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>pair lost &gt; graceMs</text>

      {/* Self-loop on ACTIVE for cooldown suppression */}
      <path d="M 460 80 Q 500 50 480 80" stroke="rgba(255,220,150,0.4)" strokeWidth="1.2" fill="none" strokeDasharray="3 3" />
      <text x="502" y="48" textAnchor="start" fill="rgba(255,220,150,0.65)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>500ms cooldown</text>
    </svg>
  );
}

function SpreadGauge() {
  const width = 540;
  const height = 120;
  const barY = 50;
  const barH = 22;
  const max = 1.5;
  const x = (v: number) => 30 + (v / max) * 480;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} fill="none" role="img" aria-label="Fingertip spread zones" style={{ maxWidth: 900 }}>
      {/* Background bar */}
      <rect x={x(0)} y={barY} width={x(max) - x(0)} height={barH} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" rx="2" />

      {/* Active zone 0 → 0.22 (green) */}
      <rect x={x(0)} y={barY} width={x(0.22) - x(0)} height={barH} fill="rgba(120,255,200,0.25)" stroke="rgba(120,255,200,0.55)" strokeWidth="1" rx="2" />

      {/* Hysteresis zone 0.22 → 0.4 (yellow) */}
      <rect x={x(0.22)} y={barY} width={x(0.4) - x(0.22)} height={barH} fill="rgba(240,200,100,0.14)" stroke="rgba(240,200,100,0.35)" strokeWidth="1" />

      {/* Activate threshold */}
      <line x1={x(0.22)} y1={barY - 6} x2={x(0.22)} y2={barY + barH + 6} stroke="rgba(120,255,200,0.75)" strokeWidth="1" strokeDasharray="3 3" />
      <text x={x(0.22)} y={barY - 12} textAnchor="middle" fill="rgba(120,255,200,0.9)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>activate</text>
      <text x={x(0.22)} y={barY + barH + 18} textAnchor="middle" fill="rgba(120,255,200,0.8)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>0.22</text>

      {/* Release threshold */}
      <line x1={x(0.4)} y1={barY - 6} x2={x(0.4)} y2={barY + barH + 6} stroke="rgba(240,200,100,0.75)" strokeWidth="1" strokeDasharray="3 3" />
      <text x={x(0.4)} y={barY - 12} textAnchor="middle" fill="rgba(240,200,100,0.9)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>release</text>
      <text x={x(0.4)} y={barY + barH + 18} textAnchor="middle" fill="rgba(240,200,100,0.85)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>0.4</text>

      {/* Gesture labels below */}
      <text x={x(0.11)} y={barY + barH + 38} textAnchor="middle" fill="rgba(160,240,216,0.85)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>bouquet / fist</text>
      <text x={x(0.65)} y={barY + barH + 38} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>relaxed</text>
      <text x={x(1.15)} y={barY + barH + 38} textAnchor="middle" fill="rgba(120,200,255,0.75)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>open palm</text>

      {/* Axis ticks */}
      {[0, 0.5, 1.0, 1.5].map((v) => (
        <text
          key={v}
          x={x(v)}
          y={barY + barH + 56}
          textAnchor="middle"
          fill="rgba(255,255,255,0.2)"
          fontSize="9"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {v.toFixed(1)}
        </text>
      ))}
      <text x={width - 20} y={barY + barH + 56} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>spread (× hand scale)</text>
    </svg>
  );
}

function ShapeGallery() {
  // Each shape centered at (50, 50) inside a 100×100 cell.
  const star = (() => {
    const cx = 50, cy = 50, outer = 34, inner = 14;
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(' ');
  })();

  const items = [
    { name: 'Circle', el: <circle cx="50" cy="50" r="34" /> },
    { name: 'Hexagon', el: <polygon points="50,16 79,33 79,67 50,84 21,67 21,33" /> },
    { name: 'Diamond', el: <polygon points="50,14 86,50 50,86 14,50" /> },
    { name: 'Squircle', el: <rect x="16" y="16" width="68" height="68" rx="24" ry="24" /> },
    { name: 'Star', el: <polygon points={star} /> },
  ];

  return (
    <svg viewBox="0 0 540 130" fill="none" role="img" aria-label="Lens SDF shapes" style={{ maxWidth: 900 }}>
      {items.map((item, i) => {
        const tx = 24 + i * 102;
        return (
          <g key={item.name} transform={`translate(${tx} 0)`}>
            <g transform="translate(0 10)" fill="rgba(120,200,255,0.18)" stroke="rgba(120,200,255,0.7)" strokeWidth="1.5">
              {item.el}
            </g>
            <text x="50" y="120" textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>
              {item.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

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

/* ── Code snippets ─────────────────────────────────── */

const CODE_STACK = `// @mediapipe/tasks-vision + custom pipeline
const fileset = await FilesetResolver.forVisionTasks('/vision/wasm');
const landmarker = await HandLandmarker.createFromOptions(fileset, {
  baseOptions: {
    modelAssetPath: '/vision/hand_landmarker.task',
    delegate: 'GPU',
  },
  numHands: 2,
  runningMode: 'VIDEO',
});

// Driven by requestVideoFrameCallback — only fires on decoded frames.
video.requestVideoFrameCallback(() => {
  const result = landmarker.detectForVideo(video, performance.now());
  // result.landmarks: 21 points × up to 2 hands
  // result.handedness: "Left" | "Right" per hand (often unreliable near frame edges)
});`;

const CODE_CLAP = `// Clap fires when wrists are close AND approaching fast.
const d = dist2d(wristA, wristB);          // 0..1 video space
const windowSample = history.find((s) => s.t >= t - 200) ?? history[0];
const dt = (t - windowSample.t) / 1000;
const inwardVelocity = (windowSample.d - d) / dt;   // positive = shrinking

const canFire = t - lastClapTime > 500;     // 500ms cooldown
if (canFire && d < 0.25 && inwardVelocity > 0.5) {
  fireClap();
  mode = 'active';
}`;

const CODE_STICKY = `// Clap + Sticky: pair present → midpoint + wrist distance.
// One hand remains → palm center, size driven by fingertip spread.
if (pair) {
  center = wristMidpoint(pair[0], pair[1]);
  size = wristDistance(pair[0], pair[1]);
} else if (hands.length > 0) {
  const hand = hands[0];
  center = palmCenter(hand);
  const scale = handScale(hand);              // wrist → middle MCP
  const spread = fingertipSpread(hand);       // ~0.2 closed, ~1.2 open
  size = scale * (base + spread * range);     // user closes fist → smaller
}`;

const CODE_PINCH = `// Spread = avg fingertip distance from their centroid, in hand-scale units.
// ~0.2 when fingertips touch, ~1.0+ when hand is fully open.
function fingertipSpread(hand) {
  const tips = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP]
    .map((i) => hand.landmarks[i]);
  const cx = tips.reduce((a, t) => a + t.x, 0) / 5;
  const cy = tips.reduce((a, t) => a + t.y, 0) / 5;
  const avg = tips.reduce(
    (a, t) => a + Math.hypot(t.x - cx, t.y - cy), 0
  ) / 5;
  return avg / handScale(hand);
}

// Dwell timer: spread must stay below threshold for 80ms before firing —
// filters out single-frame noise.
if (spread > releaseThreshold) belowSince = null;
else if (spread < activateThreshold) belowSince ??= t;
if (belowSince && t - belowSince >= minActiveMs) fire();`;

const CODE_LENS = `// Lens SDF in aspect-corrected space (circle stays round in pixels).
vec2 p = vec2((ndc.x - uLensCenter.x) * uViewportAspect,
              ndc.y - uLensCenter.y);
float d = sdLens(p, uLensRadius);              // <0 inside, >0 outside

// Inside: distort sample, aberrate by radial offset, warp with noise.
vec2 toCenter = ndc - uLensCenter;
float norm = clamp(length(toCenter) / uLensRadius, 0.0, 1.0);
vec2 warped = uLensCenter
            + toCenter * (1.0 + uDistortion * pow(1.0 - norm, 2.0));
warped += noise2(p * uNoiseScale + uTime) * uNoiseWarp * inside;

vec2 radial = warped - uLensCenter;
col.r = texture2D(uVideoTexture, videoUV(warped + radial * uAberr)).r;
col.g = texture2D(uVideoTexture, videoUV(warped)).g;
col.b = texture2D(uVideoTexture, videoUV(warped - radial * uAberr)).b;`;

/* ── TOC sections ──────────────────────────────────── */

export const TOC_SECTIONS = [
  { id: 'overview', label: 'The Big Picture' },
  { id: 'tracking', label: 'Seeing Your Hands' },
  { id: 'clap', label: 'Detecting the Clap' },
  { id: 'sticky', label: 'The Sticky Handoff' },
  { id: 'pinch', label: 'One-Hand Pinch' },
  { id: 'lens', label: 'The Lens Shader' },
  { id: 'coords', label: 'Landmarks on Screen' },
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

export function ClapLensArticle() {
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
      <header className="article-hero">
        <p className="article-hero-eyebrow">Deep Dive</p>
        <h1>How the Lens Works</h1>
        <p className="article-hero-lead">
          A webcam feed, two hands, and a glowing lens between them — driven end to
          end from 21 landmarks per hand, a velocity-gated clap detector, and a
          fragment shader that samples the video through a swappable SDF.
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
          The goal was simple: hold up both hands, clap, pull them apart, and
          see a lens appear between them that distorts the video of your face.
          What starts simple turns into three interlocking problems:
          <strong> reliable hand tracking</strong>, <strong>a gesture state machine</strong>{' '}
          that tolerates real-world jitter, and <strong>a shader</strong> that responds
          live to coordinates coming from both.
        </p>
        <p>
          The experiment ships three activation modes, all sharing the same lens
          shader. <strong>Clap</strong> is the original: two hands, clap, the
          effect tracks the midpoint while both stay in view. <strong>Clap + Sticky</strong>{' '}
          adds a handoff — once the clap fires, the lens stays with whichever hand
          remains, and opening or closing that palm scales the effect.{' '}
          <strong>Pinch</strong> is one-handed: bunch your five fingertips toward
          the palm center and the lens snaps on without any clap at all.
        </p>
        <div className="article-callout">
          <p>
            <strong>The governing idea:</strong> landmarks are noisy, detectors
            lose hands, and real gestures are sloppy. Every part of the pipeline
            has to be tolerant — smoothing, hysteresis, grace periods — or the
            effect flickers on and off every time the user moves a finger wrong.
          </p>
        </div>

        {/* ── 02 Tracking ── */}
        <hr className="article-divider" />
        <span className="article-section-num">02</span>
        <h2 id="tracking">Seeing Your Hands</h2>

        <p>
          Hand tracking is off-the-shelf:{' '}
          <a href="https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js"
             target="_blank" rel="noopener noreferrer">MediaPipe Tasks Vision</a>,{' '}
          its <code className="c">HandLandmarker</code> task, with the GPU delegate.
          Each inference returns up to two hands, each with 21 3D keypoints in
          normalized image space (x, y ∈ 0..1; z is pseudo-depth relative to the
          wrist).
        </p>

        <CodeBlock code={CODE_STACK} caption="MediaPipe setup &mdash; HandTracker.ts" />

        <div className="article-breakout">
          <div className="article-diagram">
            <HandLandmarksDiagram />
            <p className="article-diagram-caption">
              Each detected hand comes back as 21 numbered landmarks. Index 0 is the wrist; fingertips are indices 4, 8, 12, 16, and 20. Every geometric primitive used downstream — wrist distance, palm center, fingertip spread — is a pure function of these numbers.
            </p>
          </div>
        </div>

        <p>
          The frame loop is split in two. Detection runs off{' '}
          <code className="c">requestVideoFrameCallback</code> — it fires exactly
          once per decoded video frame, so the detector never runs on a stale
          frame and never burns CPU waiting. Rendering runs off{' '}
          <code className="c">requestAnimationFrame</code> at the display's native
          rate. Landmarks flow between them through a shared state object that{' '}
          <code className="c">HandState</code> smooths with per-axis One-Euro
          filters — low cutoff at rest for stability, wider at speed for
          responsiveness.
        </p>
        <p>
          MediaPipe's own <code className="c">handedness</code> labels (Left/Right)
          flip near frame edges, so the experiment assigns its own{' '}
          <code className="c">Primary</code>/<code className="c">Secondary</code>{' '}
          labels and keeps them stable across frames with nearest-neighbor matching
          on wrist positions. If a hand vanishes and reappears at a different
          spot, it's treated as new rather than swapped.
        </p>

        {/* ── 03 Clap ── */}
        <hr className="article-divider" />
        <span className="article-section-num">03</span>
        <h2 id="clap">Detecting the Clap</h2>

        <p>
          A clap isn't "wrists touching" — it's wrists moving together fast and
          then being close. That distinction matters: a pair of hands held near
          each other shouldn't trigger. The detector tracks a rolling window of
          wrist distance samples and derives an inward velocity over the last
          200ms. The clap fires only when both the distance is small{' '}
          <em>and</em> that velocity is positive (distance shrinking) above a
          threshold.
        </p>

        <CodeBlock code={CODE_CLAP} caption="Clap condition &mdash; ClapDetector.update" />

        <div className="article-breakout">
          <div className="article-diagram">
            <ClapStateMachine />
            <p className="article-diagram-caption">
              The state machine is intentionally minimal: two states, a velocity-gated transition in, a grace-period transition out. The cooldown (dashed self-loop) prevents a single physical clap from firing multiple times as the hands bounce apart.
            </p>
          </div>
        </div>

        <p>
          After the clap, the detector holds <code className="c">mode === 'active'</code>{' '}
          until the pair is lost for longer than a grace window (default 600ms).
          Without that grace, a single-frame tracking hiccup — common when hands
          are near the edge or one briefly occludes the other — would kill the
          effect. With it, brief losses are invisible. A short cooldown prevents
          re-firing on the same physical clap.
        </p>

        {/* ── 04 Sticky ── */}
        <hr className="article-divider" />
        <span className="article-section-num">04</span>
        <h2 id="sticky">The Sticky Handoff</h2>

        <p>
          The Sticky mode is an explicit answer to a usability problem: in Clap
          mode, the moment you drop one hand the effect dies, even if the other
          hand is still perfectly visible. Sticky keeps the effect alive and
          hands it over to the surviving hand.
        </p>

        <CodeBlock code={CODE_STICKY} caption="Two-hand → one-hand handoff" />

        <p>
          The tricky bit is <strong>size</strong>. With two hands, the lens
          diameter is naturally the wrist distance. With one hand, there is no
          wrist distance — so the experiment repurposes{' '}
          <em>fingertip spread</em> (how open or closed the palm is) as a size
          control. Close your fist and the lens shrinks. Open your palm and it
          grows. Transitions between 2-hand and 1-hand targets are eased through
          an exponential smoother so the lens glides from the midpoint to the
          remaining hand instead of teleporting.
        </p>

        {/* ── 05 Pinch ── */}
        <hr className="article-divider" />
        <span className="article-section-num">05</span>
        <h2 id="pinch">One-Hand Pinch</h2>

        <p>
          Pinch mode detects the "bouquet" pose — all five fingertips bunched
          together, like holding an invisible pinch of salt. The metric is
          average fingertip-to-centroid distance divided by hand scale
          (wrist → middle MCP). Fully open palm scores around 0.9–1.2; a tight
          bouquet drops to around 0.15–0.25.
        </p>

        <CodeBlock code={CODE_PINCH} caption="Fingertip spread + dwell timer" />

        <div className="article-breakout">
          <div className="article-diagram">
            <SpreadGauge />
            <p className="article-diagram-caption">
              Spread zones along the normalized metric. A fully bunched bouquet lives in the green band; the yellow band is the hysteresis zone where the current state holds. Tune both thresholds live in the DialKit panel — &quot;Pinch → pinchActivate / pinchRelease&quot;.
            </p>
          </div>
        </div>

        <p>
          Two guards prevent false fires. A <strong>dwell timer</strong> requires
          the spread to stay below the activate threshold for a short window
          (default 80ms) before the gesture actually fires — filters out
          single-frame noise when MediaPipe briefly misjudges a relaxed hand.{' '}
          <strong>Hysteresis</strong> uses separate activate and release
          thresholds, so the state doesn't chatter on the boundary. Open the
          hand decisively to release; a quick twitch isn't enough.
        </p>

        {/* ── 06 Lens ── */}
        <hr className="article-divider" />
        <span className="article-section-num">06</span>
        <h2 id="lens">The Lens Shader</h2>

        <p>
          A single full-screen fragment shader does the drawing. It writes a
          transparent RGBA over the video plane so the normal video shows through
          everywhere <em>except</em> the lens region, where three things happen:
          radial barrel distortion, chromatic aberration, and a noise warp.
        </p>

        <CodeBlock code={CODE_LENS} caption="Lens distortion core &mdash; effect.glsl" />

        <div className="article-breakout">
          <div className="article-diagram">
            <ShapeGallery />
            <p className="article-diagram-caption">
              Five SDFs, one switch statement. The shader picks whichever returns the right signed-distance value for the pixel, so the rest of the effect — distortion, chromatic aberration, rim glow — works unchanged across shapes.
            </p>
          </div>
        </div>

        <p>
          The shape comes from a signed distance function selected by{' '}
          <code className="c">uShape</code> — circle, hexagon, diamond, squircle,
          or star. Each returns a single float that's <code className="c">&lt;0</code>{' '}
          inside the shape, <code className="c">&gt;0</code> outside. That value feeds
          both the alpha falloff (smooth rim) and the additive rim glow that
          peaks where the SDF crosses zero. Because the shader operates in
          aspect-corrected space (p.x multiplied by viewport aspect), every shape
          stays geometrically correct regardless of window size.
        </p>
        <p>
          Chromatic aberration is a one-liner — sample the R, G, and B channels
          at slightly different offsets along the radial axis from the lens
          center. A pulse boost piped in from the clap state briefly increases
          the aberration right after each clap, giving the effect a pop on
          trigger without the constant chroma separation becoming fatiguing.
        </p>

        {/* ── 07 Coords ── */}
        <hr className="article-divider" />
        <span className="article-section-num">07</span>
        <h2 id="coords">Landmarks on Screen</h2>

        <p>
          Landmarks arrive in image space, but the lens renders in NDC, and the
          video plane covers an arbitrary viewport aspect. Connecting the three
          correctly is where most "my effect is in the wrong place" bugs come
          from.
        </p>
        <p>
          The video plane uses a <strong>cover-fit</strong> strategy — it fills
          the full viewport, cropping whichever axis doesn't match the video
          aspect. The same transform has to be applied in reverse when mapping a
          landmark to its on-screen position: center the coordinate around 0.5,
          apply the cover-fit scale, flip the y axis (image y goes down, NDC y
          goes up), and flip x if the display is mirrored (selfie mode). A
          shared <code className="c">landmarkToNDC</code> utility bakes this in
          so the skeleton overlay and the lens always agree on where each
          fingertip actually is.
        </p>
        <p>
          The lens radius is converted from the source distance (wrists or hand
          scale) to aspect-corrected p-space by multiplying by viewport aspect.
          With <code className="c">sizeMultiplier = 1.0</code> the lens horizontal
          extent equals the source distance on screen; the default of{' '}
          <code className="c">0.7</code> leaves a comfortable margin between the
          hands and the rim. That scaling is why the same preset looks right on
          a 16:9 laptop and a 1:1 crop without re-tuning.
        </p>

      </div>
    </motion.div>
  );
}
