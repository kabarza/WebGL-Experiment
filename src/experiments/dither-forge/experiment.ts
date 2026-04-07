// ============================================================
// dither forge — WebGL2 Experiment
// Halftone glyph dithering with 3-colour palette, chromatic
// aberration, edge detection, configurable mouse interaction,
// vignette, grain, and image/video upload.
// ============================================================

import type {
  Experiment,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { FullscreenQuadGL } from '../../core/FullscreenQuadGL.ts';
import { meta } from './meta.ts';
import { controls } from './params.ts';
import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

function hex2rgb(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  ];
}

const FIT_MODES: Record<string, number> = { cover: 0, contain: 1, fill: 2 };
const GLYPH_SHAPES: Record<string, number> = {
  circle: 0,
  diamond: 1,
  cross: 2,
  line: 3,
};

function mkShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('Failed to create shader');
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader compile error: ${info}`);
  }
  return s;
}

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { gl, canvas, params, input } = ctx;

  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create program');

  gl.attachShader(prog, mkShader(gl, gl.VERTEX_SHADER, vertGLSL));
  gl.attachShader(prog, mkShader(gl, gl.FRAGMENT_SHADER, fragGLSL));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
  }

  const quad = new FullscreenQuadGL(gl);

  // ── Uniform locations ──────────────────────────────
  const U: Record<string, WebGLUniformLocation | null> = {};
  const uniformNames = [
    'u_time',
    'u_resolution',
    'u_texture',
    'u_hasTexture',
    'u_textureSize',
    'u_fitMode',
    'u_mouse',
    'u_mouseOver',
    // Mouse interaction
    'u_mouseOn',
    'u_mouseRadius',
    'u_mouseOpacity',
    'u_mouseSizeBoost',
    'u_mouseBrightBoost',
    'u_mouseSatBoost',
    'u_mouseColorShift',
    'u_mouseReveal',
    // Layer toggles
    'u_ditherOn',
    'u_edgeOn',
    'u_animOn',
    'u_chromaticOn',
    'u_vignetteOn',
    'u_grainOn',
    // Dither
    'u_glyphSize',
    'u_glyphSpacing',
    'u_glyphSoftness',
    'u_gridAngle',
    'u_luminanceGamma',
    'u_glyphShape',
    'u_invert',
    // Palette
    'u_bgColor',
    'u_accent1',
    'u_accent2',
    'u_accent3',
    'u_neutral',
    'u_colorThreshold',
    'u_colorMix',
    'u_glyphHueJitter',
    'u_glyphBrightJitter',
    // Edges
    'u_edgeThreshold',
    'u_edgeWidth',
    'u_edgeColor',
    'u_edgeOpacity',
    // Chromatic
    'u_chromaticOffset',
    // Vignette
    'u_vignetteStrength',
    'u_vignetteSize',
    // Grain
    'u_grainAmount',
    'u_grainSpeed',
    // Animation
    'u_animSpeed',
    'u_animJitter',
    'u_animPulse',
    // Post
    'u_brightness',
    'u_contrast',
    'u_postSaturation',
  ];
  for (const n of uniformNames) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  // ── Texture state ──────────────────────────────────
  const ASSET_STORAGE_KEY = 'dither-forge/asset';
  let texture: WebGLTexture | null = null;
  let textureWidth = 0;
  let textureHeight = 0;
  let hasTexture = false;
  let currentAssetUrl = ''; // tracks _assetDataUrl to detect version switches

  function uploadTexture(
    img: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  ) {
    if (!texture) texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);

    textureWidth =
      img instanceof HTMLVideoElement ? img.videoWidth : img.width;
    textureHeight =
      img instanceof HTMLVideoElement ? img.videoHeight : img.height;
    hasTexture = true;
  }

  /** Downscale an image to fit within maxDim and return a JPEG data URL. */
  function imageToDataUrl(img: HTMLImageElement, maxDim = 2048): string {
    let w = img.width;
    let h = img.height;
    if (Math.max(w, h) > maxDim) {
      const scale = maxDim / Math.max(w, h);
      w = Math.floor(w * scale);
      h = Math.floor(h * scale);
    }
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.85);
  }

  /** Load a data URL into the WebGL texture. */
  function loadAssetFromDataUrl(dataUrl: string) {
    const img = new Image();
    img.onload = () => uploadTexture(img);
    img.src = dataUrl;
  }

  /** Persist asset data URL to params (picked up by version save) and localStorage. */
  function persistAsset(dataUrl: string) {
    params._assetDataUrl = dataUrl;
    currentAssetUrl = dataUrl;
    try {
      localStorage.setItem(ASSET_STORAGE_KEY, dataUrl);
    } catch {
      // localStorage quota exceeded — version system will still have it
    }
  }

  // ── Restore persisted asset on init ────────────────
  const initAsset =
    (params._assetDataUrl as string) ||
    localStorage.getItem(ASSET_STORAGE_KEY) ||
    '';
  if (initAsset) {
    currentAssetUrl = initAsset;
    params._assetDataUrl = initAsset;
    loadAssetFromDataUrl(initAsset);
  }

  // ── File input (hidden) ────────────────────────────
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,video/*';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.play();
      video.addEventListener('loadeddata', () => {
        params._videoElement = video;
        uploadTexture(video);
        // Videos are too large to persist as data URLs — only effect
        // settings survive version switches, not the video itself.
      });
    } else {
      const img = new Image();
      img.onload = () => {
        params._videoElement = null;
        uploadTexture(img);
        persistAsset(imageToDataUrl(img));
      };
      img.src = URL.createObjectURL(file);
    }

    fileInput.value = '';
  });

  // ── Action handling ────────────────────────────────
  let lastActionTs = 0;
  let pendingSnapshot = false;

  function handleActions() {
    const ts = (params._actionTs as number) ?? 0;
    if (ts === lastActionTs) return;
    lastActionTs = ts;

    const action = params._action as string;
    if (action === 'Source.Upload Asset') {
      fileInput.click();
    } else if (action === 'Source.Take Snapshot') {
      pendingSnapshot = true;
    }
  }

  function captureSnapshot() {
    const w = canvas.width;
    const h = canvas.height;
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Flip vertically — WebGL reads bottom-to-top
    const rowSize = w * 4;
    const halfH = Math.floor(h / 2);
    const tmp = new Uint8Array(rowSize);
    for (let y = 0; y < halfH; y++) {
      const topOff = y * rowSize;
      const botOff = (h - 1 - y) * rowSize;
      tmp.set(pixels.subarray(topOff, topOff + rowSize));
      pixels.copyWithin(topOff, botOff, botOff + rowSize);
      pixels.set(tmp, botOff);
    }

    const c2d = document.createElement('canvas');
    c2d.width = w;
    c2d.height = h;
    const ctx2d = c2d.getContext('2d')!;
    const imgData = new ImageData(new Uint8ClampedArray(pixels.buffer), w, h);
    ctx2d.putImageData(imgData, 0, 0);

    c2d.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dither-forge-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  // ── Render / resize / dispose ──────────────────────
  return {
    render(time: number, _deltaTime: number) {
      const P = params;

      handleActions();

      // Detect asset change from version switch
      const assetUrl = (P._assetDataUrl as string) ?? '';
      if (assetUrl !== currentAssetUrl) {
        currentAssetUrl = assetUrl;
        if (assetUrl) {
          loadAssetFromDataUrl(assetUrl);
          try { localStorage.setItem(ASSET_STORAGE_KEY, assetUrl); } catch { /* quota */ }
        } else {
          hasTexture = false;
          localStorage.removeItem(ASSET_STORAGE_KEY);
        }
      }

      // Update video texture each frame while playing
      const video = P._videoElement;
      if (
        video instanceof HTMLVideoElement &&
        !video.paused &&
        !video.ended
      ) {
        uploadTexture(video);
      }

      gl.useProgram(prog);

      // Core
      gl.uniform1f(U.u_time, time);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

      // Texture
      if (hasTexture && texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(U.u_texture, 0);
      }
      gl.uniform1f(U.u_hasTexture, hasTexture ? 1.0 : 0.0);
      gl.uniform2f(U.u_textureSize, textureWidth, textureHeight);
      gl.uniform1f(U.u_fitMode, FIT_MODES[P.fitMode as string] ?? 0);

      // Mouse
      gl.uniform2f(U.u_mouse, input.mouse.x, input.mouse.y);
      gl.uniform1f(U.u_mouseOver, input.isOver ? 1.0 : 0.0);
      gl.uniform1f(U.u_mouseOn, P.mouseOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_mouseRadius, P.mouseRadius as number);
      gl.uniform1f(U.u_mouseOpacity, P.mouseOpacity as number);
      gl.uniform1f(U.u_mouseSizeBoost, P.mouseSizeBoost as number);
      gl.uniform1f(U.u_mouseBrightBoost, P.mouseBrightBoost as number);
      gl.uniform1f(U.u_mouseSatBoost, P.mouseSatBoost as number);
      gl.uniform1f(U.u_mouseColorShift, P.mouseColorShift as number);
      gl.uniform1f(U.u_mouseReveal, P.mouseReveal as number);

      // Layer toggles
      gl.uniform1f(U.u_ditherOn, P.ditherOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_edgeOn, P.edgeOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_animOn, P.animOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_chromaticOn, P.chromaticOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_vignetteOn, P.vignetteOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_grainOn, P.grainOn ? 1.0 : 0.0);

      // Dither
      gl.uniform1f(U.u_glyphSize, P.glyphSize as number);
      gl.uniform1f(U.u_glyphSpacing, P.glyphSpacing as number);
      gl.uniform1f(U.u_glyphSoftness, P.glyphSoftness as number);
      gl.uniform1f(U.u_gridAngle, P.gridAngle as number);
      gl.uniform1f(U.u_luminanceGamma, P.luminanceGamma as number);
      gl.uniform1f(U.u_glyphShape, GLYPH_SHAPES[P.glyphShape as string] ?? 0);
      gl.uniform1f(U.u_invert, P.invert ? 1.0 : 0.0);

      // Palette
      const bg = hex2rgb(P.bgColor as string);
      gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);
      const a1 = hex2rgb(P.accent1 as string);
      gl.uniform3f(U.u_accent1, a1[0], a1[1], a1[2]);
      const a2 = hex2rgb(P.accent2 as string);
      gl.uniform3f(U.u_accent2, a2[0], a2[1], a2[2]);
      const a3 = hex2rgb(P.accent3 as string);
      gl.uniform3f(U.u_accent3, a3[0], a3[1], a3[2]);
      const nt = hex2rgb(P.neutral as string);
      gl.uniform3f(U.u_neutral, nt[0], nt[1], nt[2]);
      gl.uniform1f(U.u_colorThreshold, P.colorThreshold as number);
      gl.uniform1f(U.u_colorMix, P.colorMix as number);
      gl.uniform1f(U.u_glyphHueJitter, P.glyphHueJitter as number);
      gl.uniform1f(U.u_glyphBrightJitter, P.glyphBrightJitter as number);

      // Edges
      gl.uniform1f(U.u_edgeThreshold, P.edgeThreshold as number);
      gl.uniform1f(U.u_edgeWidth, P.edgeWidth as number);
      const ec = hex2rgb(P.edgeColor as string);
      gl.uniform3f(U.u_edgeColor, ec[0], ec[1], ec[2]);
      gl.uniform1f(U.u_edgeOpacity, P.edgeOpacity as number);

      // Chromatic
      gl.uniform1f(U.u_chromaticOffset, P.chromaticOffset as number);

      // Vignette
      gl.uniform1f(U.u_vignetteStrength, P.vignetteStrength as number);
      gl.uniform1f(U.u_vignetteSize, P.vignetteSize as number);

      // Grain
      gl.uniform1f(U.u_grainAmount, P.grainAmount as number);
      gl.uniform1f(U.u_grainSpeed, P.grainSpeed as number);

      // Animation
      gl.uniform1f(U.u_animSpeed, P.animSpeed as number);
      gl.uniform1f(U.u_animJitter, P.animJitter as number);
      gl.uniform1f(U.u_animPulse, P.animPulse as number);

      // Post
      gl.uniform1f(U.u_brightness, P.brightness as number);
      gl.uniform1f(U.u_contrast, P.contrast as number);
      gl.uniform1f(U.u_postSaturation, P.postSaturation as number);

      quad.bind(prog);
      quad.draw();

      if (pendingSnapshot) {
        pendingSnapshot = false;
        captureSnapshot();
      }
    },

    resize(_w: number, _h: number, _dpr: number) {
      gl.viewport(0, 0, canvas.width, canvas.height);
    },

    dispose() {
      gl.deleteProgram(prog);
      if (texture) gl.deleteTexture(texture);
      quad.dispose();
      fileInput.remove();
      const video = params._videoElement as HTMLVideoElement | null;
      if (video) {
        video.pause();
        URL.revokeObjectURL(video.src);
      }
    },
  };
}

export const ditherForgeExperiment: Experiment = {
  meta,
  controls,
  initGL: initGL,
};
