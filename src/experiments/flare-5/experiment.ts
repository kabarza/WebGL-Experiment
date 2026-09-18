// ============================================================
// Flare-5 — WebGL2 layered analog-light composition
// Aurora drift veils + uploaded image plate + celestial ring +
// film grain, all composited in user-defined layer order.
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

const FIT_MODES: Record<string, number> = {
  cover: 0,
  contain: 1,
  fill: 2,
};

const LAYER_IDS = ['aurora', 'image', 'circle', 'grain'] as const;
type LayerId = (typeof LAYER_IDS)[number];

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

function parseLayerRanks(raw: unknown): Record<LayerId, number> {
  const parsed =
    typeof raw === 'string'
      ? raw
          .split(',')
          .map((part) => part.trim())
          .filter((part): part is LayerId =>
            (LAYER_IDS as readonly string[]).includes(part),
          )
      : [];

  const ordered: LayerId[] = [];
  for (const id of parsed) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  for (const id of LAYER_IDS) {
    if (!ordered.includes(id)) ordered.push(id);
  }

  return ordered.reduce(
    (acc, id, index) => {
      acc[id] = index;
      return acc;
    },
    {
      aurora: 0,
      image: 1,
      circle: 2,
      grain: 3,
    } satisfies Record<LayerId, number>,
  );
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
    'u_bgColor',
    'u_vignette',
    'u_brightness',
    'u_contrast',
    'u_saturation',
    'u_auroraRank',
    'u_imageRank',
    'u_circleRank',
    'u_grainRank',
    'u_auroraOn',
    'u_auroraOpacity',
    'u_auroraColor1',
    'u_auroraColor2',
    'u_auroraColor3',
    'u_auroraColor4',
    'u_auroraWarpOn',
    'u_auroraWarpStrength',
    'u_auroraWarpScale',
    'u_auroraSeed',
    'u_auroraBlobOn',
    'u_auroraBlobSize',
    'u_auroraBlobSpacing',
    'u_auroraBlobRotation',
    'u_auroraBlobSpread',
    'u_auroraBlobOffsetX',
    'u_auroraBlobOffsetY',
    'u_auroraTileSpacing',
    'u_auroraZoom',
    'u_auroraX',
    'u_auroraY',
    'u_auroraBloom',
    'u_auroraPrism',
    'u_auroraSoftness',
    'u_imageTexture',
    'u_hasImage',
    'u_imageSize',
    'u_imageOn',
    'u_imageOpacity',
    'u_imageScale',
    'u_imageOffset',
    'u_imageFit',
    'u_imageSoftness',
    'u_circleOn',
    'u_circlePos',
    'u_circleRadius',
    'u_circleEdge',
    'u_circleDensity',
    'u_circleParticleSize',
    'u_circleSpeed',
    'u_circleOpacity',
    'u_circleTrail',
    'u_circleTwinkle',
    'u_circleColor',
    'u_circleGlow',
    'u_circleSoftness',
    'u_grainOn',
    'u_grainAmount',
    'u_grainSize',
    'u_grainSpeed',
    'u_grainVariation',
    'u_grainX',
  ];
  for (const n of uniformNames) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  // ── Image texture state ───────────────────────────
  const ASSET_KEY_PREFIX = 'flare-5/asset';
  let texture: WebGLTexture | null = null;
  let textureWidth = 0;
  let textureHeight = 0;
  let hasTexture = false;
  let currentAssetUrl = '';
  let currentPresetId = (params._presetId as string) || '';
  let lastPresetChangeTs = 0;
  let lastResetTs = 0;
  let lastActionTs = 0;
  let lastLayerOrder = '';
  let layerRanks = parseLayerRanks(params.layerOrder);

  // Mouse smoothing from Aurora Drift
  let smoothWarpStrength = params.auroraWarpStrength as number;
  let smoothSeed = params.auroraSeed as number;

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
    return c.toDataURL('image/jpeg', 0.9);
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

  try {
    const initAsset = localStorage.getItem(assetKeyForPreset(currentPresetId)) ?? '';
    if (initAsset) {
      currentAssetUrl = initAsset;
      loadAssetFromDataUrl(initAsset);
    }
  } catch {
    // localStorage unavailable
  }

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  const handleFileChange = () => {
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

  fileInput.addEventListener('change', handleFileChange);

  function clearImage() {
    hasTexture = false;
    currentAssetUrl = '';
    textureWidth = 0;
    textureHeight = 0;
    try {
      localStorage.setItem(assetKeyForPreset(currentPresetId), '');
    } catch {
      // localStorage unavailable
    }
  }

  function handleActions() {
    const ts = (params._actionTs as number) ?? 0;
    if (ts === lastActionTs) return;
    lastActionTs = ts;

    const action = params._action as string;
    if (action === 'Image Layer.Upload Image') {
      fileInput.click();
    } else if (action === 'Image Layer.Clear Image') {
      clearImage();
    }
  }

  return {
    render(time: number, _deltaTime: number) {
      const P = params;

      handleActions();

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
              // localStorage unavailable
            }
          }

          currentPresetId = newPresetId;

          const stored = localStorage.getItem(assetKeyForPreset(newPresetId));
          if (stored === null && currentAssetUrl) {
            try {
              localStorage.setItem(assetKeyForPreset(newPresetId), currentAssetUrl);
            } catch {
              // localStorage unavailable
            }
          } else if (stored) {
            currentAssetUrl = stored;
            loadAssetFromDataUrl(stored);
          } else {
            hasTexture = false;
            currentAssetUrl = '';
            textureWidth = 0;
            textureHeight = 0;
          }
        }
      }

      const resetTs = (P._resetTs as number) ?? 0;
      if (resetTs > lastResetTs) {
        lastResetTs = resetTs;
        clearImage();
      }

      const layerOrder = String(P.layerOrder ?? '');
      if (layerOrder !== lastLayerOrder) {
        lastLayerOrder = layerOrder;
        layerRanks = parseLayerRanks(layerOrder);
      }

      const mouseOn = P.auroraMouseOn as boolean;
      const defaultWarp = P.auroraWarpStrength as number;
      const defaultSeed = P.auroraSeed as number;
      if (mouseOn && input.isOver) {
        smoothWarpStrength += (input.mouse.x * 5.0 - smoothWarpStrength) * 0.1;
        smoothSeed += ((input.mouse.y * 2.0 - 1.0) - smoothSeed) * 0.1;
      } else {
        smoothWarpStrength += (defaultWarp - smoothWarpStrength) * 0.1;
        smoothSeed += (defaultSeed - smoothSeed) * 0.1;
      }

      gl.useProgram(prog);
      gl.uniform1f(U.u_time, time);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

      const bg = hex2rgb(P.bgColor as string);
      const auroraColor1 = hex2rgb(P.auroraColor1 as string);
      const auroraColor2 = hex2rgb(P.auroraColor2 as string);
      const auroraColor3 = hex2rgb(P.auroraColor3 as string);
      const auroraColor4 = hex2rgb(P.auroraColor4 as string);
      const circleColor = hex2rgb(P.circleColor as string);

      gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);
      gl.uniform1f(U.u_vignette, P.vignette as number);
      gl.uniform1f(U.u_brightness, P.brightness as number);
      gl.uniform1f(U.u_contrast, P.contrast as number);
      gl.uniform1f(U.u_saturation, P.saturation as number);

      gl.uniform1f(U.u_auroraRank, layerRanks.aurora);
      gl.uniform1f(U.u_imageRank, layerRanks.image);
      gl.uniform1f(U.u_circleRank, layerRanks.circle);
      gl.uniform1f(U.u_grainRank, layerRanks.grain);

      gl.uniform1f(U.u_auroraOn, P.auroraOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_auroraOpacity, P.auroraOpacity as number);
      gl.uniform3f(
        U.u_auroraColor1,
        auroraColor1[0],
        auroraColor1[1],
        auroraColor1[2],
      );
      gl.uniform3f(
        U.u_auroraColor2,
        auroraColor2[0],
        auroraColor2[1],
        auroraColor2[2],
      );
      gl.uniform3f(
        U.u_auroraColor3,
        auroraColor3[0],
        auroraColor3[1],
        auroraColor3[2],
      );
      gl.uniform3f(
        U.u_auroraColor4,
        auroraColor4[0],
        auroraColor4[1],
        auroraColor4[2],
      );
      gl.uniform1f(U.u_auroraWarpOn, P.auroraWarpOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_auroraWarpStrength, smoothWarpStrength);
      gl.uniform1f(U.u_auroraWarpScale, P.auroraWarpScale as number);
      gl.uniform1f(U.u_auroraSeed, smoothSeed);
      gl.uniform1f(U.u_auroraBlobOn, P.auroraBlobOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_auroraBlobSize, P.auroraBlobSize as number);
      gl.uniform1f(U.u_auroraBlobSpacing, P.auroraBlobSpacing as number);
      gl.uniform1f(U.u_auroraBlobRotation, P.auroraBlobRotation as number);
      gl.uniform1f(U.u_auroraBlobSpread, P.auroraBlobSpread as number);
      gl.uniform1f(U.u_auroraBlobOffsetX, P.auroraBlobOffsetX as number);
      gl.uniform1f(U.u_auroraBlobOffsetY, P.auroraBlobOffsetY as number);
      gl.uniform1f(U.u_auroraTileSpacing, P.auroraTileSpacing as number);
      gl.uniform1f(U.u_auroraZoom, P.auroraZoom as number);
      gl.uniform1f(U.u_auroraX, P.auroraX as number);
      gl.uniform1f(U.u_auroraY, P.auroraY as number);
      gl.uniform1f(U.u_auroraBloom, P.auroraBloom as number);
      gl.uniform1f(U.u_auroraPrism, P.auroraPrism as number);
      gl.uniform1f(U.u_auroraSoftness, P.auroraSoftness as number);

      if (hasTexture && texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(U.u_imageTexture, 0);
      }
      gl.uniform1f(U.u_hasImage, hasTexture ? 1.0 : 0.0);
      gl.uniform2f(U.u_imageSize, textureWidth, textureHeight);
      gl.uniform1f(U.u_imageOn, P.imageOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_imageOpacity, P.imageOpacity as number);
      gl.uniform1f(U.u_imageScale, P.imageScale as number);
      gl.uniform2f(U.u_imageOffset, P.imageX as number, P.imageY as number);
      gl.uniform1f(U.u_imageFit, FIT_MODES[P.imageFit as string] ?? 1);
      gl.uniform1f(U.u_imageSoftness, P.imageSoftness as number);

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
      gl.uniform3f(U.u_circleColor, circleColor[0], circleColor[1], circleColor[2]);
      gl.uniform1f(U.u_circleGlow, P.circleGlow as number);
      gl.uniform1f(U.u_circleSoftness, P.circleSoftness as number);

      gl.uniform1f(U.u_grainOn, P.grainOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_grainAmount, P.grainAmount as number);
      gl.uniform1f(U.u_grainSize, P.grainSize as number);
      gl.uniform1f(U.u_grainSpeed, P.grainSpeed as number);
      gl.uniform1f(U.u_grainVariation, P.grainVariation as number);
      gl.uniform1f(U.u_grainX, P.grainX as number);

      quad.bind(prog);
      quad.draw();
    },

    resize(_w: number, _h: number, _dpr: number) {
      gl.viewport(0, 0, canvas.width, canvas.height);
    },

    dispose() {
      fileInput.removeEventListener('change', handleFileChange);
      fileInput.remove();
      if (texture) gl.deleteTexture(texture);
      gl.deleteProgram(prog);
      quad.dispose();
    },
  };
}

export const flare5Experiment: Experiment = {
  meta,
  controls,
  initGL: initGL,
};
