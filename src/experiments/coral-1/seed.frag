#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform float u_mode;     // 0 center, 1 random, 2 image, 3 clear, 4 noise
uniform float u_seed;
uniform vec2  u_simSize;
uniform sampler2D u_image;
uniform float u_hasImage;
uniform vec2  u_imageSize;
uniform float u_imageInvert;
uniform float u_imageInfluence;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + u_seed) * 43758.5453); }

vec2 coverUv(vec2 uv) {
  float ca = u_simSize.x / u_simSize.y;
  float ia = u_imageSize.x / max(u_imageSize.y, 1.0);
  vec2 s = ca > ia ? vec2(1.0, ia / ca) : vec2(ca / ia, 1.0);
  vec2 r = (uv - 0.5) * s + 0.5;
  r.y = 1.0 - r.y; // image rows are top-down
  return r;
}

void main() {
  vec2 uv = vUv;
  float U = 1.0, V = 0.0;
  int m = int(u_mode + 0.5);
  float aspect = u_simSize.x / u_simSize.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  if (m == 0) {
    // A few soft blobs around the centre so the growth has character
    float v = 0.0;
    for (int i = 0; i < 14; i++) {
      float fi = float(i);
      vec2 c = (vec2(hash(vec2(fi, 1.0)), hash(vec2(fi, 2.0))) - 0.5) * vec2(aspect * 0.8, 0.8);
      v = max(v, 1.0 - smoothstep(0.0, 0.02 + 0.015 * hash(vec2(fi, 3.0)), length(p - c)));
    }
    V = v;
  } else if (m == 1) {
    // Random sparse seed dots
    vec2 cell = floor(uv * u_simSize / 10.0);
    float r = hash(cell);
    V = r > 0.985 ? 1.0 : 0.0;
  } else if (m == 2 && u_hasImage > 0.5) {
    vec3 c = texture(u_image, coverUv(uv)).rgb;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    if (u_imageInvert > 0.5) l = 1.0 - l;
    // Dark pixels become V with sparse dither so growth is organic
    float dark = smoothstep(0.7, 0.3, l);
    float dither = hash(floor(uv * u_simSize / 3.0));
    V = dark * step(1.0 - dark * 0.55 * u_imageInfluence - 0.15, dither);
  } else if (m == 4) {
    V = hash(floor(uv * u_simSize / 2.0)) * 0.6;
  }
  // m == 3 → clear
  U = 1.0 - V * 0.5;
  fragColor = vec4(U, V, 0.0, 1.0);
}
