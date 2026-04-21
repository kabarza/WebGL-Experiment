// ============================================================
// Tempo-3 — Composite analog lens-flare effect
// Single-pass fragment shader: 5 independently controllable layers
// ============================================================
precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

// ── Base Gradient ──
uniform float u_baseOn;
uniform float u_baseOpacity;
uniform float u_baseWarpStrength;
uniform float u_baseWarpSpeed;
uniform float u_baseNoiseScale;
uniform float u_baseColorTemp;
uniform float u_baseFalloff;
uniform float u_baseBrightness;

// ── Aurora Noise ──
uniform float u_auroraOn;
uniform float u_auroraOpacity;
uniform float u_auroraSpeed;
uniform float u_auroraScale;
uniform float u_auroraWarp;
uniform float u_auroraSaturation;

// ── Particle Ring ──
uniform float u_ringOn;
uniform float u_ringOpacity;
uniform vec2 u_ringPos;
uniform float u_ringRadius;
uniform float u_ringEdgeWidth;
uniform float u_ringDensity;
uniform float u_ringParticleSize;
uniform float u_ringMode;
uniform float u_ringSpeed;
uniform float u_ringPulseRate;

// ── Lens Flare / Chromatic Dispersion ──
uniform float u_flareOn;
uniform float u_flareOpacity;
uniform float u_flareCount;
uniform float u_flareSpread;
uniform float u_flareLength;
uniform float u_flareDispersion;
uniform float u_flareDesaturation;
uniform float u_flareAngle;

// ── Film Grain ──
uniform float u_grainOn;
uniform float u_grainIntensity;
uniform float u_grainScale;

// ── Post ──
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;

