var Yt = Object.defineProperty;
var jt = (l, t, e) => t in l ? Yt(l, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : l[t] = e;
var f = (l, t, e) => jt(l, typeof t != "symbol" ? t + "" : t, e);
import * as d from "three";
import { CSS2DObject as Pt, CSS2DRenderer as Kt } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { Line2 as Nt } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry as Vt } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial as zt } from "three/examples/jsm/lines/LineMaterial.js";
const G = 1, rt = G;
function H(l, t, e, n = new d.Vector3()) {
  const i = d.MathUtils.degToRad(l), o = d.MathUtils.degToRad(t), a = Math.cos(i);
  return n.set(a * Math.sin(o) * e, Math.sin(i) * e, a * Math.cos(o) * e), n;
}
function qt(l, t, e, n, i) {
  const o = 360 / e, a = 180 / n, s = (C) => {
    let x = Math.round((C + 180) / o);
    return x = (x % e + e) % e, -180 + x * o;
  }, c = (C) => -90 + Math.max(1, Math.min(n - 1, Math.round((C + 90) / a))) * a;
  if (i === "free") return { lat: l, lon: t };
  if (i === "meridian") return { lat: l, lon: s(t) };
  if (i === "parallel") return { lat: c(l), lon: t };
  if (i === "intersection")
    return { lat: c(l), lon: s(t) };
  const h = c(l), m = s(t), v = Math.abs(l - h), b = Math.abs(t - m);
  return v <= b ? { lat: h, lon: t } : { lat: l, lon: m };
}
function Jt(l, t) {
  const e = G, n = 64, i = [], o = new d.Vector3();
  for (let a = 0; a < l; a++) {
    const s = -180 + 360 * a / l, c = new Float32Array((n + 1) * 3);
    for (let h = 0; h <= n; h++) {
      const m = -90 + 180 * (h / n);
      H(m, s, e, o), c[h * 3 + 0] = o.x, c[h * 3 + 1] = o.y, c[h * 3 + 2] = o.z;
    }
    i.push(c);
  }
  for (let a = 1; a < t; a++) {
    const s = -90 + 180 * a / t, c = new Float32Array((n + 1) * 3);
    for (let h = 0; h <= n; h++) {
      const m = -180 + 360 * (h / n);
      H(s, m, e, o), c[h * 3 + 0] = o.x, c[h * 3 + 1] = o.y, c[h * 3 + 2] = o.z;
    }
    i.push(c);
  }
  return i;
}
function xt(l, t, e = 80) {
  const n = [], i = Math.max(4, Math.round(e * 0.5));
  for (let s = 0; s <= i; s++) {
    const c = s / i, h = d.MathUtils.lerp(l.lat, t.lat, c);
    n.push(H(h, l.lon, rt));
  }
  let o = t.lon - l.lon;
  o > 180 && (o -= 360), o < -180 && (o += 360);
  const a = Math.max(4, Math.round(e * 0.5));
  for (let s = 1; s <= a; s++) {
    const c = s / a;
    n.push(H(t.lat, l.lon + o * c, rt));
  }
  return n;
}
function Xt(l, t, e, n) {
  const i = (a) => 3 * (1 - a) * (1 - a) * a * l + 3 * (1 - a) * a * a * e + a * a * a, o = (a) => 3 * (1 - a) * (1 - a) * a * t + 3 * (1 - a) * a * a * n + a * a * a;
  return (a) => {
    if (a <= 0) return 0;
    if (a >= 1) return 1;
    let s = a;
    for (let c = 0; c < 6; c++) {
      const h = i(s), m = 3 * (1 - s) * (1 - s) * l + 6 * (1 - s) * s * (e - l) + 3 * s * s * (1 - e);
      if (Math.abs(m) < 1e-6) break;
      s -= (h - a) / m, s < 0 && (s = 0), s > 1 && (s = 1);
    }
    return o(s);
  };
}
function $t(l, t) {
  const e = Math.max(0.05, l), n = Math.min(0.99, Math.max(0, t)), i = Math.max(0.05, 1 - n), o = 2 * Math.PI / e;
  return (a) => {
    if (a <= 0) return 0;
    if (a >= 1) return 1;
    const s = a * e;
    let c;
    if (i >= 1)
      c = 1 - (1 + o * s) * Math.exp(-o * s);
    else {
      const h = Math.sqrt(1 - i * i), m = o * h;
      c = 1 - Math.exp(-i * o * s) * (Math.cos(m * s) + i / h * Math.sin(m * s));
    }
    return Math.min(1, Math.max(0, c));
  };
}
function Zt(l) {
  return l ? l.type === "easing" && l.ease ? Xt(l.ease[0], l.ease[1], l.ease[2], l.ease[3]) : l.type === "spring" ? $t(l.visualDuration ?? 0.5, l.bounce ?? 0) : (t) => t : (t) => t;
}
function Qt() {
  const t = document.createElement("canvas");
  t.width = t.height = 64;
  const e = t.getContext("2d");
  e.clearRect(0, 0, 64, 64), e.strokeStyle = "#ffffff", e.lineWidth = 2.5;
  const n = 64 / 2, i = 64 * 0.32;
  e.beginPath(), e.moveTo(n - i, n), e.lineTo(n + i, n), e.moveTo(n, n - i), e.lineTo(n, n + i), e.stroke();
  const o = new d.CanvasTexture(t);
  return o.minFilter = d.LinearFilter, o.magFilter = d.LinearFilter, o.anisotropy = 4, o;
}
function te(l, t) {
  try {
    const e = JSON.parse(l);
    if (!Array.isArray(e)) return t;
    const n = [];
    for (const i of e)
      i && typeof i.name == "string" && typeof i.lat == "number" && typeof i.lon == "number" && n.push({ name: i.name, lat: i.lat, lon: i.lon });
    return n.length ? n : t;
  } catch {
    return t;
  }
}
function Ut() {
  return typeof window > "u" || !window.matchMedia ? !1 : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
const Lt = "globe-1-css";
let It = "", kt = -1, At = NaN;
function ee(l, t, e) {
  if (l === It && t === kt && e === At)
    return;
  It = l, kt = t, At = e;
  let n = document.getElementById(Lt);
  n || (n = document.createElement("style"), n.id = Lt, document.head.appendChild(n)), n.textContent = `
    .globe-1-label-root {
      display: inline-block;
      position: relative;
      pointer-events: none;
      transform: translateY(${e}px);
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: ${t}px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: ${l};
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
const se = new d.PlaneGeometry(1, 1);
class ne {
  constructor(t, e, n) {
    f(this, "group", new d.Group());
    f(this, "cross");
    f(this, "material");
    f(this, "label");
    f(this, "labelEl");
    f(this, "flashUntil", 0);
    f(this, "basePosition", new d.Vector3());
    f(this, "surface");
    // Scratch Color objects — reused each flash frame so we don't churn GC.
    f(this, "_baseCol", new d.Color());
    f(this, "_accentCol", new d.Color());
    f(this, "_lerpCol", new d.Color());
    if (this.surface = n, n) {
      const o = new d.MeshBasicMaterial({
        map: e,
        color: 16777215,
        transparent: !0,
        depthWrite: !1,
        depthTest: !1,
        side: d.DoubleSide
      });
      this.material = o, this.cross = new d.Mesh(se, o);
    } else {
      const o = new d.SpriteMaterial({
        map: e,
        color: 16777215,
        transparent: !0,
        depthWrite: !1,
        depthTest: !1
      });
      this.material = o, this.cross = new d.Sprite(o);
    }
    this.cross.scale.set(0.05, 0.05, 1), this.cross.renderOrder = 4;
    const i = document.createElement("div");
    i.style.pointerEvents = "none", this.labelEl = document.createElement("span"), this.labelEl.className = "globe-1-label-root", this.labelEl.textContent = t.name, i.appendChild(this.labelEl), this.label = new Pt(i), this.group.add(this.cross), this.group.add(this.label);
  }
  setPosition(t, e) {
    H(t, e, rt, this.basePosition), this.group.position.copy(this.basePosition), this.surface && this.cross.lookAt(0, 0, 0);
  }
  setColors(t, e) {
    this.material.color.set(t), this.labelEl.style.color !== e && (this.labelEl.style.color = e);
  }
  setSize(t) {
    this.cross.scale.set(t, t, 1);
  }
  setVisible(t) {
    this.cross.visible = t;
  }
  setLabelVisible(t) {
    this.labelEl.style.visibility = t ? "visible" : "hidden";
  }
  setOpacity(t) {
    this.material.opacity = t, this.labelEl.style.opacity = String(t);
  }
  flash(t, e) {
    this.flashUntil = t + e, this.labelEl.classList.add("is-flash");
  }
  updateFlash(t, e, n, i) {
    if (this.flashUntil <= 0) return;
    const o = this.flashUntil - t;
    if (o <= 0) {
      this.flashUntil = 0, this.material.color.set(n), this.labelEl.classList.remove("is-flash");
      return;
    }
    const a = o / e;
    this._baseCol.set(n), this._accentCol.set(i), this._lerpCol.copy(this._baseCol).lerp(this._accentCol, a), this.material.color.copy(this._lerpCol);
  }
  // Used by the front/back visibility test in the render loop.
  getSpriteWorldPos(t) {
    return this.cross.getWorldPosition(t);
  }
  dispose() {
    this.material.dispose(), this.labelEl.parentElement && this.labelEl.parentElement.removeChild(this.labelEl);
  }
}
class ie {
  constructor(t, e) {
    f(this, "line");
    f(this, "geom");
    f(this, "material");
    f(this, "trailDetail");
    // vertex count along the trail (params.snakeTrailDetail)
    f(this, "scratch");
    // Hoisted out of update() so we don't allocate every frame.
    f(this, "colorScratch");
    f(this, "active", null);
    f(this, "scheduled", null);
    f(this, "lastHeadDist", 0);
    // Reusable Vector3s for sampleAt() — mutated rather than allocated.
    f(this, "_sampleOut", new d.Vector3());
    f(this, "_sampleA", new d.Vector3());
    f(this, "_sampleB", new d.Vector3());
    this.trailDetail = t, this.scratch = new Float32Array(t * 3), this.colorScratch = new Float32Array(t * 3), this.geom = new Vt(), this.geom.setPositions(this.scratch), this.material = new zt({
      color: new d.Color(e).getHex(),
      linewidth: 3,
      transparent: !0,
      depthTest: !1,
      depthWrite: !1,
      worldUnits: !1,
      vertexColors: !0,
      dashed: !1,
      alphaToCoverage: !0
    }), this.material.blending = d.AdditiveBlending, this.material.resolution.set(window.innerWidth, window.innerHeight), this.line = new Nt(this.geom, this.material), this.line.computeLineDistances(), this.line.renderOrder = 5, this.line.frustumCulled = !1, this.line.visible = !1;
  }
  setResolution(t, e) {
    this.material.resolution.set(t, e);
  }
  setWidth(t) {
    this.material.linewidth = t;
  }
  setAccentColor(t) {
    this.material.color.set(t);
  }
  setTrailDetail(t) {
    t !== this.trailDetail && (this.trailDetail = t, this.scratch = new Float32Array(t * 3), this.colorScratch = new Float32Array(t * 3));
  }
  schedule(t, e, n) {
    const i = e + Math.random() * Math.max(0, n - e);
    this.scheduled = t + i;
  }
  begin(t, e) {
    if (e.length < 2) return;
    const n = Math.floor(Math.random() * e.length);
    let i = Math.floor(Math.random() * e.length);
    i === n && (i = (i + 1) % e.length);
    const o = xt(e[n], e[i]), a = [0];
    let s = 0;
    for (let c = 1; c < o.length; c++)
      s += o[c].distanceTo(o[c - 1]), a.push(s);
    this.active = {
      endIdx: i,
      endCountry: e[i],
      path: o,
      cumulative: a,
      totalDistance: s,
      legStartDist: 0,
      legEndDist: s,
      legStartTime: t,
      flashed: !1,
      phase: "travel",
      pauseUntil: 0,
      tailDist: 0,
      tailVel: 0
    }, this.lastHeadDist = 0, this.line.visible = !0;
  }
  appendLeg(t, e) {
    if (!this.active) return;
    const n = this.active;
    if (e.length < 2) {
      this.enterWindup(t);
      return;
    }
    let i = Math.floor(Math.random() * e.length);
    e[n.endIdx] === n.endCountry && i === n.endIdx && (i = (i + 1) % e.length);
    const o = n.endCountry, a = e[i], s = xt(o, a);
    let c = n.totalDistance;
    for (let h = 1; h < s.length; h++)
      c += s[h].distanceTo(s[h - 1]), n.path.push(s[h]), n.cumulative.push(c);
    n.legStartDist = n.totalDistance, n.legEndDist = c, n.totalDistance = c, n.endIdx = i, n.endCountry = a, n.legStartTime = t, n.flashed = !1, n.phase = "travel";
  }
  // After many legs in continuous mode, trim the front of the path
  // since only the trail-window worth of points behind tail is needed.
  // Called occasionally rather than every leg to amortise the array
  // splicing cost.
  prunePath(t = 1) {
    if (!this.active) return;
    const e = this.active;
    if (e.path.length < 600) return;
    const n = Math.max(0, e.tailDist - t);
    let i = 0;
    for (; i < e.cumulative.length - 1 && e.cumulative[i + 1] < n; )
      i++;
    i < 1 || (e.path.splice(0, i), e.cumulative.splice(0, i));
  }
  enterWindup(t) {
    this.active && (this.active.phase = "wind-up");
  }
  // Updates geometry. Returns destination index when an arrival event
  // fires (so the render loop can flash that country's marker).
  update(t, e, n, i, o, a) {
    if (!this.active)
      return this.line.visible = !1, -1;
    const s = this.active;
    let c = -1, h;
    if (s.phase === "travel") {
      const w = s.legEndDist - s.legStartDist, y = Math.max(
        a.legMinDuration,
        w / Math.max(0.01, n)
      ), I = t - s.legStartTime;
      if (I < y)
        h = s.legStartDist + o(I / y) * w;
      else if (h = s.legEndDist, s.flashed || (s.flashed = !0, c = s.endIdx), a.continuous) {
        const _ = a.pauseMin + Math.random() * Math.max(0, a.pauseMax - a.pauseMin);
        s.phase = "pause", s.pauseUntil = t + _;
      } else
        this.enterWindup(t);
    } else s.phase === "pause" ? (h = s.legEndDist, a.continuous ? t >= s.pauseUntil && (this.appendLeg(t, a.countries), h = s.legStartDist) : this.enterWindup(t)) : h = s.legEndDist;
    const m = Math.max(1e-3, a.trailMin), v = Math.max(m + 1e-3, a.trailLength), b = 10 + a.trailFollow * 200, C = 0.7 * 2 * Math.sqrt(b), x = s.phase === "wind-up" ? h : h - m, k = 4, P = Math.max(1e-4, e / k);
    for (let w = 0; w < k; w++) {
      const y = x - s.tailDist, I = b * y - C * s.tailVel;
      s.tailVel += I * P, s.tailDist += s.tailVel * P;
    }
    s.phase === "wind-up" ? s.tailDist > h && (s.tailDist = h, s.tailVel > 0 && (s.tailVel = 0)) : (s.tailDist > h - m && (s.tailDist = h - m, s.tailVel > 0 && (s.tailVel = 0)), s.tailDist < h - v && (s.tailDist = h - v, s.tailVel < 0 && (s.tailVel = 0))), s.tailDist < 0 && (s.tailDist = 0, s.tailVel < 0 && (s.tailVel = 0));
    const B = this.trailDetail, A = this.scratch, T = this.colorScratch, N = this.material.color, L = this._sampleOut;
    for (let w = 0; w < B; w++) {
      const y = w / (B - 1), I = d.MathUtils.lerp(s.tailDist, h, y);
      this.sampleAt(I, L), A[w * 3 + 0] = L.x, A[w * 3 + 1] = L.y, A[w * 3 + 2] = L.z;
      const _ = Math.pow(y, 1.4);
      T[w * 3 + 0] = N.r * i * (0.25 + 1.5 * _), T[w * 3 + 1] = N.g * i * (0.25 + 1.5 * _), T[w * 3 + 2] = N.b * i * (0.25 + 1.5 * _);
    }
    return this.geom.setPositions(A), this.geom.setColors(T), this.line.computeLineDistances(), this.lastHeadDist = h, s.phase === "wind-up" && s.tailDist >= s.legEndDist - 1e-3 && (this.active = null, this.line.visible = !1), c;
  }
  // Sample head + tangent. Mutates the supplied vectors.
  sampleHeadAndTangent(t, e) {
    if (!this.active) return !1;
    const n = this.active.totalDistance, i = Math.min(0.04, n * 0.05), o = Math.min(n, Math.max(0, this.lastHeadDist));
    this.sampleAt(o, t);
    let a, s;
    return o < i ? (a = o, s = Math.min(n, o + i)) : (a = Math.max(0, o - i), s = o), s - a < 1e-5 ? (e.set(0, 0, 0), !0) : (this.sampleAt(a, this._sampleA), this.sampleAt(s, this._sampleB), e.copy(this._sampleB).sub(this._sampleA), !0);
  }
  // Mutates `out`; never allocates.
  sampleAt(t, e) {
    const n = this.active, i = n.cumulative;
    if (t <= 0) return e.copy(n.path[0]);
    if (t >= i[i.length - 1]) return e.copy(n.path[n.path.length - 1]);
    let o = 0, a = i.length - 1;
    for (; o < a - 1; ) {
      const h = o + a >> 1;
      i[h] <= t ? o = h : a = h;
    }
    const s = i[a] - i[o] || 1, c = (t - i[o]) / s;
    return e.copy(n.path[o]).lerp(n.path[a], c);
  }
  dispose() {
    this.geom.dispose(), this.material.dispose();
  }
}
const _t = "globe-1-snake-icon-css", ae = "M443.537,3.805c-3.84-3.84-9.686-4.893-14.625-2.613L7.553,195.239c-4.827,2.215-7.807,7.153-7.535,12.459c0.254,5.305,3.727,9.908,8.762,11.63l129.476,44.289c21.349,7.314,38.125,24.089,45.438,45.438l44.321,129.509c1.72,5.018,6.325,8.491,11.63,8.762c5.306,0.271,10.244-2.725,12.458-7.535L446.15,18.429C448.428,13.491,447.377,7.644,443.537,3.805z";
function oe() {
  if (document.getElementById(_t)) return;
  const l = document.createElement("style");
  l.id = _t, l.textContent = `
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
  `, document.head.appendChild(l);
}
class le {
  constructor() {
    f(this, "el");
    f(this, "rotor");
    f(this, "svgEl");
    f(this, "pathEl");
    f(this, "obj");
    f(this, "size", 22);
    f(this, "rotationOffsetDeg", 0);
    f(this, "lastHeadingDeg", 0);
    f(this, "_lastColor", "");
    oe();
    const t = document.createElement("div");
    t.className = "globe-1-snake-icon", this.rotor = document.createElement("div"), this.rotor.className = "globe-1-snake-icon-rotor";
    const e = "http://www.w3.org/2000/svg";
    this.svgEl = document.createElementNS(e, "svg"), this.svgEl.setAttribute("viewBox", "0 0 447.342 447.342"), this.svgEl.setAttribute("class", "globe-1-snake-icon-svg"), this.svgEl.setAttribute("xmlns", e);
    const n = document.createElementNS(e, "g");
    n.setAttribute("transform", "rotate(-45 223.671 223.671)"), this.pathEl = document.createElementNS(e, "path"), this.pathEl.setAttribute("d", ae), this.pathEl.setAttribute("fill", "currentColor"), n.appendChild(this.pathEl), this.svgEl.appendChild(n), this.rotor.appendChild(this.svgEl), t.appendChild(this.rotor), this.el = t, this.obj = new Pt(t), this.applySize();
  }
  setSize(t) {
    t !== this.size && (this.size = t, this.applySize());
  }
  applySize() {
    this.svgEl.setAttribute("width", String(this.size)), this.svgEl.setAttribute("height", String(this.size));
  }
  setColor(t) {
    t !== this._lastColor && (this._lastColor = t, this.el.style.color = t);
  }
  setRotationOffset(t) {
    t !== this.rotationOffsetDeg && (this.rotationOffsetDeg = t, this.applyRotation());
  }
  setHeading(t) {
    this.lastHeadingDeg = t, this.applyRotation();
  }
  applyRotation() {
    this.rotor.style.transform = `rotate(${this.lastHeadingDeg + this.rotationOffsetDeg}deg)`;
  }
  setOpacity(t) {
    this.el.style.opacity = String(t);
  }
  setVisible(t) {
    this.el.style.visibility = t ? "visible" : "hidden";
  }
  setLocalPosition(t) {
    this.obj.position.copy(t);
  }
  dispose() {
    this.el.parentElement && this.el.parentElement.removeChild(this.el);
  }
}
function re(l) {
  let t = 0, e = 0, n = !1, i = !0;
  const o = Ut(), a = () => {
    i = !0;
  };
  function s() {
    n || (window.addEventListener("scroll", a, { passive: !0 }), window.addEventListener("resize", a, { passive: !0 }), n = !0, i = !0);
  }
  function c() {
    n && (window.removeEventListener("scroll", a), window.removeEventListener("resize", a), n = !1);
  }
  function h(m) {
    const v = l.getBoundingClientRect(), b = window.innerHeight || 1, C = (b - v.top) / Math.max(1, b + v.height), x = Math.max(0, Math.min(1, C)), k = d.MathUtils.degToRad(m);
    t = (x - 0.5) * k;
  }
  return {
    get currentPitch() {
      return e;
    },
    set currentPitch(m) {
      e = m;
    },
    update(m, v) {
      !v.enabled || o ? (t = 0, n && c()) : (n || s(), i && (h(v.rangeDeg), i = !1));
      const b = Math.max(0.1, v.smoothing), C = 1 - Math.exp(-m * b);
      e += (t - e) * C;
    },
    dispose() {
      c();
    }
  };
}
const ct = [
  { name: "NORWEGEN", lat: 60, lon: 5 },
  { name: "SCHWEDEN", lat: 60, lon: 20 },
  { name: "FINNLAND", lat: 60, lon: 37 },
  { name: "IRLAND", lat: 50, lon: -40 },
  { name: "ENGLAND", lat: 50, lon: -22 },
  { name: "NIEDERLANDE", lat: 50, lon: -8 },
  { name: "ESTLAND", lat: 50, lon: 37 },
  { name: "BELGIEN", lat: 40, lon: -22 },
  { name: "DEUTSCHLAND", lat: 40, lon: -8 },
  { name: "POLEN", lat: 40, lon: 8 },
  { name: "LETTLAND", lat: 40, lon: 37 },
  { name: "LUXEMBURG", lat: 30, lon: -8 },
  { name: "TSCHECHIEN", lat: 30, lon: 8 },
  { name: "SLOWAKEI", lat: 30, lon: 20 },
  { name: "LITAUEN", lat: 30, lon: 37 },
  { name: "FRANKREICH", lat: 20, lon: -22 },
  { name: "ÖSTERREICH", lat: 20, lon: 8 },
  { name: "UNGARN", lat: 20, lon: 20 },
  { name: "RUMÄNIEN", lat: 20, lon: 37 },
  { name: "SCHWEIZ", lat: 10, lon: -8 },
  { name: "SLOWENIEN", lat: 10, lon: 8 },
  { name: "SERBIEN", lat: 10, lon: 20 },
  { name: "TÜRKEI", lat: 10, lon: 37 },
  { name: "PORTUGAL", lat: 0, lon: -40 },
  { name: "SPANIEN", lat: 0, lon: -22 },
  { name: "ITALIEN", lat: -5, lon: -8 }
], ce = {
  type: "spring",
  stiffness: 110,
  damping: 18,
  mass: 1
}, he = {
  type: "easing",
  duration: 0.3,
  ease: [0.34, 0.45, 0.5, 1]
}, de = {
  defaults: {
    bgColor: "#000000",
    lineColor: "#5a5a52",
    crossColor: "#ffffff",
    labelColor: "#cfcfcf",
    accentColor: "#ffffff",
    // Globe geometry
    lonSegments: 30,
    latSegments: 30,
    lineOpacity: 0.24,
    lineWidth: 2,
    // Layers
    showLines: !0,
    showCountries: !0,
    showLabels: !0,
    showSnake: !0,
    // Camera framing
    zoom: 0.84,
    basePitchDeg: 21,
    baseYawDeg: -10,
    fov: 25,
    // Snap behaviour
    snapMode: "free",
    crossSize: 0.055,
    crossOnSurface: !0,
    labelSize: 10,
    labelOffsetY: 18,
    // Interaction
    dragSensitivity: 0.26,
    dragSpring: ce,
    autoSpin: !1,
    autoSpinSpeed: 0.15,
    autoSpinAxis: "Y (yaw)",
    pauseSpinOnDrag: !0,
    // Snake animation
    // Per-leg duration is `legDistance / snakeSpeed`, clamped to at
    // least `snakeLegMinDuration` so very short legs don't zip past
    // before the eye can register them. Speed is in globe-radius units
    // per second.
    snakeIntervalMin: 0.1,
    snakeIntervalMax: 0.6,
    snakeSpeed: 0.44,
    snakeLegMinDuration: 0.6,
    snakeWidth: 1,
    snakeFlashDuration: 2.2,
    snakeIntensity: 0.1,
    snakeEase: he,
    // When true, a finished route doesn't wind up + restart. Instead the
    // head pauses at the destination, then a new destination is appended
    // to the SAME path so the trail and head icon stay continuous.
    // The pause duration reuses snakeIntervalMin/Max.
    snakeContinuous: !0,
    // Spring-tail dynamics.
    //   snakeTrailMin     — resting gap; the trail can't shrink below it.
    //   snakeTrailLength  — stretch cap; the trail can't grow past it.
    //   snakeTrailFollow  — tightness (0 = lazy/very stretchy, 1 = snappy).
    //   snakeTrailDetail  — number of vertices in the trail geometry. A
    //                       technical detail; raising it just adds more
    //                       sample points, it does NOT lengthen the trail.
    snakeTrailMin: 0.06,
    snakeTrailLength: 0.55,
    snakeTrailFollow: 0.45,
    snakeTrailDetail: 31,
    // Snake head icon (GPS arrow that rides the head, oriented by heading)
    showSnakeIcon: !0,
    snakeIconColor: "#ffffff",
    snakeIconSize: 12,
    snakeIconOpacity: 1,
    snakeIconRotationOffset: 0,
    // Scroll-driven pitch — when on, scrolling the page pitches the
    // globe up/down. The wrapper element's intersection with the
    // viewport is mapped to ±range/2 pitch, applied as a 4th rotation
    // term on top of base/drag/auto-spin. Designed primarily for the
    // standalone Webflow embed; in the gallery it's harmless because
    // the canvas wrapper rarely scrolls.
    scrollPitchEnabled: !1,
    scrollPitchRangeDeg: 30,
    scrollPitchSmoothing: 8,
    // Country list (JSON)
    countriesJson: JSON.stringify(ct, null, 2)
  },
  dialConfig: {
    Countries: {
      countriesJson: {
        default: JSON.stringify(ct, null, 2)
      }
    }
  }
};
var Tt = {};
const Rt = { ...de.defaults }, Ot = typeof window < "u" && window.__GLOBE_1_CONFIG__ ? { ...window.__GLOBE_1_CONFIG__ } : {}, r = typeof Tt < "u" ? { ...Rt, ...Tt, ...Ot } : { ...Rt, ...Ot };
function pe(l) {
  const t = l.querySelector("canvas");
  if (!t) return;
  const e = t, n = Ut();
  ee(
    r.labelColor,
    r.labelSize,
    r.labelOffsetY
  );
  const i = new d.WebGLRenderer({ canvas: e, antialias: !0, alpha: !1 });
  i.setClearColor(r.bgColor, 1);
  const o = new Kt();
  Object.assign(o.domElement.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    userSelect: "none"
  }), l.appendChild(o.domElement);
  const a = new d.Scene(), s = new d.PerspectiveCamera(r.fov, 1, 0.01, 20);
  s.position.set(0, 0, 4.5 / Math.max(0.01, r.zoom));
  const c = new d.Group();
  a.add(c);
  const h = new d.SphereGeometry(G * 0.998, 64, 32), m = new d.MeshBasicMaterial({ color: r.bgColor }), v = new d.Mesh(h, m);
  c.add(v);
  const b = new zt({
    color: new d.Color(r.lineColor).getHex(),
    linewidth: r.lineWidth ?? 2,
    transparent: !1,
    worldUnits: !1,
    depthTest: !0,
    depthWrite: !0,
    dashed: !1,
    alphaToCoverage: !0
  });
  b.onBeforeCompile = (u) => {
    u.fragmentShader = u.fragmentShader.replace(
      /\bvoid main\(\)\s*\{/,
      `void main() {
  if (abs(vUv.y) > 1.0) discard;`
    );
  }, b.resolution.set(window.innerWidth, window.innerHeight);
  const C = new d.Group(), x = [];
  c.add(C);
  const k = Math.max(3, Math.round(r.lonSegments)), P = Math.max(2, Math.round(r.latSegments)), B = Jt(k, P);
  for (const u of B) {
    const p = new Vt();
    p.setPositions(Array.from(u));
    const g = new Nt(p, b);
    g.frustumCulled = !1, C.add(g), x.push(g);
  }
  C.visible = r.showLines !== !1;
  {
    const u = new d.Color(r.lineColor), p = d.MathUtils.clamp(r.lineOpacity, 0, 1);
    b.color.setRGB(
      u.r * p,
      u.g * p,
      u.b * p
    );
  }
  const A = Qt();
  let T = te(
    r.countriesJson,
    ct
  );
  const N = r.snapMode ?? "nearest line", L = T.map((u) => ({
    name: u.name,
    ...qt(u.lat, u.lon, k, P, N)
  })), w = !!r.crossOnSurface, y = [], I = r.showCountries !== !1, _ = r.showLabels !== !1;
  for (const u of L) {
    const p = new ne(u, A, w);
    p.setPosition(u.lat, u.lon), p.setColors(r.crossColor, r.labelColor), p.setSize(r.crossSize), p.group.visible = I, _ || (p.labelEl.style.display = "none"), c.add(p.group), y.push(p);
  }
  const M = new ie(
    Math.max(4, Math.round(r.snakeTrailDetail ?? 31)),
    r.accentColor
  );
  M.setWidth(r.snakeWidth), c.add(M.line);
  const D = new le();
  D.setColor(r.snakeIconColor), D.setSize(r.snakeIconSize), D.setRotationOffset(r.snakeIconRotationOffset), D.setVisible(!1), c.add(D.obj);
  let V = !1, Y = null;
  const R = { x: 0, y: 0 };
  let j = 0, O = 0, K = 0, q = 0, Q = 0, tt = 0;
  const ht = (u) => {
    var p;
    V = !0, Y = u.pointerId, R.x = u.clientX, R.y = u.clientY, K = 0, q = 0, (p = e.setPointerCapture) == null || p.call(e, u.pointerId), e.style.cursor = "grabbing";
  }, dt = (u) => {
    if (!V || u.pointerId !== Y) return;
    const p = u.clientX - R.x, g = u.clientY - R.y;
    R.x = u.clientX, R.y = u.clientY;
    const z = r.dragSensitivity * 5e-3;
    j += p * z, O += g * z, O = d.MathUtils.clamp(O, -Math.PI * 0.55, Math.PI * 0.55);
  }, J = (u) => {
    var p;
    if (u.pointerId === Y) {
      V = !1, Y = null, e.style.cursor = "grab";
      try {
        (p = e.releasePointerCapture) == null || p.call(e, u.pointerId);
      } catch {
      }
    }
  };
  e.style.cursor = "grab", e.addEventListener("pointerdown", ht), e.addEventListener("pointermove", dt), e.addEventListener("pointerup", J), e.addEventListener("pointercancel", J);
  const et = re(l);
  function pt() {
    const u = Math.min(window.devicePixelRatio || 1, 2), p = e.getBoundingClientRect();
    p.width < 1 || p.height < 1 || (i.setPixelRatio(u), i.setSize(p.width, p.height, !1), s.aspect = p.width / Math.max(1, p.height), s.updateProjectionMatrix(), o.setSize(p.width, p.height), b.resolution.set(p.width * u, p.height * u), M.setResolution(p.width * u, p.height * u));
  }
  const ut = new ResizeObserver(pt);
  ut.observe(e), pt();
  let ft = !0;
  const mt = new IntersectionObserver(
    (u) => {
      for (const p of u) ft = p.isIntersecting;
    },
    { rootMargin: "100px", threshold: 0 }
  );
  mt.observe(l);
  const gt = new d.Vector3(), X = new d.Vector3(), wt = new d.Vector3(), st = new d.Vector3(), bt = new d.Vector3(), nt = new d.Vector3(), it = new d.Vector3(), Mt = new d.Vector3(), Et = new d.Vector3(), Wt = new d.Vector3();
  function Ft() {
    s.updateMatrixWorld();
    const u = s.matrixWorldInverse, p = Wt.set(0, 0, 0).applyMatrix4(u).z;
    for (const g of y) {
      g.getSpriteWorldPos(gt);
      const lt = (gt.applyMatrix4(u).z - p) / G, U = d.MathUtils.smoothstep(lt, 0.05, 0.35);
      g.setOpacity(U), g.setVisible(U > 0.02), g.setLabelVisible(U > 0.05);
    }
  }
  const Gt = Zt(r.snakeEase);
  let at = -1, yt = !1, vt = 0, ot = 0;
  function St(u) {
    if (ot = requestAnimationFrame(St), !ft || i.domElement.width < 1 || i.domElement.height < 1) return;
    const p = u / 1e3, g = at < 0 ? 1 / 60 : Math.min(p - at, 0.1);
    at = p;
    const z = r.pauseSpinOnDrag !== !1 && V;
    if (!n && r.autoSpin && !z) {
      const E = r.autoSpinSpeed, S = r.autoSpinAxis;
      S === "X (pitch)" ? tt += E * g : S === "Both" ? (Q += E * g, tt += E * g * 0.4) : Q += E * g;
    }
    if (!V) {
      const E = r.dragSpring ?? {}, S = E.stiffness ?? 110, W = E.damping ?? 18, $ = Math.max(0.05, E.mass ?? 1), F = 4, Z = g / F;
      for (let Dt = 0; Dt < F; Dt++) {
        const Ht = (-S * j - W * K) / $, Bt = (-S * O - W * q) / $;
        K += Ht * Z, q += Bt * Z, j += K * Z, O += q * Z;
      }
    }
    et.update(g, {
      enabled: r.scrollPitchEnabled === !0,
      rangeDeg: r.scrollPitchRangeDeg ?? 30,
      smoothing: r.scrollPitchSmoothing ?? 8
    });
    const lt = d.MathUtils.degToRad(r.basePitchDeg), U = d.MathUtils.degToRad(r.baseYawDeg);
    if (c.rotation.set(
      lt + O + tt + et.currentPitch,
      U + j + Q,
      0
    ), r.showSnake !== !1) {
      M.active || (yt ? M.scheduled !== null && p >= M.scheduled && (M.scheduled = null, M.begin(p, L)) : (M.schedule(
        p,
        r.snakeIntervalMin,
        r.snakeIntervalMax
      ), yt = !0));
      const E = r.snakeContinuous === !0, S = M.update(
        p,
        g,
        r.snakeSpeed,
        r.snakeIntensity,
        Gt,
        {
          continuous: E,
          pauseMin: r.snakeIntervalMin,
          pauseMax: r.snakeIntervalMax,
          countries: L,
          trailMin: r.snakeTrailMin,
          trailLength: r.snakeTrailLength,
          trailFollow: r.snakeTrailFollow,
          legMinDuration: r.snakeLegMinDuration ?? 0
        }
      );
      S >= 0 && S < y.length && (y[S].flash(p, r.snakeFlashDuration), E || M.schedule(
        p,
        r.snakeIntervalMin,
        r.snakeIntervalMax
      )), p - vt > 30 && (M.prunePath(), vt = p);
    }
    let Ct = !1;
    for (const E of y)
      if (E.flashUntil > 0) {
        Ct = !0;
        break;
      }
    if (Ct) {
      const E = r.snakeFlashDuration;
      for (const S of y)
        S.updateFlash(p, E, r.crossColor, r.accentColor);
    }
    if (s.updateMatrixWorld(), c.updateMatrixWorld(), Ft(), r.showSnake !== !1 && r.showSnakeIcon !== !1 && !!M.active && M.active)
      if (M.sampleHeadAndTangent(X, wt)) {
        D.setLocalPosition(X), st.copy(X).applyMatrix4(c.matrixWorld), bt.copy(X).add(wt).applyMatrix4(c.matrixWorld), nt.copy(st).project(s), it.copy(bt).project(s);
        const S = it.x - nt.x, W = it.y - nt.y;
        Math.hypot(S, W) > 1e-5 && D.setHeading(Math.atan2(S, W) * 180 / Math.PI), Mt.copy(st).applyMatrix4(s.matrixWorldInverse), Et.set(0, 0, 0).applyMatrix4(c.matrixWorld).applyMatrix4(s.matrixWorldInverse);
        const $ = (Mt.z - Et.z) / G, F = d.MathUtils.smoothstep($, 0.05, 0.35) * r.snakeIconOpacity;
        D.setOpacity(F), D.setVisible(F > 0.02);
      } else
        D.setVisible(!1);
    else
      D.setVisible(!1);
    i.render(a, s), o.render(a, s);
  }
  ot = requestAnimationFrame(St), l.__dispose = () => {
    cancelAnimationFrame(ot), ut.disconnect(), mt.disconnect(), e.removeEventListener("pointerdown", ht), e.removeEventListener("pointermove", dt), e.removeEventListener("pointerup", J), e.removeEventListener("pointercancel", J), et.dispose();
    for (const u of y) u.dispose();
    D.dispose(), M.dispose();
    for (const u of x) u.geometry.dispose();
    b.dispose(), h.dispose(), m.dispose(), A.dispose(), o.domElement.parentElement && o.domElement.parentElement.removeChild(o.domElement), i.dispose();
  };
}
(function() {
  const l = /* @__PURE__ */ new Set();
  document.querySelectorAll('[data-webgl-experiment="globe-1"]').forEach((t) => l.add(t)), document.querySelectorAll("canvas[data-flow-globe-1]").forEach((t) => {
    t.parentElement && l.add(t.parentElement);
  });
  for (const t of l)
    pe(t);
})();
