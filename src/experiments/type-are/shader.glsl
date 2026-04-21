precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;
uniform sampler2D u_scene;

// Dither
uniform float u_ditherMode;    // 0 halftone, 1 ordered, 2 noise, 3 crosshatch, 4 scanline
uniform float u_cellSize;
uniform float u_softness;
uniform float u_gridAngle;
uniform float u_gamma;
uniform float u_invert;

// Palette
uniform vec3 u_bgColor;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_colorMix;

// Wave
uniform float u_waveOn;
uniform float u_waveAmplitude;
uniform float u_waveFrequency;

// Animation
uniform float u_animOn;
uniform float u_animSpeed;
uniform float u_animIntensity;

// Effects
uniform float u_chromaticOn;
uniform float u_chromaticOffset;
uniform float u_vignetteOn;
uniform float u_vignetteStrength;
uniform float u_vignetteSize;
uniform float u_grainOn;
uniform float u_grainAmount;

// Post
uniform float u_brightness;
uniform float u_contrast;

// ─── Hash ───────────────────────────────────────────
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// ─── Bayer 2x2 base value ───────────────────────────
float b2(float x, float y) {
  return 2.0 * x + y * (3.0 - 4.0 * x);
}

// ─── Bayer 8x8 threshold (recursive from 2x2) ──────
float bayer8(vec2 p) {
  vec2 c = mod(floor(p), 8.0);
  float lx = mod(c.x, 2.0);
  float ly = mod(c.y, 2.0);
  float mx = mod(floor(c.x * 0.5), 2.0);
  float my = mod(floor(c.y * 0.5), 2.0);
  float hx = floor(c.x * 0.25);
  float hy = floor(c.y * 0.25);
  return (16.0 * b2(lx, ly) + 4.0 * b2(mx, my) + b2(hx, hy) + 0.5) / 64.0;
}

// ─── Dither: Halftone dots ──────────────────────────
float ditherHalftone(vec2 px, float luma) {
  float sp = max(u_cellSize, 2.0);
  float ang = u_gridAngle * 0.017453293;
  float ca = cos(ang), sa = sin(ang);
  mat2 rot = mat2(ca, -sa, sa, ca);

  vec2 anim = vec2(0.0);
  if (u_animOn > 0.5) {
    float t = u_time * u_animSpeed;
    anim = vec2(sin(t * 0.7), cos(t * 0.9)) * u_animIntensity * sp * 0.5;
  }

  vec2 rp = rot * (px + anim);
  vec2 cf = fract(rp / sp) - 0.5;
  float d = length(cf);
  float r = pow(luma, u_gamma) * 0.46;
  float soft = u_softness * 0.05;
  return 1.0 - smoothstep(r - soft, r + soft + 0.005, d);
}

// ─── Dither: Ordered (Bayer 8x8) ────────────────────
float ditherOrdered(vec2 px, float luma) {
  float sp = max(u_cellSize, 2.0);
  float ang = u_gridAngle * 0.017453293;
  float ca = cos(ang), sa = sin(ang);
  mat2 rot = mat2(ca, -sa, sa, ca);

  vec2 anim = vec2(0.0);
  if (u_animOn > 0.5) {
    anim = vec2(floor(u_time * u_animSpeed * 2.0)) * u_animIntensity * sp;
  }

  vec2 rp = rot * (px + anim);
  float threshold = bayer8(rp / sp);
  float g = pow(luma, u_gamma);
  float soft = u_softness * 0.15;
  return smoothstep(threshold - soft, threshold + soft, g);
}

// ─── Dither: Noise ──────────────────────────────────
float ditherNoise(vec2 px, float luma) {
  float sp = max(u_cellSize, 2.0);
  vec2 p = floor(px / sp);
  float t = u_animOn > 0.5 ? floor(u_time * u_animSpeed * 10.0) : 0.0;
  float threshold = hash21(p + t * 17.13);
  float g = pow(luma, u_gamma);
  float soft = u_softness * 0.15;
  return smoothstep(threshold - soft, threshold + soft, g);
}

// ─── Dither: Crosshatch ─────────────────────────────
float ditherCrosshatch(vec2 px, float luma) {
  float sp = max(u_cellSize * 1.5, 3.0);
  float ang = u_gridAngle * 0.017453293;
  float g = pow(luma, u_gamma);

  vec2 anim = vec2(0.0);
  if (u_animOn > 0.5) {
    float t = u_time * u_animSpeed;
    anim = vec2(sin(t * 0.5), cos(t * 0.7)) * u_animIntensity * sp;
  }
  vec2 p = px + anim;

  float lineW = 0.35;
  float soft = u_softness * 0.15 + 0.02;
  float v = 0.0;

  // Layer 1: 45deg diagonal
  float d1 = abs(fract((p.x * cos(ang + 0.785) + p.y * sin(ang + 0.785)) / sp) - 0.5) * 2.0;
  v = max(v, step(0.1, g) * (1.0 - smoothstep(lineW - soft, lineW + soft, d1)));

  // Layer 2: -45deg diagonal
  float d2 = abs(fract((p.x * cos(ang - 0.785) + p.y * sin(ang - 0.785)) / sp) - 0.5) * 2.0;
  v = max(v, step(0.3, g) * (1.0 - smoothstep(lineW - soft, lineW + soft, d2)));

  // Layer 3: near-horizontal
  float d3 = abs(fract((p.x * sin(ang) + p.y * cos(ang)) / sp) - 0.5) * 2.0;
  v = max(v, step(0.55, g) * (1.0 - smoothstep(lineW * 0.7 - soft, lineW * 0.7 + soft, d3)));

  // Layer 4: near-vertical
  float d4 = abs(fract((p.x * cos(ang) - p.y * sin(ang)) / sp) - 0.5) * 2.0;
  v = max(v, step(0.75, g) * (1.0 - smoothstep(lineW * 0.5 - soft, lineW * 0.5 + soft, d4)));

  return v;
}

