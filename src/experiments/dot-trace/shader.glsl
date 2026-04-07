precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

// Source texture
uniform sampler2D u_texture;
uniform float u_hasTexture;
uniform vec2 u_textureSize;
uniform float u_fitMode; // 0 = fill, 1 = contain, 2 = cover

// Layer toggles
uniform float u_dotsOn;

// Reveal / Playback
uniform float u_progress;
uniform float u_revealMode;
uniform float u_revealOriginX;
uniform float u_revealOriginY;
uniform float u_revealSpread;
uniform float u_revealReverse;

// Dither
uniform float u_dotSize;
uniform float u_dotSpacing;
uniform float u_dotSoftness;
uniform float u_gridAngle;
uniform float u_luminanceGamma;

// Colors
uniform vec3 u_bgColor;
uniform vec3 u_accent1;
uniform vec3 u_accent2;
uniform vec3 u_neutral;
uniform float u_colorThreshold;
uniform float u_colorMix;

// Post
uniform float u_brightness;
uniform float u_contrast;
uniform float u_postSaturation;

// ─── Hash ───────────────────────────────────────────
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// ─── RGB → HSL ──────────────────────────────────────
vec3 rgb2hsl(vec3 c) {
  float cMax = max(c.r, max(c.g, c.b));
  float cMin = min(c.r, min(c.g, c.b));
  float d = cMax - cMin;
  float l = (cMax + cMin) * 0.5;
  if (d < 0.001) return vec3(0.0, 0.0, l);
  float s = d / (1.0 - abs(2.0 * l - 1.0));
  float h;
  if (cMax == c.r)      h = mod((c.g - c.b) / d, 6.0);
  else if (cMax == c.g) h = (c.b - c.r) / d + 2.0;
  else                  h = (c.r - c.g) / d + 4.0;
  return vec3(h / 6.0, s, l);
}

// ─── Texture UV — fit modes ─────────────────────────
// 0 = Fill    — stretch to fill canvas, ignore aspect ratio
// 1 = Contain — fit inside canvas, preserve aspect (letterbox)
// 2 = Cover   — fill canvas, preserve aspect (crop excess)
vec2 fitUV(vec2 uv) {
  int mode = int(u_fitMode + 0.5);
  if (mode == 0) return uv; // Fill: 1:1 UV mapping

  float ca = u_resolution.x / u_resolution.y;
  float ta = u_textureSize.x / u_textureSize.y;
  vec2 o = uv;

  if (mode == 1) {
    // Contain — scale down to fit, letterboxing the excess
    if (ca > ta) o.x = (uv.x - 0.5) * (ca / ta) + 0.5;
    else         o.y = (uv.y - 0.5) * (ta / ca) + 0.5;
  } else {
    // Cover — scale up to fill, cropping the excess
    if (ca > ta) o.y = (uv.y - 0.5) * (ca / ta) + 0.5;
    else         o.x = (uv.x - 0.5) * (ta / ca) + 0.5;
  }

  return o;
}

// ─── Sample source colour ───────────────────────────
vec3 sampleSource(vec2 uv) {
  if (u_hasTexture > 0.5) {
    vec2 tuv = fitUV(uv);
    if (tuv.x < 0.0 || tuv.x > 1.0 || tuv.y < 0.0 || tuv.y > 1.0)
      return u_bgColor;
    return texture2D(u_texture, tuv).rgb;
  }

  // Procedural demo — cherry blossom branches
  vec2 p = uv * 5.0;
  float branch = sin(p.x * 2.0 + p.y * 0.5) * cos(p.y * 1.5) * 0.5 + 0.5;
  branch = smoothstep(0.42, 0.55, branch) * (1.0 - smoothstep(0.55, 0.63, branch));

  float flower = 0.0;
  for (int i = 0; i < 7; i++) {
    vec2 center = vec2(
      hash21(vec2(float(i) * 1.7, 3.2)) * 0.8 + 0.1,
      hash21(vec2(float(i) * 2.3, 7.1)) * 0.8 + 0.1
    );
    float r = length(uv - center);
    flower = max(flower, smoothstep(0.07, 0.02, r));
  }

  vec3 col = vec3(0.04);
  col += vec3(0.25, 0.22, 0.28) * branch;
  col += vec3(0.45, 0.15, 0.65) * flower;
  return col;
}

