precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

uniform float u_baseOn;
uniform float u_auroraOn;
uniform float u_ringOn;
uniform float u_flareOn;
uniform float u_grainOn;

uniform vec3 u_bgColor;
uniform vec3 u_purpleColor;
uniform vec3 u_orangeColor;
uniform vec2 u_baseCenter;
uniform float u_baseRadius;
uniform float u_baseSoftness;
uniform float u_purpleStrength;
uniform float u_orangeStrength;
uniform float u_emberWidth;

uniform vec3 u_auroraColorA;
uniform vec3 u_auroraColorB;
uniform float u_auroraScale;
uniform float u_auroraSpeed;
uniform float u_auroraFlow;
uniform float u_auroraIntensity;
uniform float u_auroraThreshold;
uniform float u_auroraSoftness;

uniform vec2 u_ringCenter;
uniform float u_ringRadius;
uniform float u_ringThickness;
uniform float u_ringDensity;
uniform float u_ringSize;
uniform float u_ringSpin;
uniform float u_ringBlink;
uniform float u_ringOpacity;

uniform float u_flareIntensity;
uniform float u_flareSpread;
uniform float u_flareSmear;
uniform float u_flareChromatic;
uniform float u_flareAngle;
uniform float u_flareDrift;
uniform float u_flareGhostOpacity;

uniform float u_grainAmount;
uniform float u_grainSize;
uniform float u_grainSpeed;

uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 rotate2d(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 basis = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = basis * p + 0.17;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = vUv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 st = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float t = u_time;
  vec3 color = u_bgColor;

  if (u_baseOn > 0.5) {
    vec2 darkCenter = vec2((u_baseCenter.x - 0.5) * aspect, u_baseCenter.y - 0.5);
    vec2 voidDelta = (st - darkCenter) / vec2(
      max(0.2, u_baseRadius * 0.96),
      max(0.2, u_baseRadius * 0.74)
    );
    float centerVoid = 1.0 - smoothstep(0.0, 1.0 + u_baseSoftness, length(voidDelta));

    vec2 tlDelta = (st - vec2(-0.72 * aspect, -0.56)) / vec2(1.18, 0.96);
    float topLeftBloom = exp(-dot(tlDelta, tlDelta) * 1.85);
    float topWash = exp(-pow((uv.y - 0.0) / 0.22, 2.0)) * exp(-pow((uv.x - 0.18) / 0.5, 2.0));
    float purpleMask = topLeftBloom * 0.82 + topWash * 0.4;

    vec2 rightDelta = (st - vec2(0.82 * aspect, -0.04)) / vec2(0.54, 1.12);
    float rightGlow = exp(-dot(rightDelta, rightDelta) * 1.9);
    vec2 leftDelta = (st - vec2(-0.88 * aspect, 0.08)) / vec2(0.42, 1.2);
    float leftGlow = exp(-dot(leftDelta, leftDelta) * 2.1);
    float emberMask = rightGlow * 0.92 + leftGlow * 0.55;

    color += u_purpleColor * purpleMask * u_purpleStrength;
    color += u_orangeColor * emberMask * u_orangeStrength;
    color = mix(color, u_bgColor, centerVoid * 0.88);
  }

  if (u_auroraOn > 0.5) {
    vec2 flowUv = rotate2d(st - vec2(-0.14 * aspect, -0.18), -0.48) * u_auroraScale;
    float warp = (fbm(vec2(flowUv.y * 1.4, t * u_auroraSpeed + 1.9)) - 0.5) * u_auroraFlow;
    flowUv.x += warp;

    float ribbonA = fbm(vec2(flowUv.x * 0.42, flowUv.y * 2.8 - t * u_auroraSpeed));
    float ribbonB = fbm(vec2(flowUv.x * 1.6 + 3.7, flowUv.y * 6.2 - t * u_auroraSpeed * 0.55));
    float ribbon = smoothstep(
      u_auroraThreshold - u_auroraSoftness,
      u_auroraThreshold + u_auroraSoftness,
      ribbonA * 0.84 + ribbonB * 0.16
    );

    float mask = exp(-pow((uv.x - 0.24) / 0.16, 2.0)) * exp(-pow((uv.y - 0.22) / 0.3, 2.0));
    mask += exp(-pow((uv.x - 0.31) / 0.22, 2.0)) * exp(-pow((uv.y - 0.42) / 0.48, 2.0)) * 0.35;

    vec3 auroraColor = mix(u_auroraColorA, u_auroraColorB, clamp(ribbonB * 0.35, 0.0, 1.0));
    color += auroraColor * ribbon * mask * u_auroraIntensity;
  }

  if (u_ringOn > 0.5) {
    vec2 ringCenter = vec2((u_ringCenter.x - 0.5) * aspect, u_ringCenter.y - 0.5);
    vec2 ringDelta = st - ringCenter;
    float ringGap = abs(length(ringDelta) - u_ringRadius);
    float zone = 1.0 - smoothstep(u_ringThickness * 8.0, u_ringThickness * 18.0, ringGap);

    if (zone > 0.001) {
      float halo = exp(-pow(ringGap / max(u_ringThickness * 2.1, 0.0001), 2.0));
      float outerHalo = exp(-pow(ringGap / max(u_ringThickness * 5.8, 0.0001), 2.0));
      float particles = 0.0;
      float countF = mix(20.0, 72.0, clamp(u_ringDensity, 0.0, 1.0));
      int count = int(min(72.0, ceil(countF)));
      float spin = t * u_ringSpin * 0.18;

      for (int i = 0; i < 72; i++) {
        if (i >= count) break;

        float fi = float(i);
        float seed = fi * 19.73 + 0.17;
        float angle = hash21(vec2(seed, 1.3)) * 6.28318530718
                    + spin * (0.8 + hash21(vec2(seed, 2.1)) * 0.4);
        float jitter = (hash21(vec2(seed, 3.7)) - 0.5) * u_ringThickness * 4.0;
        vec2 particlePos = ringCenter + vec2(cos(angle), sin(angle)) * (u_ringRadius + jitter);
        vec2 particleDelta = st - particlePos;
        float particleSize = (0.0025 + 0.01 * u_ringSize)
          * mix(0.8, 1.4, hash21(vec2(seed, 4.9)));
        float pulse = 0.35 + 0.65 * smoothstep(
          0.2,
          1.0,
          sin(t * (0.6 + u_ringBlink * 2.4) + seed) * 0.5 + 0.5
        );
        float blink = mix(1.0, pulse, u_ringBlink);
        particles += exp(-dot(particleDelta, particleDelta) / max(particleSize * particleSize, 0.00001)) * blink;
      }

      float ringMask = (halo * 0.34 + outerHalo * 0.16 + particles * 0.42) * u_ringOpacity * zone;
      color += vec3(0.76, 0.77, 0.8) * ringMask;
    }
  }

  if (u_flareOn > 0.5) {
    vec3 flareAccum = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float seed = fi * 11.71 + 2.0;
      vec2 origin = vec2(
        mix(-0.12, 0.95, hash21(vec2(seed, 0.1))),
        mix(0.06, 0.92, hash21(vec2(seed, 0.2)))
      );
      origin += vec2(
        sin(t * u_flareDrift * 0.25 + fi * 1.7),
        cos(t * u_flareDrift * 0.18 + fi * 2.3)
      ) * 0.04 * u_flareDrift;

      vec2 originPos = vec2((origin.x - 0.5) * aspect, origin.y - 0.5);
      float flareAngle = u_flareAngle + (hash21(vec2(seed, 0.3)) - 0.5) * 1.6;
      vec2 dir = vec2(cos(flareAngle), sin(flareAngle));
      vec2 perp = vec2(-dir.y, dir.x);
      vec2 flareDelta = st - originPos;
      float along = dot(flareDelta, dir);
      float across = dot(flareDelta, perp);

      float width = (0.015 + 0.024 * hash21(vec2(seed, 0.4))) * u_flareSpread;
      float lengthScale = (0.22 + 0.32 * hash21(vec2(seed, 0.5))) * u_flareSmear;
      float body = exp(-(across * across) / max(width * width, 0.0001));
      body *= exp(-(along * along) / max(lengthScale * lengthScale, 0.0001));
      body *= mix(0.35, 1.0, smoothstep(-lengthScale * 0.2, lengthScale * 0.9, along));

      float chroma = u_flareChromatic * width * 3.0;
      vec3 spectral;
      spectral.r = exp(-pow(across - chroma, 2.0) / max(width * width * 2.0, 0.0001));
      spectral.g = exp(-pow(across, 2.0) / max(width * width * 1.5, 0.0001));
      spectral.b = exp(-pow(across + chroma, 2.0) / max(width * width * 2.0, 0.0001));
      spectral *= exp(-(along * along) / max(lengthScale * lengthScale * 1.4, 0.0001));

      float haze = exp(-dot(flareDelta, flareDelta) / max(lengthScale * lengthScale * 2.6, 0.0001));
      float weight = 0.28 + 0.72 * hash21(vec2(seed, 0.6));
      vec3 ghost = mix(vec3(1.0, 0.55, 0.2), spectral, 0.82);

      flareAccum += ghost * body * weight;
      flareAccum += vec3(1.0, 0.56, 0.25) * haze * u_flareGhostOpacity * 0.22 * weight;
    }

    color += flareAccum * u_flareIntensity;
  }

  if (u_grainOn > 0.5) {
    float frame = floor(t * u_grainSpeed);
    vec2 grainCell = floor((vUv * u_resolution) / max(u_grainSize, 0.5));
    float g1 = hash21(grainCell + frame * 0.17);
    float g2 = hash21(grainCell * 1.37 + frame * 1.93 + 19.1);
    float grain = ((g1 + g2) * 0.5 - 0.5) * u_grainAmount;
    color += grain;
  }

  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, u_saturation);
  color *= u_brightness;
  color = (color - 0.5) * u_contrast + 0.5;
  color = pow(max(color, 0.0), vec3(0.95));
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
