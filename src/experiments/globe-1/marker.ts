// ============================================================
// Globe 1 — Country marker (cross sprite/mesh + CSS2D label)
// ============================================================

import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { latLonToVec3, MARKER_RADIUS } from './helpers.ts';
import type { Country } from './params.ts';

const STYLE_ID = 'globe-1-css';

// Cache the last (color, size, offset) we wrote into the style tag so
// we don't trash the DOM every frame on no-op updates.
let lastLabelColor = '';
let lastFontSize = -1;
let lastOffsetY = NaN;

export function ensureLabelStyles(labelColor: string, fontSizePx: number, offsetYPx: number) {
  if (
    labelColor === lastLabelColor &&
    fontSizePx === lastFontSize &&
    offsetYPx === lastOffsetY
  ) {
    return;
  }
  lastLabelColor = labelColor;
  lastFontSize = fontSizePx;
  lastOffsetY = offsetYPx;

  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = `
    .globe-1-label-root {
      display: inline-block;
      position: relative;
      pointer-events: none;
      transform: translateY(${offsetYPx}px);
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: ${fontSizePx}px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: ${labelColor};
      white-space: nowrap;
      transition: opacity 200ms ease, color 240ms ease;
      text-align: center;
      line-height: 1;
      will-change: opacity;
    }
    .globe-1-label-root.is-flash {
      color: #ffffff;
      text-shadow: 0 0 12px rgba(255,255,255,0.75);
    }
  `;
}

// Shared planar geometry used by the surface-cross variant.
const SURFACE_CROSS_GEOMETRY = new THREE.PlaneGeometry(1, 1);

export class CountryMarker {
  group = new THREE.Group();
  cross: THREE.Sprite | THREE.Mesh;
  material: THREE.SpriteMaterial | THREE.MeshBasicMaterial;
  label: CSS2DObject;
  labelEl: HTMLElement;
  flashUntil = 0;
  basePosition = new THREE.Vector3();
  surface: boolean;

  // Scratch Color objects — reused each flash frame so we don't churn GC.
  private _baseCol = new THREE.Color();
  private _accentCol = new THREE.Color();
  private _lerpCol = new THREE.Color();

  constructor(country: Country, crossTex: THREE.Texture, surface: boolean) {
    this.surface = surface;

    if (surface) {
      // Tangent plane: small textured quad whose normal aligns with
      // the sphere's surface normal at the country's lat/lon. Uses
      // DoubleSide because Mesh.lookAt(0,0,0) points local +Z inward.
      const m = new THREE.MeshBasicMaterial({
        map: crossTex,
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      this.material = m;
      this.cross = new THREE.Mesh(SURFACE_CROSS_GEOMETRY, m);
    } else {
      const m = new THREE.SpriteMaterial({
        map: crossTex,
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });
      this.material = m;
      this.cross = new THREE.Sprite(m);
    }
    this.cross.scale.set(0.05, 0.05, 1);
    this.cross.renderOrder = 4;

    // CSS2DRenderer overwrites inline `transform` on its target every
    // frame — so the projected element is a wrapper, and the styled
    // label sits inside it where our offset survives.
    const labelWrap = document.createElement('div');
    labelWrap.style.pointerEvents = 'none';
    this.labelEl = document.createElement('span');
    this.labelEl.className = 'globe-1-label-root';
    this.labelEl.textContent = country.name;
    labelWrap.appendChild(this.labelEl);
    this.label = new CSS2DObject(labelWrap);

    this.group.add(this.cross);
    this.group.add(this.label);
  }

  setPosition(latDeg: number, lonDeg: number) {
    latLonToVec3(latDeg, lonDeg, MARKER_RADIUS, this.basePosition);
    this.group.position.copy(this.basePosition);
    if (this.surface) {
      // Object3D.lookAt on a Mesh orients local +Z toward target —
      // so lookAt(0,0,0) makes the plane lie tangent to the sphere
      // (DoubleSide makes which face is outward irrelevant).
      this.cross.lookAt(0, 0, 0);
    }
  }
  setColors(crossHex: string, labelHex: string) {
    this.material.color.set(crossHex);
    if (this.labelEl.style.color !== labelHex) {
      this.labelEl.style.color = labelHex;
    }
  }
  setSize(size: number) {
    this.cross.scale.set(size, size, 1);
  }
  setVisible(v: boolean) {
    this.cross.visible = v;
  }
  setLabelVisible(v: boolean) {
    this.labelEl.style.visibility = v ? 'visible' : 'hidden';
  }
  setOpacity(o: number) {
    this.material.opacity = o;
    this.labelEl.style.opacity = String(o);
  }
  flash(now: number, duration: number) {
    this.flashUntil = now + duration;
    this.labelEl.classList.add('is-flash');
  }
  updateFlash(now: number, duration: number, baseHex: string, accentHex: string) {
    if (this.flashUntil <= 0) return;
    const remaining = this.flashUntil - now;
    if (remaining <= 0) {
      this.flashUntil = 0;
      this.material.color.set(baseHex);
      this.labelEl.classList.remove('is-flash');
      return;
    }
    const t = remaining / duration;
    this._baseCol.set(baseHex);
    this._accentCol.set(accentHex);
    this._lerpCol.copy(this._baseCol).lerp(this._accentCol, t);
    this.material.color.copy(this._lerpCol);
  }
  // Used by the front/back visibility test in the render loop.
  getSpriteWorldPos(out: THREE.Vector3): THREE.Vector3 {
    return this.cross.getWorldPosition(out);
  }
  dispose() {
    this.material.dispose();
    if (this.labelEl.parentElement) this.labelEl.parentElement.removeChild(this.labelEl);
  }
}
