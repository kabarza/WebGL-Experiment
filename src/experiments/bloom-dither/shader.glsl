precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

// ─── Layer toggles ───
uniform float u_branchOn;
uniform float u_flowerOn;
uniform float u_glowOn;
uniform float u_ditherOn;

// ─── Branches ───
uniform float u_branchScale;
uniform float u_branchThickness;
uniform vec3 u_branchColor;

// ─── Flowers ───
uniform float u_flowerSize;
uniform vec3 u_flowerColor;
uniform float u_petalCount;

// ─── Glow ───
uniform float u_glowIntensity;
uniform vec3 u_glowColor;
uniform float u_glowRadius;

// ─── Dither ───
uniform float u_ditherSize;

// ─── General ───
uniform float u_progress;
uniform float u_seed;
uniform vec3 u_bgColor;

const float PI = 3.14159265;
const float TAU = 6.28318530;

// ─────────────────────────────────────────────────
// Hash — Dave Hoskins
// ─────────────────────────────────────────────────

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// ─────────────────────────────────────────────────
// Segment SDF
// ─────────────────────────────────────────────────

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// ─────────────────────────────────────────────────
// Branch curve generation
// ─────────────────────────────────────────────────

vec2 stemAt(float idx, float t) {
  float s = u_seed * 0.37 + idx * 7.13;

  // Origin at canvas edge
  vec2 a;
  float side = fract(idx * 0.618 + u_seed * 0.1);
  if (side < 0.4) {
    a = vec2(-0.03, hash21(vec2(s, 1.0)) * 0.55 + 0.2);
  } else if (side < 0.75) {
    a = vec2(hash21(vec2(s, 2.0)) * 0.5 + 0.15, -0.03);
  } else {
    a = vec2(1.03, hash21(vec2(s, 3.0)) * 0.45 + 0.25);
  }

  // End point toward canvas interior
  float angle = atan(0.5 - a.y, 0.5 - a.x) + (hash21(vec2(s, 4.0)) - 0.5) * 0.9;
  float len = 0.3 + hash21(vec2(s, 5.0)) * 0.4;
  vec2 b = a + vec2(cos(angle), sin(angle)) * len;

  // Quadratic Bezier control
  vec2 mid = mix(a, b, 0.5);
  mid += vec2(hash21(vec2(s, 6.0)) - 0.5, hash21(vec2(s, 7.0)) - 0.5) * 0.12;

  vec2 pos = mix(mix(a, mid, t), mix(mid, b, t), t);

  // Organic wobble
  pos.y += sin(t * PI * 2.5 + idx * 2.1) * 0.015;
  pos.x += cos(t * PI * 1.8 + idx * 1.7) * 0.01;

  return pos;
}

// ─────────────────────────────────────────────────
// Flower shape
// Returns vec2(alpha, colorVariation)
// ─────────────────────────────────────────────────

vec2 flowerAt(vec2 p, vec2 center, float seed) {
  float fd = length(p - center);
  float fs = u_flowerSize * (0.018 + hash21(vec2(seed, u_seed + 70.0)) * 0.018);

  float fAngle = atan(p.y - center.y, p.x - center.x);
  float fPhase = hash21(vec2(seed, u_seed + 72.0)) * TAU;
  float petal = 0.55 + 0.45 * cos(fAngle * u_petalCount + fPhase);
  float fR = fs * petal;

  float fA = 1.0 - smoothstep(fR * 0.1, fR, fd);

  // Darker center
  float centerA = 1.0 - smoothstep(0.0, fs * 0.12, fd);
  float colorVar = 0.8 + hash21(vec2(seed, u_seed + 74.0)) * 0.4;
  // Slight hue shift per flower
  colorVar = mix(colorVar, colorVar * 0.35, centerA);

  return vec2(fA, colorVar);
}

// Glow contribution
float glowAt(vec2 p, vec2 center, float seed, float growthT) {
  float fd = length(p - center);
  float fs = u_flowerSize * (0.018 + hash21(vec2(seed, u_seed + 70.0)) * 0.018);
  float age = u_progress - growthT;
  float peak = exp(-pow(max(age - 0.07, 0.0), 2.0) / 0.003) * step(0.0, age);
  float gd = fd / (fs * u_glowRadius * 3.5);
  return peak * exp(-gd * gd * 2.0) * u_glowIntensity;
}

// ─────────────────────────────────────────────────
// Scene
// ─────────────────────────────────────────────────

