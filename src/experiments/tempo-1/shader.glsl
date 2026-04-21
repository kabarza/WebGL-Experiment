precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

// ── Layer toggles ────────────────────────────────────────────
uniform float u_auroraOn;
uniform float u_ringOn;
uniform float u_flareOn;
uniform float u_grainOn;

// ── Layer 1: Aurora Gradient ─────────────────────────────────
uniform float u_auroraScale;
uniform float u_auroraSpeed;
uniform float u_auroraWarp;
uniform float u_auroraIntensity;
uniform float u_auroraBlend;
uniform float u_auroraOffsetX;
uniform float u_auroraOffsetY;
uniform vec3  u_col1;
uniform vec3  u_col2;
uniform vec3  u_col3;

// ── Layer 2: Ring (FBO texture) ──────────────────────────────
uniform float u_ringOpacity;
uniform sampler2D u_ringTex;

// ── Layer 3: Lens Flare ──────────────────────────────────────
uniform float u_flareIntensity;
uniform float u_flareSpread;
uniform float u_flareSoftness;
uniform float u_flareRainbow;
uniform float u_flareCount;
uniform float u_flareAngle;
uniform float u_flareGlow;
uniform vec2  u_flarePos[8];
uniform vec4  u_flareParamsA[8];
uniform vec3  u_flareParamsB[8];

// ── Layer 4: Film Grain ──────────────────────────────────────
uniform float u_grainAmount;
uniform float u_grainSize;
uniform float u_grainSpeed;

// ── Post Processing ──────────────────────────────────────────
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_vignette;
uniform vec3  u_bgColor;

