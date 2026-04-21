precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

// Colors
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;
uniform vec3 u_color4;
uniform vec3 u_bgColor;

// Warp layer
uniform float u_warpOn;
uniform float u_warpStrength;
uniform float u_warpScale;
uniform float u_warpOctaves;
uniform float u_seed;
uniform float u_seedSpeed;

// Blob layer
uniform float u_blobOn;
uniform float u_blobSize;
uniform float u_blobSpacing;
uniform float u_blobRotation;
uniform float u_blobSpread;
uniform float u_blobOffsetX;
uniform float u_blobOffsetY;
uniform float u_tileSpacing;
uniform float u_blobCount;
uniform float u_blendSoftness;
uniform float u_autoRotation;

// Color shift
uniform float u_colorShift;

// Transform
uniform float u_zoom;
uniform float u_offsetX;
uniform float u_offsetY;

// Mouse — all modes are whole-field / unbounded-falloff
// No hard radius mask, no point of concentration.
uniform float u_mouseOn;
uniform vec2  u_mousePos;
uniform vec2  u_mouseWind;   // decaying velocity vector (JS-side)
uniform float u_mouseStr;
uniform float u_mouseRadius; // gaussian sigma for soft modes (Swell, Shimmer)

// Mouse modes: 0=Breeze  1=Swell  2=Tide  3=Parallax  4=Shimmer
uniform float u_mouseMode;

// Click pulse (shockwave)
uniform vec2  u_pulsePos;
uniform float u_pulseStr;
uniform float u_pulseAge;
uniform float u_pulseSpeed;
uniform float u_pulseWidth;

// Grain layer
uniform float u_grainOn;
uniform float u_grainAmount;
uniform float u_grainScale;
uniform float u_grainSpeed;

// ── Simplex 3D noise ──────────────────────────────────────
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
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
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// ── FBM ───────────────────────────────────────────────────
float fbm(vec3 p, int octaves) {
  float val = 0.0, amp = 0.55, freq = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    val += amp * snoise(p * freq);
    freq *= 1.9;
    amp *= 0.48;
  }
  return val;
}

// ── Hash → [-1, 1] ───────────────────────────────────────
float hash2s(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z) * 2.0 - 1.0;
}