vec3 computeScene(vec2 uv) {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec3 col = u_bgColor;

  float baseThick = u_branchThickness * 0.01;

  // Nearest branch tracking
  float nearDist = 999.0;
  float nearGrowthT = 0.0;
  float nearThick = 0.0;

  // Flower / glow accumulation
  float bestFlA = 0.0;
  float bestFlVar = 1.0;
  float glowSum = 0.0;

  // ─── 6 main stems ───
  for (int si = 0; si < 6; si++) {
    float fi = float(si);
    vec2 prevUV = stemAt(fi, 0.0);
    vec2 prev = vec2(prevUV.x * aspect, prevUV.y);

    for (int seg = 1; seg <= 12; seg++) {
      float t = float(seg) / 12.0;
      vec2 currUV = stemAt(fi, t);
      vec2 curr = vec2(currUV.x * aspect, currUV.y);

      // Main stem SDF
      float d = segDist(p, prev, curr);
      float thick = baseThick * (1.4 - t * 0.7);
      float growthT = t * 0.35;

      if (d < nearDist) {
        nearDist = d;
        nearGrowthT = growthT;
        nearThick = thick;
      }

      // ── Flower along main stem ──
      if (u_flowerOn > 0.5 && mod(float(seg), 3.0) < 0.5) {
        float prob = hash21(vec2(fi * 12.0 + float(seg), u_seed + 50.0));
        if (prob > 0.5) {
          float flSeed = fi * 100.0 + float(seg);
          float flGrowthT = growthT + 0.15;
          float flGrowth = smoothstep(flGrowthT, flGrowthT + 0.1, u_progress);

          vec2 fl = flowerAt(p, curr, flSeed);
          fl.x *= flGrowth;
          if (fl.x > bestFlA) { bestFlA = fl.x; bestFlVar = fl.y; }

          if (u_glowOn > 0.5) {
            glowSum += glowAt(p, curr, flSeed, flGrowthT);
          }
        }
      }

      // ── Sub-branches ──
      if (seg >= 3 && mod(float(seg), 2.0) < 0.5) {
        vec2 dir = normalize(curr - prev);

        for (int sub = 0; sub < 3; sub++) {
          float subSeed = fi * 200.0 + float(seg) * 10.0 + float(sub);
          float subProb = hash21(vec2(subSeed, u_seed + 60.0));

          if (subProb > 0.3) {
            float bAngle = atan(dir.y, dir.x);
            bAngle += (hash21(vec2(subSeed, u_seed + 62.0)) - 0.5) * 1.5;
            float bLen = (0.04 + hash21(vec2(subSeed, u_seed + 64.0)) * 0.08) * u_branchScale;
            vec2 subEnd = curr + vec2(cos(bAngle), sin(bAngle)) * bLen;

            float sd = segDist(p, curr, subEnd);
            float subThick = baseThick * 0.45;
            float subGrowthT = growthT + 0.30;

            if (sd < nearDist) {
              nearDist = sd;
              nearGrowthT = subGrowthT;
              nearThick = subThick;
            }

            // Flower at sub-branch tip
            if (u_flowerOn > 0.5 && subProb > 0.45) {
              float flSeed = subSeed + 500.0;
              float flGrowthT = subGrowthT + 0.08;
              float flGrowth = smoothstep(flGrowthT, flGrowthT + 0.1, u_progress);

              vec2 fl = flowerAt(p, subEnd, flSeed);
              fl.x *= flGrowth;
              if (fl.x > bestFlA) { bestFlA = fl.x; bestFlVar = fl.y; }

              if (u_glowOn > 0.5) {
                glowSum += glowAt(p, subEnd, flSeed, flGrowthT);
              }
            }

            // ── Twigs (unrolled ×2) ──
            vec2 subDir = normalize(subEnd - curr);

            // Twig 0
            {
              float twSeed = subSeed * 10.0;
              float twProb = hash21(vec2(twSeed, u_seed + 80.0));
              if (twProb > 0.4) {
                float twAngle = atan(subDir.y, subDir.x);
                twAngle += (hash21(vec2(twSeed, u_seed + 82.0)) - 0.5) * 1.8;
                float twLen = (0.015 + hash21(vec2(twSeed, u_seed + 84.0)) * 0.03) * u_branchScale;
                float twOff = 0.3 + hash21(vec2(twSeed, u_seed + 86.0)) * 0.5;
                vec2 twOrig = mix(curr, subEnd, twOff);
                vec2 twEnd = twOrig + vec2(cos(twAngle), sin(twAngle)) * twLen;

                float td = segDist(p, twOrig, twEnd);
                float twGrowthT = subGrowthT + 0.12;

                if (td < nearDist) {
                  nearDist = td;
                  nearGrowthT = min(twGrowthT, 0.95);
                  nearThick = baseThick * 0.2;
                }

                // Small flower at twig tip
                if (u_flowerOn > 0.5 && twProb > 0.6) {
                  float flSeed2 = twSeed + 700.0;
                  float flGrowthT2 = twGrowthT + 0.05;
                  float flGrowth2 = smoothstep(flGrowthT2, flGrowthT2 + 0.1, u_progress);

                  vec2 fl2 = flowerAt(p, twEnd, flSeed2);
                  fl2.x *= flGrowth2;
                  if (fl2.x > bestFlA) { bestFlA = fl2.x; bestFlVar = fl2.y; }

                  if (u_glowOn > 0.5) {
                    glowSum += glowAt(p, twEnd, flSeed2, flGrowthT2) * 0.7;
                  }
                }
              }
            }

            // Twig 1
            {
              float twSeed = subSeed * 10.0 + 1.0;
              float twProb = hash21(vec2(twSeed, u_seed + 80.0));
              if (twProb > 0.4) {
                float twAngle = atan(subDir.y, subDir.x);
                twAngle += (hash21(vec2(twSeed, u_seed + 82.0)) - 0.5) * 1.8;
                float twLen = (0.015 + hash21(vec2(twSeed, u_seed + 84.0)) * 0.03) * u_branchScale;
                float twOff = 0.3 + hash21(vec2(twSeed, u_seed + 86.0)) * 0.5;
                vec2 twOrig = mix(curr, subEnd, twOff);
                vec2 twEnd = twOrig + vec2(cos(twAngle), sin(twAngle)) * twLen;

                float td = segDist(p, twOrig, twEnd);
                float twGrowthT = subGrowthT + 0.12;

                if (td < nearDist) {
                  nearDist = td;
                  nearGrowthT = min(twGrowthT, 0.95);
                  nearThick = baseThick * 0.2;
                }

                if (u_flowerOn > 0.5 && twProb > 0.6) {
                  float flSeed2 = twSeed + 700.0;
                  float flGrowthT2 = twGrowthT + 0.05;
                  float flGrowth2 = smoothstep(flGrowthT2, flGrowthT2 + 0.1, u_progress);

                  vec2 fl2 = flowerAt(p, twEnd, flSeed2);
                  fl2.x *= flGrowth2;
                  if (fl2.x > bestFlA) { bestFlA = fl2.x; bestFlVar = fl2.y; }

                  if (u_glowOn > 0.5) {
                    glowSum += glowAt(p, twEnd, flSeed2, flGrowthT2) * 0.7;
                  }
                }
              }
            }
          }
        }
      }

      prev = curr;
    }
  }

  // ─── Compose layers ───

  // Branches
  if (u_branchOn > 0.5) {
    float growth = smoothstep(nearGrowthT - 0.03, nearGrowthT + 0.03, u_progress);
    float alpha = (1.0 - smoothstep(0.0, nearThick, nearDist)) * growth;
    vec3 bCol = u_branchColor * (0.8 + nearGrowthT * 0.4);
    col = mix(col, bCol, alpha);
  }

  // Flowers
  if (u_flowerOn > 0.5 && bestFlA > 0.01) {
    // Hue shift per flower for variety
    vec3 fCol = u_flowerColor * bestFlVar;
    col = mix(col, fCol, bestFlA);
  }

  // Glow (additive)
  if (u_glowOn > 0.5) {
    col += u_glowColor * min(glowSum, 2.5);
  }

  return col;
}

// ─────────────────────────────────────────────────
// Main — halftone dither overlay
// ─────────────────────────────────────────────────

void main() {
  vec2 uv = vUv;

  if (u_ditherOn > 0.5) {
    float dotPx = max(u_ditherSize, 2.0);
    vec2 cellSz = dotPx / u_resolution;
    vec2 cell = floor(uv / cellSz);
    vec2 center = (cell + 0.5) * cellSz;
    vec2 local = (uv - cell * cellSz) / cellSz - 0.5;

    vec3 scene = computeScene(center);
    float luma = dot(scene, vec3(0.299, 0.587, 0.114));

    float dotR = sqrt(max(luma, 0.0)) * 0.46;
    float d = length(local);
    float alpha = 1.0 - smoothstep(dotR - 0.04, dotR, d);

    gl_FragColor = vec4(mix(u_bgColor, scene, alpha), 1.0);
  } else {
    gl_FragColor = vec4(computeScene(uv), 1.0);
  }
}
