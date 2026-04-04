// Math utilities — rotation, remap, smootherstep

fn rot2d(p: vec2f, angle: f32) -> vec2f {
  let c = cos(angle);
  let s = sin(angle);
  return vec2f(p.x * c - p.y * s, p.x * s + p.y * c);
}

fn remap(value: f32, inLow: f32, inHigh: f32, outLow: f32, outHigh: f32) -> f32 {
  return outLow + (value - inLow) * (outHigh - outLow) / (inHigh - inLow);
}

fn smootherstep(edge0: f32, edge1: f32, x: f32) -> f32 {
  let t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}
