precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform vec4 u_layerOrder;

uniform vec3 u_bgColor;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_lift;

// Aurora Drift layer
uniform float u_auroraOn;
uniform float u_auroraOpacity;
uniform float u_auroraX;
uniform float u_auroraZ;
uniform vec3 u_auroraColor1;
uniform vec3 u_auroraColor2;
uniform vec3 u_auroraColor3;
uniform vec3 u_auroraColor4;
uniform float u_warpOn;
uniform float u_warpStrength;
uniform float u_warpScale;
uniform float u_seed;
uniform float u_blobOn;
uniform float u_blobSize;
uniform float u_blobSpacing;
uniform float u_blobRotation;
uniform float u_blobSpread;
uniform float u_blobOffsetX;
uniform float u_blobOffsetY;
uniform float u_tileSpacing;
uniform float u_auroraZoom;
uniform float u_auroraOffsetY;
uniform float u_auroraStripeAmount;
uniform float u_auroraStripeDensity;
uniform float u_auroraTopGlow;
uniform float u_auroraDarkness;

// Image layer
uniform float u_imageOn;
uniform float u_imageOpacity;
uniform float u_imageX;
uniform float u_imageZ;
uniform float u_imageScale;
uniform float u_imageFit;
uniform float u_imageSaturation;
uniform vec3 u_imageTint;
uniform float u_hasImage;
uniform sampler2D u_imageTexture;
uniform vec2 u_textureSize;

// Celestial circle layer
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
uniform float u_circleLayerX;
uniform float u_circleLayerZ;
uniform vec3 u_circleColor;
uniform float u_circleBloom;
uniform float u_circleJitter;

