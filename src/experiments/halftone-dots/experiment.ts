// ============================================================
// halftone dots — WebGL2 Experiment
// Halftone dot grid: divides a source image into a grid of
// anti-aliased circles, sized by pixel luminance or fixed.
// Supports image and video upload.
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

const FIT_MODES = ['Fill', 'Contain', 'Cover'];

// ── Helpers ────────────────────────────────────────

function hex2rgb(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  ];
}

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

// ── Main ────────────────────────────────────────────

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { gl, canvas, params } = ctx;

  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create program');

  gl.attachShader(prog, mkShader(gl, gl.VERTEX_SHADER, vertGLSL));
  gl.attachShader(prog, mkShader(gl, gl.FRAGMENT_SHADER, fragGLSL));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
  }

  const quad = new FullscreenQuadGL(gl);

  const U: Record<string, WebGLUniformLocation | null> = {};
  const uniformNames = [
    'u_time',
    'u_resolution',
    'u_texture',
    'u_hasTexture',
    'u_textureSize',
    'u_fitMode',
    'u_numSquares',
    'u_depth',
    'u_aspectRatio',
    'u_sizeByLuma',
    'u_fixedRadius',
    'u_bgColor',
    'u_dotColor',
    'u_useSourceColor',
    'u_brightness',
    'u_contrast',
    'u_postSaturation',
  ];
  for (const n of uniformNames) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  // ── Texture state ──────────────────────────────────
  const ASSET_KEY_PREFIX = 'halftone-dots/asset';
  let texture: WebGLTexture | null = null;
  let textureWidth = 0;
  let textureHeight = 0;
  let hasTexture = false;
  let currentAssetUrl = '';
  let currentPresetId = (params._presetId as string) || '';
  let lastPresetChangeTs = 0;
  let lastResetTs = 0;

  function assetKeyForPreset(presetId: string): string {
    return presetId ? `${ASSET_KEY_PREFIX}/${presetId}` : ASSET_KEY_PREFIX;
  }

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

  /** Persist asset data URL to localStorage keyed by the current preset. */
  function persistAsset(dataUrl: string) {
    currentAssetUrl = dataUrl;
    try {
      localStorage.setItem(assetKeyForPreset(currentPresetId), dataUrl);
    } catch {
      // localStorage quota exceeded
    }
  }

  // ── Restore persisted asset on init ────────────────
  const initAsset =
    localStorage.getItem(assetKeyForPreset(currentPresetId)) ?? '';
  if (initAsset) {
    currentAssetUrl = initAsset;
    loadAssetFromDataUrl(initAsset);
  } else {
    // Generate a placeholder gradient so something is visible on first load
    const ph = document.createElement('canvas');
    ph.width = 512;
    ph.height = 512;
    const pctx = ph.getContext('2d')!;
    const grad = pctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#ff6b6b');
    grad.addColorStop(0.33, '#feca57');
    grad.addColorStop(0.66, '#48dbfb');
    grad.addColorStop(1, '#ff9ff3');
    pctx.fillStyle = grad;
    pctx.fillRect(0, 0, 512, 512);
    pctx.fillStyle = '#222';
    pctx.beginPath();
    pctx.arc(256, 256, 120, 0, Math.PI * 2);
    pctx.fill();
    pctx.fillStyle = '#fff';
    pctx.beginPath();
    pctx.arc(256, 256, 60, 0, Math.PI * 2);
    pctx.fill();
    uploadTexture(ph);
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
      a.download = `halftone-dots-${Date.now()}.png`;
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

      // Detect preset change — save asset under old preset, load for new
      const presetChangeTs = (P._presetChanged as number) ?? 0;
      if (presetChangeTs > lastPresetChangeTs) {
        lastPresetChangeTs = presetChangeTs;
        const newPresetId = (P._presetId as string) ?? '';
        if (newPresetId !== currentPresetId) {
          if (currentAssetUrl) {
            try {
              localStorage.setItem(
                assetKeyForPreset(currentPresetId),
                currentAssetUrl,
              );
            } catch {
              /* quota */
            }
          }
          currentPresetId = newPresetId;

          const vid = P._videoElement;
          if (vid instanceof HTMLVideoElement) {
            vid.pause();
            URL.revokeObjectURL(vid.src);
            P._videoElement = null;
          }

          const stored = localStorage.getItem(
            assetKeyForPreset(newPresetId),
          );
          if (stored === null && currentAssetUrl) {
            try {
              localStorage.setItem(
                assetKeyForPreset(newPresetId),
                currentAssetUrl,
              );
            } catch {
              /* quota */
            }
          } else if (stored) {
            currentAssetUrl = stored;
            loadAssetFromDataUrl(stored);
          } else {
            hasTexture = false;
            currentAssetUrl = '';
          }
        }
      }

      // Detect "Reset to Defaults" — clear asset for current preset
      const resetTs = (P._resetTs as number) ?? 0;
      if (resetTs > lastResetTs) {
        lastResetTs = resetTs;
        hasTexture = false;
        currentAssetUrl = '';
        try {
          localStorage.setItem(assetKeyForPreset(currentPresetId), '');
        } catch {
          /* */
        }
        const vid = P._videoElement;
        if (vid instanceof HTMLVideoElement) {
          vid.pause();
          URL.revokeObjectURL(vid.src);
        }
        P._videoElement = null;
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

      gl.uniform1f(U.u_time, time);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

      if (hasTexture && texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(U.u_texture, 0);
      }
      gl.uniform1f(U.u_hasTexture, hasTexture ? 1.0 : 0.0);
      gl.uniform2f(U.u_textureSize, textureWidth, textureHeight);
      gl.uniform1f(
        U.u_fitMode,
        Math.max(FIT_MODES.indexOf(P.fitMode as string), 0),
      );

      gl.uniform1f(U.u_numSquares, P.numSquares as number);
      gl.uniform1i(U.u_depth, P.depth as number);
      gl.uniform1f(U.u_aspectRatio, canvas.width / canvas.height);
      gl.uniform1f(U.u_sizeByLuma, (P.sizeByLuma as boolean) ? 1.0 : 0.0);
      gl.uniform1f(U.u_fixedRadius, P.fixedRadius as number);
      gl.uniform1f(
        U.u_useSourceColor,
        (P.useSourceColor as boolean) ? 1.0 : 0.0,
      );

      const bg = hex2rgb(P.bgColor as string);
      gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);

      const dc = hex2rgb(P.dotColor as string);
      gl.uniform3f(U.u_dotColor, dc[0], dc[1], dc[2]);

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

export const halftonDotsExperiment: Experiment = {
  meta,
  controls,
  initGL: initGL,
};
