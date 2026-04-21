precision highp float;

varying vec2 vUv;

uniform float u_time;
uniform vec2 u_resolution;
uniform sampler2D u_text;

// Aurora palette
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;
uniform vec3 u_color4;

// Aurora controls
uniform float u_bgScale;
uniform float u_drift;
uniform float u_waveAmount;

// Text effect controls
uniform float u_effectMode;   // 0=clean 1=dither 2=scanline 3=ghost 4=pixelate 5=glitch
uniform float u_effectMix;
uniform float u_ditherCell;
uniform float u_chromatic;
uniform float u_textDistortion;
uniform float u_glow;
uniform float u_pixelSize;
uniform float u_glitchIntensity;

// Surface
uniform float u_grainAmount;
uniform float u_vignette;

// ── Simplex 3D noise ──────────────────────────────────
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

  vec4 norm = taylorInvSqrt(vec4(
    dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)
  ));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(
    dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)
  ), 0.0);
  m *= m;
  return 42.0 * dot(m * m, vec4(
    dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)
  ));
}

// ── Hash ──────────────────────────────────────────────
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// ── Bayer dither ──────────────────────────────────────
float b2(float x, float y) {
  return 2.0 * x + y * (3.0 - 4.0 * x);
}

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

// ── Sample text mask ──────────────────────────────────
float sampleMask(vec2 uv) {
  vec4 src = texture2D(u_text, clamp(uv, 0.0, 1.0));
  return max(src.a, dot(src.rgb, vec3(0.299, 0.587, 0.114)));
}

