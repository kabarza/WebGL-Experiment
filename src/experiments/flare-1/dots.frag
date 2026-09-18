precision highp float;

varying float v_alpha;
uniform float u_dotOpacity;

void main() {
  // gl_PointCoord is [0,1] within the point sprite square
  vec2  c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;                           // circular clip (r = 0.5)
  float alpha = exp(-d * 12.0) * v_alpha * u_dotOpacity;
  gl_FragColor = vec4(0.9, 0.88, 0.85, alpha);
}
