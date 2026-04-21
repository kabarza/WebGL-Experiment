// ============================================================
// Tempo-6 — layered analog composite
// Aurora drift + user image + celestial circle + film grain
// with draggable layer ordering in DialKit.
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

const IMAGE_FIT_MODES: Record<string, number> = {
  cover: 0,
  contain: 1,
  fill: 2,
};

const LAYER_TO_INDEX: Record<string, number> = {
  aurora: 0,
  image: 1,
  circle: 2,
  grain: 3,
};

const DEFAULT_LAYER_IDS = ['aurora', 'image', 'circle', 'grain'];

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

function hex2rgb(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  ];
}

function parseLayerOrder(raw: unknown): [number, number, number, number] {
  const seen = new Set<string>();
  const orderedIds: string[] = [];

  if (typeof raw === 'string') {
    const ids = raw
      .split(/[,\s|>]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    for (const id of ids) {
      if (id in LAYER_TO_INDEX && !seen.has(id)) {
        seen.add(id);
        orderedIds.push(id);
      }
    }
  }

  for (const id of DEFAULT_LAYER_IDS) {
    if (!seen.has(id)) {
      seen.add(id);
      orderedIds.push(id);
    }
  }

  const i0 = LAYER_TO_INDEX[orderedIds[0]];
  const i1 = LAYER_TO_INDEX[orderedIds[1]];
  const i2 = LAYER_TO_INDEX[orderedIds[2]];
  const i3 = LAYER_TO_INDEX[orderedIds[3]];
  return [i0, i1, i2, i3];
}

/** Downscale before persistence to reduce localStorage pressure. */
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
  return c.toDataURL('image/jpeg', 0.88);
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
    'u_time', 'u_resolution', 'u_mouse', 'u_layerOrder',
    'u_bgColor', 'u_brightness', 'u_contrast', 'u_saturation', 'u_lift',

    'u_auroraOn', 'u_auroraOpacity', 'u_auroraX', 'u_auroraZ',
    'u_auroraColor1', 'u_auroraColor2', 'u_auroraColor3', 'u_auroraColor4',
    'u_warpOn', 'u_warpStrength', 'u_warpScale', 'u_seed',
    'u_blobOn', 'u_blobSize', 'u_blobSpacing', 'u_blobRotation', 'u_blobSpread',
    'u_blobOffsetX', 'u_blobOffsetY', 'u_tileSpacing',
    'u_auroraZoom', 'u_auroraOffsetY', 'u_auroraStripeAmount',
    'u_auroraStripeDensity', 'u_auroraTopGlow', 'u_auroraDarkness',

    'u_imageOn', 'u_imageOpacity', 'u_imageX', 'u_imageZ', 'u_imageScale',
    'u_imageFit', 'u_imageSaturation', 'u_imageTint', 'u_hasImage',
    'u_imageTexture', 'u_textureSize',

    'u_circleOn', 'u_circlePos', 'u_circleRadius', 'u_circleEdge',
    'u_circleDensity', 'u_circleParticleSize', 'u_circleSpeed', 'u_circleOpacity',
    'u_circleTrail', 'u_circleTwinkle', 'u_circleLayerX', 'u_circleLayerZ',
    'u_circleColor', 'u_circleBloom', 'u_circleJitter',

    'u_grainOn', 'u_grainAmount', 'u_grainSize', 'u_grainSpeed',
    'u_grainVariation', 'u_grainX', 'u_grainZ', 'u_grainTint',
  ];
  for (const n of uniformNames) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  // ── Layer order cache ─────────────────────────────
  let cachedOrderRaw = '';
  let cachedOrder: [number, number, number, number] = [0, 1, 2, 3];
  function resolveLayerOrder(raw: unknown): [number, number, number, number] {
    const text = typeof raw === 'string' ? raw : '';
    if (text !== cachedOrderRaw) {
      cachedOrder = parseLayerOrder(text);
      cachedOrderRaw = text;
    }
    return cachedOrder;
  }

  // ── Image texture state ───────────────────────────
  const ASSET_KEY_PREFIX = 'tempo-6/image';
  let texture: WebGLTexture | null = null;
  let textureWidth = 1;
  let textureHeight = 1;
  let hasImage = false;
  let currentAssetUrl = '';
  let currentPresetId = (params._presetId as string) || '';
  let lastPresetChangeTs = 0;
  let lastResetTs = 0;

  function assetKeyForPreset(presetId: string): string {
    return presetId ? `${ASSET_KEY_PREFIX}/${presetId}` : ASSET_KEY_PREFIX;
  }

  function uploadTexture(img: HTMLImageElement | HTMLCanvasElement) {
    if (!texture) texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);

    textureWidth = img.width;
    textureHeight = img.height;
    hasImage = true;
  }

  function clearImageLayer() {
    hasImage = false;
    currentAssetUrl = '';
    textureWidth = 1;
    textureHeight = 1;
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
    } catch {
      // localStorage quota exceeded
    }
  }

  // ── Restore persisted image on init ───────────────
  const initAsset = localStorage.getItem(assetKeyForPreset(currentPresetId)) ?? '';
  if (initAsset) {
    currentAssetUrl = initAsset;
    loadAssetFromDataUrl(initAsset);
  }

  // ── File input (hidden) ───────────────────────────
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  const onFileChange = () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      uploadTexture(img);
      persistAsset(imageToDataUrl(img));
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;

    fileInput.value = '';
  };

  fileInput.addEventListener('change', onFileChange);

  // ── Action handling ───────────────────────────────
  let lastActionTs = 0;
  function handleActions() {
    const ts = (params._actionTs as number) ?? 0;
    if (ts === lastActionTs) return;
    lastActionTs = ts;

    const action = params._action as string;
    if (action === 'Image.Upload Image') {
      fileInput.click();
    } else if (action === 'Image.Clear Image') {
      clearImageLayer();
      try {
        localStorage.setItem(assetKeyForPreset(currentPresetId), '');
      } catch {
        // ignore quota errors
      }
    }
  }

  return {
    render(time: number, _deltaTime: number) {
      const P = params;

      handleActions();

      // Preset-aware asset persistence
      const presetChangeTs = (P._presetChanged as number) ?? 0;
      if (presetChangeTs > lastPresetChangeTs) {
        lastPresetChangeTs = presetChangeTs;
        const newPresetId = (P._presetId as string) ?? '';

        if (newPresetId !== currentPresetId) {
          if (currentAssetUrl) {
            try {
              localStorage.setItem(assetKeyForPreset(currentPresetId), currentAssetUrl);
            } catch {
              // ignore quota errors
            }
          }
          currentPresetId = newPresetId;

          // null  -> brand-new preset (inherit current image)
          // ''    -> explicitly cleared image
          // data  -> load persisted image
          const stored = localStorage.getItem(assetKeyForPreset(newPresetId));
          if (stored === null && currentAssetUrl) {
            try {
              localStorage.setItem(assetKeyForPreset(newPresetId), currentAssetUrl);
            } catch {
              // ignore quota errors
            }
          } else if (stored) {
            currentAssetUrl = stored;
            loadAssetFromDataUrl(stored);
          } else {
            clearImageLayer();
          }
        }
      }

      // Reset to defaults clears image for active preset
      const resetTs = (P._resetTs as number) ?? 0;
      if (resetTs > lastResetTs) {
        lastResetTs = resetTs;
        clearImageLayer();
        try {
          localStorage.setItem(assetKeyForPreset(currentPresetId), '');
        } catch {
          // ignore quota errors
        }
      }

      const layerOrder = resolveLayerOrder(P.layerOrder);

      gl.useProgram(prog);
      gl.uniform1f(U.u_time, time);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);
      gl.uniform2f(U.u_mouse, input.mouse.x, input.mouse.y);
      gl.uniform4f(U.u_layerOrder, layerOrder[0], layerOrder[1], layerOrder[2], layerOrder[3]);

      // Base + post
      const bg = hex2rgb(P.bgColor as string);
      gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);
      gl.uniform1f(U.u_brightness, P.brightness as number);
      gl.uniform1f(U.u_contrast, P.contrast as number);
      gl.uniform1f(U.u_saturation, P.saturation as number);
      gl.uniform1f(U.u_lift, P.lift as number);

      // Aurora layer
      gl.uniform1f(U.u_auroraOn, P.auroraOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_auroraOpacity, P.auroraOpacity as number);
      gl.uniform1f(U.u_auroraX, P.auroraX as number);
      gl.uniform1f(U.u_auroraZ, P.auroraZ as number);
      const a1 = hex2rgb(P.auroraColor1 as string);
      const a2 = hex2rgb(P.auroraColor2 as string);
      const a3 = hex2rgb(P.auroraColor3 as string);
      const a4 = hex2rgb(P.auroraColor4 as string);
      gl.uniform3f(U.u_auroraColor1, a1[0], a1[1], a1[2]);
      gl.uniform3f(U.u_auroraColor2, a2[0], a2[1], a2[2]);
      gl.uniform3f(U.u_auroraColor3, a3[0], a3[1], a3[2]);
      gl.uniform3f(U.u_auroraColor4, a4[0], a4[1], a4[2]);
      gl.uniform1f(U.u_warpOn, P.warpOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_warpStrength, P.warpStrength as number);
      gl.uniform1f(U.u_warpScale, P.warpScale as number);
      gl.uniform1f(U.u_seed, P.seed as number);
      gl.uniform1f(U.u_blobOn, P.blobOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_blobSize, P.blobSize as number);
      gl.uniform1f(U.u_blobSpacing, P.blobSpacing as number);
      gl.uniform1f(U.u_blobRotation, P.blobRotation as number);
      gl.uniform1f(U.u_blobSpread, P.blobSpread as number);
      gl.uniform1f(U.u_blobOffsetX, P.blobOffsetX as number);
      gl.uniform1f(U.u_blobOffsetY, P.blobOffsetY as number);
      gl.uniform1f(U.u_tileSpacing, P.tileSpacing as number);
      gl.uniform1f(U.u_auroraZoom, P.auroraZoom as number);
      gl.uniform1f(U.u_auroraOffsetY, P.auroraOffsetY as number);
      gl.uniform1f(U.u_auroraStripeAmount, P.auroraStripeAmount as number);
      gl.uniform1f(U.u_auroraStripeDensity, P.auroraStripeDensity as number);
      gl.uniform1f(U.u_auroraTopGlow, P.auroraTopGlow as number);
      gl.uniform1f(U.u_auroraDarkness, P.auroraDarkness as number);

      // Image layer
      gl.uniform1f(U.u_imageOn, P.imageOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_imageOpacity, P.imageOpacity as number);
      gl.uniform1f(U.u_imageX, P.imageX as number);
      gl.uniform1f(U.u_imageZ, P.imageZ as number);
      gl.uniform1f(U.u_imageScale, P.imageScale as number);
      gl.uniform1f(U.u_imageFit, IMAGE_FIT_MODES[P.imageFit as string] ?? 0);
      gl.uniform1f(U.u_imageSaturation, P.imageSaturation as number);
      const it = hex2rgb(P.imageTint as string);
      gl.uniform3f(U.u_imageTint, it[0], it[1], it[2]);
      gl.uniform1f(U.u_hasImage, hasImage ? 1.0 : 0.0);
      gl.uniform2f(U.u_textureSize, textureWidth, textureHeight);
      if (hasImage && texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(U.u_imageTexture, 0);
      }

      // Circle layer
      gl.uniform1f(U.u_circleOn, P.circleOn ? 1.0 : 0.0);
      gl.uniform2f(U.u_circlePos, P.circleX as number, P.circleY as number);
      gl.uniform1f(U.u_circleRadius, P.circleRadius as number);
      gl.uniform1f(U.u_circleEdge, P.circleEdge as number);
      gl.uniform1f(U.u_circleDensity, P.circleDensity as number);
      gl.uniform1f(U.u_circleParticleSize, P.circleParticleSize as number);
      gl.uniform1f(U.u_circleSpeed, P.circleSpeed as number);
      gl.uniform1f(U.u_circleOpacity, P.circleOpacity as number);
      gl.uniform1f(U.u_circleTrail, P.circleTrail as number);
      gl.uniform1f(U.u_circleTwinkle, P.circleTwinkle as number);
      gl.uniform1f(U.u_circleLayerX, P.circleLayerX as number);
      gl.uniform1f(U.u_circleLayerZ, P.circleLayerZ as number);
      const cc = hex2rgb(P.circleColor as string);
      gl.uniform3f(U.u_circleColor, cc[0], cc[1], cc[2]);
      gl.uniform1f(U.u_circleBloom, P.circleBloom as number);
      gl.uniform1f(U.u_circleJitter, P.circleJitter as number);

      // Grain layer
      gl.uniform1f(U.u_grainOn, P.grainOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_grainAmount, P.grainAmount as number);
      gl.uniform1f(U.u_grainSize, P.grainSize as number);
      gl.uniform1f(U.u_grainSpeed, P.grainSpeed as number);
      gl.uniform1f(U.u_grainVariation, P.grainVariation as number);
      gl.uniform1f(U.u_grainX, P.grainX as number);
      gl.uniform1f(U.u_grainZ, P.grainZ as number);
      const gt = hex2rgb(P.grainTint as string);
      gl.uniform3f(U.u_grainTint, gt[0], gt[1], gt[2]);

      quad.bind(prog);
      quad.draw();
    },

    resize(_w: number, _h: number, _dpr: number) {
      gl.viewport(0, 0, canvas.width, canvas.height);
    },

    dispose() {
      gl.deleteProgram(prog);
      if (texture) gl.deleteTexture(texture);
      quad.dispose();
      fileInput.removeEventListener('change', onFileChange);
      document.body.removeChild(fileInput);
    },
  };
}

export const tempo6Experiment: Experiment = {
  meta,
  controls,
  initGL,
};
