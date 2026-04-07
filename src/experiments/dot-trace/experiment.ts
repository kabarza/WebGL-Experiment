// ============================================================
// dot trace — WebGL2 Experiment
// Progressive dot-dither reveal of uploaded SVG/image content.
// Each dot appears according to a spatial reveal order driven
// by a scrub slider or auto-play.
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

const REVEAL_MODES = ['Radial', 'Sweep Right', 'Sweep Down', 'Random', 'Spiral'];

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

  // ── Uniform locations ──────────────────────────────
  const U: Record<string, WebGLUniformLocation | null> = {};
  const uniformNames = [
    'u_time', 'u_resolution',
    'u_texture', 'u_hasTexture', 'u_textureSize', 'u_fitMode',
    // Layer toggles
    'u_dotsOn',
    // Reveal
    'u_progress', 'u_revealMode', 'u_revealOriginX', 'u_revealOriginY',
    'u_revealSpread', 'u_revealReverse',
    // Dither
    'u_dotSize', 'u_dotSpacing', 'u_dotSoftness',
    'u_gridAngle', 'u_luminanceGamma',
    // Colors
    'u_bgColor', 'u_accent1', 'u_accent2', 'u_neutral',
    'u_colorThreshold', 'u_colorMix',
    // Post
    'u_brightness', 'u_contrast', 'u_postSaturation',
  ];
  for (const n of uniformNames) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  // ── Texture state ──────────────────────────────────
  let texture: WebGLTexture | null = null;
  let textureWidth = 0;
  let textureHeight = 0;
  let hasTexture = false;

  function uploadTexture(
    img: HTMLImageElement | HTMLCanvasElement,
  ) {
    if (!texture) texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
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

  // ── SVG rasterisation helper ───────────────────────
  function rasterizeSVG(svgText: string): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        // Rasterize at a good resolution
        const w = img.naturalWidth || 1024;
        const h = img.naturalHeight || 1024;
        const scale = Math.min(2048 / Math.max(w, h), 2);
        const cw = Math.round(w * scale);
        const ch = Math.round(h * scale);

        const offscreen = document.createElement('canvas');
        offscreen.width = cw;
        offscreen.height = ch;
        const c2d = offscreen.getContext('2d')!;
        c2d.drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        resolve(offscreen);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG'));
      };
      img.src = url;
    });
  }

  // ── File input (hidden) ────────────────────────────
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.svg,image/svg+xml,image/*';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.svg') || file.type === 'image/svg+xml') {
      const text = await file.text();
      const offscreen = await rasterizeSVG(text);
      uploadTexture(offscreen);
    } else {
      const img = new Image();
      img.onload = () => uploadTexture(img);
      img.src = URL.createObjectURL(file);
    }

    fileInput.value = '';
  });

  // ── Action handling ────────────────────────────────
  let lastActionTs = 0;

  function handleActions() {
    const ts = (params._actionTs as number) ?? 0;
    if (ts === lastActionTs) return;
    lastActionTs = ts;

    const action = params._action as string;
    if (action === 'Source.UploadSVG') {
      fileInput.click();
    } else if (action === 'Source.Take Snapshot') {
      takeSnapshot();
    }
  }

  function takeSnapshot() {
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dot-trace-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      'image/png',
    );
  }

  // ── Auto-play state ───────────────────────────────
  let autoProgress = 0;

  // ── Render / resize / dispose ──────────────────────
  return {
    render(time: number, deltaTime: number) {
      const P = params;

      handleActions();

      // Playback mode
      if (P.playMode === 'Auto Play') {
        autoProgress += deltaTime * (P.playSpeed as number);
        if (autoProgress > 1.0) {
          autoProgress = (P.looping as boolean) ? 0.0 : 1.0;
        }
      } else {
        autoProgress = P.progress as number;
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
      gl.uniform1f(
        U.u_fitMode,
        Math.max(FIT_MODES.indexOf(P.fitMode as string), 0),
      );

      // Layer toggles
      gl.uniform1f(U.u_dotsOn, P.dotsOn ? 1.0 : 0.0);

      // Reveal
      gl.uniform1f(U.u_progress, autoProgress);
      gl.uniform1f(
        U.u_revealMode,
        Math.max(REVEAL_MODES.indexOf(P.revealMode as string), 0),
      );
      gl.uniform1f(U.u_revealOriginX, P.revealOriginX as number);
      gl.uniform1f(U.u_revealOriginY, P.revealOriginY as number);
      gl.uniform1f(U.u_revealSpread, P.revealSpread as number);
      gl.uniform1f(U.u_revealReverse, P.revealReverse ? 1.0 : 0.0);

      // Dither
      gl.uniform1f(U.u_dotSize, P.dotSize as number);
      gl.uniform1f(U.u_dotSpacing, P.dotSpacing as number);
      gl.uniform1f(U.u_dotSoftness, P.dotSoftness as number);
      gl.uniform1f(U.u_gridAngle, P.gridAngle as number);
      gl.uniform1f(U.u_luminanceGamma, P.luminanceGamma as number);

      // Colors
      const bg = hex2rgb(P.bgColor as string);
      gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);
      const a1 = hex2rgb(P.accent1 as string);
      gl.uniform3f(U.u_accent1, a1[0], a1[1], a1[2]);
      const a2 = hex2rgb(P.accent2 as string);
      gl.uniform3f(U.u_accent2, a2[0], a2[1], a2[2]);
      const nt = hex2rgb(P.neutral as string);
      gl.uniform3f(U.u_neutral, nt[0], nt[1], nt[2]);
      gl.uniform1f(U.u_colorThreshold, P.colorThreshold as number);
      gl.uniform1f(U.u_colorMix, P.colorMix as number);

      // Post
      gl.uniform1f(U.u_brightness, P.brightness as number);
      gl.uniform1f(U.u_contrast, P.contrast as number);
      gl.uniform1f(U.u_postSaturation, P.postSaturation as number);

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
      fileInput.remove();
    },
  };
}

export const dotTraceExperiment: Experiment = {
  meta,
  controls,
  initGL: initGL,
};
