precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

uniform vec3 u_bgColor;
uniform float u_vignette;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;

uniform float u_auroraRank;
uniform float u_imageRank;
uniform float u_circleRank;
uniform float u_grainRank;

uniform float u_auroraOn;
uniform float u_auroraOpacity;
uniform vec3 u_auroraColor1;
uniform vec3 u_auroraColor2;
uniform vec3 u_auroraColor3;
uniform vec3 u_auroraColor4;
uniform float u_auroraWarpOn;
uniform float u_auroraWarpStrength;
uniform float u_auroraWarpScale;
uniform float u_auroraSeed;
uniform float u_auroraBlobOn;
uniform float u_auroraBlobSize;
uniform float u_auroraBlobSpacing;
uniform float u_auroraBlobRotation;
uniform float u_auroraBlobSpread;
uniform float u_auroraBlobOffsetX;
uniform float u_auroraBlobOffsetY;
uniform float u_auroraTileSpacing;
uniform float u_auroraZoom;
uniform float u_auroraX;
uniform float u_auroraY;
uniform float u_auroraBloom;
uniform float u_auroraPrism;
uniform float u_auroraSoftness;

uniform sampler2D u_imageTexture;
uniform float u_hasImage;
uniform vec2 u_imageSize;
uniform float u_imageOn;
uniform float u_imageOpacity;
uniform float u_imageScale;
uniform vec2 u_imageOffset;
uniform float u_imageFit;
uniform float u_imageSoftness;

uniform float u_circleOn;
uniform vec2 u_circlePos;
uniform float u_circleRadius;
uniform float u_circleEdge;
uniform float u_circleDensity;
uniform float u_circleParticleSize;
uniform float u_circleSpeed;
uniform float u_circleOpacity;
uniform float u_circleTrail;
uniform float u_circleTwinkle;
uniform vec3 u_circleColor;
uniform float u_circleGlow;
uniform float u_circleSoftness;

uniform float u_grainOn;
uniform float u_grainAmount;
uniform float u_grainSize;
uniform float u_grainSpeed;
uniform float u_grainVariation;
uniform float u_grainX;

