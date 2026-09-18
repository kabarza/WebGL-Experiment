// ============================================================
// AngrySlider1Article — Deep dive on the angry-slider-1 experiment
// ============================================================

import { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { useChrome } from './ChromeContext.tsx';

/* ── SVG Diagrams ──────────────────────────────────── */

function RowAnatomyDiagram() {
  // One slider row, drawn to the same proportions as the real DOM:
  // label + tag + value on the head, the track capsule below, and the
  // invisible interaction bands that the hit test actually uses.
  return (
    <svg viewBox="0 0 760 260" fill="none" role="img" aria-label="Anatomy of a slider row" style={{ maxWidth: 900 }}>
      {/* head */}
      <text x="60" y="42" fill="rgba(255,255,255,0.85)" fontSize="16" fontWeight="600" style={{ fontFamily: 'var(--font-body)' }}>Exposure</text>
      <rect x="150" y="28" width="52" height="19" rx="4" fill="rgba(226,64,47,0.18)" stroke="rgba(226,64,47,0.45)" strokeWidth="1" />
      <text x="176" y="41" textAnchor="middle" fill="#ff8a80" fontSize="9" fontWeight="700" letterSpacing="1.2" style={{ fontFamily: 'var(--font-mono)' }}>SLING</text>
      <text x="700" y="42" textAnchor="end" fill="rgba(255,255,255,0.9)" fontSize="15" style={{ fontFamily: 'var(--font-body)' }}>+0.4 EV</text>

      {/* track */}
      <rect x="60" y="94" width="640" height="12" rx="6" fill="rgba(90,90,100,0.55)" stroke="rgba(0,0,0,0.6)" strokeWidth="1" />
      {/* fill */}
      <rect x="60" y="94" width="366" height="12" rx="6" fill="rgba(226,64,47,0.85)" stroke="rgba(110,19,12,0.9)" strokeWidth="1" />
      {/* thumb */}
      <circle cx="426" cy="100" r="12" fill="rgba(255,255,255,0.95)" stroke="rgba(0,0,0,0.45)" strokeWidth="1" />

      {/* hit bands */}
      <rect x="52" y="80" width="656" height="40" fill="rgba(226,64,47,0.05)" stroke="rgba(226,64,47,0.35)" strokeWidth="1" strokeDasharray="4 3" />
      <text x="716" y="74" textAnchor="end" fill="rgba(255,138,128,0.75)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>hit band ±13px → click-to-set</text>

      {/* fork dots at the progress tip */}
      <circle cx="426" cy="100" r="4" fill="#e2402f" />
      <circle cx="444" cy="100" r="4" fill="#e2402f" />
      <text x="435" y="126" textAnchor="middle" fill="rgba(255,138,128,0.8)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>fork dots: tip · tip+18</text>

      {/* bracket annotations */}
      <text x="60" y="160" fill="rgba(255,255,255,0.45)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>fill = progress (red, volumetric)</text>
      <text x="440" y="160" fill="rgba(255,255,255,0.45)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>track = gray capsule</text>
      <text x="330" y="186" fill="rgba(255,255,255,0.45)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>handle = 22px shaded sphere</text>
      <line x1="426" y1="112" x2="426" y2="168" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <line x1="435" y1="106" x2="435" y2="168" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
    </svg>
  );
}

function FlightPipelineDiagram() {
  return (
    <svg viewBox="0 0 860 230" fill="none" role="img" aria-label="Grab to landing pipeline" style={{ maxWidth: 900 }}>
      {(() => {
        const states = [
          { x: 30, label: 'GRAB', sub: 'pointerdown\nhit test', hot: false },
          { x: 195, label: 'STRETCH', sub: '> 13px\nknob → canvas', hot: true },
          { x: 375, label: 'AIM', sub: 'predict()\ndots + value', hot: true },
          { x: 555, label: 'FLY', sub: 'physStep\n@ 240 Hz', hot: true },
          { x: 720, label: 'LAND', sub: 'fill S-curve\nor boom', hot: false },
        ] as const;
        return states.map((s, i) => (
          <g key={s.label}>
            <rect
              x={s.x} y="70" width="130" height="70" rx="8"
              fill={s.hot ? 'rgba(226,64,47,0.08)' : 'rgba(255,255,255,0.04)'}
              stroke={s.hot ? 'rgba(226,64,47,0.5)' : 'rgba(255,255,255,0.22)'}
              strokeWidth="1.5"
            />
            <text x={s.x + 65} y="100" textAnchor="middle" fill="#e8e8e8" fontSize="14" fontWeight="600" style={{ fontFamily: 'var(--font-body)' }}>{s.label}</text>
            {s.sub.split('\n').map((line, j) => (
              <text key={j} x={s.x + 65} y={118 + j * 14} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9.5" style={{ fontFamily: 'var(--font-mono)' }}>{line}</text>
            ))}
            {i < states.length - 1 && (
              <>
                <line x1={s.x + 132} y1="105" x2={states[i + 1].x - 8} y2="105" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                <polygon points={`${states[i + 1].x - 3},105 ${states[i + 1].x - 12},100 ${states[i + 1].x - 12},110`} fill="rgba(255,255,255,0.3)" />
              </>
            )}
          </g>
        ));
      })()}
      {/* the loop back: predict == flight */}
      <path d="M 620 145 Q 620 200 440 200 Q 260 200 260 148" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" fill="none" strokeDasharray="4 4" />
      <text x="440" y="194" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>
        one integrator, two consumers — dots are never a guess
      </text>
    </svg>
  );
}

function ForkGeometryDiagram() {
  return (
    <svg viewBox="0 0 760 200" fill="none" role="img" aria-label="Slingshot fork geometry" style={{ maxWidth: 900 }}>
      {/* track + fill tip */}
      <rect x="60" y="60" width="600" height="10" rx="5" fill="rgba(90,90,100,0.55)" stroke="rgba(0,0,0,0.6)" strokeWidth="1" />
      <rect x="60" y="60" width="240" height="10" rx="5" fill="rgba(226,64,47,0.85)" stroke="rgba(110,19,12,0.9)" strokeWidth="1" />
      {/* fork dots at tip and tip + 18 */}
      <circle cx="300" cy="65" r="5" fill="#e2402f" />
      <circle cx="318" cy="65" r="5" fill="#e2402f" />
      {/* bands down to the knob */}
      <line x1="300" y1="65" x2="150" y2="170" stroke="rgba(226,64,47,0.85)" strokeWidth="2" />
      <line x1="318" y1="65" x2="150" y2="170" stroke="rgba(226,64,47,0.85)" strokeWidth="2" />
      <circle cx="150" cy="170" r="11" fill="rgba(255,255,255,0.95)" stroke="rgba(0,0,0,0.45)" strokeWidth="1" />
      {/* dimension line */}
      <line x1="300" y1="88" x2="318" y2="88" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
      <line x1="300" y1="83" x2="300" y2="93" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
      <line x1="318" y1="83" x2="318" y2="93" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
      <text x="328" y="91" fill="rgba(255,255,255,0.5)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>18px</text>
      <text x="300" y="45" textAnchor="middle" fill="rgba(255,138,128,0.85)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>left dot = progress tip</text>
      <text x="150" y="196" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>draw = (anchor − pointer) × 6, clamped</text>
    </svg>
  );
}

function LayerStackDiagram() {
  const layers = [
    {
      y: 20,
      name: 'FX canvas (2D)',
      detail: 'trajectory dots · stretch bands · knob · smoke · fallen letters',
      pe: 'pointer-events: none',
      fill: 'rgba(226,64,47,0.07)',
      stroke: 'rgba(226,64,47,0.45)',
    },
    {
      y: 100,
      name: 'DOM panel',
      detail: 'labels · tags · values · track capsules · handles',
      pe: 'pointer-events: auto',
      fill: 'rgba(255,255,255,0.04)',
      stroke: 'rgba(255,255,255,0.25)',
    },
    {
      y: 180,
      name: 'WebGL canvas',
      detail: 'inert backdrop — clears to the background color, nothing else',
      pe: 'pointer-events: none',
      fill: 'rgba(255,255,255,0.02)',
      stroke: 'rgba(255,255,255,0.15)',
    },
  ];
  return (
    <svg viewBox="0 0 860 260" fill="none" role="img" aria-label="Layer stack of the stage" style={{ maxWidth: 900 }}>
      {layers.map((l) => (
        <g key={l.name}>
          <rect x="40" y={l.y} width="580" height="56" rx="8" fill={l.fill} stroke={l.stroke} strokeWidth="1.5" />
          <text x="60" y={l.y + 25} fill="#e8e8e8" fontSize="14" fontWeight="600" style={{ fontFamily: 'var(--font-body)' }}>{l.name}</text>
          <text x="60" y={l.y + 43} fill="rgba(255,255,255,0.45)" fontSize="10.5" style={{ fontFamily: 'var(--font-mono)' }}>{l.detail}</text>
          <text x="640" y={l.y + 25} fill="rgba(255,255,255,0.4)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>{l.pe.split(':')[0]}</text>
          <text x="640" y={l.y + 40} fill="rgba(255,255,255,0.25)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>{l.pe.split(':').slice(1).join(':').trim()}</text>
        </g>
      ))}
      {/* shake annotation */}
      <path d="M 40 96 Q 20 128 40 176" stroke="rgba(226,64,47,0.5)" strokeWidth="1.2" fill="none" strokeDasharray="3 3" />
      <text x="8" y="140" fill="rgba(255,138,128,0.7)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>shake = transform on both</text>
    </svg>
  );
}

function FixedTimestepDiagram() {
  // Frames arrive irregularly (16 / 33 / 12 ms). The accumulator banks
  // that time and the physics spends it in uniform 1/240s slices.
  const frames = [
    { w: 64, ms: '16ms' },
    { w: 128, ms: '33ms' },
    { w: 48, ms: '12ms' },
  ];
  let fx = 60;
  const frameRects = frames.map((f) => {
    const r = { x: fx, w: f.w, ms: f.ms };
    fx += f.w + 14;
    return r;
  });
  const slices = Array.from({ length: 16 }, (_, i) => 60 + i * 34);
  return (
    <svg viewBox="0 0 860 210" fill="none" role="img" aria-label="Fixed timestep accumulator" style={{ maxWidth: 900 }}>
      <text x="60" y="28" fill="rgba(255,255,255,0.55)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>render frames — uneven by nature</text>
      {frameRects.map((f) => (
        <g key={f.ms}>
          <rect x={f.x} y="40" width={f.w} height="30" rx="4" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
          <text x={f.x + f.w / 2} y="59" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>{f.ms}</text>
        </g>
      ))}
      {/* arrows down */}
      {frameRects.map((f, i) => (
        <g key={i}>
          <line x1={f.x + f.w / 2} y1="74" x2={f.x + f.w / 2} y2="108" stroke="rgba(226,64,47,0.5)" strokeWidth="1.2" strokeDasharray="3 3" />
          <polygon points={`${f.x + f.w / 2},112 ${f.x + f.w / 2 - 4},104 ${f.x + f.w / 2 + 4},104`} fill="rgba(226,64,47,0.5)" />
        </g>
      ))}
      <text x="60" y="132" fill="rgba(255,138,128,0.75)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>accumulator → fixed 1/240 s slices</text>
      {slices.map((x) => (
        <g key={x}>
          <rect x={x} y="142" width="28" height="26" rx="3" fill="rgba(226,64,47,0.14)" stroke="rgba(226,64,47,0.55)" strokeWidth="1" />
        </g>
      ))}
      <text x="60" y="192" fill="rgba(255,255,255,0.45)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>
        every slice runs physStep() once — a dropped frame advances the same distance as the prediction modeled
      </text>
    </svg>
  );
}

function GrabThresholdDiagram() {
  // Vertical zones around the track: inside ±13px the drag stays a
  // normal slider; beyond it the slingshot arms.
  const cx = 380;
  const trackY = 120;
  return (
    <svg viewBox="0 0 760 240" fill="none" role="img" aria-label="Grab threshold zones" style={{ maxWidth: 900 }}>
      {/* outer zone */}
      <rect x="60" y="24" width="640" height="192" fill="rgba(226,64,47,0.06)" stroke="rgba(226,64,47,0.3)" strokeWidth="1" strokeDasharray="4 3" />
      {/* inner zone */}
      <rect x={cx - 220} y={trackY - 44} width="440" height="88" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 3" />
      {/* track */}
      <rect x="60" y={trackY - 5} width="640" height="10" rx="5" fill="rgba(90,90,100,0.55)" stroke="rgba(0,0,0,0.6)" strokeWidth="1" />
      <rect x="60" y={trackY - 5} width="320" height="10" rx="5" fill="rgba(226,64,47,0.85)" stroke="rgba(110,19,12,0.9)" strokeWidth="1" />
      <circle cx={cx} cy={trackY} r="12" fill="rgba(255,255,255,0.95)" stroke="rgba(0,0,0,0.45)" strokeWidth="1" />
      {/* pointer samples */}
      <circle cx={cx + 60} cy={trackY - 6} r="5" fill="rgba(255,255,255,0.7)" />
      <text x={cx + 72} y={trackY - 2} fill="rgba(255,255,255,0.5)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>still a slider</text>
      <circle cx={cx + 130} cy={trackY - 60} r="5" fill="#e2402f" />
      <text x={cx + 142} y={trackY - 56} fill="rgba(255,138,128,0.85)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>slingshot armed → knob on canvas</text>
      {/* threshold lines */}
      <line x1={cx - 220} y1={trackY - 13} x2={cx + 220} y2={trackY - 13} stroke="rgba(226,64,47,0.55)" strokeWidth="1" strokeDasharray="3 3" />
      <line x1={cx - 220} y1={trackY + 13} x2={cx + 220} y2={trackY + 13} stroke="rgba(226,64,47,0.55)" strokeWidth="1" strokeDasharray="3 3" />
      <text x={cx + 226} y={trackY - 9} fill="rgba(255,138,128,0.7)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>13px</text>
      <text x={cx - 214} y={trackY + 28} fill="rgba(255,255,255,0.45)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>±13px — was 26px, halved so the catch feels instant</text>
    </svg>
  );
}

function RopeGeometryDiagram() {
  const x0 = 60, x1 = 700, lineY = 70;
  const bend = { x: 380, y: 190 };
  const knobX = 520;
  // knob rides the right segment (bend is left of the knob)
  const t = (knobX - bend.x) / (x1 - bend.x);
  const knobY = bend.y + (lineY - bend.y) * t;
  return (
    <svg viewBox="0 0 760 240" fill="none" role="img" aria-label="Rope bend geometry" style={{ maxWidth: 900 }}>
      {/* rest position ghost */}
      <line x1={x0} y1={lineY} x2={x1} y2={lineY} stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeDasharray="5 5" />
      <text x={x1} y={lineY - 10} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>rest position</text>
      {/* progress side: red */}
      <line x1={x0} y1={lineY} x2={knobX} y2={knobY} stroke="#d2392c" strokeWidth="3" strokeLinecap="round" />
      {/* slack side: gray, through the bend */}
      <polyline points={`${knobX},${knobY} ${bend.x},${bend.y} ${x1},${lineY}`} stroke="#4a4a54" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* bend marker */}
      <circle cx={bend.x} cy={bend.y} r="5" fill="rgba(255,255,255,0.65)" />
      <text x={bend.x} y={bend.y + 24} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>grab point = bend</text>
      {/* knob */}
      <circle cx={knobX} cy={knobY} r="12" fill="rgba(255,255,255,0.95)" stroke="rgba(0,0,0,0.45)" strokeWidth="1" />
      <text x={knobX + 20} y={knobY - 6} fill="rgba(255,255,255,0.6)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>knob threads the rope —</text>
      <text x={knobX + 20} y={knobY + 8} fill="rgba(255,255,255,0.6)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>y interpolated on its segment</text>
      {/* launch vectors */}
      <line x1={knobX} y1={knobY} x2={knobX - 70} y2={knobY - 110} stroke="rgba(226,64,47,0.8)" strokeWidth="1.5" />
      <polygon points={`${knobX - 70},${knobY - 110} ${knobX - 64},${knobY - 98} ${knobX - 76},${knobY - 100}`} fill="rgba(226,64,47,0.8)" />
      <text x={knobX - 96} y={knobY - 118} fill="rgba(255,138,128,0.9)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>launch from HERE</text>
      <text x={x0} y={lineY - 10} fill="rgba(255,138,128,0.85)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>progress (red)</text>
    </svg>
  );
}

