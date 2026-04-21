precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

// Source texture
uniform sampler2D u_texture;
uniform float u_hasTexture;
uniform vec2 u_textureSize;
uniform float u_fitMode;       // 0 = fill, 1 = contain, 2 = cover
uniform float u_texInfluence;  // how much texture luma modulates radius
uniform float u_useSourceColor;

// Grid
uniform float u_numSquares;
uniform float u_baseRadius;

// Noise layer 1
uniform float u_noiseOn;
uniform float u_noiseScale;
uniform float u_noiseSpeed;
uniform float u_noiseStrength;

// Noise layer 2 (flow)
uniform float u_noise2On;
uniform float u_noise2Scale;
uniform float u_noise2Speed;
uniform float u_noise2Strength;

// Texture warp
uniform float u_texWarpOn;
uniform float u_texWarpScale;
uniform float u_texWarpSpeed;
uniform float u_texWarpStrength;

// Pulse layer
uniform float u_pulseOn;
uniform float u_pulseRate;
uniform float u_pulseDepth;
uniform float u_pulseWave;

// Color layer
uniform float u_colorOn;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform float u_colorSpeed;
uniform float u_colorAngle;
uniform float u_colorNoiseAmt;

// Mouse
uniform vec2 u_mousePos;
uniform float u_mouseNoiseBoost;
uniform float u_mouseRepel;
uniform float u_mouseRadius;

// Colors / background
uniform vec3 u_bgColor;
uniform vec3 u_dotColor;

// Post
uniform float u_brightness;
uniform float u_contrast;
uniform float u_postSaturation;

