// FBM — requires noise.glsl (snoise)
float fbm(vec3 p, int octaves) {
  float val = 0.0, amp = 0.55, freq = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    val += amp * snoise(p * freq);
    freq *= 1.9;
    amp *= 0.48;
  }
  return val;
}
