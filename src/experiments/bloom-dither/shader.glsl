precision highp float;

varying vec2 vUv;
uniform vec2 u_resolution;
uniform sampler2D u_scene;
uniform float u_ditherOn;
uniform float u_ditherSize;
uniform vec3 u_bgColor;

void main() {
  if (u_ditherOn > 0.5) {
    float dotPx = max(u_ditherSize, 2.0);
    vec2 cellSz = dotPx / u_resolution;
    vec2 cell = floor(vUv / cellSz);
    vec2 center = (cell + 0.5) * cellSz;
    vec2 local = (vUv - cell * cellSz) / cellSz - 0.5;

    vec3 scene = texture2D(u_scene, center).rgb;
    float luma = dot(scene, vec3(0.299, 0.587, 0.114));

    float dotR = sqrt(max(luma, 0.0)) * 0.46;
    float d = length(local);
    float alpha = 1.0 - smoothstep(dotR - 0.04, dotR, d);

    gl_FragColor = vec4(mix(u_bgColor, scene, alpha), 1.0);
  } else {
    gl_FragColor = texture2D(u_scene, vUv);
  }
}