// ─── Simplex 3D Noise (Ashima Arts) ─────────────────
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
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// ─── Math ───────────────────────────────────────────
vec2 rot2d(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

float getLuma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

// ─── Texture UV — fit modes ─────────────────────────
vec2 fitUV(vec2 uv) {
  int mode = int(u_fitMode + 0.5);
  if (mode == 0) return uv;

  float ca = u_resolution.x / u_resolution.y;
  float ta = u_textureSize.x / u_textureSize.y;
  vec2 o = uv;

  if (mode == 1) {
    if (ca > ta) o.x = (uv.x - 0.5) * (ca / ta) + 0.5;
    else         o.y = (uv.y - 0.5) * (ta / ca) + 0.5;
  } else {
    if (ca > ta) o.y = (uv.y - 0.5) * (ca / ta) + 0.5;
    else         o.x = (uv.x - 0.5) * (ta / ca) + 0.5;
  }

  return o;
}

void main() {
  vec2 uv = vUv;
  float aspect = u_resolution.x / u_resolution.y;
  float t = u_time;

  // ═══════════════ GRID SETUP ═══════════════
  float numSq = max(u_numSquares, 1.0);
  float rows = numSq / aspect;
  vec2 gridCount = vec2(numSq, rows);
  vec2 scaledUV = uv * gridCount;
  vec2 cellPos = floor(scaledUV);
  vec2 localUV = fract(scaledUV);

  // Cell center in normalized UV space [0,1]
  vec2 cellCenter = (cellPos + 0.5) / gridCount;

  // ═══════════════ MOUSE PROXIMITY ═══════════════
  vec2 mDelta = cellCenter - u_mousePos;
  mDelta.x *= aspect;
  float mouseDist = length(mDelta);
  float mouseProximity = smoothstep(u_mouseRadius, 0.0, mouseDist);

  // ═══════════════ TEXTURE SAMPLE ═══════════════
  vec4 texSample = vec4(0.0);
  bool hasTex = u_hasTexture > 0.5;
  if (hasTex) {
    vec2 tuv = fitUV(cellCenter);

    // Warp texture UV with noise so the image itself moves
    if (u_texWarpOn > 0.5 && u_texWarpStrength > 0.001) {
      float warpAmt = u_texWarpStrength;
      // Boost warp near mouse
      warpAmt += mouseProximity * u_mouseNoiseBoost * u_texWarpStrength;

      float wx = snoise(vec3(tuv * u_texWarpScale, t * u_texWarpSpeed));
      float wy = snoise(vec3(tuv * u_texWarpScale + 100.0, t * u_texWarpSpeed));
      tuv += vec2(wx, wy) * warpAmt * 0.1;
    }

    if (tuv.x >= 0.0 && tuv.x <= 1.0 && tuv.y >= 0.0 && tuv.y <= 1.0) {
      texSample = texture2D(u_texture, tuv);
    }
  }

  // ═══════════════ RADIUS COMPUTATION ═══════════════
  float radius = u_baseRadius;

  // Texture luma influence on radius
  if (hasTex && u_texInfluence > 0.001) {
    float texLuma = getLuma(texSample.rgb);
    radius += (texLuma - 0.5) * u_texInfluence;
  }

  // ──── LAYER 1: NOISE (additive) ────
  if (u_noiseOn > 0.5) {
    float str = u_noiseStrength;
    str += mouseProximity * u_mouseNoiseBoost * u_noiseStrength;

    vec3 noiseCoord = vec3(cellCenter * u_noiseScale, t * u_noiseSpeed);
    float n = snoise(noiseCoord);
    radius += n * str;
  }

  // ──── LAYER 2: FLOW NOISE (additive, different frequency) ────
  if (u_noise2On > 0.5) {
    float str2 = u_noise2Strength;
    str2 += mouseProximity * u_mouseNoiseBoost * u_noise2Strength;

    // Offset seed (+73) so it's independent from noise 1
    vec3 flowCoord = vec3(cellCenter * u_noise2Scale + 73.0, t * u_noise2Speed);
    float n2 = snoise(flowCoord);
    radius += n2 * str2;
  }

  // ──── LAYER 3: PULSE (multiplicative) ────
  if (u_pulseOn > 0.5) {
    vec2 centerDelta = cellCenter - 0.5;
    centerDelta.x *= aspect;
    float phaseDist = length(centerDelta);

    float phase = phaseDist * u_pulseWave * 10.0;
    float pulse = sin(t * u_pulseRate * 6.2832 - phase);

    float multiplier = 1.0 - u_pulseDepth * 0.5 * (1.0 - pulse);
    radius *= multiplier;
  }

  // ──── MOUSE REPEL ────
  if (u_mouseRepel > 0.001) {
    radius -= mouseProximity * u_mouseRepel;
  }

  radius = clamp(radius, 0.0, 0.5);

  // ═══════════════ SDF CIRCLE ═══════════════
  vec2 centered = localUV - 0.5;
  float dist = length(centered);

  float aa = 0.5 / (numSq / aspect * min(u_resolution.x, u_resolution.y));
  float d = dist - radius;
  float mask = 1.0 - smoothstep(-aa, aa, d);

  if (mask < 0.01) {
    gl_FragColor = vec4(u_bgColor, 1.0);
    return;
  }

  // ═══════════════ COLOR ═══════════════
  vec3 dotCol = u_dotColor;

  // Use source texture color when available and enabled
  if (hasTex && u_useSourceColor > 0.5) {
    dotCol = texSample.rgb;
  } else if (u_colorOn > 0.5) {
    vec2 gradDir = rot2d(vec2(1.0, 0.0), u_colorAngle);
    float gradT = dot(cellCenter - 0.5, gradDir) + 0.5;

    gradT += t * u_colorSpeed * 0.1;
    gradT = fract(gradT);

    if (u_colorNoiseAmt > 0.001) {
      float cn = snoise(vec3(cellCenter * 3.0, t * 0.2));
      gradT += cn * u_colorNoiseAmt * 0.5;
      gradT = clamp(gradT, 0.0, 1.0);
    }

    dotCol = mix(u_colorA, u_colorB, gradT);
  }

  vec3 color = mix(u_bgColor, dotCol, mask);

  // ═══════════════ POST ═══════════════
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, u_postSaturation);
  color *= u_brightness;
  color = (color - 0.5) * u_contrast + 0.5;
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