function SCurveDiagram() {
  // Plots the real easeInOutBack over t 0..1, including the
  // anticipation dip and the overshoot past the target.
  const c2 = 1.70158 * 1.525;
  const ease = (x: number) =>
    x < 0.5
      ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
      : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
  const x0 = 70, y0 = 200, w = 600, h = 170;
  const px = (t: number) => x0 + t * w;
  const py = (v: number) => y0 - v * h;
  let path = '';
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    path += `${i === 0 ? 'M' : 'L'} ${px(t).toFixed(1)} ${py(ease(t)).toFixed(1)} `;
  }
  return (
    <svg viewBox="0 0 760 260" fill="none" role="img" aria-label="easeInOutBack curve" style={{ maxWidth: 900 }}>
      {/* axes */}
      <line x1={x0} y1={y0 + 30} x2={x0 + w + 20} y2={y0 + 30} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <line x1={x0} y1={y0 + 30} x2={x0} y2={py(1.12)} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      {/* target line at 1.0 */}
      <line x1={x0} y1={py(1)} x2={x0 + w + 20} y2={py(1)} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="4 4" />
      <text x={x0 + w + 24} y={py(1) + 4} fill="rgba(255,255,255,0.4)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>target</text>
      <text x={x0 - 12} y={py(1) + 4} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>1.0</text>
      <text x={x0 - 12} y={y0 + 4} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>0</text>
      {/* zero line */}
      <line x1={x0} y1={y0} x2={x0 + w} y2={y0} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {/* the curve */}
      <path d={path} stroke="#e2402f" strokeWidth="2.5" fill="none" />
      {/* phase labels */}
      <text x={px(0.06)} y={py(-0.14)} fill="rgba(255,138,128,0.85)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>anticipation</text>
      <text x={px(0.32)} y={py(0.42)} fill="rgba(255,255,255,0.5)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>sweep</text>
      <text x={px(0.62)} y={py(1.13)} fill="rgba(255,138,128,0.85)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>overshoot</text>
      <text x={px(0.86)} y={py(0.82)} fill="rgba(255,255,255,0.5)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>settle</text>
      {/* caption */}
      <text x={x0 + w + 24} y={y0 + 4} fill="rgba(255,255,255,0.4)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>t</text>
      <text x={x0} y={y0 + 54} fill="rgba(255,255,255,0.45)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>
        thumb snaps to 1.0 at t=0 — the curve is the fill catching up
      </text>
    </svg>
  );
}

