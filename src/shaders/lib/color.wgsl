// Color space utilities, grain, contrast

fn rgb2luma(c: vec3f) -> f32 {
  return dot(c, vec3f(0.299, 0.587, 0.114));
}

fn adjustSaturation(color: vec3f, saturation: f32) -> vec3f {
  let luma = rgb2luma(color);
  return mix(vec3f(luma), color, saturation);
}

fn adjustContrast(color: vec3f, contrast: f32) -> vec3f {
  return (color - 0.5) * contrast + 0.5;
}

fn adjustBrightness(color: vec3f, brightness: f32) -> vec3f {
  return color * brightness;
}

fn applyGrain(color: vec3f, grain: f32) -> vec3f {
  return clamp(color + grain, vec3f(0.0), vec3f(1.0));
}
