// ============================================================
// Halftone Pulse — WebGL2 Experiment
// Animated halftone grid: procedural circles driven by ripples,
// noise, and pulse with mouse interaction. Supports image/video
// upload as source texture for color and luma-driven radius.
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

  const U: Record<string, WebGLUniformLocation | null> = {};
  const uniformNames = [
    'u_time',
    'u_resolution',
    // Source texture
    'u_texture',
    'u_hasTexture',
    'u_textureSize',
    'u_fitMode',
    'u_texInfluence',
    'u_useSourceColor',
    // Grid
    'u_numSquares',
    'u_baseRadius',
    // Noise 1
    'u_noiseOn',
    'u_noiseScale',
    'u_noiseSpeed',
    'u_noiseStrength',
    // Noise 2 (flow)
    'u_noise2On',
    'u_noise2Scale',
    'u_noise2Speed',
    'u_noise2Strength',
    // Texture warp
    'u_texWarpOn',
    'u_texWarpScale',
    'u_texWarpSpeed',
    'u_texWarpStrength',
    // Pulse
    'u_pulseOn',
    'u_pulseRate',
    'u_pulseDepth',
    'u_pulseWave',
    // Color
    'u_colorOn',
    'u_colorA',
    'u_colorB',
    'u_colorSpeed',
    'u_colorAngle',
    'u_colorNoiseAmt',
    // Mouse
    'u_mousePos',
    'u_mouseNoiseBoost',
    'u_mouseRepel',
    'u_mouseRadius',
    // Colors / background
    'u_bgColor',
    'u_dotColor',
    // Post
    'u_brightness',
    'u_contrast',
    'u_postSaturation',
  ];
  for (const n of uniformNames) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  // ── Texture state ──────────────────────────────────
  const ASSET_KEY_PREFIX = 'halftone-pulse/asset';
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

  function loadAssetFromDataUrl(dataUrl: string) {
    const img = new Image();
    img.onload = () => uploadTexture(img);
    img.src = dataUrl;
  }

  function persistAsset(dataUrl: string) {
    currentAssetUrl = dataUrl;
    try {
      localStorage.setItem(assetKeyForPreset(currentPresetId), dataUrl);
    } catch { /* localStorage quota exceeded */ }
  }

  // Restore persisted asset on init
  const initAsset = localStorage.getItem(assetKeyForPreset(currentPresetId)) ?? '';
  if (initAsset) {
    currentAssetUrl = initAsset;
    loadAssetFromDataUrl(initAsset);
  }

  // ── File input ────────────────────────────────────
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

  // ── Actions ───────────────────────────────────────
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
      a.download = `halftone-pulse-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  // ── Render ────────────────────────────────────────
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
            try { localStorage.setItem(assetKeyForPreset(currentPresetId), currentAssetUrl); } catch { /* quota */ }
          }
          currentPresetId = newPresetId;

          const vid = P._videoElement;
          if (vid instanceof HTMLVideoElement) {
            vid.pause();
            URL.revokeObjectURL(vid.src);
            P._videoElement = null;
          }

          const stored = localStorage.getItem(assetKeyForPreset(newPresetId));
          if (stored === null && currentAssetUrl) {
            try { localStorage.setItem(assetKeyForPreset(newPresetId), currentAssetUrl); } catch { /* quota */ }
          } else if (stored) {
            currentAssetUrl = stored;
            loadAssetFromDataUrl(stored);
          } else {
            hasTexture = false;
            currentAssetUrl = '';
          }
        }
      }

      // Detect reset — clear asset for current preset
      const resetTs = (P._resetTs as number) ?? 0;
      if (resetTs > lastResetTs) {
        lastResetTs = resetTs;
        hasTexture = false;
        currentAssetUrl = '';
        try { localStorage.setItem(assetKeyForPreset(currentPresetId), ''); } catch { /* */ }
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

      // Source texture
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
      gl.uniform1f(U.u_texInfluence, P.texInfluence as number);
      gl.uniform1f(
        U.u_useSourceColor,
        (P.useSourceColor as boolean) ? 1.0 : 0.0,
      );

      // Grid
      gl.uniform1f(U.u_numSquares, P.numSquares as number);
      gl.uniform1f(U.u_baseRadius, P.baseRadius as number);

      // Noise 1
      gl.uniform1f(U.u_noiseOn, (P.noiseOn as boolean) ? 1.0 : 0.0);
      gl.uniform1f(U.u_noiseScale, P.noiseScale as number);
      gl.uniform1f(U.u_noiseSpeed, P.noiseSpeed as number);
      gl.uniform1f(U.u_noiseStrength, P.noiseStrength as number);

      // Noise 2 (flow)
      gl.uniform1f(U.u_noise2On, (P.noise2On as boolean) ? 1.0 : 0.0);
      gl.uniform1f(U.u_noise2Scale, P.noise2Scale as number);
      gl.uniform1f(U.u_noise2Speed, P.noise2Speed as number);
      gl.uniform1f(U.u_noise2Strength, P.noise2Strength as number);

      // Texture warp
      gl.uniform1f(U.u_texWarpOn, (P.texWarpOn as boolean) ? 1.0 : 0.0);
      gl.uniform1f(U.u_texWarpScale, P.texWarpScale as number);
      gl.uniform1f(U.u_texWarpSpeed, P.texWarpSpeed as number);
      gl.uniform1f(U.u_texWarpStrength, P.texWarpStrength as number);

      // Pulse
      gl.uniform1f(U.u_pulseOn, (P.pulseOn as boolean) ? 1.0 : 0.0);
      gl.uniform1f(U.u_pulseRate, P.pulseRate as number);
      gl.uniform1f(U.u_pulseDepth, P.pulseDepth as number);
      gl.uniform1f(U.u_pulseWave, P.pulseWave as number);

      // Color
      gl.uniform1f(U.u_colorOn, (P.colorOn as boolean) ? 1.0 : 0.0);
      const cA = hex2rgb(P.colorA as string);
      gl.uniform3f(U.u_colorA, cA[0], cA[1], cA[2]);
      const cB = hex2rgb(P.colorB as string);
      gl.uniform3f(U.u_colorB, cB[0], cB[1], cB[2]);
      gl.uniform1f(U.u_colorSpeed, P.colorSpeed as number);
      gl.uniform1f(U.u_colorAngle, P.colorAngle as number);
      gl.uniform1f(U.u_colorNoiseAmt, P.colorNoiseAmt as number);

      // Mouse
      gl.uniform2f(U.u_mousePos, input.mouse.x, input.mouse.y);
      gl.uniform1f(U.u_mouseNoiseBoost, P.mouseNoiseBoost as number);
      gl.uniform1f(U.u_mouseRepel, P.mouseRepel as number);
      gl.uniform1f(U.u_mouseRadius, P.mouseRadius as number);

      // Colors / background
      const bg = hex2rgb(P.bgColor as string);
      gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);
      const dc = hex2rgb(P.dotColor as string);
      gl.uniform3f(U.u_dotColor, dc[0], dc[1], dc[2]);

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

export const halftonePulseExperiment: Experiment = {
  meta,
  controls,
  initGL: initGL,
};