function LetterLifecycleDiagram() {
  const steps = [
    { x: 30, title: 'DOM letter', detail: 'measured rect,\nvisibility: hidden on hit', letter: 'F', rot: 0, particle: false },
    { x: 240, title: 'particle', detail: 'vx / vy / spin,\ngravity applies', letter: 'F', rot: -0.5, particle: true },
    { x: 450, title: 'ground pile', detail: 'bounce → rest on\nthe ground line', letter: 'F', rot: 0.6, particle: true, piled: true },
    { x: 660, title: 'restore', detail: 'alpha fades after\n4s — DOM shows again', letter: 'F', rot: 0, particle: false, ghost: true },
  ] as const;
  return (
    <svg viewBox="0 0 860 190" fill="none" role="img" aria-label="Letter lifecycle" style={{ maxWidth: 900 }}>
      {steps.map((s, i) => (
        <g key={s.title}>
          <rect x={s.x} y="24" width="170" height="110" rx="8" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" />
          {/* ground line in the pile cell */}
          {('piled' in s && s.piled) && <line x1={s.x + 15} y1={110} x2={s.x + 155} y2={110} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />}
          {/* the letter */}
          {('ghost' in s && s.ghost) ? (
            <text x={s.x + 85} y="92" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="34" fontWeight="600" style={{ fontFamily: 'var(--font-body)' }}>{s.letter}</text>
          ) : (
            <g transform={`translate(${s.x + 85} ${('piled' in s && s.piled) ? 96 : 78}) rotate(${(s.rot * 180) / Math.PI})`}>
              <text textAnchor="middle" fill={s.particle ? '#e2402f' : '#f4f4f6'} fontSize="34" fontWeight="600" style={{ fontFamily: 'var(--font-body)' }}>{s.letter}</text>
            </g>
          )}
          {s.particle && (
            <>
              <line x1={s.x + 85} y1="78" x2={s.x + 120} y2="48" stroke="rgba(226,64,47,0.8)" strokeWidth="1.5" />
              <polygon points={`${s.x + 120},48 ${s.x + 110},50 ${s.x + 116},58`} fill="rgba(226,64,47,0.8)" />
              <text x={s.x + 124} y="46" fill="rgba(255,138,128,0.8)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>vx, vy, spin</text>
            </>
          )}
          <text x={s.x + 85} y="152" textAnchor="middle" fill="#e8e8e8" fontSize="12.5" fontWeight="600" style={{ fontFamily: 'var(--font-body)' }}>{s.title}</text>
          {s.detail.split('\n').map((line, j) => (
            <text key={j} x={s.x + 85} y={166 + j * 12} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" style={{ fontFamily: 'var(--font-mono)' }}>{line}</text>
          ))}
          {i < steps.length - 1 && (
            <>
              <line x1={s.x + 174} y1="79" x2={s.x + 206} y2="79" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
              <polygon points={`${s.x + 210},79 ${s.x + 201},74 ${s.x + 201},84`} fill="rgba(255,255,255,0.3)" />
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

function BoomLayersDiagram() {
  // Timeline 0..0.7s with the three explosion layers.
  const x0 = 70, w = 700, t = (s: number) => x0 + (s / 0.7) * w;
  return (
    <svg viewBox="0 0 860 250" fill="none" role="img" aria-label="Explosion sound layers" style={{ maxWidth: 900 }}>
      {/* lane 1: sub drop */}
      <text x={x0} y="34" fill="rgba(255,255,255,0.6)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>sub sine 160 → 26 Hz</text>
      <rect x={x0} y="52" width={w} height="74" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <path d={`M ${t(0)} 60 Q ${t(0.12)} 100 ${t(0.5)} 118`} stroke="#e2402f" strokeWidth="2.5" fill="none" />
      {/* lane 2: noise burst */}
      <text x={x0} y="152" fill="rgba(255,255,255,0.6)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>noise burst 2.6k → 120 Hz</text>
      <path
        d={`M ${t(0)} 210 L ${t(0.015)} 168 L ${t(0.1)} 196 L ${t(0.25)} 204 L ${t(0.5)} 210`}
        stroke="rgba(255,255,255,0.65)"
        strokeWidth="2"
        fill="none"
      />
      {/* lane 3: crackle pops */}
      <text x={x0} y="238" fill="rgba(255,255,255,0.6)" fontSize="11" style={{ fontFamily: 'var(--font-mono)' }}>debris crackle ×5</text>
      {[0.14, 0.21, 0.3, 0.36, 0.46].map((s, i) => (
        <g key={i}>
          <line x1={t(s)} y1={244} x2={t(s)} y2={232 - (i % 3) * 4} stroke="#ffd166" strokeWidth="2" />
          <circle cx={t(s)} cy={230 - (i % 3) * 4} r="2" fill="#ffd166" />
        </g>
      ))}
      {/* detune note */}
      <text x={x0 + w} y="34" textAnchor="end" fill="rgba(255,209,102,0.75)" fontSize="10" style={{ fontFamily: 'var(--font-mono)' }}>±15% random detune per blast</text>
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

/* ── Prompt box (copy-to-clipboard) ────────────────── */

const REPRO_PROMPT = `Build an "Angry Birds sliders" web component: a settings panel whose
sliders are physics toys. Stack: Vite + React + TypeScript, one 2D
canvas overlay, WebAudio for sound. NO physics libraries.

STAGE
- Full-viewport app on #0d0d10. A DOM panel (pointer-events: auto)
  centered at 17% top, width min(860px, 78vw). A full-viewport 2D
  canvas ABOVE it renders trajectories, stretch bands, the flying
  knob, smoke and falling letters. Everything else is normal DOM.
- Canvas is a replaced element: give it explicit width/height 100%
  or inset alone will not stretch it. Size its backing store every
  frame (viewport x dpr) and setTransform per draw.

WIDGETS (4 rows, tagged SLING or ROPE, 2 of each, grouped by kind
with a gap between groups)
- Row: chunky label + tag pill left, tabular value right, an 8px
  track capsule below (volumetric gray #57575f->#333339, 1px dark
  border, inner top highlight), a RED volumetric fill
  (#ef564a->#c22b22 60%->#a02018, border #6e130c, top gloss), and a
  22px white shaded ball handle (radial-gradient white->#b9b9c6,
  1px dark border, inner gloss + drop shadow).
- SLING rows: Exposure (-5..5 EV), Field of view (5..120 deg).
- ROPE rows: position (0..100%), samples / s (1..64).

PHYSICS (the trick: prediction and flight share ONE integrator)
- Semi-implicit Euler at a fixed PHYS_DT = 1/240 s:
    vy += G*dt; v *= max(0, 1 - drag*dt); p += v*dt
  with G = gravity * 2600.
- predict(x, y, vx, vy, stopY, rangeMin, rangeMax) loops the SAME
  integrator, samples a dot every dotSpacing seconds, and stops at
  the first descending crossing of stopY inside range (= landing)
  or at the ground. Because flight and dots consume one integrator,
  the dots always end EXACTLY where the knob will land.

SLING
- Grab the thumb. A move of > 13px vertical (or > 18px total) from
  the anchor switches to slingshot: hide the DOM thumb, draw two
  bands from a fork at the progress tip (dots at tip and tip+18,
  bands attached at dot centers) to the knob, run the prediction,
  and preview the landing value LIVE inside the value field
  (tinted red, dimmed at 55% when the shot will miss).
- Release: launch from (anchorX, anchorY - 4) with
  v = (anchor - draw) * 6 * power. Landing on the own track sets
  the value to the landing x; a miss bounces with restitution,
  settles, then arcs home.

ROPE
- The whole line is grabbable (filled or slack), except within
  ~18px of the thumb, which drags the value directly.
- Pulling bends the line through the grab point into a V; the knob
  threads on the rope: its y is interpolated on the segment opposite
  the bend, so it sinks as the bend deepens. The progress-colored
  part of the rope is RED (#d2392c), the slack is gray (#4a4a54).
- Release with pull depth > 14px launches from the knob's HANGING
  position with vy = -depth*8*power and vx from the lateral grab
  offset. A click (< 8px movement) glides the value to the click
  position instead.

LANDINGS
- The thumb snaps to the new value instantly and ONLY the progress
  fill tweens to meet it: easeInOutBack over 0.55s. No step-back,
  no bounce-back of the bar. Value text shows the target at once.

DESTRUCTION
- Letters of labels/values are measured rects. The knob collides
  with them (hit radius ~16px); a hit hides the DOM letter and
  respawns it as a canvas particle (velocity + spin + ground pile +
  timed fade-restore, 4s default).
- Landings ripple; ground hits spawn smoke puffs and shake the
  panel. BOOM toggle: every handle becomes a bomb (fuse + spark,
  tumbling with spin in flight) and EVERY landing explodes: radial
  impulse to all letters, smoke ring, screen shake, boom sound.

SOUND (WebAudio, zero assets)
- Stretch creak: triangle osc + vibrato, frequency/brightness follow
  stretch distance. Whoosh on release: bandpass noise sweep. Rope
  boing: pitch-dropping triangle. Knock per letter hit: sine drop +
  noise click. Ground thud: 85->42 Hz sine + lowpassed noise. Tick
  per value set. Explosion: sub-sine 160->26 Hz + lowpass noise
  burst 2.6k->120 Hz + sparse debris crackle, randomly detuned.

CONTROLS
- Expose every constant live: gravity, launchPower, maxStretch,
  restitution, airDrag, dotSpacing/dotFade/dotSize, toggles for
  knockLabels, groundSmoke, screenShake, squash, ripples, trail,
  bounceEdges (ball bounces off viewport walls), boom, sound/volume.
  A settings panel (DialKit or similar) writes into one params
  object that the render loop reads every frame.

ACCEPT
- At any gravity/power the last dot sits exactly on the landing
  spot. Sliders still work as sliders (click to set, drag to set).
- No color outside red/white/gray + dark background.`;

function PromptBox() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(REPRO_PROMPT);
      ok = true;
    } catch {
      // restricted clipboard context — fall back to a temporary textarea
      try {
        const ta = document.createElement('textarea');
        ta.value = REPRO_PROMPT;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div className="article-breakout">
      <div className="article-diagram">
        <div style={{ position: 'relative' }}>
          <CodeBlock code={REPRO_PROMPT} caption="Copy → paste into your agent of choice → ship" />
          <button
            onClick={copy}
            style={{
              position: 'absolute',
              top: 34,
              right: 14,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: copied ? '#8af0a0' : '#fff',
              background: copied ? 'rgba(60,200,90,0.25)' : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {copied ? 'Copied ✓' : 'Copy prompt'}
          </button>
        </div>
        <p className="article-diagram-caption">
          Everything above — stage, physics constants, interaction rules, sound
          design, controls and the acceptance test — condensed into one prompt.
          Hand it to any coding agent and you should land within a session of
          where this experiment ended up.
        </p>
      </div>
    </div>
  );
}

/* ── Code snippets ─────────────────────────────────── */

const CODE_PHYS = `// The single integrator. Both the prediction loop and the real
// flight call THIS — never two implementations of the same math.
const PHYS_DT = 1 / 240;

function physStep(s: { x; y; vx; vy }) {
  s.vy += gravity() * PHYS_DT;
  const d = Math.max(0, 1 - airDrag() * PHYS_DT);
  s.vx *= d; s.vy *= d;
  s.x += s.vx * PHYS_DT;
  s.y += s.vy * PHYS_DT;
  // optional: bounce off viewport walls with restitution
}

function predict(x, y, vx, vy, stopY, rangeMin, rangeMax) {
  const s = { x, y, vx, vy };
  let acc = 0;
  for (let i = 0; i < 240 * 12; i++) {
    const prevY = s.y;
    physStep(s);
    acc += PHYS_DT;
    if (acc >= dotSpacing) { acc = 0; result.pts.push({ ...s }); }
    if (s.vy > 0 && (prevY - stopY) * (s.y - stopY) < 0
        && s.x >= rangeMin && s.x <= rangeMax)
      return { ...result, landing: { x: s.x, y: stopY } };
    if (s.y >= groundY - THUMB_R) return { ...result, ground: { ...s } };
  }
}`;

const CODE_FLIGHT = `// The flight: same physStep, driven by an accumulator so a slow
// frame advances the same distance as the prediction says it must.
proj.acc += Math.min(dt, 1 / 30);
while (proj.acc >= PHYS_DT && proj.phase === 'fly') {
  proj.acc -= PHYS_DT;
  const prevY = proj.y;
  physStep(proj);                 // identical to the dots
  collideWithLetters(proj);       // allowed divergence: the world
  if (descendingCrossing(prevY, proj, ownTrackY)) landOnTrack();
  if (proj.y >= groundY - THUMB_R) bounceOrExplode();
}`;

const CODE_VELOCITY = `// Sling: pull distance becomes launch speed, release snaps the knob
// back to the fork and fires from there (4px above the line — the
// exact point the prediction starts from).
const draw = clampToMaxStretch(pointer - anchor);
const vx = (anchor.x - draw.x) * LAUNCH_K * power;   // LAUNCH_K = 6
const vy = (anchor.y - draw.y) * LAUNCH_K * power;
launch(anchor.x, anchor.y - 4, vx, vy);

// Rope: pull depth becomes vertical speed, the lateral offset of the
// grab point relative to the knob shapes the direction.
const depth = pointer.y - grabStart.y;               // > 14px to fire
const ratio = clamp(depth / maxStretch, 0, 1);
const vx = (grabX - knobX) * 4.5 * power * (0.35 + 0.65 * ratio)
         - (pointer.x - grabStart.x) * 2.0 * power;
const vy = -depth * 8.0 * power;`;

const CODE_S_CURVE = `// Landing: thumb snaps, only the fill tweens — a sharp S with a
// playful overshoot on both ends (anticipation + settle).
function easeInOutBack(x: number) {
  const c2 = 1.70158 * 1.525;
  return x < 0.5
    ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
    : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
}

// per frame: value = from + (to - from) * easeInOutBack(t / 0.55)
// the DOM value text already shows the target — no letter churn`;

const CODE_ROPEGEOM = `// Where do the knob and the bend sit while the rope is stretched?
// The knob threads on the rope: it rides the segment the bend is
// NOT on, so it sinks as the bend deepens.
const bendX = clamp(pointer.x, trackX, trackX + trackW);
if (knobX <= bendX) {
  // knob on the straight left segment
  const t = (knobX - trackX) / max(1, bendX - trackX);
  knobY = trackY + (bendY - trackY) * t;
} else {
  // knob on the right segment, below the line
  const t = (knobX - bendX) / max(1, trackX + trackW - bendX);
  knobY = bendY + (trackY - bendY) * t;
}`;

const CODE_BOOMSOUND = `// Explosion: nothing like the landing thud. Sub drop + noise burst
// + sparse debris crackle, randomly detuned so no two are alike.
const detune = 0.85 + Math.random() * 0.3;

sub.frequency.setValueAtTime(160 * detune, t);
sub.frequency.exponentialRampToValueAtTime(26, t + 0.5);

burst.frequency.setValueAtTime(2600, t);
burst.frequency.exponentialRampToValueAtTime(120, t + 0.45);

for (let i = 0; i < 5; i++) {          // debris
  const at = t + 0.09 + i * 0.06 + Math.random() * 0.03;
  crackle.frequency.value = (320 + Math.random() * 520) * detune;
  schedule(crackle, at, 0.055);
}`;

/* ── TOC sections ──────────────────────────────────── */

export const TOC_SECTIONS = [
  { id: 'overview', label: 'The Big Picture' },
  { id: 'stage', label: 'A Panel, Not a Shader' },
  { id: 'physics', label: 'One Integrator, Two Truths' },
  { id: 'sling', label: 'The Slingshot' },
  { id: 'rope', label: 'The Rope' },
  { id: 'landing', label: 'Landings & the S-Curve' },
  { id: 'destruction', label: 'Letters, Smoke, Boom' },
  { id: 'sound', label: 'Sound From Nothing' },
  { id: 'prompt', label: 'Build It In One Prompt' },
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

export function AngrySlider1Article() {
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
        <h1>Sliders That Fight Back</h1>
        <p className="article-hero-lead">
          A settings panel where the sliders are slingshots and ropes: stretch
          them anywhere, watch a dot-perfect trajectory arc across the screen,
          knock the labels over, bounce through smoke — and land exactly where
          the preview promised. All DOM, one 2D canvas, zero physics libraries.
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
          Every settings panel on the web agrees to the same silent contract:
          sliders are boring. You drag a thumb along a groove, a number changes,
          nothing has mass. This experiment breaks that contract on purpose —
          four sliders where two are <strong>slingshots</strong> (grab the
          handle, stretch it anywhere on screen, release, and it fires along a
          dotted arc to its new value) and two are <strong>ropes</strong> (grab
          the line itself, pull it into a bend, and fling the knob to wherever
          the projection says it will land).
        </p>
        <p>
          The fun is layered. The knob knocks the letters of its own label off
          the panel; they tumble, pile up on the ground line and fade back in.
          Hard landings kick up smoke and shake the screen. A <strong>Boom</strong>{' '}
          toggle turns every handle into a bomb that detonates wherever it
          lands. And everything — creaks, whooshes, thuds, the explosion — is
          synthesized in WebAudio, with not a single audio file.
        </p>
        <div className="article-callout">
          <p>
            <strong>The governing idea:</strong> a physics toy stops being fun
            the moment its preview lies. The trajectory dots and the actual
            flight share one fixed-timestep integrator in this codebase — so
            the last dot always sits exactly on the landing spot, no matter how
            gravity, drag or power are tweaked live.
          </p>
        </div>

        {/* ── 02 Stage ── */}
        <hr className="article-divider" />
        <span className="article-section-num">02</span>
        <h2 id="stage">A Panel, Not a Shader</h2>

        <p>
          Most experiments in this collection are a fragment shader with a
          canvas behind them. This one inverts the stack: the WebGL canvas is a
          nearly inert backdrop that only clears to the background color, and
          the entire effect lives in two other layers. A real DOM panel carries
          the typography — labels, tags, values, the track capsules and handles
          are plain elements with CSS gradients. Above it sits a full-viewport
          2D canvas that draws everything transient: trajectory dots, stretch
          bands, the flying knob, smoke, ripples and the fallen letters.
        </p>
        <div className="article-breakout">
          <div className="article-diagram">
            <LayerStackDiagram />
            <p className="article-diagram-caption">
              The three-layer stage. Only the DOM panel accepts pointers — the
              canvases are inert surfaces. The panel shake is a transform on
              the middle layer mirrored by an offset in the canvas transform,
              so typography and effects move as one object.
            </p>
          </div>
        </div>
        <div className="article-breakout">
          <div className="article-diagram">
            <RowAnatomyDiagram />
            <p className="article-diagram-caption">
              One slider row. The track capsule, red progress fill and shaded
              handle are regular DOM; the dashed zone is the interaction band
              the hit test actually uses; the fork dots ride the tip of the
              progress fill when a slingshot is armed.
            </p>
          </div>
        </div>
        <p>
          Two DOM/CSS details earned their keep. Canvas is a replaced element —
          an absolutely positioned canvas with only{' '}
          <code className="c">inset: 0</code> refuses to stretch and renders at
          its intrinsic size, so it needs explicit{' '}
          <code className="c">width/height: 100%</code> and a backing store
          that is re-synced against the viewport (and devicePixelRatio) every
          frame. And because the panel can shake independently of the canvas,
          the shake is applied twice: a transform on the panel, and a matching
          offset in the canvas transform — so text and effects shake as one
          object.
        </p>

        {/* ── 03 Physics ── */}
        <hr className="article-divider" />
        <span className="article-section-num">03</span>
        <h2 id="physics">One Integrator, Two Truths</h2>

        <p>
          The classic way to draw a trajectory preview is a small ad-hoc
          parabola formula. It always drifts from the real flight, because the
          real flight is integrated step by step while the preview is a closed
          form. This experiment refuses that drift: there is{' '}
          <strong>exactly one integrator</strong>, a semi-implicit Euler step
          at a fixed 240 Hz, and both the trajectory dots and the flying knob
          consume it.
        </p>

        <CodeBlock code={CODE_PHYS} caption="The shared integrator + the prediction loop" />

        <div className="article-breakout">
          <div className="article-diagram">
            <FixedTimestepDiagram />
            <p className="article-diagram-caption">
              Frames arrive unevenly; the accumulator converts them into uniform
              1/240s slices. Whether a frame is 12ms or 33ms late, the physics
              advances by exactly the number of slices the banked time buys —
              so the dots and the flight always travel the same distance.
            </p>
          </div>
        </div>

        <p>
          The flight runs on an accumulator — real frame time is banked and
          spent in fixed <code className="c">PHYS_DT</code> slices — so a
          dropped frame advances the knob exactly as far as the prediction
          models. The prediction stops at the first descending crossing of the
          row's own track within range: that crossing is the landing, and the
          drawn dots end on it. Letter hits are the one permitted divergence —
          they are the world reacting, not the math drifting.
        </p>

        <CodeBlock code={CODE_FLIGHT} caption="Flight = prediction + consequences" />

        <div className="article-breakout">
          <div className="article-diagram">
            <FlightPipelineDiagram />
            <p className="article-diagram-caption">
              The whole life of a knob. The red stages are the ones the user
              sees; the dashed return is the invariant that makes the toy
              trustworthy — AIM and FLY consume the same integrator, so AIM can
              never lie.
            </p>
          </div>
        </div>

        <p>
          The payoff is absolute: drag gravity to 0.3 or power to 2.5 mid-play
          and the final dot still sits pixel-exact on the landing spot. When
          the preview and the outcome agree, the panel feels honest — and
          honest physics is what makes the toy satisfying to abuse.
        </p>

        {/* ── 04 Sling ── */}
        <hr className="article-divider" />
        <span className="article-section-num">04</span>
        <h2 id="sling">The Slingshot</h2>

        <p>
          A sling thumb leads a double life. Grab it and drag along the track:
          it is a normal slider. Move more than 13px off the line (a threshold
          tuned down from 26 after playtesting — the catch should feel
          instant): the DOM thumb hides, a canvas knob appears in your hand,
          two bands stretch from a fork on the track to the knob, and a creak
          starts rising in pitch with the pull distance.
        </p>

        <div className="article-breakout">
          <div className="article-diagram">
            <GrabThresholdDiagram />
            <p className="article-diagram-caption">
              The grab threshold is a vertical zone, not a gesture: inside
              ±13px of the line the thumb keeps behaving like a slider, past it
              the slingshot arms and the knob jumps to the canvas. The zone was
              halved after playtesting — the catch should feel instant.
            </p>
          </div>
        </div>

        <p>
          The fork is geometry with an opinion. The left dot sits{' '}
          <em>exactly on the tip of the red progress fill</em> — the slingshot
          is anchored where your value is — and the right dot sits a fixed span
          to its right, with both bands attached at the dot centers. Release
          converts the pull into a launch: velocity is the anchor-to-pointer
          offset times a constant, aimed from the fork, and the knob flies.
        </p>

        <CodeBlock code={CODE_VELOCITY} caption="Two toys, two velocity models" />

        <div className="article-breakout">
          <div className="article-diagram">
            <ForkGeometryDiagram />
            <p className="article-diagram-caption">
              The fork is anchored to the value, not the track: the left dot
              sits on the tip of the red progress, the right dot holds a fixed
              span to its right, and both bands attach at the dot centers —
              a slingshot, not two stray lines.
            </p>
          </div>
        </div>

        <p>
          Clicking the track without grabbing does the polite thing — the value
          glides to where you clicked, animated with the same overshooting
          curve landings use. The handle never teleports under you mid-gesture:
          arming the slingshot freezes the bar at the grabbed value, so the
          fill only ever moves forward, toward where the knob lands.
        </p>

        {/* ── 05 Rope ── */}
        <hr className="article-divider" />
        <span className="article-section-num">05</span>
        <h2 id="rope">The Rope</h2>

        <p>
          The rope rows look identical to the slings — that is deliberate; the
          tag is the only tell — but the whole line is the toy. Grab it
          anywhere (the filled part and the slack part behave the same), pull,
          and the line bends through your cursor into a V while the knob
          threads along it, sinking as the bend deepens. The knot of the
          problem is a two-line geometry helper: which segment is the knob on,
          and where on it?
        </p>

        <CodeBlock code={CODE_ROPEGEOM} caption="Knob-on-rope interpolation" />

        <div className="article-breakout">
          <div className="article-diagram">
            <RopeGeometryDiagram />
            <p className="article-diagram-caption">
              Grabbing bends the rope through the cursor; the knob threads the
              opposite segment, sinking as the bend deepens. The red side is
              the progress, the gray side the slack — and the launch fires
              from the knob's hanging position, not from the rail.
            </p>
          </div>
        </div>

        <p>
          Release fires the knob from its <em>hanging</em> position — not the
          rail — with vertical speed from the pull depth and horizontal speed
          shaped by where you grabbed relative to the knob, so grabbing the
          slack side flings it forward and grabbing the progress side shots it
          backward. Because the launch point is the drawn ball, the dots begin
          where your eyes already are. A tiny pull (under the depth threshold)
          is a click instead: the knob glides to where you grabbed.
        </p>

        {/* ── 06 Landing ── */}
        <hr className="article-divider" />
        <span className="article-section-num">06</span>
        <h2 id="landing">Landings &amp; the S-Curve</h2>

        <p>
          When the knob touches down on its own track, the landing is a
          two-part trick. The thumb (the real DOM handle) snaps to the landing
          spot instantly — it is the object that flew, so it must be where the
          flight ended. The progress bar, meanwhile, tweens from its old
          position to meet it with a sharp easeInOutBack curve: a whisker of
          anticipation, a fast sweep, an overshoot past the mark and a settle.
        </p>

        <CodeBlock code={CODE_S_CURVE} caption="The only easing in the panel" />

        <div className="article-breakout">
          <div className="article-diagram">
            <SCurveDiagram />
            <p className="article-diagram-caption">
              The real easeInOutBack, plotted. The dip below zero is the
              anticipation (the fill leans back for a frame), the hump past 1.0
              is the overshoot, and the tail is the settle — the whole
              personality of the landing in one cubic.
            </p>
          </div>
        </div>

        <p>
          The discipline here is negative space: the bar never moves backward
          as a "reset" when you arm a slingshot, never animates while you drag,
          and the value text never re-renders mid-flight (it shows the target
          the moment the tween starts). Animation budget is spent in exactly
          one place — the fill sliding forward to meet the ball.
        </p>

        {/* ── 07 Destruction ── */}
        <hr className="article-divider" />
        <span className="article-section-num">07</span>
        <h2 id="destruction">Letters, Smoke, Boom</h2>

        <p>
          The labels are not decoration; they are level geometry. Every letter
          of every label and value is a measured rect. The flying knob sweeps
          them each frame, and a hit converts the DOM letter into a canvas
          particle — velocity from the impact, a random spin, gravity, a bounce
          and rest on the ground line. After a timeout they fade and their DOM
          originals reappear, so the panel always heals.
        </p>

        <div className="article-breakout">
          <div className="article-diagram">
            <LetterLifecycleDiagram />
            <p className="article-diagram-caption">
              A letter's four lives: measured DOM rect → canvas particle with
              the impact's velocity and a random spin → rested debris on the
              ground line → timed fade back into the label. The panel always
              heals because the DOM original never stopped existing.
            </p>
          </div>
        </div>

        <p>
          The world reacts elsewhere too: hard crossings ripple the tracks, a
          ground hit kicks up smoke puffs with buoyancy and shakes the panel,
          and an optional toggle lets the knob bounce off the viewport edges.
          <strong> Boom mode</strong> is the crescendo — every handle becomes a
          bomb with a sparking fuse that tumbles as it flies, and{' '}
          <em>every</em> landing detonates: a radial impulse scatters all the
          letters on the panel, a smoke ring pops, the screen kicks. On a track
          landing the value still sets first; destruction is the garnish, never
          the meal.
        </p>

        {/* ── 08 Sound ── */}
        <hr className="article-divider" />
        <span className="article-section-num">08</span>
        <h2 id="sound">Sound From Nothing</h2>

        <p>
          There is no audio folder. Every sound is a few oscillators and a
          shared noise buffer played through WebAudio: the stretch creak is a
          triangle wave with vibrato whose pitch follows the pull distance, the
          release whoosh is bandpass noise sweeping downward, letters knock
          with a pitched sine drop plus a click of noise, and the rope adds a
          boing. A tick marks every value change so the ear can track the bar.
        </p>
        <p>
          The explosion is the signature: a sub-bass sine dropping from 160 Hz
          to 26, a noise burst sweeping 2.6 kHz down to 120, and five sparse
          debris crackles scattered over the following quarter second — all
          detuned randomly per blast, so the tenth explosion sounds different
          from the first. Crucially, an explosion is <em>only</em> the
          explosion: bomb landings suppress the normal landing tick and thud so
          the event owns its sound completely.
        </p>

        <CodeBlock code={CODE_BOOMSOUND} caption="The explosion voice — sound.ts" />

        <div className="article-breakout">
          <div className="article-diagram">
            <BoomLayersDiagram />
            <p className="article-diagram-caption">
              The explosion on a timeline: the sub drop carries the weight, the
              noise burst is the hit, and the five crackle pops are the debris
              settling after. Random detuning per blast keeps repetition from
              flattening it.
            </p>
          </div>
        </div>

        {/* ── 09 Prompt ── */}
        <hr className="article-divider" />
        <span className="article-section-num">09</span>
        <h2 id="prompt">Build It In One Prompt</h2>

        <p>
          Everything this panel does reduces to a spec: a stage, four widgets,
          one shared integrator, a handful of interaction rules and a sound
          kit. That spec fits in a single prompt. The box below is the whole
          component — physics constants, interaction thresholds, the exactness
          trick, the styling, the acceptance test — written to be handed to any
          coding agent. Paste it, let it build, then spend your time on the
          two numbers that matter: the grab threshold and the overshoot.
        </p>

        <PromptBox />

        <p>
          If you keep one idea when you adapt it, keep the integrator rule:
          never let the preview and the flight disagree. The moment the dots
          are a guess, the panel is a gimmick; the moment they are a promise,
          it is a toy you can trust.
        </p>

      </div>
    </motion.div>
  );
}
