#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D u_src;
void main() { fragColor = texture(u_src, vUv); }
