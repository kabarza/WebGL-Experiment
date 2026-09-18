precision highp float;

attribute float a_angle;    // base angle [0, TAU] — golden-angle spaced
attribute float a_rOffset;  // radial offset normalised [-1, 1]
attribute float a_size;     // size multiplier [0.4, 1.0]
attribute float a_phase;    // twinkle phase [0, TAU]

uniform vec2  u_resolution;
uniform vec2  u_ringCenter;  // [0,1] UV space
uniform float u_ringRadius;
uniform float u_ringEdge;
uniform float u_dotSize;     // base point size in pixels
uniform float u_dotSpeed;
uniform float u_dotBlink;    // 0 = no blink, 1 = full blink
uniform float u_dotRotate;   // 0 = stationary, 1 = rotate
uniform float u_time;

varying float v_alpha;

void main() {
  float aspect = u_resolution.x / u_resolution.y;

  // Optional slow rotation
  float angle = a_angle + u_dotRotate * u_time * u_dotSpeed * 0.02;

  // Scatter dots radially within the ring edge
  float edgeW = u_ringEdge * 0.08;
  float r     = u_ringRadius + a_rOffset * edgeW * 1.5;

  // Aspect-corrected position → NDC
  float aspX  = u_ringCenter.x * aspect + cos(angle) * r;
  float aspY  = u_ringCenter.y           + sin(angle) * r;
  gl_Position = vec4((aspX / aspect) * 2.0 - 1.0, aspY * 2.0 - 1.0, 0.0, 1.0);

  // Twinkle computed per-vertex — not per pixel
  float tw = 0.15 + 0.85 * max(0.0, sin(a_phase + u_time * u_dotSpeed * 2.0));
  v_alpha     = mix(1.0, tw, u_dotBlink) * a_size;

  gl_PointSize = u_dotSize * a_size;
}
