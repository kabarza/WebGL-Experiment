#version 300 es
// ============================================================
// Coral-1 — Gray-Scott reaction-diffusion step
//   U + 2V → 3V,  V → P
//   dU/dt = Du ∇²U − U V² + f (1 − U)
//   dV/dt = Dv ∇²V + U V² − (f + k) V
// Feed / kill vary across the canvas via a "variation map" so the
// same canvas grows spots, worms and mazes side by side — and an
// optional source image can drive the map, seed or mask the growth.
// ============================================================
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D u_state;    // r = U, g = V
uniform vec2  u_texel;
uniform vec2  u_simSize;
uniform float u_time;

uniform float u_feed;
uniform float u_kill;
uniform float u_dU;
uniform float u_dV;
uniform float u_dt;
uniform float u_scale;        // stencil spacing in texels — feature size scales with it

uniform float u_mapMode;      // 0 none, 1 radial, 2 rotate, 3 swirl, 4 bubble, 5 ring, 6 horizontal, 7 noise
uniform float u_mapFeed;      // feed swing (+/-)
uniform float u_mapKill;      // kill swing (+/-)
uniform float u_mapScale;
uniform float u_mapAngle;
uniform float u_mapDrift;

uniform float u_anisotropy;   // 0 isotropic .. 1 strongly directional diffusion
uniform float u_flowAngle;

uniform sampler2D u_image;
uniform float u_hasImage;
uniform vec2  u_imageSize;
uniform float u_imageInvert;
uniform float u_imageMode;    // 0 off, 1 seed, 2 density map, 3 mask, 4 seed+density
uniform float u_imageInfluence;

uniform vec2  u_pointer;
uniform float u_brush;        // 0 none, 1 add, -1 erase
uniform float u_brushRadius;

vec2 coverUv(vec2 uv) {
  float ca = u_simSize.x / u_simSize.y;
  float ia = u_imageSize.x / max(u_imageSize.y, 1.0);
  vec2 s = ca > ia ? vec2(1.0, ia / ca) : vec2(ca / ia, 1.0);
  vec2 r = (uv - 0.5) * s + 0.5;
  r.y = 1.0 - r.y; // image rows are top-down
  return r;
}

float imageLuma(vec2 uv) {
  vec3 c = texture(u_image, coverUv(uv)).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return u_imageInvert > 0.5 ? 1.0 - l : l;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

// Returns -1..1 spatial variation
float variation(vec2 uv) {
  float aspect = u_simSize.x / u_simSize.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float c = cos(u_mapAngle), s = sin(u_mapAngle);
  p = mat2(c, -s, s, c) * p;
  float t = u_time * u_mapDrift;
  int m = int(u_mapMode + 0.5);
  if (m == 1) return clamp(length(p) * 2.0 * u_mapScale - 1.0, -1.0, 1.0);            // radial
  if (m == 2) return sin(atan(p.y, p.x) * u_mapScale + t);                              // rotate
  if (m == 3) return sin(atan(p.y, p.x) * 2.0 + length(p) * 8.0 * u_mapScale - t);     // swirl
  if (m == 4) return sin(p.x * 6.0 * u_mapScale + t) * sin(p.y * 6.0 * u_mapScale);    // bubble
  if (m == 5) return sin(length(p) * 12.0 * u_mapScale - t);                            // ring
  if (m == 6) return clamp(p.x * 2.0 * u_mapScale, -1.0, 1.0);                          // horizontal sweep
  if (m == 7) return vnoise(p * 3.0 * u_mapScale + t * 0.2) * 2.0 - 1.0;               // noise
  return 0.0;
}

void main() {
  vec2 uv = vUv;
  vec2 tx = u_texel;

  vec4 c = texture(u_state, uv);
  // 9-point Laplacian (Karl Sims weights), optionally stretched
  // along a flow direction for anisotropic diffusion.
  vec2 dir = vec2(cos(u_flowAngle), sin(u_flowAngle));
  vec2 ax = mix(vec2(1.0, 0.0), dir, u_anisotropy);
  vec2 ay = mix(vec2(0.0, 1.0), vec2(-dir.y, dir.x) * (1.0 - u_anisotropy * 0.6), u_anisotropy);
  vec2 ox = ax * tx * u_scale;
  vec2 oy = ay * tx * u_scale;

  vec4 l = texture(u_state, uv - ox) + texture(u_state, uv + ox) +
           texture(u_state, uv - oy) + texture(u_state, uv + oy);
  vec4 d = texture(u_state, uv - ox - oy) + texture(u_state, uv + ox - oy) +
           texture(u_state, uv - ox + oy) + texture(u_state, uv + ox + oy);
  vec2 lap = (l.rg * 0.2 + d.rg * 0.05 - c.rg);

  float U = c.r;
  float V = c.g;

  // Spatially varying feed / kill
  float var = variation(uv);
  float f = u_feed + var * u_mapFeed;
  float k = u_kill + var * u_mapKill;

  float growthScale = 1.0;
  if (u_hasImage > 0.5) {
    float lum = imageLuma(uv);
    int im = int(u_imageMode + 0.5);
    if (im == 2 || im == 4) {
      // Density map: dark areas grow dense (higher feed, lower kill)
      float d2 = (0.5 - lum) * 2.0 * u_imageInfluence;
      f += d2 * 0.012;
      k -= d2 * 0.004;
    } else if (im == 3) {
      // Mask: pattern only survives in dark regions
      growthScale = mix(1.0, smoothstep(0.65, 0.35, lum), u_imageInfluence);
    }
  }

  float uvv = U * V * V;
  float dU = u_dU * lap.x - uvv + f * (1.0 - U);
  float dV = u_dV * lap.y + uvv - (f + k) * V;
  U += dU * u_dt;
  V += dV * u_dt;

  // Mask suppression
  V *= mix(1.0, growthScale, 0.08);

  // Brush
  if (abs(u_brush) > 0.5) {
    float aspect = u_simSize.x / u_simSize.y;
    vec2 dp = (uv - u_pointer) * vec2(aspect, 1.0);
    float r = u_brushRadius;
    float b = 1.0 - smoothstep(r * 0.4, r, length(dp));
    if (u_brush > 0.0) { V = max(V, b * 0.9); U = mix(U, 0.5, b * 0.5); }
    else { V = mix(V, 0.0, b); U = mix(U, 1.0, b); }
  }

  fragColor = vec4(clamp(U, 0.0, 1.0), clamp(V, 0.0, 1.0), 0.0, 1.0);
}
