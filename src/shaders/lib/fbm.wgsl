// Fractional Brownian Motion — configurable octaves
// Requires: noise.wgsl (snoise)

fn fbm(p: vec3f, octaves: i32) -> f32 {
  var val = 0.0;
  var amp = 0.55;
  var freq = 1.0;
  for (var i = 0; i < 6; i++) {
    if (i >= octaves) { break; }
    val += amp * snoise(p * freq);
    freq *= 1.9;
    amp *= 0.48;
  }
  return val;
}
