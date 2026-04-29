precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
  vec2 uv = vUv;

  // Simple animated gradient — replace with your effect
  vec3 col = 0.5 + 0.5 * cos(u_time + uv.xyx + vec3(0, 2, 4));

  gl_FragColor = vec4(col, 1.0);
}
