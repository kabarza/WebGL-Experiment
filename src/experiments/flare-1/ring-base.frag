precision highp float;

varying vec2  vUv;
uniform vec2  u_resolution;
uniform vec2  u_ringCenter;   // [0,1] UV space
uniform float u_ringRadius;
uniform float u_ringEdge;

void main() {
  float aspect   = u_resolution.x / u_resolution.y;
  vec2  st       = vec2(vUv.x * aspect, vUv.y);
  vec2  center   = vec2(u_ringCenter.x * aspect, u_ringCenter.y);
  float ringDist = length(st - center) - u_ringRadius;
  float edgeW    = u_ringEdge * 0.08;
  float haloW    = edgeW * 2.6;
  float ringGlow = exp(-ringDist * ringDist / (edgeW * edgeW));
  float ringHalo = exp(-ringDist * ringDist / max(haloW * haloW, 0.00001));
  float grad     = ringGlow * 0.55 + ringHalo * 0.20;
  gl_FragColor   = vec4(grad, grad, grad, 1.0);
}
