#version 300 es
// ============================================================
// Shared display pass — turns a scalar pattern field into a
// brand-ready image: flat / outline / emboss / gradient / dots,
// optional source-image compositing, transparent mask output.
// ============================================================
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D u_field;
uniform vec4  u_channel;        // dot-mask selecting the field channel
uniform vec2  u_fieldRange;     // remap: (v - x) / (y - x)
uniform vec2  u_texel;          // 1 / field size
uniform vec2  u_resolution;

uniform sampler2D u_image;
uniform float u_hasImage;
uniform vec2  u_imageSize;
uniform float u_imageFill;      // 0 = show image through pattern, 1 = tint pattern by image, 2 = image behind (pattern as overlay)
uniform float u_imageBlend;     // 0 off .. 1 full

uniform float u_renderMode;     // 0 flat, 1 outline, 2 emboss, 3 gradient, 4 dots
uniform float u_threshold;
uniform float u_softness;
uniform float u_lineWidth;
uniform float u_embossHeight;
uniform float u_lightAngle;
uniform float u_dotScale;
uniform float u_invert;
uniform float u_transparent;    // 1 = output alpha mask (pattern = opaque)
uniform float u_grain;
uniform float u_vignette;

uniform vec3 u_bgColor;
uniform vec3 u_fgColor;
uniform vec3 u_accentColor;
uniform float u_accentMix;      // 0..1 how much accent bleeds into mid-tones

float fieldLinear(vec2 uv) {
  float v = dot(texture(u_field, uv), u_channel);
  return clamp((v - u_fieldRange.x) / max(u_fieldRange.y - u_fieldRange.x, 1e-5), 0.0, 1.0);
}

// Bicubic B-spline reconstruction from four bilinear taps. The field is
// usually upsampled a lot (pattern scale), and plain bilinear shows its
// texel grid as creases along the threshold — this stays smooth.
float field(vec2 uv) {
  vec2 texSize = 1.0 / u_texel;
  vec2 coord = uv * texSize - 0.5;
  vec2 f = fract(coord);
  coord -= f;
  vec2 f2 = f * f;
  vec2 f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 s0 = w0 + w1;
  vec2 s1 = w2 + w3;
  vec2 t0 = (coord - 1.0 + w1 / s0 + 0.5) * u_texel;
  vec2 t1 = (coord + 1.0 + w3 / s1 + 0.5) * u_texel;
  return fieldLinear(vec2(t0.x, t0.y)) * s0.x * s0.y
       + fieldLinear(vec2(t1.x, t0.y)) * s1.x * s0.y
       + fieldLinear(vec2(t0.x, t1.y)) * s0.x * s1.y
       + fieldLinear(vec2(t1.x, t1.y)) * s1.x * s1.y;
}

vec2 coverUv(vec2 uv) {
  // Map canvas uv onto the image with "cover" fitting.
  float ca = u_resolution.x / u_resolution.y;
  float ia = u_imageSize.x / max(u_imageSize.y, 1.0);
  vec2 s = ca > ia ? vec2(1.0, ia / ca) : vec2(ca / ia, 1.0);
  vec2 r = (uv - 0.5) * s + 0.5;
  r.y = 1.0 - r.y; // image rows are top-down
  return r;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float v = field(uv);

  // Gradient from finite differences (for emboss + outline thickness)
  vec2 px = max(u_texel, 1.0 / u_resolution);
  float vx = field(uv + vec2(px.x, 0.0)) - field(uv - vec2(px.x, 0.0));
  float vy = field(uv + vec2(0.0, px.y)) - field(uv - vec2(0.0, px.y));
  vec2 grad = vec2(vx, vy) * 0.5 * (u_texel / px);

  float soft = max(u_softness, 0.001);
  float mask; // 1 = ink / pattern, 0 = paper / background
  float shade = 0.0;

  int mode = int(u_renderMode + 0.5);
  if (mode == 1) {
    // Outline — constant-width line around the iso-contour, measured in
    // simulation texels so it stays uniform however steep the field is.
    float r = u_lineWidth * 30.0;
    float here = smoothstep(u_threshold - soft, u_threshold + soft, v);
    float edge = 0.0;
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 0.5236;
      vec2 o = vec2(cos(a), sin(a)) * u_texel * r;
      float there = smoothstep(u_threshold - soft, u_threshold + soft, field(uv + o));
      edge = max(edge, abs(there - here));
    }
    mask = smoothstep(0.15, 0.6, edge);
  } else if (mode == 3) {
    mask = smoothstep(0.0, 1.0, v);
  } else if (mode == 4) {
    // Dots — halftone driven by the field
    vec2 cell = uv * u_resolution / max(u_dotScale, 2.0);
    vec2 c = fract(cell) - 0.5;
    float r = sqrt(v) * 0.62;
    float d = length(c);
    mask = 1.0 - smoothstep(r - 0.08, r + 0.08, d);
  } else {
    mask = smoothstep(u_threshold - soft, u_threshold + soft, v);
  }

  if (mode == 2) {
    // Emboss — lit height field, masked to the pattern
    vec2 l = vec2(cos(u_lightAngle), sin(u_lightAngle));
    float h = u_embossHeight * 40.0;
    vec3 n = normalize(vec3(-grad * h, 1.0));
    float diff = clamp(dot(n.xy, l) * 1.2, -1.0, 1.0);
    shade = diff;
  }

  if (u_invert > 0.5) mask = 1.0 - mask;

  // Ink colour: fg with accent bleeding into softer values
  vec3 ink = mix(u_fgColor, u_accentColor, u_accentMix * (1.0 - smoothstep(0.0, 0.7, v)));
  if (mode == 3) ink = mix(u_accentColor, u_fgColor, smoothstep(0.25, 0.95, v));

  vec3 paper = u_bgColor;

  // Source image compositing
  if (u_hasImage > 0.5 && u_imageBlend > 0.001) {
    vec3 img = texture(u_image, coverUv(uv)).rgb;
    int imode = int(u_imageFill + 0.5);
    if (imode == 0) {
      // Image shows through the pattern
      ink = mix(ink, img, u_imageBlend);
    } else if (imode == 1) {
      // Tint pattern by image
      ink = mix(ink, ink * img * 1.6, u_imageBlend);
    } else {
      // Image behind, pattern overlays
      paper = mix(paper, img, u_imageBlend);
    }
  }

  vec3 col = mix(paper, ink, mask);
  if (mode == 2) {
    col += shade * 0.45 * mask;
    col -= shade * 0.12 * (1.0 - mask);
  }

  // Vignette + grain (brand polish)
  if (u_vignette > 0.001) {
    vec2 q = uv - 0.5;
    float vig = 1.0 - smoothstep(0.35, 0.95, length(q) * 1.3) * u_vignette;
    col *= vig;
  }
  if (u_grain > 0.001) {
    col += (hash(gl_FragCoord.xy) - 0.5) * u_grain * 0.25;
  }

  if (u_transparent > 0.5) {
    fragColor = vec4(ink, mask);
  } else {
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
}
