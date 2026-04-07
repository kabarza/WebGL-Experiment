precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

// Source
uniform sampler2D u_texture;
uniform float u_hasTexture;
uniform vec2 u_textureSize;
uniform float u_fitMode;       // 0 cover, 1 contain, 2 fill

// Mouse
uniform vec2 u_mouse;
uniform float u_mouseOver;
uniform float u_mouseOn;
uniform float u_mouseRadius;
uniform float u_mouseOpacity;
uniform float u_mouseSizeBoost;
uniform float u_mouseBrightBoost;
uniform float u_mouseSatBoost;
uniform float u_mouseColorShift;
uniform float u_mouseReveal;

// Layer toggles
uniform float u_ditherOn;
uniform float u_edgeOn;
uniform float u_animOn;
uniform float u_chromaticOn;
uniform float u_vignetteOn;
uniform float u_grainOn;

// Dither
uniform float u_glyphSize;
uniform float u_glyphSpacing;
uniform float u_glyphSoftness;
uniform float u_gridAngle;
uniform float u_luminanceGamma;
uniform float u_glyphShape;    // 0 circle, 1 diamond, 2 cross, 3 line
uniform float u_invert;

// Palette
uniform vec3 u_bgColor;
uniform vec3 u_accent1;
uniform vec3 u_accent2;
uniform vec3 u_accent3;
uniform vec3 u_neutral;
uniform float u_colorThreshold;
uniform float u_colorMix;
uniform float u_glyphHueJitter;
uniform float u_glyphBrightJitter;

// Edges
uniform float u_edgeThreshold;
uniform float u_edgeWidth;
uniform vec3 u_edgeColor;
uniform float u_edgeOpacity;

// Chromatic
uniform float u_chromaticOffset;

// Vignette
uniform float u_vignetteStrength;
uniform float u_vignetteSize;

// Grain
uniform float u_grainAmount;
uniform float u_grainSpeed;

// Animation
uniform float u_animSpeed;
uniform float u_animJitter;
uniform float u_animPulse;

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

// ─── Hue rotation (Rodrigues around luma axis) ──────
vec3 rotateHue(vec3 c, float angle) {
  float cs = cos(angle), sn = sin(angle);
  vec3 w = vec3(0.299, 0.587, 0.114);
  return vec3(
    dot(c, vec3(cs + (1.0-cs)*w.r,        (1.0-cs)*w.r*w.g - sn*w.b, (1.0-cs)*w.r*w.b + sn*w.g)),
    dot(c, vec3((1.0-cs)*w.r*w.g + sn*w.b, cs + (1.0-cs)*w.g,        (1.0-cs)*w.g*w.b - sn*w.r)),
    dot(c, vec3((1.0-cs)*w.r*w.b - sn*w.g, (1.0-cs)*w.g*w.b + sn*w.r, cs + (1.0-cs)*w.b))
  );
}

// ─── Fit UV (cover / contain / fill) ────────────────
vec2 fitUV(vec2 uv) {
  float ca = u_resolution.x / u_resolution.y;
  float ta = u_textureSize.x / u_textureSize.y;
  vec2 o = uv;
  if (u_fitMode < 0.5) {
    if (ca > ta) o.y = (uv.y - 0.5) * (ca / ta) + 0.5;
    else         o.x = (uv.x - 0.5) * (ta / ca) + 0.5;
  } else if (u_fitMode < 1.5) {
    if (ca > ta) o.x = (uv.x - 0.5) * (ca / ta) + 0.5;
    else         o.y = (uv.y - 0.5) * (ta / ca) + 0.5;
  }
  return o;
}

// ─── Sample source ──────────────────────────────────
vec3 sampleSource(vec2 uv) {
  if (u_hasTexture > 0.5) {
    vec2 tuv = fitUV(uv);
    if (tuv.x < 0.0 || tuv.x > 1.0 || tuv.y < 0.0 || tuv.y > 1.0)
      return u_bgColor;
    return texture2D(u_texture, tuv).rgb;
  }

  // Procedural demo
  float t = u_time * 0.25;
  vec2 p = uv * 4.0;
  float v = sin(p.x * 1.7 + t) * cos(p.y * 1.3 - t * 0.6)
          + sin(p.x * 0.6 + p.y * 2.1 + t * 0.4) * 0.7
          + sin((p.x + p.y) * 3.0 + t * 0.3) * 0.3;
  v = v * 0.25 + 0.5;
  float flower = smoothstep(0.62, 0.78, v);
  float branch = smoothstep(0.40, 0.52, v) * (1.0 - smoothstep(0.55, 0.62, v));
  return vec3(0.12) * branch + vec3(0.55, 0.15, 0.70) * flower + vec3(0.03);
}