// ── 2D value noise for grain ──────────────────────────────
float valNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash2s(i);
  float b = hash2s(i + vec2(1.0, 0.0));
  float c = hash2s(i + vec2(0.0, 1.0));
  float d = hash2s(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// ── 2D rotation ───────────────────────────────────────────
vec2 rot2d(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// ── Aspect-corrected screen coord ─────────────────────────
vec2 aspectCorrect(vec2 p, float aspect) {
  p.x *= min(1.0, aspect);
  p.y *= min(1.0, 1.0 / aspect);
  return p;
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  vec2 pos = uv;
  float aspect = u_resolution.x / u_resolution.y;
  pos = aspectCorrect(pos, aspect);
  pos /= max(u_zoom, 0.01);
  pos += vec2(u_offsetX, u_offsetY);

  float t = u_time;
  float animSeed = u_seed + t * u_seedSpeed;

  // ── Soft mouse influence (no point of concentration) ────
  // All modes operate on the whole field:
  //   • Breeze / Parallax  → global, position-independent
  //   • Tide               → unbounded 1/(1 + r²·k) (never reaches zero)
  //   • Swell / Shimmer    → broad gaussian modulation (amplitude, not gate)
  float warpBoost = 1.0;  // Swell multiplies the warp amplitude globally

  if (u_mouseOn > 0.5 && u_mouseStr > 0.0) {
    vec2 screenUV = aspectCorrect(uv, aspect);
    vec2 cursorScreen = aspectCorrect(u_mousePos * 2.0 - 1.0, aspect);
    vec2 toCursor = screenUV - cursorScreen;
    float mDist = length(toCursor);

    // Broad gaussian proximity — no hard edge, just softer as you go out.
    float sigma2 = max(u_mouseRadius * u_mouseRadius, 0.04);
    float proximity = exp(-mDist * mDist / sigma2);

    int mode = int(u_mouseMode + 0.5);

    if (mode == 0) {
      // Breeze — mouse velocity becomes a global wind vector (JS accumulates).
      // Every pixel is shifted by the same amount; no focus, just drift.
      pos += u_mouseWind * u_mouseStr;
    } else if (mode == 1) {
      // Swell — cursor proximity intensifies the warp amplitude.
      // No displacement in this mode; the aurora "breathes harder" near cursor.
      warpBoost = 1.0 + proximity * u_mouseStr * 2.5;
    } else if (mode == 2) {
      // Tide — soft radial pull with no singularity at the cursor.
      // Multiplying by toCursor (NOT normalized) makes displacement → 0 at cursor,
      // avoiding the pinwheel that a normalized 1/r field would produce there.
      // The field strength peaks at some mid radius and decays smoothly outward.
      float grav = 1.0 / (1.0 + mDist * mDist * 0.8);
      pos -= toCursor * grav * u_mouseStr * 0.7;
    } else if (mode == 3) {
      // Parallax — cursor absolute position pans the viewport (whole canvas).
      // Feels like a slow camera move; no locality at all.
      vec2 delta = (u_mousePos - vec2(0.5)) * 2.0;
      delta = aspectCorrect(delta, aspect);
      pos += delta * u_mouseStr * 0.6;
    } else {
      // Shimmer — proximity modulates high-frequency noise amplitude.
      // The aurora "sparkles" more near cursor, but the noise itself is global.
      float sh1 = snoise(vec3(pos * u_warpScale * 3.5 + vec2(4.7, 2.1), t * 0.6));
      float sh2 = snoise(vec3(pos * u_warpScale * 3.5 + vec2(11.2, 8.3), t * 0.6 + 5.5));
      pos += vec2(sh1, sh2) * proximity * u_mouseStr * 0.4;
    }
  }

  // ── Click pulse (expanding shockwave) ──────────────────
  if (u_pulseStr > 0.001) {
    vec2 screenUV = aspectCorrect(uv, aspect);
    vec2 pulseScreen = aspectCorrect(u_pulsePos * 2.0 - 1.0, aspect);
    vec2 pdir = screenUV - pulseScreen;
    float pDist = length(pdir);
    vec2 pdirN = pDist > 1e-5 ? pdir / pDist : vec2(0.0);

    float ringR = u_pulseAge * u_pulseSpeed;
    float ringDelta = pDist - ringR;
    float ringMask = exp(-(ringDelta * ringDelta) / max(u_pulseWidth * u_pulseWidth, 1e-4));

    pos += pdirN * ringMask * u_pulseStr;
  }

  // ── Noise displacement (FBM), optionally boosted by Swell ──
  if (u_warpOn > 0.5) {
    int oct = int(u_warpOctaves);
    float d1 = fbm(vec3(pos * u_warpScale + 0.5, animSeed), oct);
    float d2 = fbm(vec3(pos * u_warpScale + 0.5 + 5.3, animSeed + 1.7), oct);
    pos += vec2(d1, d2) * u_warpStrength * warpBoost;
  }

  // ── Tiled color blobs ───────────────────────────────────
  vec3 col = u_bgColor;

  if (u_blobOn > 0.5) {
    vec2 op = pos - vec2(u_blobOffsetX, u_blobOffsetY);
    float sp = u_tileSpacing;
    op = mod(op - sp, vec2(sp * 2.0)) - sp;

    // Rotation with auto-rotation
    float totalRot = u_blobRotation + u_autoRotation * t;
    op = rot2d(op, -totalRot);

    op /= max(u_blobSize, 0.01);
    op *= vec2(1.0 / max(u_blobSpread, 0.01), 1.0);

    // Dynamic blob positions based on count
    float cs = u_blobSpacing;
    float halfSpan = cs * (u_blobCount - 1.0) * 0.5;
    float bs = max(u_blendSoftness, 0.01);

    float y0 = halfSpan;
    float y1 = halfSpan - cs;
    float y2 = halfSpan - cs * 2.0;
    float y3 = halfSpan - cs * 3.0;
    float y4 = halfSpan - cs * 4.0;
    float y5 = halfSpan - cs * 5.0;

    col = mix(u_color1, col, smoothstep(0.0, bs, distance(op, vec2(0.0, y0))));
    if (u_blobCount > 1.5) col = mix(u_color2, col, smoothstep(0.0, bs, distance(op, vec2(0.0, y1))));
    if (u_blobCount > 2.5) col = mix(u_color3, col, smoothstep(0.0, bs, distance(op, vec2(0.0, y2))));
    if (u_blobCount > 3.5) col = mix(u_color4, col, smoothstep(0.0, bs, distance(op, vec2(0.0, y3))));
    if (u_blobCount > 4.5) col = mix(u_color1, col, smoothstep(0.0, bs, distance(op, vec2(0.0, y4))));
    if (u_blobCount > 5.5) col = mix(u_color2, col, smoothstep(0.0, bs, distance(op, vec2(0.0, y5))));
  }

  // ── Color shift (hue rotation) ─────────────────────────
  if (abs(u_colorShift) > 0.001) {
    float angle = u_colorShift * t;
    float cosA = cos(angle);
    float sinA = sin(angle);
    col = mat3(
      0.299 + 0.701 * cosA + 0.168 * sinA,
      0.587 - 0.587 * cosA + 0.330 * sinA,
      0.114 - 0.114 * cosA - 0.497 * sinA,
      0.299 - 0.299 * cosA - 0.328 * sinA,
      0.587 + 0.413 * cosA + 0.035 * sinA,
      0.114 - 0.114 * cosA + 0.292 * sinA,
      0.299 - 0.300 * cosA + 1.250 * sinA,
      0.587 - 0.588 * cosA - 1.050 * sinA,
      0.114 + 0.886 * cosA - 0.203 * sinA
    ) * col;
  }

  // ── Grain ───────────────────────────────────────────────
  if (u_grainOn > 0.5) {
    vec2 gp = uv * u_resolution / max(u_grainScale, 0.01);
    // Re-seed grain in discrete time steps so it flickers like film grain.
    // speed=0 → static; higher → faster frame rate.
    float tStep = floor(t * max(u_grainSpeed, 0.0));
    gp += vec2(tStep * 13.17, tStep * 7.91);
    float n = valNoise(gp);
    col += n * u_grainAmount;
  }

  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}
