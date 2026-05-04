// ============================================================
// Globe 1 — Snake head icon (GPS arrow CSS2DObject)
// ============================================================
//
// HTML/SVG element mounted as a CSS2DObject and parented to `world`,
// so its world matrix tracks the globe rotation. Each frame the
// render loop:
//   1. positions it at the snake head's local position (same space as
//      the path samples), and
//   2. rotates the inner element by the screen-space heading of the
//      path tangent.

import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const ICON_STYLE_ID = 'globe-1-snake-icon-css';
const SNAKE_ICON_SVG_PATH =
  'M443.537,3.805c-3.84-3.84-9.686-4.893-14.625-2.613L7.553,195.239' +
  'c-4.827,2.215-7.807,7.153-7.535,12.459c0.254,5.305,3.727,9.908,8.762,11.63' +
  'l129.476,44.289c21.349,7.314,38.125,24.089,45.438,45.438l44.321,129.509' +
  'c1.72,5.018,6.325,8.491,11.63,8.762c5.306,0.271,10.244-2.725,12.458-7.535' +
  'L446.15,18.429C448.428,13.491,447.377,7.644,443.537,3.805z';

function ensureSnakeIconStyles() {
  if (document.getElementById(ICON_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = ICON_STYLE_ID;
  el.textContent = `
    .globe-1-snake-icon {
      pointer-events: none;
      will-change: opacity;
    }
    .globe-1-snake-icon-rotor {
      display: block;
      transform-origin: 50% 50%;
      will-change: transform;
      line-height: 0;
    }
    .globe-1-snake-icon-svg {
      display: block;
      overflow: visible;
    }
  `;
  document.head.appendChild(el);
}

export class SnakeIcon {
  el: HTMLElement;
  rotor: HTMLElement;
  svgEl: SVGSVGElement;
  pathEl: SVGPathElement;
  obj: CSS2DObject;
  size = 22;
  rotationOffsetDeg = 0;
  lastHeadingDeg = 0;
  private _lastColor = '';

  constructor() {
    ensureSnakeIconStyles();
    const wrap = document.createElement('div');
    wrap.className = 'globe-1-snake-icon';

    this.rotor = document.createElement('div');
    this.rotor.className = 'globe-1-snake-icon-rotor';

    const svgNS = 'http://www.w3.org/2000/svg';
    this.svgEl = document.createElementNS(svgNS, 'svg');
    this.svgEl.setAttribute('viewBox', '0 0 447.342 447.342');
    this.svgEl.setAttribute('class', 'globe-1-snake-icon-svg');
    this.svgEl.setAttribute('xmlns', svgNS);

    const g = document.createElementNS(svgNS, 'g');
    // -45° around the path's bbox center so 0° heading = north.
    g.setAttribute('transform', 'rotate(-45 223.671 223.671)');

    this.pathEl = document.createElementNS(svgNS, 'path');
    this.pathEl.setAttribute('d', SNAKE_ICON_SVG_PATH);
    this.pathEl.setAttribute('fill', 'currentColor');
    g.appendChild(this.pathEl);
    this.svgEl.appendChild(g);

    this.rotor.appendChild(this.svgEl);
    wrap.appendChild(this.rotor);
    this.el = wrap;

    this.obj = new CSS2DObject(wrap);
    this.applySize();
  }

  setSize(px: number) {
    if (px === this.size) return;
    this.size = px;
    this.applySize();
  }
  private applySize() {
    this.svgEl.setAttribute('width', String(this.size));
    this.svgEl.setAttribute('height', String(this.size));
  }
  setColor(hex: string) {
    if (hex === this._lastColor) return;
    this._lastColor = hex;
    this.el.style.color = hex;
  }
  setRotationOffset(deg: number) {
    if (deg === this.rotationOffsetDeg) return;
    this.rotationOffsetDeg = deg;
    this.applyRotation();
  }
  setHeading(deg: number) {
    this.lastHeadingDeg = deg;
    this.applyRotation();
  }
  private applyRotation() {
    this.rotor.style.transform = `rotate(${this.lastHeadingDeg + this.rotationOffsetDeg}deg)`;
  }
  setOpacity(o: number) {
    this.el.style.opacity = String(o);
  }
  setVisible(v: boolean) {
    this.el.style.visibility = v ? 'visible' : 'hidden';
  }
  setLocalPosition(p: THREE.Vector3) {
    this.obj.position.copy(p);
  }
  dispose() {
    if (this.el.parentElement) this.el.parentElement.removeChild(this.el);
  }
}