// ─── Reveal order — maps UV to a 0→1 reveal value ──
float revealOrder(vec2 uv, vec2 cell) {
  int mode = int(u_revealMode + 0.5);
  vec2 origin = vec2(u_revealOriginX, u_revealOriginY);
  float order = 0.0;

  if (mode == 0) {
    // Radial — distance from origin
    order = length(uv - origin) / length(vec2(1.0));
  } else if (mode == 1) {
    // Sweep right
    order = uv.x;
  } else if (mode == 2) {
    // Sweep down
    order = 1.0 - uv.y;
  } else if (mode == 3) {
    // Random / noise-based
    order = hash21(cell * 137.0 + 42.0);
  } else if (mode == 4) {
    // Spiral
    vec2 d = uv - origin;
    float angle = atan(d.y, d.x) / 6.28318 + 0.5;
    float dist = length(d) * 2.0;
    order = fract(angle + dist * 3.0);
  }

  if (u_revealReverse > 0.5) order = 1.0 - order;
  return clamp(order, 0.0, 1.0);
}

// ─────────────────────────────────────────────────────
void main() {
  vec2 uv = vUv;
  vec2 px = uv * u_resolution;

  vec3 color = u_bgColor;

  // ════════════════════ DOTS ════════════════════
  if (u_dotsOn > 0.5) {
    float sp = u_dotSpacing;

    // Grid rotation
    float ang = u_gridAngle * 0.017453293;
    float ca = cos(ang), sa = sin(ang);
    mat2 rot  = mat2(ca, -sa, sa, ca);
    mat2 irot = mat2(ca,  sa, -sa, ca);

    // Pixel → rotated grid
    vec2 rp   = rot * px;
    vec2 cell = floor(rp / sp);
    vec2 cf   = fract(rp / sp);

    // Map cell centre back to canvas UV
    vec2 cellCenterPx = irot * ((cell + 0.5) * sp);
    vec2 cellUV = cellCenterPx / u_resolution;

    // Sample source at cell centre
    vec3 src    = sampleSource(cellUV);
    vec3 srcHSL = rgb2hsl(src);
    float cellLuma = dot(src, vec3(0.299, 0.587, 0.114));
    float cellSat  = srcHSL.y;

    // ── Reveal mask ──
    float order = revealOrder(cellUV, cell);
    float spread = max(u_revealSpread, 0.001);
    float reveal = smoothstep(order - spread, order + spread, u_progress);

    // Only draw revealed dots
    if (reveal > 0.001) {
      // Dot size from luminance (gamma-curved)
      float lum = pow(cellLuma, u_luminanceGamma);
      float radius = lum * u_dotSize * 0.5;

      // Pop-in scale
      radius *= smoothstep(0.0, 0.3, reveal);

      // Distance from cell centre (circle)
      float d = length(cf - 0.5);

      // Soft-edged dot mask
      float soft = u_dotSoftness * 0.05;
      float dotMask = 1.0 - smoothstep(radius - soft, radius + soft + 0.005, d);

      // ── Colour mapping ──
      vec3 dotColor;
      if (cellSat > u_colorThreshold) {
        float hue = srcHSL.x;
        dotColor = mix(u_accent1, u_accent2, clamp(hue * u_colorMix * 2.0, 0.0, 1.0));
        dotColor = mix(dotColor, src, 0.12);
      } else {
        dotColor = u_neutral * (0.3 + cellLuma * 0.7);
      }

      color = mix(color, dotColor, dotMask * reveal);
    }
  }

  // ════════════════════ POST ═════════════════════
  float pl = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(pl), color, u_postSaturation);
  color *= u_brightness;
  color = (color - 0.5) * u_contrast + 0.5;
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
