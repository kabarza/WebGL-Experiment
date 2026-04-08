precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

// Wave Gradient
uniform float u_noiseScale;
uniform float u_noiseSpeed;
uniform float u_noiseOctaves;
uniform float u_warpStrength;
uniform float u_warpScale;
uniform float u_warpSpeed;
uniform float u_waveIntensity;
uniform vec3 u_col1;
uniform vec3 u_col2;
uniform vec3 u_col3;
uniform float u_blendWidth;
uniform float u_colorShift;

// Particle Circle
uniform vec2 u_circlePos;
uniform float u_circleRadius;
uniform float u_circleEdge;
uniform float u_circleDensity;
uniform float u_circleParticleSize;
uniform float u_circleSpeed;
uniform float u_circleOpacity;
uniform float u_circleTrail;
uniform float u_circleTwinkle;

// Lens Flares
uniform float u_flareIntensity;
uniform float u_flareSpread;
uniform float u_flareLength;
uniform float u_flareRainbow;
uniform float u_flareCount;
uniform float u_flareSpeed;
uniform float u_flareAngle;

// Film Grain
uniform float u_grainAmount;
uniform float u_grainSize;
uniform float u_grainSpeed;
uniform float u_grainVariation;

// Post Processing
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform vec3 u_bgColor;

// Layer toggles
uniform float u_waveOn;
uniform float u_circleOn;
uniform float u_flareOn;
uniform float u_grainOn;

// Hash functions
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