// ── Aurora background ─────────────────────────────────
vec3 buildAurora(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  p.x *= aspect;

  float t = u_time * (0.15 + u_drift * 0.4);
  vec2 flow = p * (1.0 + u_bgScale * 0.5);
  vec2 warp = vec2(
    snoise(vec3(flow * 0.7 + vec2(0.0, 2.0), t * 0.5)),
    snoise(vec3(flow.yx * 0.72 + vec2(5.0, -3.0), t * 0.4 + 4.0))
  );
  flow += warp * (0.18 + u_waveAmount * 0.4);

  float ribbonA = sin(flow.y * 3.8 + t + snoise(vec3(flow * 1.1, t * 0.28)) * 1.8);
  float ribbonB = sin(flow.x * 2.5 - t * 0.7 + snoise(vec3(flow * 0.85 - 2.0, t * 0.22)) * 1.4);
  float mist = 0.5 + 0.5 * snoise(vec3(flow * 1.2 + vec2(2.0, -1.0), t * 0.2));

  float bandA = smoothstep(-0.7, 0.95, ribbonA + mist * 0.55);
  float bandB = smoothstep(-0.85, 0.85, ribbonB + mist * 0.4);

  vec3 base = mix(u_color1, u_color2, clamp(uv.y * 1.1, 0.0, 1.0));
  vec3 wash = mix(u_color3, u_color4, clamp(uv.x * 0.8 + mist * 0.2, 0.0, 1.0));
  vec3 col = mix(base, wash, bandA * 0.5 + bandB * 0.35);

  float haloA = exp(-length(p - vec2(-0.4, 0.2)) * 2.2);
  float haloB = exp(-length(p + vec2(0.3, 0.1)) * 3.0);
  col += mix(u_color3, u_color4, 0.4 + 0.3 * sin(t * 0.6)) * haloA * 0.2;
  col += mix(u_color2, u_color3, 0.3 + 0.3 * cos(t * 0.4)) * haloB * 0.16;

  col *= 0.72 + mist * 0.3;
  return clamp(col, 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;
  vec2 px = uv * u_resolution;

  // Background aurora
  vec3 background = buildAurora(uv);

  // Text distortion drift
  float timePulse = u_time * 0.8;
  vec2 drift = vec2(
    sin(uv.y * 12.0 + timePulse * 1.4),
    cos(uv.x * 9.0 - timePulse * 1.1)
  ) * u_textDistortion * 0.005;

  // Chromatic aberration offsets
  vec2 chroma = vec2(u_chromatic * 0.0015, 0.0);
  float baseMask = sampleMask(uv + drift);
  float maskR = sampleMask(uv + drift + chroma);
  float maskG = baseMask;
  float maskB = sampleMask(uv + drift - chroma);

  // Effect mode: dither
  if (u_effectMode > 0.5 && u_effectMode < 1.5) {
    float threshold = bayer8(px / max(u_ditherCell, 1.0));
    float soft = 0.12;
    maskR = smoothstep(threshold - soft, threshold + soft, maskR);
    maskG = smoothstep(threshold - soft, threshold + soft, maskG);
    maskB = smoothstep(threshold - soft, threshold + soft, maskB);
  }
  // Effect mode: scanline
  else if (u_effectMode >= 1.5 && u_effectMode < 2.5) {
    float scan = 0.78 + 0.22 * sin(uv.y * u_resolution.y * 0.42 + u_time * 28.0);
    float wobble = 0.92 + 0.08 * sin(uv.x * 24.0 + u_time * 5.0);
    maskR *= scan * wobble;
    maskG *= scan;
    maskB *= scan * (1.0 / wobble);
  }
  // Effect mode: ghost
  else if (u_effectMode >= 2.5 && u_effectMode < 3.5) {
    float ghostA = sampleMask(uv + drift + vec2(0.012, -0.004) * u_effectMix);
    float ghostB = sampleMask(uv + drift - vec2(0.015, 0.006) * u_effectMix);
    maskR = max(maskR, ghostA * 0.82);
    maskG = max(maskG, baseMask * 0.95);
    maskB = max(maskB, ghostB * 0.78);
  }
  // Effect mode: pixelate
  else if (u_effectMode >= 3.5 && u_effectMode < 4.5) {
    float cell = max(u_pixelSize, 2.0);
    vec2 blockUv = (floor(px / cell) * cell + cell * 0.5) / u_resolution;
    float blockMask = sampleMask(blockUv + drift);
    maskR = blockMask;
    maskG = blockMask;
    maskB = blockMask;
    // Add subtle chromatic on pixelated blocks
    maskR = sampleMask(blockUv + drift + chroma * 0.5);
    maskB = sampleMask(blockUv + drift - chroma * 0.5);
  }
  // Effect mode: glitch
  else if (u_effectMode >= 4.5) {
    float glitchTime = floor(u_time * 8.0);
    float row = floor(uv.y * 20.0);
    float rowHash = hash21(vec2(row, glitchTime));
    float sliceActive = step(1.0 - u_glitchIntensity * 0.3, rowHash);
    float sliceOffset = (hash21(vec2(row + 0.5, glitchTime)) - 0.5) * u_glitchIntensity * 0.06;
    vec2 glitchUv = uv + drift + vec2(sliceOffset * sliceActive, 0.0);
    maskR = sampleMask(glitchUv + chroma);
    maskG = sampleMask(glitchUv);
    maskB = sampleMask(glitchUv - chroma);
    // Occasional full-frame jitter
    float frameGlitch = step(0.92, hash21(vec2(glitchTime, 0.7)));
    float jitter = (hash21(vec2(glitchTime, 1.3)) - 0.5) * 0.015 * frameGlitch * u_glitchIntensity;
    maskR = max(maskR, sampleMask(uv + drift + vec2(jitter, 0.0)));
  }

  // Text fill gradient
  vec3 textFill = mix(
    mix(u_color3, vec3(1.0), 0.2),
    mix(u_color4, u_color3, 0.55 + 0.15 * sin(u_time + uv.y * 8.0)),
    clamp(0.25 + uv.y * 0.65 + sin(uv.x * 7.0 + u_time * 0.6) * 0.08, 0.0, 1.0)
  );

  // Glow halo around text
  float glowMask = smoothstep(0.02, 0.92, baseMask);
  float glow = pow(glowMask, 1.3) * (0.2 + u_glow * 0.4);
  vec3 color = background + textFill * glow;

  // Composite text channels
  float mixAmt = clamp(u_effectMix, 0.0, 1.0);
  vec3 textChannels = mix(vec3(baseMask), vec3(maskR, maskG, maskB), mixAmt);
  color.r = mix(color.r, textFill.r, clamp(textChannels.r, 0.0, 1.0));
  color.g = mix(color.g, textFill.g, clamp(textChannels.g, 0.0, 1.0));
  color.b = mix(color.b, textFill.b, clamp(textChannels.b, 0.0, 1.0));

  // Vignette
  float vignette = 1.0 - length((uv - 0.5) * vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0));
  vignette = smoothstep(-0.15, 0.9, vignette);
  color *= mix(1.0, vignette, u_vignette);

  // Grain
  float grain = hash21(px + floor(u_time * 30.0)) - 0.5;
  color += grain * u_grainAmount;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
