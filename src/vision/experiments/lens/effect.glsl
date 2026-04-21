precision highp float;

uniform sampler2D uVideoTexture;
uniform float uViewportAspect;
uniform float uVideoAspect;
uniform float uMirror;

uniform vec2 uLensCenter;
uniform float uLensRadius;
uniform float uLensActive;
uniform float uLensPulse;
uniform float uTime;

uniform int uShape;
uniform float uDistortion;
uniform float uChromaticAberration;
uniform float uNoiseWarp;
uniform float uNoiseScale;
uniform float uNoiseSpeed;
uniform float uRimWidth;
uniform vec3 uRimColor;
uniform float uRimIntensity;
uniform vec3 uInnerTint;
uniform float uInnerTintMix;

varying vec2 vUv;

// Cover-fit + mirror: map viewport-space NDC (-1..1) to video texture UV.
vec2 videoUV(vec2 ndc) {
  float sx = 1.0;
  float sy = 1.0;
  if (uViewportAspect > uVideoAspect) {
    sy = uVideoAspect / uViewportAspect;
  } else {
    sx = uViewportAspect / uVideoAspect;
  }
  vec2 uv = ndc * 0.5 * vec2(sx, sy) + 0.5;
  if (uMirror > 0.5) uv.x = 1.0 - uv.x;
  return uv;
}

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i),                 f - vec2(0.0, 0.0)),
        dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float sdLens(vec2 p, float r) {
  if (uShape == 0) {
    return length(p) - r;
  }
  if (uShape == 1) {
    vec2 q = abs(p);
    return max(q.x * 0.866 + q.y * 0.5, q.y) - r;
  }
  if (uShape == 2) {
    return abs(p.x) + abs(p.y) - r;
  }
  if (uShape == 3) {
    vec2 q = abs(p) / max(r, 1e-4);
    return (pow(pow(q.x, 4.0) + pow(q.y, 4.0), 0.25) - 1.0) * r;
  }
  // Star
  float a = atan(p.y, p.x);
  return length(p) - r * (1.0 + 0.22 * cos(5.0 * a));
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;

  // Aspect-corrected offset so the SDF produces a shape round in pixels.
  vec2 p = vec2((ndc.x - uLensCenter.x) * uViewportAspect, ndc.y - uLensCenter.y);

  float pulse = uLensPulse;
  // Subtle size bump on clap pulse — previously 0.25 pushed the lens past the hands.
  float radius = max(uLensRadius * (1.0 + pulse * 0.08), 0.02);
  float d = sdLens(p, radius);

  float alpha = 1.0 - smoothstep(0.0, uRimWidth, d);
  float rimGlow = smoothstep(uRimWidth * 1.3, 0.0, abs(d)) * uRimIntensity;

  if (alpha < 0.002 && rimGlow < 0.002) discard;

  float inside = 1.0 - smoothstep(-uRimWidth * 0.5, uRimWidth * 0.4, d);

  // Barrel distortion — push pixels outward near rim (fisheye) or inward (depending on sign).
  vec2 toCenter = ndc - uLensCenter;
  float dist = length(toCenter);
  float norm = clamp(dist / max(radius, 0.02), 0.0, 1.0);
  float distortionFactor = 1.0 + uDistortion * pow(1.0 - norm, 2.0);
  vec2 warpedNDC = uLensCenter + toCenter * distortionFactor;

  // Organic noise warp (only inside lens)
  vec2 noiseSample = p * uNoiseScale + vec2(uTime * uNoiseSpeed, -uTime * uNoiseSpeed * 0.7);
  vec2 warp = vec2(noise2(noiseSample), noise2(noiseSample + vec2(11.3, 7.1))) * uNoiseWarp * inside;
  warpedNDC += warp;

  // Chromatic aberration — sample R/G/B at slightly different offsets along the radial axis.
  vec2 toCenterWarp = warpedNDC - uLensCenter;
  float aberr = uChromaticAberration * inside * (1.0 + pulse);
  vec3 col;
  col.r = texture2D(uVideoTexture, videoUV(warpedNDC + toCenterWarp * aberr)).r;
  col.g = texture2D(uVideoTexture, videoUV(warpedNDC)).g;
  col.b = texture2D(uVideoTexture, videoUV(warpedNDC - toCenterWarp * aberr)).b;

  // Inner tint
  col = mix(col, col * uInnerTint * 1.15, uInnerTintMix * inside);

  // Rim glow (additive, boosted briefly on clap pulse)
  col += uRimColor * rimGlow * (1.0 + pulse * 1.4);

  float finalAlpha = max(alpha, rimGlow * 0.85) * uLensActive;
  col *= uLensActive;

  gl_FragColor = vec4(col, finalAlpha);
}
