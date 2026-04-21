precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

// Source texture
uniform sampler2D u_texture;
uniform float u_hasTexture;
uniform vec2 u_textureSize;
uniform float u_fitMode; // 0 = fill, 1 = contain, 2 = cover

// Halftone
uniform float u_numSquares;   // number of cells across X
uniform int u_depth;           // number of circle size steps
uniform float u_aspectRatio;   // canvas width / height
uniform float u_sizeByLuma;    // 1.0 = size varies by luma, 0.0 = fixed
uniform float u_fixedRadius;   // radius when sizeByLuma is off (0.0–0.5)

// Background
uniform vec3 u_bgColor;
uniform vec3 u_dotColor;
uniform float u_useSourceColor; // 1.0 = sample source, 0.0 = use u_dotColor

// Post
uniform float u_brightness;
uniform float u_contrast;
uniform float u_postSaturation;

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

// ─── Luma ───────────────────────────────────────────
float getLuma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 uv = vUv;
  vec3 color = u_bgColor;

  // Compute grid
  float numSq = max(u_numSquares, 1.0);
  float ar = u_resolution.x / u_resolution.y;
  float rows = numSq / ar;
  vec2 gridCount = vec2(numSq, rows);
  vec2 scaledUV = uv * gridCount;
  vec2 cellPos = floor(scaledUV);
  vec2 localUV = fract(scaledUV);

  // Sample source texture at cell center
  vec2 sampleUV = (cellPos + 0.5) / gridCount;

  vec4 sampled = vec4(u_bgColor, 1.0);
  if (u_hasTexture > 0.5) {
    vec2 tuv = fitUV(sampleUV);
    if (tuv.x >= 0.0 && tuv.x <= 1.0 && tuv.y >= 0.0 && tuv.y <= 1.0) {
      sampled = texture2D(u_texture, tuv);
    }
  }

  // Compute radius
  float radius;
  if (u_sizeByLuma > 0.5) {
    float luma = getLuma(sampled.rgb);
    float fd = max(float(u_depth), 1.0);
    int idx = int(clamp(luma, 0.0, 0.999) * fd);
    if (u_depth > 1) {
      radius = float(idx) / (fd - 1.0) * 0.5;
    } else {
      radius = 0.0;
    }
  } else {
    radius = clamp(u_fixedRadius, 0.0, 0.5);
  }

  // Distance field for centered circle
  vec2 centered = localUV - 0.5;
  float dist = length(centered);

  // Anti-aliased mask using SDF
  // Pixel size in cell-local UV space (substitute for fwidth)
  float aa = 0.5 / (numSq / ar * min(u_resolution.x, u_resolution.y));
  float d = dist - radius;
  float mask = 1.0 - smoothstep(-aa, aa, d);

  if (mask < 0.01) {
    gl_FragColor = vec4(u_bgColor, 1.0);
    return;
  }

  // Dot color: source texture or solid color
  vec3 dotCol = mix(u_dotColor, sampled.rgb, u_useSourceColor);
  color = mix(u_bgColor, dotCol, mask);

  // ════════════════════ POST ═════════════════════
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, u_postSaturation);
  color *= u_brightness;
  color = (color - 0.5) * u_contrast + 0.5;
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