void main() {
  vec2 uv = vUv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 st = vec2(uv.x * aspect, uv.y);
  float t = u_time;
  const float TAU = 6.28318530718;

  // ============ LAYER 1: Wave Gradient ============
  // Sine-wave superposition — organic blobby shapes, no noise texture lookups.
  vec3 color = u_bgColor;
  if (u_waveOn > 0.5) {
    vec2 p = st * u_noiseScale;
    float wt = t * u_warpSpeed;

    // Three layers of sine-based displacement → interference creates organic blobs
    vec2 w1 = vec2(
      sin(p.y * 2.1 * u_warpScale + wt * 0.7),
      cos(p.x * 1.8 * u_warpScale + wt * 0.6 + 1.0)
    );
    vec2 w2 = vec2(
      sin((p.x + p.y) * 3.3 * u_warpScale + wt * 0.5 + 3.0),
      cos((p.x - p.y) * 2.7 * u_warpScale + wt * 0.4 + 5.0)
    ) * 0.5;
    vec2 w3 = vec2(
      cos(p.x * 4.5 * u_warpScale + p.y * 1.3 + wt * 0.35 + 7.0),
      sin(p.y * 3.9 * u_warpScale + p.x * 0.9 + wt * 0.3 + 9.0)
    ) * 0.25;

    vec2 wP = p + u_warpStrength * (w1 + w2 + w3);

    // Two gradient signals for three-color blending
    float timeShift = u_colorShift * t * 0.012;
    float n1 = sin(wP.x * u_blendWidth + wP.y * 0.7 + timeShift) * 0.5 + 0.5;
    float n2 = sin(wP.y * u_blendWidth * 0.9 + wP.x * 0.5 + timeShift * 0.8 + 1.5708) * 0.5 + 0.5;

    vec3 waveColor = mix(u_col1, u_col2, n1);
    waveColor = mix(waveColor, u_col3, n2 * 0.4);
    color = mix(u_bgColor, waveColor, u_waveIntensity);
  }

  // ============ LAYER 2: Particle Circle ============
  // Orbit-slot system: each particle is an individual entity at a specific
  // position on the ring. For each pixel we find the nearest angular slots
  // and check ~5 candidates. mod(slot, N) wraps seamlessly (N is integer),
  // so the atan ±π discontinuity never produces a visible seam.
  if (u_circleOn > 0.5) {
    vec2 cPos = vec2(u_circlePos.x * aspect, u_circlePos.y);
    vec2 delta = st - cPos;
    float cDist = length(delta);
    float ringDist = cDist - u_circleRadius;

    float edgeW = u_circleEdge * 0.08;
    float ringGlow = exp(-ringDist * ringDist / (edgeW * edgeW));
    float edgeMask = exp(-ringDist * ringDist / (edgeW * edgeW * 6.0));

    float totalParticles = 0.0;

    // Skip expensive particle work for pixels far from the ring
    if (edgeMask > 0.001 && cDist > 0.001) {
      float pixelAngle = atan(delta.y, delta.x);
      float normAngle = pixelAngle / TAU + 0.5; // 0..1

      for (int layer = 0; layer < 3; layer++) {
        float fi = float(layer);
        // Integer count guarantees seamless angular wrap
        float N = floor(u_circleDensity * (30.0 + fi * 15.0) + 0.5);
        N = max(N, 1.0);

        // Each layer orbits at a slightly different rate
        float rotation = t * u_circleSpeed * 0.02 * (1.0 + fi * 0.08);

        // Pixel's angular slot in the rotated frame
        float shiftedAngle = fract(normAngle - rotation);
        float slotF = shiftedAngle * N;
        float slotBase = floor(slotF);

        // Check nearby orbit slots
        for (int j = -2; j <= 2; j++) {
          float s = slotBase + float(j);
          float slot = mod(s, N); // seamless wrap — no seam possible
          float seed = slot + fi * 173.7;

          // Hash-derived properties
          float h  = hash21(vec2(seed, 0.0));
          float h2 = hash21(vec2(seed, 1.0));
          float h3 = hash21(vec2(seed, 2.0));

          // Sparser in higher layers
          float exists = step(0.45 + fi * 0.08, h);

          // Angular jitter within the slot
          float angJitter = (h2 - 0.5) * 0.65;

          // Arc-length distance: pixel vs particle
          float angSep = slotF - (s + 0.5 + angJitter);
          float arcDist = (angSep / N) * TAU * u_circleRadius;

          // Radial offset from ring centre-line
          float radJitter = (h3 - 0.5) * edgeW * 3.0;
          float radDist = ringDist - radJitter;

          // Streak shape controlled by circleTrail
          float sizeVar = 0.4 + h * 0.6;
          float streakLen = u_circleParticleSize * 0.015 * sizeVar
                          * (0.5 + u_circleTrail * 4.0);
          float streakW   = u_circleParticleSize * 0.0015 * sizeVar
                          * (0.3 + (1.0 - u_circleTrail) * 1.5);

          // Elliptical distance (tangent × radial)
          float da = arcDist / max(streakLen, 0.0001);
          float dr = radDist / max(streakW,  0.0001);
          float d2 = da * da + dr * dr;

          // Soft Gaussian falloff
          float particle = exists * exp(-d2 * 4.0);

          // Twinkle / pulse
          float phase = hash21(vec2(seed, 3.0)) * TAU + t * u_circleSpeed * 2.0;
          float twinkle = mix(1.0, 0.15 + 0.85 * max(0.0, sin(phase)), u_circleTwinkle);

          totalParticles += particle * twinkle;
        }
      }
    }

    float circleMask = (ringGlow * 0.12 + totalParticles * edgeMask * 0.7) * u_circleOpacity;
    color += vec3(0.85, 0.82, 0.8) * circleMask;
  }

  // ============ LAYER 3: Lens Flares ============
  if (u_flareOn > 0.5) {
    vec3 flareAccum = vec3(0.0);
    int numFlares = int(u_flareCount);

    for (int i = 0; i < 8; i++) {
      if (i >= numFlares) break;
      float fi = float(i);
      float seed = fi * 7.13 + 3.7;

      vec2 flarePos = vec2(
        hash21(vec2(seed, 1.0)) * aspect,
        hash21(vec2(seed, 2.0))
      );

      flarePos += vec2(
        sin(t * u_flareSpeed * 0.08 + fi * 2.3) * 0.03,
        cos(t * u_flareSpeed * 0.1 + fi * 1.9) * 0.02
      );

      float flareAng = u_flareAngle + hash21(vec2(seed, 3.0)) * 3.14159;
      float flareLen = (0.2 + hash21(vec2(seed, 4.0)) * 0.4) * u_flareLength;

      vec2 dir = vec2(cos(flareAng), sin(flareAng));
      vec2 perp = vec2(-dir.y, dir.x);
      vec2 delta = st - flarePos;
      float along = dot(delta, dir);
      float perpDist = dot(delta, perp);

      float w = u_flareSpread * (0.003 + fi * 0.001);

      float chrOffset = u_flareRainbow * w * 3.0;
      vec3 chrFlare;
      chrFlare.r = exp(-(perpDist - chrOffset) * (perpDist - chrOffset) / (w * w));
      chrFlare.g = exp(-perpDist * perpDist / (w * w));
      chrFlare.b = exp(-(perpDist + chrOffset) * (perpDist + chrOffset) / (w * w));

      float lenFade = smoothstep(flareLen, flareLen * 0.1, abs(along));
      chrFlare *= lenFade;

      float glowDist = length(delta);
      float glow = exp(-glowDist * glowDist / (0.015 + fi * 0.003));
      vec3 warmGlow = vec3(1.0, 0.7, 0.3) * glow * 0.15;

      float shimmer = 0.7 + 0.3 * sin(t * u_flareSpeed * 0.4 + fi * 4.3);

      float intensity = u_flareIntensity * (0.4 + hash21(vec2(seed, 5.0)) * 0.6) * shimmer;
      flareAccum += (chrFlare + warmGlow) * intensity;
    }

    color += flareAccum;
  }

  // ============ LAYER 4: Film Grain ============
  if (u_grainOn > 0.5) {
    float grainT = floor(u_time * u_grainSpeed);
    vec2 gUV = vUv * u_resolution;

    float g1 = hash21(floor(gUV / u_grainSize) + grainT * 17.13);
    float g2 = hash31(vec3(floor(gUV / u_grainSize) * 1.37, grainT * 23.71));

    float coarseScale = u_grainSize * (2.0 + u_grainVariation * 5.0);
    float g3 = hash21(floor(gUV / coarseScale) + grainT * 31.57 + 100.0);
    float g4 = hash31(vec3(floor(gUV / coarseScale).yx * 0.97, grainT * 41.23));

    float fineGrain = (g1 + g2) * 0.5 - 0.5;
    float coarseGrain = (g3 + g4) * 0.5 - 0.5;
    float grain = mix(fineGrain, coarseGrain, u_grainVariation * 0.4) * u_grainAmount;
    color += grain;
  }

  // ============ Post Processing ============
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, u_saturation);
  color *= u_brightness;
  color = (color - 0.5) * u_contrast + 0.5;

  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