// ─── Glyph distance for shape variants ──────────────
float glyphDist(vec2 p) {
  if (u_glyphShape < 0.5) return length(p);                    // circle
  if (u_glyphShape < 1.5) return abs(p.x) + abs(p.y);          // diamond
  if (u_glyphShape < 2.5) return min(abs(p.x), abs(p.y));      // cross
  return abs(p.y);                                               // line
}

// ─── Sobel edge detection ───────────────────────────
float sobelEdge(vec2 uv) {
  vec2 ts = u_edgeWidth / u_resolution;
  float tl = dot(sampleSource(uv + vec2(-ts.x,  ts.y)), vec3(0.299, 0.587, 0.114));
  float tc = dot(sampleSource(uv + vec2( 0.0,   ts.y)), vec3(0.299, 0.587, 0.114));
  float tr = dot(sampleSource(uv + vec2( ts.x,  ts.y)), vec3(0.299, 0.587, 0.114));
  float ml = dot(sampleSource(uv + vec2(-ts.x,  0.0 )), vec3(0.299, 0.587, 0.114));
  float mr = dot(sampleSource(uv + vec2( ts.x,  0.0 )), vec3(0.299, 0.587, 0.114));
  float bl = dot(sampleSource(uv + vec2(-ts.x, -ts.y)), vec3(0.299, 0.587, 0.114));
  float bc = dot(sampleSource(uv + vec2( 0.0,  -ts.y)), vec3(0.299, 0.587, 0.114));
  float br = dot(sampleSource(uv + vec2( ts.x, -ts.y)), vec3(0.299, 0.587, 0.114));
  float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
  float gy = -tl - 2.0*tc - tr + bl + 2.0*bc + br;
  return sqrt(gx*gx + gy*gy);
}