// =============================================================
// Hash — fast, no texture dependency
// =============================================================
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// =============================================================
// Simplex 3-D noise (Ashima Arts)
// 4 evaluations total for the aurora — no FBM loop needed
// =============================================================
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
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 hx = x_ * ns.x + ns.yyyy;
  vec4 hy = y_ * ns.x + ns.yyyy;
  vec4 hz = 1.0 - abs(hx) - abs(hy);
  vec4 b0 = vec4(hx.xy, hy.xy);
  vec4 b1 = vec4(hx.zw, hy.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(hz, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, hz.x);
  vec3 p1 = vec3(a0.zw, hz.y);
  vec3 p2 = vec3(a1.xy, hz.z);
  vec3 p3 = vec3(a1.zw, hz.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

const float TAU = 6.28318530718;
const int MAX_FLARES = 8;

void main() {
  vec2 uv = vUv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 st = vec2(uv.x * aspect, uv.y);
  float t = u_time;

  vec3 color = u_bgColor;

  // ==========================================================
  // LAYER 1 — Aurora Gradient
  // Simplex noise with domain warping: 4 noise evals total
  // ==========================================================
  if (u_auroraOn > 0.5) {
    vec2 p = (st + vec2(u_auroraOffsetX, u_auroraOffsetY)) * u_auroraScale;
    float wt = t * u_auroraSpeed;

    // Domain warp (2 noise evals)
    float d1 = snoise(vec3(p * 0.5, wt * 0.3));
    float d2 = snoise(vec3(p * 0.5 + 5.3, wt * 0.3 + 1.7));
    vec2 wp = p + u_auroraWarp * vec2(d1, d2);

    // Color blend signals (2 noise evals)
    float n1 = snoise(vec3(wp, wt * 0.2)) * 0.5 + 0.5;
    float n2 = snoise(vec3(wp * 0.7 + 3.1, wt * 0.15 + 2.3)) * 0.5 + 0.5;

    vec3 aurora = mix(u_col1, u_col2, n1);
    aurora = mix(aurora, u_col3, n2 * u_auroraBlend);
    color = mix(u_bgColor, aurora, u_auroraIntensity);
  }

  // ==========================================================
  // LAYER 2 — Ring (pre-rendered FBO texture composite)
  // Gradient baked once into FBO; dots drawn as gl.POINTS in Pass C.
  // ==========================================================
  if (u_ringOn > 0.5) {
    float ringGrad = texture2D(u_ringTex, uv).r;
    vec3 ringColor = vec3(0.87, 0.84, 0.8) * ringGrad * u_ringOpacity;
    color = 1.0 - (1.0 - color) * (1.0 - ringColor);
  }

  // ==========================================================
  // LAYER 3 — Lens Flare / Rainbow
  // Soft chromatic streaks + warm glow. Max 8 iterations.
  // Per-flare controls are driven from DialKit.
  // ==========================================================
  if (u_flareOn > 0.5) {
    vec3 flareAccum = vec3(0.0);
    int numFlares = int(clamp(u_flareCount, 1.0, float(MAX_FLARES)));
    vec2 ghostAnchorAccum = vec2(0.0);
    float ghostWeight = 0.0;

    for (int i = 0; i < MAX_FLARES; i++) {
      if (i >= numFlares) break;
      if (u_flareParamsB[i].z < 0.5) continue;
      float fi   = float(i);
      float seed = fi * 7.13 + 80.88;

      vec2 flarePos = vec2(
        clamp(u_flarePos[i].x, 0.0, 1.0) * aspect,
        clamp(u_flarePos[i].y, 0.0, 1.0)
      );

      // Direction + perpendicular
      float flareAng = u_flareParamsB[i].y + (u_flareAngle - 1.42);
      vec2 dir  = vec2(cos(flareAng), sin(flareAng));
      vec2 perp = vec2(-dir.y, dir.x);
      vec2 dd   = st - flarePos;
      float along    = dot(dd, dir);
      float perpDist = dot(dd, perp);

      // Wide, soft Gaussian — key difference vs. Celestial Flare
      float spreadMul = max(u_flareParamsA[i].y, 0.05);
      float softMul = max(u_flareParamsA[i].z, 0.05);
      float rainbowMul = max(u_flareParamsA[i].w, 0.0);
      float baseSpread = u_flareSpread * spreadMul;
      float baseW = baseSpread * (0.012 + fi * 0.004)
                  * (u_flareSoftness * softMul);
      float chrOffset = u_flareRainbow * rainbowMul * baseW * 2.0;

      // Chromatic separation through lens
      vec3 chrFlare;
      float invW2 = 1.0 / max(baseW * baseW, 0.000001);
      chrFlare.r = exp(-(perpDist - chrOffset) * (perpDist - chrOffset) * invW2);
      chrFlare.g = exp(-perpDist * perpDist * invW2);
      chrFlare.b = exp(-(perpDist + chrOffset) * (perpDist + chrOffset) * invW2);

      // Length falloff — smooth exponential tails
      float flareLen = (0.3 + hash21(vec2(seed, 4.0)) * 0.5) * baseSpread;
      float lenFade  = exp(-along * along / max(flareLen * flareLen, 0.001));
      chrFlare *= lenFade;

      // Warm glow around the flare source
      float glowDist = length(dd);
      float glow     = exp(-glowDist * glowDist / (0.04 + fi * 0.01));
      float glowMul = max(u_flareParamsB[i].x, 0.0);
      vec3 warmGlow = vec3(1.0, 0.65, 0.25)
                    * glow
                    * (u_flareGlow * glowMul)
                    * 0.15;

      float intensity = u_flareIntensity
                      * max(u_flareParamsA[i].x, 0.0)
                      * (0.3 + hash21(vec2(seed, 5.0)) * 0.7);
      flareAccum += (chrFlare + warmGlow) * intensity;
      ghostAnchorAccum += flarePos * intensity;
      ghostWeight += intensity;
    }

    // Subtle curved ghost to mimic analog lens artifacts.
    vec2 ghostCenter = vec2(0.58 * aspect, 0.42);
    if (ghostWeight > 0.0001) {
      ghostCenter = mix(ghostCenter, ghostAnchorAccum / ghostWeight, 0.65);
    }
    vec2 ghostDelta = st - ghostCenter;
    float ghostR = length(ghostDelta);
    float ghostTarget = 0.22 + 0.06 * u_flareSpread;
    float ghostW = max(0.03 * u_flareSoftness, 0.001);
    float ghostArc = exp(-pow((ghostR - ghostTarget) / ghostW, 2.0));
    ghostArc *= smoothstep(-0.28, 0.12, ghostDelta.y);
    vec3 ghostColor = vec3(0.68, 0.56, 0.34)
                    * ghostArc
                    * u_flareRainbow
                    * u_flareIntensity
                    * 0.65;
    flareAccum += ghostColor;

    // Screen blend for natural integration
    color = 1.0 - (1.0 - color) * (1.0 - flareAccum);
  }

  // ==========================================================
  // LAYER 4 — Film Grain
  // Single hash per pixel, temporally animated.
  // This is the ONLY grain in the entire pipeline.
  // ==========================================================
  if (u_grainOn > 0.5) {
    float grainT = floor(t * u_grainSpeed);
    vec2 gUV     = vUv * u_resolution;
    float grain  = hash21(floor(gUV / u_grainSize) + grainT * 17.13) - 0.5;
    color += grain * u_grainAmount;
  }

  // ==========================================================
  // POST — Vignette, brightness, contrast, saturation
  // ==========================================================
  // Vignette
  vec2 vc    = vUv - 0.5;
  float vDst = dot(vc, vc);
  color *= 1.0 - u_vignette * vDst * 2.0;

  // Tone
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, u_saturation);
  color *= u_brightness;
  color = (color - 0.5) * u_contrast + 0.5;

  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
