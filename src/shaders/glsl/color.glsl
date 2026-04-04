// Color utilities
float rgb2luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

vec3 adjustSaturation(vec3 color, float saturation) {
  float luma = rgb2luma(color);
  return mix(vec3(luma), color, saturation);
}

vec3 adjustContrast(vec3 color, float contrast) {
  return (color - 0.5) * contrast + 0.5;
}

vec3 adjustBrightness(vec3 color, float brightness) {
  return color * brightness;
}