// ─── Dither: Scanline ───────────────────────────────
float ditherScanline(vec2 px, float luma) {
  float sp = max(u_cellSize, 2.0);
  float ang = u_gridAngle * 0.017453293;
  float ca = cos(ang), sa = sin(ang);

  vec2 anim = vec2(0.0);
  if (u_animOn > 0.5) {
    float t = u_time * u_animSpeed;
    anim.y = sin(t) * u_animIntensity * sp;
  }

  vec2 p = px + anim;
  float projected = p.x * sa + p.y * ca;
  float line = abs(fract(projected / sp) - 0.5) * 2.0;
  float width = pow(luma, u_gamma) * 0.9;
  float soft = u_softness * 0.1 + 0.02;
  return 1.0 - smoothstep(width - soft, width + soft, line);
}

// ─────────────────────────────────────────────────────
void main() {
  vec2 uv = vUv;
  vec2 px = uv * u_resolution;

  // ═══════════════ WAVE DISTORTION ═══════════════
  vec2 ditherPx = px;
  if (u_waveOn > 0.5) {
    float t = u_time * u_animSpeed;
    ditherPx += vec2(
      sin(uv.y * u_waveFrequency * 6.28318 + t) * u_waveAmplitude,
      cos(uv.x * u_waveFrequency * 6.28318 + t * 0.7) * u_waveAmplitude * 0.5
    );
  }

  // ═══════════════ SOURCE SAMPLING ═══════════════
  float luma = dot(texture2D(u_scene, uv).rgb, vec3(0.299, 0.587, 0.114));

  // Optional chromatic split
  float lumaR = luma, lumaG = luma, lumaB = luma;
  if (u_chromaticOn > 0.5) {
    vec2 chrDir = vec2(u_chromaticOffset * 0.003, 0.0);
    lumaR = dot(texture2D(u_scene, uv + chrDir).rgb, vec3(0.299, 0.587, 0.114));
    lumaB = dot(texture2D(u_scene, uv - chrDir).rgb, vec3(0.299, 0.587, 0.114));
  }

  // ═══════════════ DITHERING ═════════════════════
  float dR, dG, dB;

  if (u_ditherMode < 0.5) {
    dR = ditherHalftone(ditherPx, lumaR);
    dG = ditherHalftone(ditherPx, lumaG);
    dB = ditherHalftone(ditherPx, lumaB);
  } else if (u_ditherMode < 1.5) {
    dR = ditherOrdered(ditherPx, lumaR);
    dG = ditherOrdered(ditherPx, lumaG);
    dB = ditherOrdered(ditherPx, lumaB);
  } else if (u_ditherMode < 2.5) {
    dR = ditherNoise(ditherPx, lumaR);
    dG = ditherNoise(ditherPx, lumaG);
    dB = ditherNoise(ditherPx, lumaB);
  } else if (u_ditherMode < 3.5) {
    dR = ditherCrosshatch(ditherPx, lumaR);
    dG = ditherCrosshatch(ditherPx, lumaG);
    dB = ditherCrosshatch(ditherPx, lumaB);
  } else {
    dR = ditherScanline(ditherPx, lumaR);
    dG = ditherScanline(ditherPx, lumaG);
    dB = ditherScanline(ditherPx, lumaB);
  }

  // ═══════════════ INVERT ════════════════════════
  if (u_invert > 0.5) {
    dR = 1.0 - dR;
    dG = 1.0 - dG;
    dB = 1.0 - dB;
  }

  // ═══════════════ COLOUR ════════════════════════
  float pt = clamp(luma * u_colorMix, 0.0, 1.0);
  vec3 glyphColor = mix(u_color1, u_color2, pt);

  vec3 color;
  color.r = mix(u_bgColor.r, glyphColor.r, dR);
  color.g = mix(u_bgColor.g, glyphColor.g, dG);
  color.b = mix(u_bgColor.b, glyphColor.b, dB);

  // ═══════════════ VIGNETTE ══════════════════════
  if (u_vignetteOn > 0.5) {
    float aspect = u_resolution.x / u_resolution.y;
    float vd = length((vUv - 0.5) * vec2(aspect, 1.0));
    float vig = smoothstep(u_vignetteSize, u_vignetteSize * 0.3, vd);
    color *= mix(1.0, vig, u_vignetteStrength);
  }

  // ═══════════════ GRAIN ═════════════════════════
  if (u_grainOn > 0.5) {
    float grainT = floor(u_time * 30.0);
    float g = hash21(floor(vUv * u_resolution * 0.5) + grainT * 17.13) - 0.5;
    color += g * u_grainAmount;
  }

  // ═══════════════ POST ══════════════════════════
  color *= u_brightness;
  color = (color - 0.5) * u_contrast + 0.5;
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