// ─────────────────────────────────────────────────────
void main() {
  vec2 uv = vUv;
  vec2 px = uv * u_resolution;

  // ═══════════════════ DITHER ═══════════════════
  vec3 color = u_bgColor;

  if (u_ditherOn > 0.5) {
    float sp = u_glyphSpacing;

    // Animated grid offset
    vec2 anim = vec2(0.0);
    if (u_animOn > 0.5) {
      float t = u_time * u_animSpeed;
      anim = vec2(sin(t * 0.7), cos(t * 0.9)) * u_animJitter * sp * 0.3;
    }

    // Grid rotation
    float ang = u_gridAngle * 0.017453293;
    float cosA = cos(ang), sinA = sin(ang);
    mat2 rot  = mat2(cosA, -sinA, sinA, cosA);
    mat2 irot = mat2(cosA,  sinA, -sinA, cosA);

    vec2 rp   = rot * (px + anim);
    vec2 cell = floor(rp / sp);
    vec2 cf   = fract(rp / sp);

    // Cell centre → canvas UV
    vec2 cellCenterPx = irot * ((cell + 0.5) * sp) - anim;
    vec2 cellUV = cellCenterPx / u_resolution;

    // ── Mouse proximity ──────────────────────────
    float proximity = 0.0;
    if (u_mouseOn > 0.5 && u_mouseOver > 0.5) {
      float md = length(cellUV - u_mouse);
      proximity = smoothstep(u_mouseRadius, 0.0, md) * u_mouseOpacity;
    }

    // ── Source sampling (with optional chromatic split) ──
    vec3 srcCenter = sampleSource(cellUV);
    float lumR, lumG, lumB;

    if (u_chromaticOn > 0.5) {
      vec2 chrDir = vec2(u_chromaticOffset * 0.005, 0.0);
      lumR = dot(sampleSource(cellUV + chrDir), vec3(0.299, 0.587, 0.114));
      lumG = dot(srcCenter, vec3(0.299, 0.587, 0.114));
      lumB = dot(sampleSource(cellUV - chrDir), vec3(0.299, 0.587, 0.114));
    } else {
      float l = dot(srcCenter, vec3(0.299, 0.587, 0.114));
      lumR = l; lumG = l; lumB = l;
    }

    vec3 srcHSL   = rgb2hsl(srcCenter);
    float cellLuma = dot(srcCenter, vec3(0.299, 0.587, 0.114));
    float cellSat  = srcHSL.y;

    // ── Mouse: brightness boost ──
    float brightMul = 1.0 + proximity * u_mouseBrightBoost;
    lumR = min(lumR * brightMul, 1.0);
    lumG = min(lumG * brightMul, 1.0);
    lumB = min(lumB * brightMul, 1.0);
    cellLuma = min(cellLuma * brightMul, 1.0);

    // ── Mouse: saturation boost ──
    cellSat = min(cellSat + proximity * u_mouseSatBoost, 1.0);

    // ── Mouse: size boost ──
    float sizeBoost = 1.0 + proximity * u_mouseSizeBoost;

    // ── Per-channel glyph radii ──
    float pulse = 1.0;
    if (u_animOn > 0.5) {
      float ph = hash21(cell) * 6.28318 + u_time * u_animSpeed * 2.0;
      pulse = 1.0 + sin(ph) * u_animPulse * 0.15;
    }

    float scale = u_glyphSize * 0.5 * pulse * sizeBoost;
    float rR = pow(lumR, u_luminanceGamma) * scale;
    float rG = pow(lumG, u_luminanceGamma) * scale;
    float rB = pow(lumB, u_luminanceGamma) * scale;

    // Distance to cell centre (shape-dependent)
    float d = glyphDist(cf - 0.5);

    float soft = u_glyphSoftness * 0.05;
    float glR = 1.0 - smoothstep(rR - soft, rR + soft + 0.005, d);
    float glG = 1.0 - smoothstep(rG - soft, rG + soft + 0.005, d);
    float glB = 1.0 - smoothstep(rB - soft, rB + soft + 0.005, d);

    // ── 3-stop palette gradient mapped by luminance ──
    float pt = clamp(cellLuma * u_colorMix, 0.0, 1.0);
    vec3 palette;
    if (pt < 0.5) palette = mix(u_accent1, u_accent2, pt * 2.0);
    else          palette = mix(u_accent2, u_accent3, (pt - 0.5) * 2.0);

    // Blend palette ↔ neutral by saturation
    float satBlend = smoothstep(u_colorThreshold * 0.5, u_colorThreshold, cellSat);
    vec3 neutralTone = u_neutral * (0.3 + cellLuma * 0.7);
    vec3 glyphColor = mix(neutralTone, palette, satBlend);

    // Per-glyph organic jitter
    float ch = hash21(cell);
    glyphColor = rotateHue(glyphColor, (ch - 0.5) * u_glyphHueJitter);
    glyphColor *= 1.0 + (hash21(cell + 100.0) - 0.5) * u_glyphBrightJitter;

    // ── Mouse: colour shift toward accent ──
    if (proximity > 0.0 && u_mouseColorShift > 0.0) {
      glyphColor = mix(glyphColor, u_accent2, proximity * u_mouseColorShift);
      glyphColor *= 1.0 + proximity * u_mouseColorShift * 0.3;
    }

    // ── Compose per-channel ──
    if (u_invert < 0.5) {
      color.r = mix(u_bgColor.r, glyphColor.r, glR);
      color.g = mix(u_bgColor.g, glyphColor.g, glG);
      color.b = mix(u_bgColor.b, glyphColor.b, glB);
    } else {
      color.r = mix(glyphColor.r, u_bgColor.r, glR);
      color.g = mix(glyphColor.g, u_bgColor.g, glG);
      color.b = mix(glyphColor.b, u_bgColor.b, glB);
    }

    // ── Mouse: reveal original source through dither ──
    if (proximity > 0.0 && u_mouseReveal > 0.0) {
      vec3 original = sampleSource(uv);
      color = mix(color, original, proximity * u_mouseReveal);
    }
  }

  // ═══════════════════ EDGES ═══════════════════
  if (u_edgeOn > 0.5) {
    float edge = sobelEdge(uv);
    edge = smoothstep(u_edgeThreshold, u_edgeThreshold + 0.1, edge);
    color = mix(color, u_edgeColor, edge * u_edgeOpacity);
  }

  // ═══════════════════ VIGNETTE ═════════════════
  if (u_vignetteOn > 0.5) {
    float aspect = u_resolution.x / u_resolution.y;
    float vd = length((uv - 0.5) * vec2(aspect, 1.0));
    float vig = smoothstep(u_vignetteSize, u_vignetteSize * 0.3, vd);
    color *= mix(1.0, vig, u_vignetteStrength);
  }

  // ═══════════════════ GRAIN ════════════════════
  if (u_grainOn > 0.5) {
    float grainT = floor(u_time * u_grainSpeed);
    float g = hash21(floor(uv * u_resolution * 0.5) + grainT * 17.13) - 0.5;
    color += g * u_grainAmount;
  }

  // ═══════════════════ POST ═════════════════════
  float pl = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(pl), color, u_postSaturation);
  color *= u_brightness;
  color = (color - 0.5) * u_contrast + 0.5;
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