// Grain layer
uniform float u_grainOn;
uniform float u_grainAmount;
uniform float u_grainSize;
uniform float u_grainSpeed;
uniform float u_grainVariation;
uniform float u_grainX;
uniform float u_grainZ;
uniform vec3 u_grainTint;

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
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

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
  float c = cos(a);
  float s = sin(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

vec2 applyLayerTransform(vec2 uv, float xOffset, float zDepth) {
  float depth = clamp(zDepth, -2.0, 2.0);
  float scale = max(0.2, 1.0 + depth * 0.18);
  vec2 p = (uv - 0.5) / scale + 0.5;
  p.x += xOffset;
  p += (u_mouse - 0.5) * depth * 0.12;
  return p;
}

vec3 blendScreen(vec3 base, vec3 src, float alpha) {
  vec3 screened = 1.0 - (1.0 - base) * (1.0 - src);
  return mix(base, screened, clamp(alpha, 0.0, 1.0));
}

vec2 fitImageUv(vec2 uv, float fitMode) {
  float texAspect = u_textureSize.x / max(u_textureSize.y, 1.0);
  float viewAspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 outUv = uv;

  // 0 = cover, 1 = contain, 2 = fill
  if (fitMode < 0.5) {
    if (viewAspect > texAspect) {
      outUv.y = (uv.y - 0.5) * (viewAspect / max(texAspect, 0.0001)) + 0.5;
    } else {
      outUv.x = (uv.x - 0.5) * (texAspect / max(viewAspect, 0.0001)) + 0.5;
    }
  } else if (fitMode < 1.5) {
    if (viewAspect > texAspect) {
      outUv.x = (uv.x - 0.5) * (texAspect / max(viewAspect, 0.0001)) + 0.5;
    } else {
      outUv.y = (uv.y - 0.5) * (viewAspect / max(texAspect, 0.0001)) + 0.5;
    }
  }

  return outUv;
}

vec4 getAuroraLayer(vec2 uv, float t) {
  if (u_auroraOn < 0.5) return vec4(0.0);

  float aspect = u_resolution.x / u_resolution.y;
  vec2 layerUv = applyLayerTransform(uv, u_auroraX, u_auroraZ);
  vec2 pos = layerUv * 2.0 - 1.0;
  pos.x *= min(1.0, aspect);
  pos.y *= min(1.0, 1.0 / aspect);
  pos /= max(u_auroraZoom, 0.01);
  pos += vec2(0.0, u_auroraOffsetY);

  float animSeed = u_seed + t * 0.1;

  if (u_warpOn > 0.5) {
    float d1 = snoise(vec3(pos * u_warpScale + 0.5, animSeed));
    float d2 = snoise(vec3(pos * u_warpScale + 5.3, animSeed + 1.7));
    pos += vec2(d1, d2) * u_warpStrength;
  }

  vec3 col = vec3(0.0);

  if (u_blobOn > 0.5) {
    vec2 op = pos - vec2(u_blobOffsetX, u_blobOffsetY);
    float sp = u_tileSpacing;
    op = mod(op - sp, vec2(sp * 2.0)) - sp;
    op = rot2d(op, -u_blobRotation);
    op /= max(u_blobSize, 0.01);
    op *= vec2(1.0 / max(u_blobSpread, 0.01), 1.0);

    float cs = u_blobSpacing;
    col = mix(u_auroraColor1, col, smoothstep(0.0, 1.0, distance(op, vec2(0.0, cs * 1.5))));
    col = mix(u_auroraColor2, col, smoothstep(0.0, 1.0, distance(op, vec2(0.0, cs * 0.5))));
    col = mix(u_auroraColor3, col, smoothstep(0.0, 1.0, distance(op, vec2(0.0, -cs * 0.5))));
    col = mix(u_auroraColor4, col, smoothstep(0.0, 1.0, distance(op, vec2(0.0, -cs * 1.5))));
  }

  float stripeNoise = snoise(vec3(pos * 0.45 + vec2(7.1, 2.3), t * 0.02));
  float stripes = sin((pos.x + stripeNoise * 0.45) * u_auroraStripeDensity);
  stripes = pow(max(stripes * 0.5 + 0.5, 0.0), 3.0);
  vec3 stripeColor = mix(u_auroraColor2, u_auroraColor4, 0.35);
  col += stripeColor * stripes * u_auroraStripeAmount * 0.28;

  float topMask = smoothstep(0.15, 1.0, layerUv.y);
  vec3 topBlend = mix(u_auroraColor1, u_auroraColor2, clamp(layerUv.x * 0.9, 0.0, 1.0));
  col += topBlend * topMask * u_auroraTopGlow * 0.2;

  float warmEdge = exp(-pow(layerUv.x * 3.2, 2.0)) * smoothstep(0.1, 1.0, layerUv.y);
  col += u_auroraColor4 * warmEdge * u_auroraTopGlow * 0.18;

  float vignette = 1.0 - smoothstep(0.05, 1.45, length((layerUv - 0.5) * vec2(aspect, 1.0)));
  col *= vignette;
  col *= 1.0 - clamp(u_auroraDarkness, 0.0, 1.0) * 0.35;

  return vec4(max(col, vec3(0.0)), clamp(u_auroraOpacity, 0.0, 1.0));
}

vec4 getImageLayer(vec2 uv) {
  if (u_imageOn < 0.5 || u_hasImage < 0.5) return vec4(0.0);

  vec2 imgUv = applyLayerTransform(uv, u_imageX, u_imageZ);
  imgUv = (imgUv - 0.5) / max(u_imageScale, 0.01) + 0.5;
  imgUv = fitImageUv(imgUv, u_imageFit);

  if (imgUv.x < 0.0 || imgUv.x > 1.0 || imgUv.y < 0.0 || imgUv.y > 1.0) {
    return vec4(0.0);
  }

  vec3 imageColor = texture2D(u_imageTexture, imgUv).rgb;
  float luma = dot(imageColor, vec3(0.299, 0.587, 0.114));
  imageColor = mix(vec3(luma), imageColor, u_imageSaturation);
  imageColor *= u_imageTint;

  return vec4(imageColor, clamp(u_imageOpacity, 0.0, 1.0));
}

vec4 getCircleLayer(vec2 uv, float t) {
  if (u_circleOn < 0.5) return vec4(0.0);

  const float TAU = 6.28318530718;
  float aspect = u_resolution.x / u_resolution.y;

  vec2 layerUv = applyLayerTransform(uv, u_circleLayerX, u_circleLayerZ);
  vec2 st = vec2(layerUv.x * aspect, layerUv.y);
  vec2 cPos = vec2(u_circlePos.x * aspect, u_circlePos.y);
  vec2 delta = st - cPos;
  float cDist = length(delta);
  float ringDist = cDist - u_circleRadius;

  float edgeW = max(0.0005, u_circleEdge * 0.08);
  float ringGlow = exp(-ringDist * ringDist / (edgeW * edgeW));
  float totalParticles = 0.0;

  float reach = edgeW * 3.0 + u_circleParticleSize * 0.08;
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

        float radJitter = (h1 - 0.5) * edgeW * 3.0 * u_circleJitter;
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

  float circleMask = (ringGlow * 0.12 * u_circleBloom + totalParticles * 0.7) * u_circleOpacity;
  vec3 circleCol = u_circleColor * circleMask;
  return vec4(circleCol, clamp(circleMask, 0.0, 1.0));
}

vec4 getGrainLayer(vec2 uv, float t) {
  if (u_grainOn < 0.5) return vec4(0.0);

  vec2 grainUv = applyLayerTransform(uv, u_grainX, u_grainZ) * u_resolution;
  float grainT = floor(t * u_grainSpeed);
  float baseScale = max(u_grainSize, 0.001);

  float g1 = hash21(floor(grainUv / baseScale) + grainT * 17.13);
  float g2 = hash31(vec3(floor(grainUv / baseScale) * 1.37, grainT * 23.71));

  float coarseScale = baseScale * (2.0 + u_grainVariation * 5.0);
  float g3 = hash21(floor(grainUv / coarseScale) + grainT * 31.57 + 100.0);
  float g4 = hash31(vec3(floor(grainUv / coarseScale).yx * 0.97, grainT * 41.23));

  float fineGrain = (g1 + g2) * 0.5 - 0.5;
  float coarseGrain = (g3 + g4) * 0.5 - 0.5;
  float grain = mix(fineGrain, coarseGrain, u_grainVariation * 0.45) * u_grainAmount;
  vec3 grainCol = u_grainTint * grain;
  return vec4(grainCol, 1.0);
}

float layerIdAtIndex(int index) {
  if (index == 0) return u_layerOrder.x;
  if (index == 1) return u_layerOrder.y;
  if (index == 2) return u_layerOrder.z;
  return u_layerOrder.w;
}

void main() {
  vec3 color = u_bgColor;
  float t = u_time;

  vec4 auroraLayer = getAuroraLayer(vUv, t);
  vec4 imageLayer = getImageLayer(vUv);
  vec4 circleLayer = getCircleLayer(vUv, t);
  vec4 grainLayer = getGrainLayer(vUv, t);

  for (int i = 0; i < 4; i++) {
    float id = layerIdAtIndex(i);

    if (id < 0.5) {
      color = blendScreen(color, auroraLayer.rgb, auroraLayer.a);
    } else if (id < 1.5) {
      color = mix(color, imageLayer.rgb, imageLayer.a);
    } else if (id < 2.5) {
      color = blendScreen(color, circleLayer.rgb, circleLayer.a);
    } else {
      color += grainLayer.rgb;
    }
  }

  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, u_saturation);
  color = (color + vec3(u_lift)) * u_brightness;
  color = (color - 0.5) * u_contrast + 0.5;

  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
