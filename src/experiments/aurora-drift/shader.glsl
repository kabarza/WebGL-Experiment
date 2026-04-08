precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

// Colors
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;
uniform vec3 u_color4;

// Warp layer
uniform float u_warpOn;
uniform float u_warpStrength;
uniform float u_warpScale;
uniform float u_seed;

// Blob layer
uniform float u_blobOn;
uniform float u_blobSize;
uniform float u_blobSpacing;
uniform float u_blobRotation;
uniform float u_blobSpread;
uniform float u_blobOffsetX;
uniform float u_blobOffsetY;
uniform float u_tileSpacing;

// Transform
uniform float u_zoom;
uniform float u_offsetX;
uniform float u_offsetY;

// Grain layer
uniform float u_grainOn;
uniform float u_grainAmount;
uniform float u_grainScale;

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
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// ── Hash → [-1, 1] ───────────────────────────────────────
float hash2s(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z) * 2.0 - 1.0;
}

// ── 2D value noise for grain ──────────────────────────────
float valNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash2s(i);
  float b = hash2s(i + vec2(1.0, 0.0));
  float c = hash2s(i + vec2(0.0, 1.0));
  float d = hash2s(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// ── 2D rotation ───────────────────────────────────────────
vec2 rot2d(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

void main() {
  // NDC coordinates [-1, 1]
  vec2 uv = vUv * 2.0 - 1.0;
  vec2 pos = uv;
  float aspect = u_resolution.x / u_resolution.y;
  pos.x *= min(1.0, aspect);
  pos.y *= min(1.0, 1.0 / aspect);
  pos /= max(u_zoom, 0.01);
  pos += vec2(u_offsetX, u_offsetY);

  float t = u_time;
  float animSeed = u_seed + t * 0.1;

  // ── Noise displacement ──────────────────────────────────
  if (u_warpOn > 0.5) {
    float d1 = snoise(vec3(pos * u_warpScale + 0.5, animSeed));
    float d2 = snoise(vec3(pos * u_warpScale + 0.5 + 5.3, animSeed + 1.7));
    pos += vec2(d1, d2) * u_warpStrength;
  }

  // ── Tiled color blobs ───────────────────────────────────
  vec3 col = vec3(0.0);

  if (u_blobOn > 0.5) {
    vec2 op = pos - vec2(u_blobOffsetX, u_blobOffsetY);
    float sp = u_tileSpacing;
    op = mod(op - sp, vec2(sp * 2.0)) - sp;
    op = rot2d(op, -u_blobRotation);
    op /= max(u_blobSize, 0.01);
    op *= vec2(1.0 / max(u_blobSpread, 0.01), 1.0);

    float cs = u_blobSpacing;
    col = mix(u_color1, col, smoothstep(0.0, 1.0, distance(op, vec2(0.0, cs * 1.5))));
    col = mix(u_color2, col, smoothstep(0.0, 1.0, distance(op, vec2(0.0, cs * 0.5))));
    col = mix(u_color3, col, smoothstep(0.0, 1.0, distance(op, vec2(0.0, -cs * 0.5))));
    col = mix(u_color4, col, smoothstep(0.0, 1.0, distance(op, vec2(0.0, -cs * 1.5))));
  }

  // ── Grain ───────────────────────────────────────────────
  if (u_grainOn > 0.5) {
    float n = valNoise(uv * u_resolution / max(u_grainScale, 0.01));
    col += n * u_grainAmount;
  }

  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}
