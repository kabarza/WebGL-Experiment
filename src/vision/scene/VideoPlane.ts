import * as THREE from 'three';

export interface VideoPlaneOptions {
  video: HTMLVideoElement;
  mirror?: boolean;
}

const VS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FS = /* glsl */ `
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uViewportAspect;
  uniform float uVideoAspect;
  uniform float uMirror;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float sx = 1.0;
    float sy = 1.0;
    if (uViewportAspect > uVideoAspect) {
      sy = uVideoAspect / uViewportAspect;
    } else {
      sx = uViewportAspect / uVideoAspect;
    }
    uv = (uv - 0.5) * vec2(sx, sy) + 0.5;
    if (uMirror > 0.5) uv.x = 1.0 - uv.x;
    gl_FragColor = texture2D(uTexture, uv);
  }
`;

export class VideoPlane {
  readonly texture: THREE.VideoTexture;
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private mirror: boolean;

  constructor({ video, mirror = true }: VideoPlaneOptions) {
    this.mirror = mirror;

    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    this.texture = tex;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: tex },
        uViewportAspect: { value: 1 },
        uVideoAspect: { value: 1 },
        uMirror: { value: mirror ? 1 : 0 },
      },
      vertexShader: VS,
      fragmentShader: FS,
      depthTest: false,
      depthWrite: false,
    });

    const geo = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
  }

  setAspect(viewportAspect: number, videoAspect: number): void {
    this.material.uniforms.uViewportAspect.value = viewportAspect;
    this.material.uniforms.uVideoAspect.value = videoAspect;
  }

  setMirror(mirror: boolean): void {
    this.mirror = mirror;
    this.material.uniforms.uMirror.value = mirror ? 1 : 0;
  }

  get isMirrored(): boolean {
    return this.mirror;
  }

  dispose(): void {
    this.material.dispose();
    this.mesh.geometry.dispose();
    this.texture.dispose();
  }
}