const float TAU = 6.28318530718;

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
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float valNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec2 rot2d(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

vec3 screenBlend(vec3 base, vec3 blend, float opacity) {
  vec3 screened = 1.0 - (1.0 - base) * (1.0 - blend);
  return mix(base, screened, clamp(opacity, 0.0, 1.0));
}

vec2 fitImageUv(vec2 uv) {
  vec2 outUv = (uv - u_imageOffset - 0.5) / max(u_imageScale, 0.0001) + 0.5;
  float canvasAspect = u_resolution.x / u_resolution.y;
  float textureAspect = u_imageSize.x / max(u_imageSize.y, 1.0);

  if (u_imageFit < 0.5) {
    if (canvasAspect > textureAspect) {
      outUv.y = (outUv.y - 0.5) * (canvasAspect / textureAspect) + 0.5;
    } else {
      outUv.x = (outUv.x - 0.5) * (textureAspect / canvasAspect) + 0.5;
    }
  } else if (u_imageFit < 1.5) {
    if (canvasAspect > textureAspect) {
      outUv.x = (outUv.x - 0.5) * (canvasAspect / textureAspect) + 0.5;
    } else {
      outUv.y = (outUv.y - 0.5) * (textureAspect / canvasAspect) + 0.5;
    }
  }

  return outUv;
}

vec3 applyAurora(vec3 base, vec2 uv, vec2 st, float aspect, float t) {
  if (u_auroraOn < 0.5 || u_auroraOpacity <= 0.001) return base;

  vec2 pos = st;
  pos /= max(u_auroraZoom, 0.01);
  pos += vec2(u_auroraX, u_auroraY);

  if (u_auroraWarpOn > 0.5) {
    float animSeed = u_auroraSeed + t * 0.1;
    float d1 = snoise(vec3(pos * u_auroraWarpScale + 0.5, animSeed));
    float d2 = snoise(vec3(pos * u_auroraWarpScale + 5.3, animSeed + 1.7));
    pos += vec2(d1, d2) * u_auroraWarpStrength;
  }

  vec3 veil = vec3(0.0);
  if (u_auroraBlobOn > 0.5) {
    vec2 op = pos - vec2(u_auroraBlobOffsetX, u_auroraBlobOffsetY);
    float sp = max(u_auroraTileSpacing, 0.001);
    op = mod(op - sp, vec2(sp * 2.0)) - sp;
    op = rot2d(op, -u_auroraBlobRotation);
    op /= max(u_auroraBlobSize, 0.01);
    op *= vec2(1.0 / max(u_auroraBlobSpread, 0.01), 1.0);

    float cs = u_auroraBlobSpacing;
    veil = mix(u_auroraColor1, veil, smoothstep(0.0, 1.1, distance(op, vec2(0.0, cs * 1.45))));
    veil = mix(u_auroraColor2, veil, smoothstep(0.0, 1.05, distance(op, vec2(0.0, cs * 0.35))));
    veil = mix(u_auroraColor3, veil, smoothstep(0.0, 1.0, distance(op, vec2(0.0, -cs * 0.55))));
    veil = mix(u_auroraColor4, veil, smoothstep(0.0, 1.25, distance(op, vec2(0.0, -cs * 1.55))));
  }

  vec2 roseVec = st - vec2(aspect * 0.08, 0.92);
  roseVec.x *= 0.75;
  float roseMask = exp(-dot(roseVec, roseVec) * (2.2 + u_auroraSoftness * 1.6));

  vec2 violetVec = st - vec2(aspect * 0.42, 0.82);
  violetVec.x *= 0.7;
  float violetMask = exp(-dot(violetVec, violetVec) * (1.5 + u_auroraSoftness * 1.2));

  vec2 amberVec = st - vec2(aspect * 0.95, 0.88);
  amberVec.x *= 1.25;
  float amberMask = exp(-dot(amberVec, amberVec) * 8.5);

  float topBias = smoothstep(0.06, 0.64, uv.y);
  float veilMask = roseMask * 0.95 + violetMask * 0.82 + amberMask * 0.38;
  veil *= veilMask * topBias * u_auroraBloom;

  vec2 arcVec = st - vec2(aspect * 0.64, 0.42);
  arcVec.x *= 1.65;
  arcVec.y *= 6.0;
  float prismBand = exp(-abs(length(arcVec) - 0.28) * 22.0);
  vec3 prism = mix(vec3(0.08, 0.05, 0.03), vec3(0.05, 0.08, 0.07), uv.x);
  prism += vec3(
    0.02 * sin(uv.x * 12.0 + t * 0.08),
    0.0,
    0.02 * cos(uv.x * 9.0 - t * 0.06)
  );
  veil += prism * prismBand * u_auroraPrism;

  float luma = dot(veil, vec3(0.299, 0.587, 0.114));
  float alpha = clamp(luma * (1.2 + u_auroraSoftness) * u_auroraOpacity, 0.0, 1.0);
  return screenBlend(base, clamp(veil, 0.0, 1.0), alpha);
}

vec3 applyImage(vec3 base, vec2 uv) {
  if (u_imageOn < 0.5 || u_hasImage < 0.5 || u_imageOpacity <= 0.001) return base;

  vec2 tuv = fitImageUv(uv);
  if (tuv.x < 0.0 || tuv.x > 1.0 || tuv.y < 0.0 || tuv.y > 1.0) {
    return base;
  }

  vec4 tex = texture2D(u_imageTexture, tuv);
  float margin = min(min(tuv.x, 1.0 - tuv.x), min(tuv.y, 1.0 - tuv.y));
  float edgeMask = smoothstep(0.0, max(u_imageSoftness, 0.0001), margin);
  vec3 img = mix(vec3(dot(tex.rgb, vec3(0.299, 0.587, 0.114))), tex.rgb, 0.92);
  float alpha = tex.a * u_imageOpacity * edgeMask;
  return mix(base, img, alpha);
}

vec3 applyCircle(vec3 base, vec2 st, float aspect, float t) {
  if (u_circleOn < 0.5 || u_circleOpacity <= 0.001) return base;

  vec2 cPos = vec2(u_circlePos.x * aspect, u_circlePos.y);
  vec2 delta = st - cPos;
  float cDist = length(delta);
  float ringDist = cDist - u_circleRadius;

  float edgeW = max(0.0005, u_circleEdge * 0.08 * u_circleSoftness);
  float ringGlow = exp(-ringDist * ringDist / (edgeW * edgeW));
  float totalParticles = 0.0;

  float reach = edgeW * (3.0 + u_circleSoftness * 2.0) + u_circleParticleSize * 0.08;
  if (abs(ringDist) < reach && cDist > 0.001) {
    for (int layer = 0; layer < 3; layer++) {
      float fl = float(layer);
      float layerSeed = fl * 137.0;
      float layerBright = 1.0 - fl * 0.2;
      float layerScale = 1.0 - fl * 0.15;
      float maxCount = u_circleDensity * (18.0 + fl * 6.0);
      int N = int(min(ceil(maxCount), 48.0));
      float rotation = t * u_circleSpeed * 0.02 * (1.0 + fl * 0.08);

      for (int i = 0; i < 48; i++) {
        if (i >= N) break;
        float fi = float(i);
        float fadeIn = smoothstep(maxCount, maxCount - 1.0, fi);
        if (fadeIn < 0.001) continue;

        float seed = fi + layerSeed;
        float h0 = hash21(vec2(seed, 0.0));
        float h1 = hash21(vec2(seed, 1.0));
        float angle = h0 * TAU + rotation;
        float radJitter = (h1 - 0.5) * edgeW * 3.0;
        float pR = u_circleRadius + radJitter;
        float ca = cos(angle);
        float sa = sin(angle);
        vec2 pPos = cPos + pR * vec2(ca, sa);
        vec2 toP = st - pPos;
        float cutoff = u_circleParticleSize * 0.06 * (1.0 + u_circleTrail * 3.0);
        if (dot(toP, toP) > cutoff * cutoff) continue;

        float h2 = hash21(vec2(seed, 2.0));
        float h3 = hash21(vec2(seed, 3.0));
        vec2 tangent = vec2(-sa, ca);
        vec2 radial = vec2(ca, sa);
        float alongT = dot(toP, tangent);
        float perpR = dot(toP, radial);

        float sizeVar = (0.4 + h2 * 0.6) * layerScale;
        float streakLen = u_circleParticleSize * 0.015 * sizeVar * (0.5 + u_circleTrail * 4.0);
        float streakW = u_circleParticleSize * 0.0015 * sizeVar * (0.3 + (1.0 - u_circleTrail) * 1.5);

        float da = alongT / max(streakLen, 0.0001);
        float dr = perpR / max(streakW, 0.0001);
        float particle = exp(-(da * da + dr * dr) * 4.0);
        float phase = h3 * TAU + t * u_circleSpeed * 2.0;
        float twinkle = mix(1.0, 0.15 + 0.85 * max(0.0, sin(phase)), u_circleTwinkle);

        totalParticles += particle * twinkle * fadeIn * layerBright;
      }
    }
  }

  float glowMix = mix(0.05, 0.24, u_circleGlow);
  float particleMix = mix(0.45, 0.95, u_circleGlow);
  float circleMask = (ringGlow * glowMix + totalParticles * particleMix) * u_circleOpacity;
  return screenBlend(base, u_circleColor, circleMask);
}

vec3 applyGrain(vec3 base, vec2 uv) {
  if (u_grainOn < 0.5 || u_grainAmount <= 0.0001) return base;

  float grainT = floor(u_time * u_grainSpeed);
  vec2 gUV = (uv + vec2(u_grainX, 0.0)) * u_resolution;
  float cell = max(u_grainSize, 0.01);

  float g1 = valNoise(gUV / cell + grainT * 17.13);
  float g2 = hash31(vec3(floor(gUV / cell) * 1.37, grainT * 23.71));
  float coarseScale = cell * (2.0 + u_grainVariation * 5.0);
  float g3 = valNoise(gUV / coarseScale + grainT * 31.57 + 100.0);
  float g4 = hash31(vec3(floor(gUV / coarseScale).yx * 0.97, grainT * 41.23));

  float fineGrain = (g1 + g2) * 0.5 - 0.5;
  float coarseGrain = (g3 + g4) * 0.5 - 0.5;
  float grain = mix(fineGrain, coarseGrain, u_grainVariation * 0.5) * u_grainAmount;
  return clamp(base + grain, 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 st = vec2(uv.x * aspect, uv.y);
  float t = u_time;

  vec3 color = u_bgColor;

  vec2 leftGlow = st - vec2(aspect * 0.08, 0.94);
  leftGlow.x *= 0.82;
  float rose = exp(-dot(leftGlow, leftGlow) * 3.2);
  vec2 rightGlow = st - vec2(aspect * 0.95, 0.86);
  rightGlow.x *= 1.2;
  float amber = exp(-dot(rightGlow, rightGlow) * 8.0);
  color += vec3(0.08, 0.04, 0.07) * rose * 0.55;
  color += vec3(0.08, 0.05, 0.02) * amber * 0.32;

  for (int rank = 0; rank < 4; rank++) {
    float currentRank = float(rank);
    if (abs(u_auroraRank - currentRank) < 0.25) {
      color = applyAurora(color, uv, st, aspect, t);
    }
    if (abs(u_imageRank - currentRank) < 0.25) {
      color = applyImage(color, uv);
    }
    if (abs(u_circleRank - currentRank) < 0.25) {
      color = applyCircle(color, st, aspect, t);
    }
    if (abs(u_grainRank - currentRank) < 0.25) {
      color = applyGrain(color, uv);
    }
  }

  float dist = length((uv - 0.5) * vec2(aspect, 1.0));
  float vignetteMask = 1.0 - smoothstep(0.35, 0.92, dist);
  color *= mix(1.0, 0.35 + 0.65 * vignetteMask, u_vignette);

  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, u_saturation);
  color *= u_brightness;
  color = (color - 0.5) * u_contrast + 0.5;

  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
