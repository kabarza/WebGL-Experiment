// ============================================================
// Tempo-4 — Layered composite with z-order compositing
// 4 reorderable layers: Aurora, Image, Circle, Film Grain
// Single-pass, sine-based warp (no expensive noise lookups).
// ============================================================
precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

// ── Background ──
uniform vec3 u_bgColor;

// ── Layer Order (0 = bottom, 3 = top) ──
uniform float u_orderAurora;
uniform float u_orderImage;
uniform float u_orderCircle;
uniform float u_orderGrain;

// ── Aurora Layer ──
uniform float u_auroraOn;
uniform float u_auroraOpacity;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;
uniform vec3 u_color4;
uniform float u_warpStrength;
uniform float u_warpScale;
uniform float u_warpSpeed;
uniform float u_blobSize;
uniform float u_blobSpacing;
uniform float u_blobRotation;
uniform float u_blobSpread;
uniform float u_blobOffsetX;
uniform float u_blobOffsetY;
uniform float u_tileSpacing;
uniform float u_zoom;
uniform float u_auroraOffsetX;
uniform float u_auroraOffsetY;

// ── Image Layer ──
uniform float u_imageOn;
uniform float u_imageOpacity;
uniform sampler2D u_image;
uniform float u_imageLoaded;
uniform float u_imageScale;
uniform float u_imageOffsetX;
uniform float u_imageOffsetY;
uniform float u_imageAspect;

// ── Circle Layer ──
uniform float u_circleOn;
uniform float u_circleOpacity;
uniform vec2 u_circlePos;
uniform float u_circleRadius;
uniform float u_circleEdge;
uniform float u_circleDensity;
uniform float u_circleParticleSize;
uniform float u_circleSpeed;
uniform float u_circleTrail;
uniform float u_circleTwinkle;
uniform vec3 u_circleColor;
uniform float u_circleGlow;

// ── Film Grain ──
uniform float u_grainOn;
uniform float u_grainAmount;
uniform float u_grainSize;
uniform float u_grainSpeed;

// ── Post ──
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;

// ============================================================
// Utility functions
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

