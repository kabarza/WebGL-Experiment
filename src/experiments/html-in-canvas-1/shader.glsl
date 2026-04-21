precision highp float;

varying vec2 vUv;

uniform float u_time;
uniform vec2  u_resolution;
uniform sampler2D u_text;

// Aurora palette
uniform vec3 u_color1;   // sky base (dark)
uniform vec3 u_color2;   // mid aurora
uniform vec3 u_color3;   // bright curtain (cyan)
uniform vec3 u_color4;   // accent (violet)

// Aurora shape
uniform float u_bgScale;
uniform float u_drift;
uniform float u_waveAmp;

// Text effects
// 0 = clean · 1 = dither · 2 = prism · 3 = streak
uniform float u_effectMode;
uniform float u_effectMix;
uniform float u_ditherCell;
uniform float u_chromatic;
uniform float u_glow;

// Surface
uniform float u_grainAmount;
uniform float u_vignette;

// ── Simplex 3D noise ──────────────────────────────────────────────────────────
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g  = step(x0.yzx, x0.xyz);
  vec3 l  = 1.0 - g;
  vec3 i1 = min(g, l.zxy);
  vec3 i2 = max(g, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 1.0 / 7.0;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4  j  = p - 49.0 * floor(p * ns.z * ns.z);
  vec4  x_ = floor(j * ns.z);
  vec4  y_ = floor(j - 7.0 * x_);
  vec4  x  = x_ * ns.x + ns.yyyy;
  vec4  y  = y_ * ns.x + ns.yyyy;
  vec4  h  = 1.0 - abs(x) - abs(y);
  vec4  b0 = vec4(x.xy, y.xy);
  vec4  b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(
    dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(
    dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m,
    vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// ── Hash ─────────────────────────────────────────────────────────────────────
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// ── Bayer 8×8 ordered dither ─────────────────────────────────────────────────
float b2(float x, float y) { return 2.0 * x + y * (3.0 - 4.0 * x); }

float bayer8(vec2 p) {
  vec2  c  = mod(floor(p), 8.0);
  float lx = mod(c.x, 2.0);
  float ly = mod(c.y, 2.0);
  float mx = mod(floor(c.x * 0.5), 2.0);
  float my = mod(floor(c.y * 0.5), 2.0);
  float hx = floor(c.x * 0.25);
  float hy = floor(c.y * 0.25);
  return (16.0 * b2(lx, ly) + 4.0 * b2(mx, my) + b2(hx, hy) + 0.5) / 64.0;
}

// ── Text texture sampler ──────────────────────────────────────────────────────
float sampleMask(vec2 uv) {
  vec4 s = texture2D(u_text, clamp(uv, 0.0, 1.0));
  return max(s.a, dot(s.rgb, vec3(0.299, 0.587, 0.114)));
}

// ── Vertical curtain aurora ───────────────────────────────────────────────────
// A curtain-style northern-lights effect: tall vertical columns of light
// that drift slowly, distorted by two-pass domain warping.
vec3 buildAurora(vec2 uv) {
  vec2  p      = uv * 2.0 - 1.0;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  p.x *= aspect;

  float t = u_time * (0.08 + u_drift * 0.12);

  // ── Pass 1: coarse warp ───
  vec2 warp1 = vec2(
    snoise(vec3(p * 0.45, t * 0.28)),
    snoise(vec3(p * 0.45 + vec2(4.7, -2.1), t * 0.22))
  );
  vec2 q = p + warp1 * (0.22 + u_waveAmp * 0.3);

  // ── Pass 2: fine warp ────
  vec2 warp2 = vec2(
    snoise(vec3(q * 0.9 + vec2(1.2, 3.5), t * 0.35)),
    snoise(vec3(q * 0.9 + vec2(-2.4, 0.7), t * 0.30))
  );
  vec2 r = q + warp2 * (0.1 + u_waveAmp * 0.14);

  // ── Curtain columns — vertical emphasis ───
  float sc = (1.4 + u_bgScale * 0.7);
  float cx = r.x * sc;

  float v0 = snoise(vec3(cx * 1.0,  r.y * 0.18 + t * 0.45,  t * 0.14));
  float v1 = snoise(vec3(cx * 0.65 + 1.8, r.y * 0.14 - t * 0.38, t * 0.11 + 2.5));
  float v2 = snoise(vec3(cx * 0.82 - 1.3, r.y * 0.20 + t * 0.30, t * 0.09 + 5.1));

  // Curtain shape: strong in the middle height band, fading near top and bottom
  float curtain = smoothstep(0.05, 0.45, uv.y) * smoothstep(1.0, 0.55, uv.y);

  float band0 = max(0.0, v0) * curtain;
  float band1 = max(0.0, v1) * curtain * 0.8;
  float band2 = max(0.0, v2) * curtain * 0.6;

  // Subtle flicker — fast noise modulates brightness at column level
  float flicker = 0.85 + 0.15 * snoise(vec3(cx * 1.5, t * 2.8, 0.0));

  // Sky gradient: deep at bottom, slightly lighter at mid
  vec3 sky = mix(u_color1, mix(u_color1, u_color2, 0.35), pow(uv.y, 0.7));

  // Aurora layers: cyan curtain + violet accent
  vec3 aurora  = u_color3 * band0 * 0.85;
  aurora      += mix(u_color3, u_color4, 0.45) * band1 * 0.6;
  aurora      += u_color4 * band2 * 0.45;
  aurora      *= flicker;

  // Soft horizon glow — bleed of aurora color near the lower quarter
  float horizGlow = exp(-abs(uv.y - 0.3) * 6.0) * 0.25;
  aurora += mix(u_color2, u_color3, 0.5) * horizGlow;

  return clamp(sky + aurora, 0.0, 1.0);
}

// ── Main ──────────────────────────────────────────────────────────────────────
void main() {
  vec2  uv = vUv;
  vec2  px = uv * u_resolution;

  // Background
  vec3 background = buildAurora(uv);

  // Base text mask (no shift)
  float baseMask = sampleMask(uv);

  // ── Effect processing ─────────────────────────────────────────────────────
  float maskR, maskG, maskB;

  if (u_effectMode < 0.5) {
    // 0 — clean: straight mask with chromatic offset
    float ch = u_chromatic * 0.0012;
    maskR = sampleMask(uv + vec2( ch, 0.0));
    maskG = baseMask;
    maskB = sampleMask(uv - vec2( ch, 0.0));

  } else if (u_effectMode < 1.5) {
    // 1 — dither: Bayer 8×8 threshold with per-channel chroma shift
    float threshold = bayer8(px / max(u_ditherCell, 1.0));
    float soft      = 0.10;
    float ch        = u_chromatic * 0.0018;
    maskR = smoothstep(threshold - soft, threshold + soft, sampleMask(uv + vec2( ch, 0.0)));
    maskG = smoothstep(threshold - soft, threshold + soft, baseMask);
    maskB = smoothstep(threshold - soft, threshold + soft, sampleMask(uv - vec2( ch, 0.0)));

  } else if (u_effectMode < 2.5) {
    // 2 — prism: wide diagonal RGB split, rainbow fringing
    float spread = u_chromatic * 0.0055;
    maskR = sampleMask(uv + vec2( spread,  spread * 0.4));
    maskG = sampleMask(uv + vec2( 0.0,    -spread * 0.25));
    maskB = sampleMask(uv - vec2( spread,  spread * 0.4));

  } else {
    // 3 — streak: horizontal motion blur simulated with 8 offset samples
    float maxOff = u_chromatic * 0.022 * u_effectMix;
    float acc    = 0.0;
    float wSum   = 0.0;
    for (int i = 0; i < 8; i++) {
      float fi  = float(i) / 7.0;             // 0 → 1
      float off = (fi - 0.5) * maxOff;         // -half → +half
      float w   = 1.0 - abs(fi - 0.5) * 1.6;  // centre-weighted
      w = max(w, 0.0);
      acc  += sampleMask(uv + vec2(off, 0.0)) * w;
      wSum += w;
    }
    float streaked = acc / max(wSum, 0.0001);
    maskR = streaked;
    maskG = streaked;
    maskB = sampleMask(uv - vec2(maxOff * 0.3, 0.0));  // subtle trail tint
  }

  // ── Text fill colour — aurora-tinted white ────────────────────────────────
  vec3 textFill = mix(
    vec3(0.92, 0.98, 1.0),                                 // near-white cold
    mix(u_color3, u_color4, 0.35 + 0.3 * sin(u_time * 0.5 + uv.x * 5.0)),
    clamp(0.18 + uv.y * 0.55, 0.0, 1.0)
  );

  // ── Glow ──────────────────────────────────────────────────────────────────
  float glowMask = smoothstep(0.02, 0.85, baseMask);
  float glow     = pow(glowMask, 1.2) * (0.16 + u_glow * 0.36);
  vec3  color    = background + textFill * glow;

  // ── Composite text channels ───────────────────────────────────────────────
  float mixAmt    = clamp(u_effectMix, 0.0, 1.0);
  vec3  textChans = mix(vec3(baseMask), vec3(maskR, maskG, maskB), mixAmt);
  color.r = mix(color.r, textFill.r, clamp(textChans.r, 0.0, 1.0));
  color.g = mix(color.g, textFill.g, clamp(textChans.g, 0.0, 1.0));
  color.b = mix(color.b, textFill.b, clamp(textChans.b, 0.0, 1.0));

  // ── Vignette ──────────────────────────────────────────────────────────────
  float vig = 1.0 - length((uv - 0.5) * vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0));
  vig = smoothstep(-0.1, 0.9, vig);
  color *= mix(1.0, vig, u_vignette);

  // ── Film grain ────────────────────────────────────────────────────────────
  float grain = hash21(px + floor(u_time * 24.0)) - 0.5;
  color += grain * u_grainAmount;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
