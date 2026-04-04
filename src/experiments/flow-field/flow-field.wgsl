#include "noise"
#include "fbm"
#include "hash"
#include "math"
#include "color"

struct Uniforms {
  time: f32,
  resolution: vec2f,
  mouse: vec2f,

  noiseScale: f32,
  noiseSpeed: f32,
  noiseOctaves: f32,

  warpStrength: f32,
  warpScale: f32,
  warpSpeed: f32,
  warpDepth: f32,

  circleRadius: f32,
  circleSoft: f32,
  circlePos: vec2f,

  rotation: f32,
  zoom: f32,

  mouseStr: f32,

  col1: vec3f,
  col2: vec3f,
  col3: vec3f,
  col4: vec3f,
  saturation: f32,
  brightness: f32,
  contrast: f32,
  blendWidth: f32,
  colorShift: f32,
  highlightStr: f32,
  highlightColor: vec3f,

  grainAmt: f32,
  grainScale: f32,
  grainSpeed: f32,

  bgColor: vec3f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = u.resolution.x / u.resolution.y;
  var st = vec2f(uv.x * aspect, uv.y);
  let t = u.time;

  // Camera: rotation + zoom
  let center = vec2f(aspect * 0.5, 0.5);
  var centered = st - center;
  centered = rot2d(centered, u.rotation);
  centered /= u.zoom;
  st = centered + center;

  // Mouse offset
  var mOff = (u.mouse - 0.5) * u.mouseStr;
  mOff.x *= aspect;

  // Noise + flow field (domain warping)
  var p = st * u.noiseScale + mOff;
  let ft = t * u.warpSpeed;
  let octaves = i32(u.noiseOctaves);

  let q1 = fbm(vec3f(p * u.warpScale, ft * 0.6), octaves);
  let q2 = fbm(vec3f((p + vec2f(5.2, 1.3)) * u.warpScale, ft * 0.55 + 10.0), octaves);

  var wP = p;
  if (u.warpDepth >= 1.0) {
    wP = p + u.warpStrength * vec2f(q1, q2);
  }

  let r1 = fbm(vec3f((wP + vec2f(1.7, 9.2)) * u.warpScale, ft * 0.45), octaves);
  let r2 = fbm(vec3f((wP + vec2f(8.3, 2.8)) * u.warpScale, ft * 0.5), octaves);

  if (u.warpDepth >= 2.0) {
    wP = p + u.warpStrength * vec2f(r1, r2);
  }

  if (u.warpDepth >= 3.0) {
    let s1 = fbm(vec3f((wP + vec2f(3.1, 7.7)) * u.warpScale, ft * 0.4), octaves);
    let s2 = fbm(vec3f((wP + vec2f(6.5, 4.2)) * u.warpScale, ft * 0.42), octaves);
    wP = p + u.warpStrength * vec2f(s1, s2);
  }

  // Final noise at warped position
  let noiseT = t * u.noiseSpeed;
  let n1 = fbm(vec3f(wP, noiseT), octaves);
  let n2 = fbm(vec3f(wP + vec2f(3.7, 1.1), noiseT * 0.9 + 5.0), octaves);
  let n3 = (q1 + q2) * 0.5;
  let n4 = (r1 + r2) * 0.5;

  // Circle mask
  let ctr = vec2f(u.circlePos.x * aspect, u.circlePos.y);
  let dist = length(st - ctr);
  let circle = 1.0 - smoothstep(
    u.circleRadius - u.circleSoft,
    u.circleRadius + u.circleSoft,
    dist
  );

  // Color mapping — sin-based, always smooth
  let TAU = 6.28318530718;
  let timeShift = u.colorShift * t * 0.012;

  let v1 = sin(n1 * TAU * u.blendWidth * 0.5 + timeShift) * 0.5 + 0.5;
  let v2 = sin(n2 * TAU * u.blendWidth * 0.5 + timeShift * 0.8 + 1.5708) * 0.5 + 0.5;
  let v3 = sin(n3 * TAU * u.blendWidth * 0.4 + timeShift * 0.5) * 0.5 + 0.5;
  let v4 = sin(n4 * TAU * u.blendWidth * 0.4 + 0.785) * 0.5 + 0.5;

  let mixA = mix(u.col1, u.col2, v1);
  let mixB = mix(u.col3, u.col4, v1);
  var col = mix(mixA, mixB, v2);

  // Organic variation from warp fields
  let accent = mix(u.col2, u.col3, 0.5);
  col = mix(col, accent, v3 * 0.15);

  // Highlights where waves/folds meet
  var fold = abs(n1 - n2);
  fold = pow(fold, 0.6);
  var foldQ = abs(q1 - q2);
  foldQ = pow(foldQ, 0.7);
  let totalFold = max(fold, foldQ);
  col = mix(col, u.highlightColor, totalFold * u.highlightStr);

  // Apply circle mask
  col = mix(u.bgColor, col, circle);

  // Post-processing
  col = adjustSaturation(col, u.saturation);
  col = adjustBrightness(col, u.brightness);
  col = adjustContrast(col, u.contrast);

  // Grain
  let grainT = floor(u.time * u.grainSpeed);
  let gUV = uv * u.resolution / u.grainScale;
  let g1 = hash21(gUV + grainT * 17.13);
  let g2 = hash31(vec3f(gUV * 1.37, grainT * 23.71));
  let g3 = hash21(gUV.yx * 0.97 + grainT * 31.57 + 100.0);
  let grain = ((g1 + g2 + g3) / 3.0 - 0.5) * u.grainAmt;

  col = applyGrain(col, grain);

  return vec4f(col, 1.0);
}
