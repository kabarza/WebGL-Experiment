precision highp float;

varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;

// Source — the progressively-drawn canvas
uniform sampler2D u_texture;
uniform float u_hasTexture;
uniform vec2 u_textureSize;
uniform float u_fitMode; // 0 = fill, 1 = contain, 2 = cover

// Background
uniform vec3 u_bgColor;

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

void main() {
  vec2 uv = vUv;
  vec3 color = u_bgColor;

  if (u_hasTexture > 0.5) {
    vec2 tuv = fitUV(uv);
    if (tuv.x >= 0.0 && tuv.x <= 1.0 && tuv.y >= 0.0 && tuv.y <= 1.0) {
      vec4 tex = texture2D(u_texture, tuv);
      color = mix(color, tex.rgb, tex.a);
    }
  }

  // ════════════════════ POST ═════════════════════
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, u_postSaturation);
  color *= u_brightness;
  color = (color - 0.5) * u_contrast + 0.5;
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