// ============================================================
// Noise
// ============================================================

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash31(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

// Simplex 3D
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

// Soft-light blend (Pegtop — branch-free)
vec3 softLight(vec3 base, vec3 blend) {
  return (1.0 - 2.0 * blend) * base * base + 2.0 * blend * base;
}

const float TAU = 6.28318530718;
const float PI  = 3.14159265359;

void main() {
  vec2 uv = vUv;
  float aspect = u_resolution.x / u_resolution.y;
  // Normalized coordinates: x in [0, 1], y in [0, 1]
  // (NO aspect correction on st — apply where needed)
  float t = u_time;

  vec3 color = vec3(0.008, 0.004, 0.012);

  // ============================================================
  // LAYER 1 — Base Gradient (Flare Layer)
  //
  // Smoky orange / purple / black — analog lens flare on film.
  // Uses noise-warped positional gradients for organic blobs,
  // masked by a diagonal falloff to concentrate in upper-left.
  // ============================================================
  if (u_baseOn > 0.5) {
    // Work in aspect-corrected space
    vec2 st = vec2(uv.x * aspect, uv.y);

    // ── Position-based mask: upper-left bright, rest dark ──
    // Diagonal gradient from top-left corner
    float cornerDist = length(vec2(uv.x, 1.0 - uv.y));
    float mask = 1.0 - smoothstep(0.0, u_baseFalloff, cornerDist);
    // Boost the mask power so darkness dominates
    mask = pow(mask, 1.5);

    // ── Sine-based domain warp (organic smoky movement) ──
    float wt = t * u_baseWarpSpeed;
    vec2 p = st * u_baseNoiseScale;

    vec2 w1 = vec2(
      sin(p.y * 2.1 + wt * 0.7),
      cos(p.x * 1.8 + wt * 0.6 + 1.0)
    );
    vec2 w2 = vec2(
      sin((p.x + p.y) * 3.3 + wt * 0.5 + 3.0),
      cos((p.x - p.y) * 2.7 + wt * 0.4 + 5.0)
    ) * 0.5;
    vec2 w3 = vec2(
      cos(p.x * 4.5 + p.y * 1.3 + wt * 0.35 + 7.0),
      sin(p.y * 3.9 + p.x * 0.9 + wt * 0.3 + 9.0)
    ) * 0.25;

    vec2 wP = p + u_baseWarpStrength * (w1 + w2 + w3);

    // ── Two gradient signals driving the three-color blend ──
    float timeShift = t * 0.01;
    float n1 = sin(wP.x * 1.5 + wP.y * 0.7 + timeShift) * 0.5 + 0.5;
    float n2 = sin(wP.y * 1.3 + wP.x * 0.5 + timeShift * 0.8 + 1.57) * 0.5 + 0.5;

    // Add simplex noise for extra organic variation
    float sn = snoise(vec3(st * 1.5, t * u_baseWarpSpeed * 0.5)) * 0.5 + 0.5;

    // ── Color palette ──
    // Warm: pink/salmon/dusty rose
    vec3 colWarm = mix(
      vec3(0.65, 0.18, 0.22),  // cool pink
      vec3(0.70, 0.30, 0.14),  // warm amber-salmon
      u_baseColorTemp
    );
    // Purple: deep indigo/violet
    vec3 colPurple = mix(
      vec3(0.18, 0.06, 0.35),  // deep indigo
      vec3(0.30, 0.10, 0.28),  // warm violet
      u_baseColorTemp
    );
    // Dark: near-black blue-brown
    vec3 colDark = vec3(0.04, 0.02, 0.06);

    // Blend the three colors using noise-driven mix
    vec3 grad = mix(colDark, colWarm, n1 * sn);
    grad = mix(grad, colPurple, n2 * 0.7);

    // ── Positional bias: warm toward upper-left, purple more central ──
    // uv.x=0 is left, uv.y=1 is top
    float warmBias = (1.0 - uv.x) * uv.y;          // strong upper-left
    float purpleBias = (1.0 - uv.x * 0.5) * uv.y;  // broad upper band

    warmBias = pow(warmBias, 0.8);
    purpleBias = pow(purpleBias, 1.2);

    vec3 positioned = colDark;
    positioned = mix(positioned, colPurple * 0.8, purpleBias * n2);
    positioned = mix(positioned, colWarm, warmBias * n1 * 0.9);
    // Blend noise-driven gradient with position-biased version
    grad = mix(positioned, grad, 0.4);

    color += grad * mask * u_baseBrightness * u_baseOpacity;
  }

  // ============================================================
  // LAYER 2 — Aurora Noise
  //
  // Slow-moving simplex noise color field. Subtle.
  // Screen-blended into the base (brightens, doesn't overpower).
  // ============================================================
  if (u_auroraOn > 0.5) {
    vec2 aP = vec2(uv.x * aspect, uv.y) * u_auroraScale;
    float aT = t * u_auroraSpeed;

    // Domain warp
    float wx = snoise(vec3(aP * 0.7 + 0.5, aT * 0.8));
    float wy = snoise(vec3(aP * 0.7 + 5.3, aT * 0.8 + 1.7));
    aP += vec2(wx, wy) * u_auroraWarp;

    // Two noise octaves
    float n1 = snoise(vec3(aP, aT)) * 0.5 + 0.5;
    float n2 = snoise(vec3(aP * 1.7 + 3.0, aT * 1.3 + 2.0)) * 0.5 + 0.5;

    // Muted palette
    vec3 aCol1 = vec3(0.16, 0.07, 0.14); // dusty mauve
    vec3 aCol2 = vec3(0.05, 0.10, 0.10); // muted teal
    vec3 aCol3 = vec3(0.12, 0.08, 0.03); // dim ochre

    vec3 ac = mix(aCol1, aCol2, n1);
    ac = mix(ac, aCol3, n2 * 0.5);

    // Desaturate
    float aLuma = dot(ac, vec3(0.299, 0.587, 0.114));
    ac = mix(vec3(aLuma), ac, u_auroraSaturation);

    // Screen blend
    color = 1.0 - (1.0 - color) * (1.0 - ac * u_auroraOpacity);
  }

  // ============================================================
  // LAYER 3 — Particle Ring
  //
  // Circle of tiny dot elements. Two modes:
  //   mode 0 — slow rotation
  //   mode 1 — static, staggered pulse
  // Additive blend (visible on dark) + subtle soft-light on bright.
  // ============================================================
  if (u_ringOn > 0.5) {
    vec2 ringCenter = vec2(u_ringPos.x * aspect, u_ringPos.y);
    vec2 st = vec2(uv.x * aspect, uv.y);
    vec2 delta = st - ringCenter;
    float cDist = length(delta);

    // Generous early-out band around the ring
    float band = u_ringEdgeWidth * 6.0 + u_ringParticleSize * 0.025;
    float ringAccum = 0.0;

    if (abs(cDist - u_ringRadius) < band) {
      float rotation = u_ringMode < 0.5 ? t * u_ringSpeed * 0.3 : 0.0;

      int maxP = int(u_ringDensity * 12.0);
      for (int i = 0; i < 180; i++) {
        if (i >= maxP) break;
        float fi = float(i);

        float fadeIn = smoothstep(float(maxP), float(maxP) - 1.0, fi);
        if (fadeIn < 0.001) continue;

        float h0 = hash21(vec2(fi * 1.17, 0.31));
        float h1 = hash21(vec2(fi * 2.31, 1.73));
        float h2 = hash21(vec2(fi * 3.47, 2.91));

        float angle = h0 * TAU + rotation;
        float radJitter = (h1 - 0.5) * u_ringEdgeWidth * 5.0;
        float pR = u_ringRadius + radJitter;

        vec2 pPos = ringCenter + pR * vec2(cos(angle), sin(angle));
        vec2 toP = st - pPos;
        float d2 = dot(toP, toP);

        // Visible dot size — scales with ringParticleSize
        float pSize = u_ringParticleSize * 0.008 * (0.5 + h2 * 0.5);
        if (d2 > pSize * pSize * 20.0) continue;

        float particle = exp(-d2 / (pSize * pSize));

        // Animation
        float anim = 1.0;
        if (u_ringMode >= 0.5) {
          float phase = h0 * TAU + t * u_ringPulseRate;
          anim = 0.1 + 0.9 * pow(max(0.0, sin(phase)), 3.0);
        }

        ringAccum += particle * anim * fadeIn;
      }

      // Faint ring glow along the circle path
      float ringDist = abs(cDist - u_ringRadius);
      float ringGlow = exp(-ringDist * ringDist / (u_ringEdgeWidth * u_ringEdgeWidth)) * 0.06;
      ringAccum += ringGlow;
    }

    // Additive: visible even on black. Low opacity keeps it embedded.
    float ringMask = ringAccum * u_ringOpacity;
    vec3 ringTint = vec3(0.6, 0.58, 0.54);
    color += ringTint * ringMask;
  }

  // ============================================================
  // LAYER 4 — Lens Flare / Chromatic Dispersion
  //
  // Thin diffused streaks of spectral color. Desaturated, smeared.
  // Light artifacts, NOT painted rainbows.
  // ============================================================
  if (u_flareOn > 0.5) {
    vec2 st = vec2(uv.x * aspect, uv.y);
    vec3 flareAccum = vec3(0.0);
    int numFlares = int(u_flareCount);

    for (int i = 0; i < 6; i++) {
      if (i >= numFlares) break;
      float fi = float(i);
      float seed = fi * 11.37 + 5.1;

      vec2 fPos = vec2(
        hash21(vec2(seed, 1.0)) * aspect,
        hash21(vec2(seed, 2.0))
      );
      // Very gentle drift
      fPos += vec2(
        sin(t * 0.03 + fi * 3.7) * 0.015,
        cos(t * 0.04 + fi * 2.3) * 0.01
      );

      float fAng = u_flareAngle + hash21(vec2(seed, 3.0)) * PI;
      vec2 dir = vec2(cos(fAng), sin(fAng));
      vec2 perp = vec2(-dir.y, dir.x);
      vec2 d = st - fPos;
      float along = dot(d, dir);
      float perpD = dot(d, perp);

      // Thin width
      float w = u_flareSpread * (0.002 + fi * 0.0005);

      // Chromatic RGB offset
      float chrOff = u_flareDispersion * w * 4.0;
      vec3 chrF;
      chrF.r = exp(-(perpD - chrOff) * (perpD - chrOff) / (w * w));
      chrF.g = exp(-perpD * perpD / (w * w));
      chrF.b = exp(-(perpD + chrOff) * (perpD + chrOff) / (w * w));

      // Length smear
      float fLen = (0.15 + hash21(vec2(seed, 4.0)) * 0.3) * u_flareLength;
      chrF *= smoothstep(fLen, fLen * 0.05, abs(along));

      // Desaturate
      float cLuma = dot(chrF, vec3(0.299, 0.587, 0.114));
      chrF = mix(vec3(cLuma), chrF, 1.0 - u_flareDesaturation);

      flareAccum += chrF * (0.5 + hash21(vec2(seed, 5.0)) * 0.5);
    }

    color += flareAccum * u_flareOpacity;
  }

  // ============================================================
  // LAYER 5 — Film Grain (single shared pass)
  //
  // Hash-based, performant. Applied once over the composite.
  // ============================================================
  if (u_grainOn > 0.5) {
    float grainT = floor(t * 24.0);
    vec2 gUV = vUv * u_resolution;
    vec2 cell = floor(gUV / u_grainScale);

    float g1 = hash21(cell + grainT * 17.13);
    float g2 = hash31(vec3(cell * 1.37, grainT * 23.71));
    float grain = ((g1 + g2) * 0.5 - 0.5) * u_grainIntensity;

    color += grain;
  }

  // ============================================================
  // Post
  // ============================================================
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, u_saturation);
  color *= u_brightness;
  color = (color - 0.5) * u_contrast + 0.5;

  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