vec2 rot2d(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

const float TAU = 6.28318530718;

// ============================================================
// Compositing helper — blends one layer over result
// mode: 0 = screen, 1 = normal, 2 = additive
// ============================================================
vec3 compositeLayer(vec3 base, vec3 layerRgb, float layerA, float mode) {
  if (layerA < 0.001) return base;
  // Screen
  if (mode < 0.5) {
    vec3 blend = layerRgb * layerA;
    return 1.0 - (1.0 - base) * (1.0 - blend);
  }
  // Normal
  if (mode < 1.5) {
    return mix(base, layerRgb, layerA);
  }
  // Additive
  return base + layerRgb * layerA;
}

void main() {
  vec2 uv = vUv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 st = vec2(uv.x * aspect, uv.y);
  float t = u_time;

  // ============================================================
  // LAYER: Aurora (sine-based warp + tiled color blobs)
  // ============================================================
  vec3 auroraRgb = vec3(0.0);
  float auroraA = 0.0;
  if (u_auroraOn > 0.5) {
    vec2 pos = uv * 2.0 - 1.0;
    pos.x *= min(1.0, aspect);
    pos.y *= min(1.0, 1.0 / aspect);
    pos /= max(u_zoom, 0.01);
    pos += vec2(u_auroraOffsetX, u_auroraOffsetY);

    // Sine-based domain warp — cheap, organic, no noise lookups
    float wt = t * u_warpSpeed;
    vec2 w1 = vec2(
      sin(pos.y * 2.1 * u_warpScale + wt * 0.7),
      cos(pos.x * 1.8 * u_warpScale + wt * 0.6 + 1.0)
    );
    vec2 w2 = vec2(
      sin((pos.x + pos.y) * 3.3 * u_warpScale + wt * 0.5 + 3.0),
      cos((pos.x - pos.y) * 2.7 * u_warpScale + wt * 0.4 + 5.0)
    ) * 0.5;
    vec2 w3 = vec2(
      cos(pos.x * 4.5 * u_warpScale + pos.y * 1.3 + wt * 0.35 + 7.0),
      sin(pos.y * 3.9 * u_warpScale + pos.x * 0.9 + wt * 0.3 + 9.0)
    ) * 0.25;
    pos += u_warpStrength * (w1 + w2 + w3);

    // Tiled color blobs
    vec2 op = pos - vec2(u_blobOffsetX, u_blobOffsetY);
    float sp = u_tileSpacing;
    op = mod(op - sp, vec2(sp * 2.0)) - sp;
    op = rot2d(op, -u_blobRotation);
    op /= max(u_blobSize, 0.01);
    op *= vec2(1.0 / max(u_blobSpread, 0.01), 1.0);

    float cs = u_blobSpacing;
    vec3 aCol = vec3(0.0);
    aCol = mix(u_color1, aCol, smoothstep(0.0, 1.0, distance(op, vec2(0.0, cs * 1.5))));
    aCol = mix(u_color2, aCol, smoothstep(0.0, 1.0, distance(op, vec2(0.0, cs * 0.5))));
    aCol = mix(u_color3, aCol, smoothstep(0.0, 1.0, distance(op, vec2(0.0, -cs * 0.5))));
    aCol = mix(u_color4, aCol, smoothstep(0.0, 1.0, distance(op, vec2(0.0, -cs * 1.5))));

    auroraRgb = aCol;
    auroraA = u_auroraOpacity;
  }

  // ============================================================
  // LAYER: Image (texture sampling with cover mode)
  // ============================================================
  vec3 imageRgb = vec3(0.0);
  float imageA = 0.0;
  if (u_imageOn > 0.5 && u_imageLoaded > 0.5) {
    vec2 imgUV = uv;

    // Cover mode
    if (aspect > u_imageAspect) {
      float sc = aspect / u_imageAspect;
      imgUV.y = (imgUV.y - 0.5) / sc + 0.5;
    } else {
      float sc = u_imageAspect / aspect;
      imgUV.x = (imgUV.x - 0.5) / sc + 0.5;
    }

    imgUV = (imgUV - 0.5) / max(u_imageScale, 0.01) + 0.5;
    imgUV += vec2(u_imageOffsetX, u_imageOffsetY);

    vec4 texColor = texture2D(u_image, imgUV);
    imageRgb = texColor.rgb;
    imageA = texColor.a * u_imageOpacity;
  }

  // ============================================================
  // LAYER: Particle Circle
  // 2 concentric particle layers, max 36 each.
  // ============================================================
  vec3 circleRgb = vec3(0.0);
  float circleA = 0.0;
  if (u_circleOn > 0.5) {
    vec2 cPos = vec2(u_circlePos.x * aspect, u_circlePos.y);
    vec2 delta = st - cPos;
    float cDist = length(delta);
    float ringDist = cDist - u_circleRadius;

    float edgeW = u_circleEdge * 0.1;
    float ringGlowBase = exp(-ringDist * ringDist / max(edgeW * edgeW, 0.0001));

    float totalParticles = 0.0;

    float reach = edgeW * 4.0 + u_circleParticleSize * 0.15;
    if (abs(ringDist) < reach && cDist > 0.001) {
      for (int layer = 0; layer < 2; layer++) {
        float fl = float(layer);
        float layerSeed = fl * 137.0;
        float layerBright = 1.0 - fl * 0.25;

        float maxCount = u_circleDensity * (22.0 + fl * 8.0);
        int N = int(min(ceil(maxCount), 36.0));

        float rotation = t * u_circleSpeed * 0.02 * (1.0 + fl * 0.1);

        for (int i = 0; i < 36; i++) {
          if (i >= N) break;
          float fi = float(i);

          float fadeIn = smoothstep(maxCount, maxCount - 1.0, fi);
          if (fadeIn < 0.001) continue;

          float seed = fi + layerSeed;
          float h0 = hash21(vec2(seed, 0.0));
          float h1 = hash21(vec2(seed, 1.0));

          float angle = h0 * TAU + rotation;
          float radJitter = (h1 - 0.5) * edgeW * 4.0;
          float pR = u_circleRadius + radJitter;

          float ca = cos(angle), sa = sin(angle);
          vec2 pPos = cPos + pR * vec2(ca, sa);

          vec2 toP = st - pPos;
          float cutoff = u_circleParticleSize * 0.12
                       * (1.0 + u_circleTrail * 3.0);
          if (dot(toP, toP) > cutoff * cutoff) continue;

          float h2 = hash21(vec2(seed, 2.0));
          float h3 = hash21(vec2(seed, 3.0));

          vec2 tangent = vec2(-sa, ca);
          vec2 radial  = vec2( ca, sa);
          float alongT = dot(toP, tangent);
          float perpR  = dot(toP, radial);

          float sizeVar = (0.5 + h2 * 0.5);
          // Trail=0 → round dots, Trail=1 → long streaks
          float streakLen = u_circleParticleSize * 0.04 * sizeVar
                          * (0.5 + u_circleTrail * 5.0);
          float streakW   = u_circleParticleSize * 0.02 * sizeVar
                          * (1.0 - u_circleTrail * 0.7);

          float da = alongT / max(streakLen, 0.0001);
          float dr = perpR  / max(streakW,  0.0001);
          float particle = exp(-(da * da + dr * dr) * 3.0);

          float phase = h3 * TAU + t * u_circleSpeed * 2.0;
          float twinkle = mix(1.0, 0.2 + 0.8 * max(0.0, sin(phase)),
                              u_circleTwinkle);

          totalParticles += particle * twinkle * fadeIn * layerBright;
        }
      }
    }

    float circleMask = (ringGlowBase * u_circleGlow + totalParticles * 0.8)
                     * u_circleOpacity;
    circleRgb = u_circleColor * circleMask;
    circleA = clamp(circleMask, 0.0, 1.0);
  }

  // ============================================================
  // LAYER: Film Grain (hash-based, fast)
  // ============================================================
  vec3 grainRgb = vec3(0.0);
  float grainA = 0.0;
  if (u_grainOn > 0.5) {
    float grainT = floor(u_time * u_grainSpeed);
    vec2 gUV = uv * u_resolution;

    float g1 = hash21(floor(gUV / u_grainSize) + grainT * 17.13);
    float g2 = hash31(vec3(floor(gUV / u_grainSize) * 1.37, grainT * 23.71));

    grainRgb = vec3(((g1 + g2) * 0.5 - 0.5) * u_grainAmount);
    grainA = 1.0;
  }

  // ============================================================
  // Layer compositing — z-order, unrolled 4 steps
  // Blend modes: Aurora=screen(0), Image=normal(1), Circle=add(2), Grain=add(2)
  // ============================================================
  vec3 result = u_bgColor;

  // Pre-compute layer data: rgb, alpha, blend mode, order
  // Then composite in 4 passes (unrolled for GPU efficiency)

  // --- Step 0 (bottom) ---
  if (abs(u_orderAurora - 0.0) < 0.5) result = compositeLayer(result, auroraRgb, auroraA, 0.0);
  if (abs(u_orderImage  - 0.0) < 0.5) result = compositeLayer(result, imageRgb, imageA, 1.0);
  if (abs(u_orderCircle - 0.0) < 0.5) result = compositeLayer(result, circleRgb, circleA, 2.0);
  if (abs(u_orderGrain  - 0.0) < 0.5) result = compositeLayer(result, grainRgb, grainA, 2.0);

  // --- Step 1 ---
  if (abs(u_orderAurora - 1.0) < 0.5) result = compositeLayer(result, auroraRgb, auroraA, 0.0);
  if (abs(u_orderImage  - 1.0) < 0.5) result = compositeLayer(result, imageRgb, imageA, 1.0);
  if (abs(u_orderCircle - 1.0) < 0.5) result = compositeLayer(result, circleRgb, circleA, 2.0);
  if (abs(u_orderGrain  - 1.0) < 0.5) result = compositeLayer(result, grainRgb, grainA, 2.0);

  // --- Step 2 ---
  if (abs(u_orderAurora - 2.0) < 0.5) result = compositeLayer(result, auroraRgb, auroraA, 0.0);
  if (abs(u_orderImage  - 2.0) < 0.5) result = compositeLayer(result, imageRgb, imageA, 1.0);
  if (abs(u_orderCircle - 2.0) < 0.5) result = compositeLayer(result, circleRgb, circleA, 2.0);
  if (abs(u_orderGrain  - 2.0) < 0.5) result = compositeLayer(result, grainRgb, grainA, 2.0);

  // --- Step 3 (top) ---
  if (abs(u_orderAurora - 3.0) < 0.5) result = compositeLayer(result, auroraRgb, auroraA, 0.0);
  if (abs(u_orderImage  - 3.0) < 0.5) result = compositeLayer(result, imageRgb, imageA, 1.0);
  if (abs(u_orderCircle - 3.0) < 0.5) result = compositeLayer(result, circleRgb, circleA, 2.0);
  if (abs(u_orderGrain  - 3.0) < 0.5) result = compositeLayer(result, grainRgb, grainA, 2.0);

  // ============================================================
  // Post processing
  // ============================================================
  float luma = dot(result, vec3(0.299, 0.587, 0.114));
  result = mix(vec3(luma), result, u_saturation);
  result *= u_brightness;
  result = (result - 0.5) * u_contrast + 0.5;

  result = clamp(result, 0.0, 1.0);
  gl_FragColor = vec4(result, 1.0);
}
