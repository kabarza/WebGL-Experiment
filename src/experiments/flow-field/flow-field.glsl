precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

// Mouse interaction
uniform vec2 u_mousePos;
uniform vec2 u_mouseTrailPos;
uniform float u_mouseVel;
uniform float u_mouseStr;
uniform float u_mouseRadius;
uniform float u_mouseSoftness;
uniform float u_mouseTrailStr;

// Noise Fill
uniform float u_noiseScale;
uniform float u_noiseSpeed;
uniform float u_noiseOctaves;

// Flow Field / Domain Warp
uniform float u_warpStrength;
uniform float u_warpScale;
uniform float u_warpSpeed;
uniform float u_warpDepth;

// Vignette
uniform float u_vignetteRadius;
uniform float u_vignetteSoft;
uniform float u_vignetteRound;

// Camera / View
uniform float u_rotation;
uniform float u_zoom;

// Colors
uniform vec3 u_col1;
uniform vec3 u_col2;
uniform vec3 u_col3;
uniform vec3 u_col4;
uniform float u_saturation;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_blendWidth;
uniform float u_colorShift;
uniform float u_highlightStr;
uniform vec3  u_highlightColor;

// Grain
uniform float u_grainAmt;
uniform float u_grainScale;
uniform float u_grainSpeed;

// Background
uniform vec3 u_bgColor;

// ========== Simplex 3D Noise ==========
vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
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
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0+1.0;
  vec4 s1 = floor(b1)*2.0+1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

// FBM
float fbm(vec3 p) {
  float val = 0.0, amp = 0.55, freq = 1.0;
  int oct = int(u_noiseOctaves);
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    val += amp * snoise(p * freq);
    freq *= 1.9;
    amp *= 0.48;
  }
  return val;
}

// Hash
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

// 2D rotation
vec2 rot2d(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(p.x*c - p.y*s, p.x*s + p.y*c);
}

void main() {
  vec2 uv = vUv;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 st = vec2(uv.x * aspect, uv.y);
  float t = u_time;

  // Camera: rotation + zoom applied to coordinates
  vec2 center = vec2(aspect * 0.5, 0.5);
  vec2 centered = st - center;
  centered = rot2d(centered, u_rotation);
  centered /= u_zoom;
  st = centered + center;

  // ── Mouse interaction ──
  vec2 cursorPos = vec2(u_mousePos.x * aspect, u_mousePos.y);
  vec2 trailMPos = vec2(u_mouseTrailPos.x * aspect, u_mouseTrailPos.y);

  float mDist = length(st - cursorPos);
  float mInfluence = 1.0 - smoothstep(
    u_mouseRadius - u_mouseSoftness,
    u_mouseRadius + u_mouseSoftness,
    mDist
  );

  float tDist = length(st - trailMPos);
  float trailR = u_mouseRadius * 0.7;
  float tInfluence = (1.0 - smoothstep(
    trailR - u_mouseSoftness * 0.8,
    trailR + u_mouseSoftness * 0.8,
    tDist
  )) * u_mouseTrailStr;

  float mouseProx = max(mInfluence, tInfluence);

  // Noise + flow field (domain warping)
  vec2 p = st * u_noiseScale;
  float ft = t * u_warpSpeed;

  float q1 = fbm(vec3(p * u_warpScale, ft * 0.6));
  float q2 = fbm(vec3((p + vec2(5.2, 1.3)) * u_warpScale, ft * 0.55 + 10.0));

  vec2 wP = p;
  if (u_warpDepth >= 1.0) {
    wP = p + u_warpStrength * vec2(q1, q2);
  }

  if (u_warpDepth >= 2.0) {
    float r1 = fbm(vec3((wP + vec2(1.7, 9.2)) * u_warpScale, ft * 0.45));
    float r2 = fbm(vec3((wP + vec2(8.3, 2.8)) * u_warpScale, ft * 0.5));
    wP = p + u_warpStrength * vec2(r1, r2);

    if (u_warpDepth >= 3.0) {
      float s1 = fbm(vec3((wP + vec2(3.1, 7.7)) * u_warpScale, ft * 0.4));
      float s2 = fbm(vec3((wP + vec2(6.5, 4.2)) * u_warpScale, ft * 0.42));
      wP = p + u_warpStrength * vec2(s1, s2);
    }
  }

  // Mouse: inject noise-driven warp near cursor (no radial vectors)
  if (u_mouseStr > 0.0) {
    float mTime = t * 0.2 + 42.0;
    float mw1 = snoise(vec3(st * u_warpScale * 1.3 + vec2(17.3, 5.7), mTime));
    float mw2 = snoise(vec3(st * u_warpScale * 1.3 + vec2(3.1, 14.2), mTime * 0.9 + 35.0));
    wP += vec2(mw1, mw2) * mouseProx * u_mouseStr;
    wP += (cursorPos - trailMPos) * mInfluence * u_mouseVel * 0.5;
  }

  float noiseT = t * u_noiseSpeed;
  float n1 = fbm(vec3(wP, noiseT));
  float n2 = fbm(vec3(wP + vec2(3.7, 1.1), noiseT * 0.9 + 5.0));
  float n3 = (q1 + q2) * 0.5;

  // Vignette mask (rounded rectangle SDF, aspect-independent)
  vec2 vigP = uv * 2.0 - 1.0;
  float cr = (u_vignetteRound / 100.0) * u_vignetteRadius;
  vec2 q = abs(vigP) - vec2(u_vignetteRadius) + cr;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - cr;
  float vignette = 1.0 - smoothstep(-u_vignetteSoft, u_vignetteSoft, d);

  // Color mapping — sin-based
  const float TAU = 6.28318530718;
  float timeShift = u_colorShift * t * 0.012;

  float v1 = sin(n1 * TAU * u_blendWidth * 0.5 + timeShift) * 0.5 + 0.5;
  float v2 = sin(n2 * TAU * u_blendWidth * 0.5 + timeShift * 0.8 + 1.5708) * 0.5 + 0.5;
  float v3 = sin(n3 * TAU * u_blendWidth * 0.4 + timeShift * 0.5) * 0.5 + 0.5;

  vec3 mixA = mix(u_col1, u_col2, v1);
  vec3 mixB = mix(u_col3, u_col4, v1);
  vec3 color = mix(mixA, mixB, v2);

  vec3 accent = mix(u_col2, u_col3, 0.5);
  color = mix(color, accent, v3 * 0.15);

  // Highlights
  float fold = abs(n1 - n2);
  fold = pow(fold, 0.6);
  float foldQ = abs(q1 - q2);
  foldQ = pow(foldQ, 0.7);
  float totalFold = max(fold, foldQ);
  color = mix(color, u_highlightColor, totalFold * u_highlightStr);

  // Apply vignette mask
  color = mix(u_bgColor, color, vignette);

  // Post-processing
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, u_saturation);
  color *= u_brightness;
  color = (color - 0.5) * u_contrast + 0.5;

  // Grain
  float grainT = floor(u_time * u_grainSpeed);
  vec2 gUV = vUv * u_resolution / u_grainScale;
  float g1 = hash21(gUV + grainT * 17.13);
  float g2 = hash31(vec3(gUV * 1.37, grainT * 23.71));
  float g3 = hash21(gUV.yx * 0.97 + grainT * 31.57 + 100.0);
  float grain = ((g1 + g2 + g3) / 3.0 - 0.5) * u_grainAmt;
  color += grain;

  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
