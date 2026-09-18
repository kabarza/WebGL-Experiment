var Jt = Object.defineProperty;
var $t = (o, t, e) => t in o ? Jt(o, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : o[t] = e;
var m = (o, t, e) => $t(o, typeof t != "symbol" ? t + "" : t, e);
import * as h from "three";
import { CSS2DObject as zt, CSS2DRenderer as Zt } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { Line2 as Vt } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry as Wt } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial as Ut } from "three/examples/jsm/lines/LineMaterial.js";
const j = 1, ht = j;
function K(o, t, e, s = new h.Vector3()) {
  const i = h.MathUtils.degToRad(o), l = h.MathUtils.degToRad(t), a = Math.cos(i);
  return s.set(a * Math.sin(l) * e, Math.sin(i) * e, a * Math.cos(l) * e), s;
}
function Qt(o, t, e, s, i) {
  const l = 360 / e, a = 180 / s, n = (x) => {
    let E = Math.round((x + 180) / l);
    return E = (E % e + e) % e, -180 + E * l;
  }, p = (x) => -90 + Math.max(1, Math.min(s - 1, Math.round((x + 90) / a))) * a;
  if (i === "free") return { lat: o, lon: t };
  if (i === "meridian") return { lat: o, lon: n(t) };
  if (i === "parallel") return { lat: p(o), lon: t };
  if (i === "intersection")
    return { lat: p(o), lon: n(t) };
  const r = p(o), f = n(t), y = Math.abs(o - r), S = Math.abs(t - f);
  return y <= S ? { lat: r, lon: t } : { lat: o, lon: f };
}
function te(o, t) {
  const e = j, s = 64, i = [], l = new h.Vector3();
  for (let a = 0; a < o; a++) {
    const n = -180 + 360 * a / o, p = new Float32Array((s + 1) * 3);
    for (let r = 0; r <= s; r++) {
      const f = -90 + 180 * (r / s);
      K(f, n, e, l), p[r * 3 + 0] = l.x, p[r * 3 + 1] = l.y, p[r * 3 + 2] = l.z;
    }
    i.push(p);
  }
  for (let a = 1; a < t; a++) {
    const n = -90 + 180 * a / t, p = new Float32Array((s + 1) * 3);
    for (let r = 0; r <= s; r++) {
      const f = -180 + 360 * (r / s);
      K(n, f, e, l), p[r * 3 + 0] = l.x, p[r * 3 + 1] = l.y, p[r * 3 + 2] = l.z;
    }
    i.push(p);
  }
  return i;
}
function It(o, t, e = 80) {
  const s = [], i = Math.max(4, Math.round(e * 0.5));
  for (let n = 0; n <= i; n++) {
    const p = n / i, r = h.MathUtils.lerp(o.lat, t.lat, p);
    s.push(K(r, o.lon, ht));
  }
  let l = t.lon - o.lon;
  l > 180 && (l -= 360), l < -180 && (l += 360);
  const a = Math.max(4, Math.round(e * 0.5));
  for (let n = 1; n <= a; n++) {
    const p = n / a;
    s.push(K(t.lat, o.lon + l * p, ht));
  }
  return s;
}
function ee(o, t, e, s) {
  const i = (a) => 3 * (1 - a) * (1 - a) * a * o + 3 * (1 - a) * a * a * e + a * a * a, l = (a) => 3 * (1 - a) * (1 - a) * a * t + 3 * (1 - a) * a * a * s + a * a * a;
  return (a) => {
    if (a <= 0) return 0;
    if (a >= 1) return 1;
    let n = a;
    for (let p = 0; p < 6; p++) {
      const r = i(n), f = 3 * (1 - n) * (1 - n) * o + 6 * (1 - n) * n * (e - o) + 3 * n * n * (1 - e);
      if (Math.abs(f) < 1e-6) break;
      n -= (r - a) / f, n < 0 && (n = 0), n > 1 && (n = 1);
    }
    return l(n);
  };
}
function ne(o, t) {
  const e = Math.max(0.05, o), s = Math.min(0.99, Math.max(0, t)), i = Math.max(0.05, 1 - s), l = 2 * Math.PI / e;
  return (a) => {
    if (a <= 0) return 0;
    if (a >= 1) return 1;
    const n = a * e;
    let p;
    if (i >= 1)
      p = 1 - (1 + l * n) * Math.exp(-l * n);
    else {
      const r = Math.sqrt(1 - i * i), f = l * r;
      p = 1 - Math.exp(-i * l * n) * (Math.cos(f * n) + i / r * Math.sin(f * n));
    }
    return Math.min(1, Math.max(0, p));
  };
}
function se(o) {
  return o ? o.type === "easing" && o.ease ? ee(o.ease[0], o.ease[1], o.ease[2], o.ease[3]) : o.type === "spring" ? ne(o.visualDuration ?? 0.5, o.bounce ?? 0) : (t) => t : (t) => t;
}
function ie() {
  const t = document.createElement("canvas");
  t.width = t.height = 64;
  const e = t.getContext("2d");
  e.clearRect(0, 0, 64, 64), e.strokeStyle = "#ffffff", e.lineWidth = 2.5;
  const s = 64 / 2, i = 64 * 0.32;
  e.beginPath(), e.moveTo(s - i, s), e.lineTo(s + i, s), e.moveTo(s, s - i), e.lineTo(s, s + i), e.stroke();
  const l = new h.CanvasTexture(t);
  return l.minFilter = h.LinearFilter, l.magFilter = h.LinearFilter, l.anisotropy = 4, l;
}
function ae(o, t) {
  try {
    const e = JSON.parse(o);
    if (!Array.isArray(e)) return t;
    const s = [];
    for (const i of e)
      i && typeof i.name == "string" && typeof i.lat == "number" && typeof i.lon == "number" && s.push({ name: i.name, lat: i.lat, lon: i.lon });
    return s.length ? s : t;
  } catch {
    return t;
  }
}
function Ft() {
  return typeof window > "u" || !window.matchMedia ? !1 : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function Lt() {
  if (typeof window > "u")
    return {
      isMobile: !1,
      isSmall: !1,
      dprCap: 2,
      segCap: 1 / 0,
      lineWidthCap: 1 / 0,
      labelSizeCap: 1 / 0
    };
  const o = window.innerWidth, t = o < 480, e = o < 768;
  return {
    isMobile: e,
    isSmall: t,
    dprCap: e ? 1.5 : 2,
    segCap: t ? 18 : e ? 24 : 1 / 0,
    lineWidthCap: e ? 1.5 : 1 / 0,
    labelSizeCap: t ? 8 : e ? 9 : 1 / 0
  };
}
const kt = "globe-1-css";
let At = "", _t = -1, Tt = NaN;
function oe(o, t, e) {
  if (o === At && t === _t && e === Tt)
    return;
  At = o, _t = t, Tt = e;
  let s = document.getElementById(kt);
  s || (s = document.createElement("style"), s.id = kt, document.head.appendChild(s)), s.textContent = `
    .globe-1-label-root {
      display: inline-block;
      position: relative;
      pointer-events: none;
      transform: translateY(${e}px);
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: ${t}px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: ${o};
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
const le = new h.PlaneGeometry(1, 1);
class re {
  constructor(t, e, s) {
    m(this, "group", new h.Group());
    m(this, "cross");
    m(this, "material");
    m(this, "label");
    m(this, "labelEl");
    m(this, "flashUntil", 0);
    m(this, "basePosition", new h.Vector3());
    m(this, "surface");
    // Scratch Color objects — reused each flash frame so we don't churn GC.
    m(this, "_baseCol", new h.Color());
    m(this, "_accentCol", new h.Color());
    m(this, "_lerpCol", new h.Color());
    if (this.surface = s, s) {
      const l = new h.MeshBasicMaterial({
        map: e,
        color: 16777215,
        transparent: !0,
        depthWrite: !1,
        depthTest: !1,
        side: h.DoubleSide
      });
      this.material = l, this.cross = new h.Mesh(le, l);
    } else {
      const l = new h.SpriteMaterial({
        map: e,
        color: 16777215,
        transparent: !0,
        depthWrite: !1,
        depthTest: !1
      });
      this.material = l, this.cross = new h.Sprite(l);
    }
    this.cross.scale.set(0.05, 0.05, 1), this.cross.renderOrder = 4;
    const i = document.createElement("div");
    i.style.pointerEvents = "none", this.labelEl = document.createElement("span"), this.labelEl.className = "globe-1-label-root", this.labelEl.textContent = t.name, i.appendChild(this.labelEl), this.label = new zt(i), this.group.add(this.cross), this.group.add(this.label);
  }
  setPosition(t, e) {
    K(t, e, ht, this.basePosition), this.group.position.copy(this.basePosition), this.surface && this.cross.lookAt(0, 0, 0);
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
  updateFlash(t, e, s, i) {
    if (this.flashUntil <= 0) return;
    const l = this.flashUntil - t;
    if (l <= 0) {
      this.flashUntil = 0, this.material.color.set(s), this.labelEl.classList.remove("is-flash");
      return;
    }
    const a = l / e;
    this._baseCol.set(s), this._accentCol.set(i), this._lerpCol.copy(this._baseCol).lerp(this._accentCol, a), this.material.color.copy(this._lerpCol);
  }
  // Used by the front/back visibility test in the render loop.
  getSpriteWorldPos(t) {
    return this.cross.getWorldPosition(t);
  }
  dispose() {
    this.material.dispose(), this.labelEl.parentElement && this.labelEl.parentElement.removeChild(this.labelEl);
  }
}
class ce {
  constructor(t, e) {
    m(this, "line");
    m(this, "geom");
    m(this, "material");
    m(this, "trailDetail");
    // vertex count along the trail (params.snakeTrailDetail)
    m(this, "scratch");
    // Hoisted out of update() so we don't allocate every frame.
    m(this, "colorScratch");
    m(this, "active", null);
    m(this, "scheduled", null);
    m(this, "lastHeadDist", 0);
    // Reusable Vector3s for sampleAt() — mutated rather than allocated.
    m(this, "_sampleOut", new h.Vector3());
    m(this, "_sampleA", new h.Vector3());
    m(this, "_sampleB", new h.Vector3());
    this.trailDetail = t, this.scratch = new Float32Array(t * 3), this.colorScratch = new Float32Array(t * 3), this.geom = new Wt(), this.geom.setPositions(this.scratch), this.material = new Ut({
      color: new h.Color(e).getHex(),
      linewidth: 3,
      transparent: !0,
      depthTest: !1,
      depthWrite: !1,
      worldUnits: !1,
      vertexColors: !0,
      dashed: !1,
      alphaToCoverage: !0
    }), this.material.blending = h.AdditiveBlending, this.material.resolution.set(window.innerWidth, window.innerHeight), this.line = new Vt(this.geom, this.material), this.line.computeLineDistances(), this.line.renderOrder = 5, this.line.frustumCulled = !1, this.line.visible = !1;
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
  schedule(t, e, s) {
    const i = e + Math.random() * Math.max(0, s - e);
    this.scheduled = t + i;
  }
  begin(t, e) {
    if (e.length < 2) return;
    const s = Math.floor(Math.random() * e.length);
    let i = Math.floor(Math.random() * e.length);
    i === s && (i = (i + 1) % e.length);
    const l = It(e[s], e[i]), a = [0];
    let n = 0;
    for (let p = 1; p < l.length; p++)
      n += l[p].distanceTo(l[p - 1]), a.push(n);
    this.active = {
      endIdx: i,
      endCountry: e[i],
      path: l,
      cumulative: a,
      totalDistance: n,
      legStartDist: 0,
      legEndDist: n,
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
    const s = this.active;
    if (e.length < 2) {
      this.enterWindup(t);
      return;
    }
    let i = Math.floor(Math.random() * e.length);
    e[s.endIdx] === s.endCountry && i === s.endIdx && (i = (i + 1) % e.length);
    const l = s.endCountry, a = e[i], n = It(l, a);
    let p = s.totalDistance;
    for (let r = 1; r < n.length; r++)
      p += n[r].distanceTo(n[r - 1]), s.path.push(n[r]), s.cumulative.push(p);
    s.legStartDist = s.totalDistance, s.legEndDist = p, s.totalDistance = p, s.endIdx = i, s.endCountry = a, s.legStartTime = t, s.flashed = !1, s.phase = "travel";
  }
  // After many legs in continuous mode, trim the front of the path
  // since only the trail-window worth of points behind tail is needed.
  // Called occasionally rather than every leg to amortise the array
  // splicing cost.
  prunePath(t = 1) {
    if (!this.active) return;
    const e = this.active;
    if (e.path.length < 600) return;
    const s = Math.max(0, e.tailDist - t);
    let i = 0;
    for (; i < e.cumulative.length - 1 && e.cumulative[i + 1] < s; )
      i++;
    i < 1 || (e.path.splice(0, i), e.cumulative.splice(0, i));
  }
  enterWindup(t) {
    this.active && (this.active.phase = "wind-up");
  }
  // Updates geometry. Returns destination index when an arrival event
  // fires (so the render loop can flash that country's marker).
  update(t, e, s, i, l, a) {
    if (!this.active)
      return this.line.visible = !1, -1;
    const n = this.active;
    let p = -1, r;
    if (n.phase === "travel") {
      const w = n.legEndDist - n.legStartDist, I = Math.max(
        a.legMinDuration,
        w / Math.max(0.01, s)
      ), A = t - n.legStartTime;
      if (A < I)
        r = n.legStartDist + l(A / I) * w;
      else if (r = n.legEndDist, n.flashed || (n.flashed = !0, p = n.endIdx), a.continuous) {
        const C = a.pauseMin + Math.random() * Math.max(0, a.pauseMax - a.pauseMin);
        n.phase = "pause", n.pauseUntil = t + C;
      } else
        this.enterWindup(t);
    } else n.phase === "pause" ? (r = n.legEndDist, a.continuous ? t >= n.pauseUntil && (this.appendLeg(t, a.countries), r = n.legStartDist) : this.enterWindup(t)) : r = n.legEndDist;
    const f = Math.max(1e-3, a.trailMin), y = Math.max(f + 1e-3, a.trailLength), S = 10 + a.trailFollow * 200, x = 0.7 * 2 * Math.sqrt(S), E = n.phase === "wind-up" ? r : r - f, k = 4, W = Math.max(1e-4, e / k);
    for (let w = 0; w < k; w++) {
      const I = E - n.tailDist, A = S * I - x * n.tailVel;
      n.tailVel += A * W, n.tailDist += n.tailVel * W;
    }
    n.phase === "wind-up" ? n.tailDist > r && (n.tailDist = r, n.tailVel > 0 && (n.tailVel = 0)) : (n.tailDist > r - f && (n.tailDist = r - f, n.tailVel > 0 && (n.tailVel = 0)), n.tailDist < r - y && (n.tailDist = r - y, n.tailVel < 0 && (n.tailVel = 0))), n.tailDist < 0 && (n.tailDist = 0, n.tailVel < 0 && (n.tailVel = 0));
    const U = this.trailDetail, _ = this.scratch, R = this.colorScratch, O = this.material.color, P = this._sampleOut;
    for (let w = 0; w < U; w++) {
      const I = w / (U - 1), A = h.MathUtils.lerp(n.tailDist, r, I);
      this.sampleAt(A, P), _[w * 3 + 0] = P.x, _[w * 3 + 1] = P.y, _[w * 3 + 2] = P.z;
      const C = Math.pow(I, 1.4);
      R[w * 3 + 0] = O.r * i * (0.25 + 1.5 * C), R[w * 3 + 1] = O.g * i * (0.25 + 1.5 * C), R[w * 3 + 2] = O.b * i * (0.25 + 1.5 * C);
    }
    return this.geom.setPositions(_), this.geom.setColors(R), this.line.computeLineDistances(), this.lastHeadDist = r, n.phase === "wind-up" && n.tailDist >= n.legEndDist - 1e-3 && (this.active = null, this.line.visible = !1), p;
  }
  // Sample head + tangent. Mutates the supplied vectors.
  sampleHeadAndTangent(t, e) {
    if (!this.active) return !1;
    const s = this.active.totalDistance, i = Math.min(0.04, s * 0.05), l = Math.min(s, Math.max(0, this.lastHeadDist));
    this.sampleAt(l, t);
    let a, n;
    return l < i ? (a = l, n = Math.min(s, l + i)) : (a = Math.max(0, l - i), n = l), n - a < 1e-5 ? (e.set(0, 0, 0), !0) : (this.sampleAt(a, this._sampleA), this.sampleAt(n, this._sampleB), e.copy(this._sampleB).sub(this._sampleA), !0);
  }
  // Mutates `out`; never allocates.
  sampleAt(t, e) {
    const s = this.active, i = s.cumulative;
    if (t <= 0) return e.copy(s.path[0]);
    if (t >= i[i.length - 1]) return e.copy(s.path[s.path.length - 1]);
    let l = 0, a = i.length - 1;
    for (; l < a - 1; ) {
      const r = l + a >> 1;
      i[r] <= t ? l = r : a = r;
    }
    const n = i[a] - i[l] || 1, p = (t - i[l]) / n;
    return e.copy(s.path[l]).lerp(s.path[a], p);
  }
  dispose() {
    this.geom.dispose(), this.material.dispose();
  }
}
const Rt = "globe-1-snake-icon-css", he = "M443.537,3.805c-3.84-3.84-9.686-4.893-14.625-2.613L7.553,195.239c-4.827,2.215-7.807,7.153-7.535,12.459c0.254,5.305,3.727,9.908,8.762,11.63l129.476,44.289c21.349,7.314,38.125,24.089,45.438,45.438l44.321,129.509c1.72,5.018,6.325,8.491,11.63,8.762c5.306,0.271,10.244-2.725,12.458-7.535L446.15,18.429C448.428,13.491,447.377,7.644,443.537,3.805z";
function de() {
  if (document.getElementById(Rt)) return;
  const o = document.createElement("style");
  o.id = Rt, o.textContent = `
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
  `, document.head.appendChild(o);
}
class pe {
  constructor() {
    m(this, "el");
    m(this, "rotor");
    m(this, "svgEl");
    m(this, "pathEl");
    m(this, "obj");
    m(this, "size", 22);
    m(this, "rotationOffsetDeg", 0);
    m(this, "lastHeadingDeg", 0);
    m(this, "_lastColor", "");
    de();
    const t = document.createElement("div");
    t.className = "globe-1-snake-icon", this.rotor = document.createElement("div"), this.rotor.className = "globe-1-snake-icon-rotor";
    const e = "http://www.w3.org/2000/svg";
    this.svgEl = document.createElementNS(e, "svg"), this.svgEl.setAttribute("viewBox", "0 0 447.342 447.342"), this.svgEl.setAttribute("class", "globe-1-snake-icon-svg"), this.svgEl.setAttribute("xmlns", e);
    const s = document.createElementNS(e, "g");
    s.setAttribute("transform", "rotate(-45 223.671 223.671)"), this.pathEl = document.createElementNS(e, "path"), this.pathEl.setAttribute("d", he), this.pathEl.setAttribute("fill", "currentColor"), s.appendChild(this.pathEl), this.svgEl.appendChild(s), this.rotor.appendChild(this.svgEl), t.appendChild(this.rotor), this.el = t, this.obj = new zt(t), this.applySize();
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
function ue(o) {
  let t = 0, e = 0, s = !1, i = !0;
  const l = Ft(), a = () => {
    i = !0;
  };
  function n() {
    s || (window.addEventListener("scroll", a, { passive: !0 }), window.addEventListener("resize", a, { passive: !0 }), s = !0, i = !0);
  }
  function p() {
    s && (window.removeEventListener("scroll", a), window.removeEventListener("resize", a), s = !1);
  }
  function r(f) {
    const y = o.getBoundingClientRect(), S = window.innerHeight || 1, x = (S - y.top) / Math.max(1, S + y.height), E = Math.max(0, Math.min(1, x)), k = h.MathUtils.degToRad(f);
    t = (E - 0.5) * k;
  }
  return {
    get currentPitch() {
      return e;
    },
    set currentPitch(f) {
      e = f;
    },
    update(f, y) {
      !y.enabled || l ? (t = 0, s && p()) : (s || n(), i && (r(y.rangeDeg), i = !1));
      const S = Math.max(0.1, y.smoothing), x = 1 - Math.exp(-f * S);
      e += (t - e) * x;
    },
    dispose() {
      p();
    }
  };
}
const dt = [
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
], fe = {
  type: "spring",
  stiffness: 110,
  damping: 18,
  mass: 1
}, me = {
  type: "easing",
  duration: 0.3,
  ease: [0.34, 0.45, 0.5, 1]
}, ge = {
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
    dragSpring: fe,
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
    snakeEase: me,
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
    countriesJson: JSON.stringify(dt, null, 2)
  },
  dialConfig: {
    Countries: {
      countriesJson: {
        default: JSON.stringify(dt, null, 2)
      }
    }
  }
};
var Ot = {};
const Pt = { ...ge.defaults }, Nt = typeof window < "u" && window.__GLOBE_1_CONFIG__ ? { ...window.__GLOBE_1_CONFIG__ } : {}, c = typeof Ot < "u" ? { ...Pt, ...Ot, ...Nt } : { ...Pt, ...Nt };
function we(o) {
  const t = o.querySelector("canvas");
  if (!t) return;
  const e = t, s = Ft(), i = Lt(), l = Math.min(c.labelSize, i.labelSizeCap);
  oe(
    c.labelColor,
    l,
    c.labelOffsetY
  );
  const a = new h.WebGLRenderer({ canvas: e, antialias: !0, alpha: !1 });
  a.setClearColor(c.bgColor, 1);
  const n = new Zt();
  Object.assign(n.domElement.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    userSelect: "none"
  }), o.appendChild(n.domElement);
  const p = new h.Scene(), r = new h.PerspectiveCamera(c.fov, 1, 0.01, 20);
  r.position.set(0, 0, 4.5 / Math.max(0.01, c.zoom));
  const f = new h.Group();
  p.add(f);
  const y = new h.SphereGeometry(j * 0.998, 64, 32), S = new h.MeshBasicMaterial({ color: c.bgColor }), x = new h.Mesh(y, S);
  f.add(x);
  const E = new Ut({
    color: new h.Color(c.lineColor).getHex(),
    linewidth: Math.min(c.lineWidth ?? 2, i.lineWidthCap),
    transparent: !1,
    worldUnits: !1,
    depthTest: !0,
    depthWrite: !0,
    dashed: !1,
    alphaToCoverage: !0
  });
  E.onBeforeCompile = (d) => {
    d.fragmentShader = d.fragmentShader.replace(
      /\bvoid main\(\)\s*\{/,
      `void main() {
  if (abs(vUv.y) > 1.0) discard;`
    );
  }, E.resolution.set(window.innerWidth, window.innerHeight);
  const k = new h.Group(), W = [];
  f.add(k);
  const U = Math.min(
    Math.max(3, Math.round(c.lonSegments)),
    i.segCap
  ), _ = Math.min(
    Math.max(2, Math.round(c.latSegments)),
    i.segCap
  ), R = te(U, _);
  for (const d of R) {
    const u = new Wt();
    u.setPositions(Array.from(d));
    const g = new Vt(u, E);
    g.frustumCulled = !1, k.add(g), W.push(g);
  }
  k.visible = c.showLines !== !1;
  {
    const d = new h.Color(c.lineColor), u = h.MathUtils.clamp(c.lineOpacity, 0, 1);
    E.color.setRGB(
      d.r * u,
      d.g * u,
      d.b * u
    );
  }
  const O = ie();
  let P = ae(
    c.countriesJson,
    dt
  );
  const w = c.snapMode ?? "nearest line", I = P.map((d) => ({
    name: d.name,
    ...Qt(d.lat, d.lon, U, _, w)
  })), A = !!c.crossOnSurface, C = [], Ht = c.showCountries !== !1, Gt = c.showLabels !== !1;
  for (const d of I) {
    const u = new re(d, O, A);
    u.setPosition(d.lat, d.lon), u.setColors(c.crossColor, c.labelColor), u.setSize(c.crossSize), u.group.visible = Ht, Gt || (u.labelEl.style.display = "none"), f.add(u.group), C.push(u);
  }
  const b = new ce(
    Math.max(4, Math.round(c.snakeTrailDetail ?? 31)),
    c.accentColor
  );
  b.setWidth(c.snakeWidth), f.add(b.line);
  const D = new pe();
  D.setColor(c.snakeIconColor), D.setSize(c.snakeIconSize), D.setRotationOffset(c.snakeIconRotationOffset), D.setVisible(!1), f.add(D.obj);
  const Bt = 8;
  let N = !1, L = null, q = null;
  const z = { x: 0, y: 0 };
  let X = 0, V = 0, J = 0, $ = 0, nt = 0, st = 0;
  const pt = (d) => {
    L = { id: d.pointerId, x: d.clientX, y: d.clientY }, N = !1, J = 0, $ = 0;
  }, ut = (d) => {
    var F;
    if (N) {
      if (d.pointerId !== q) return;
      const H = d.clientX - z.x, T = d.clientY - z.y;
      z.x = d.clientX, z.y = d.clientY;
      const G = c.dragSensitivity * 5e-3;
      X += H * G, V += T * G, V = h.MathUtils.clamp(V, -Math.PI * 0.55, Math.PI * 0.55);
      return;
    }
    if (!L || d.pointerId !== L.id) return;
    const u = d.clientX - L.x, g = d.clientY - L.y;
    Math.hypot(u, g) < Bt || (Math.abs(u) > Math.abs(g) ? (N = !0, q = L.id, z.x = d.clientX, z.y = d.clientY, L = null, (F = e.setPointerCapture) == null || F.call(e, d.pointerId), e.style.cursor = "grabbing") : L = null);
  }, Z = (d) => {
    var u;
    if (L = null, d.pointerId === q) {
      N = !1, q = null, e.style.cursor = "grab";
      try {
        (u = e.releasePointerCapture) == null || u.call(e, d.pointerId);
      } catch {
      }
    }
  };
  e.style.cursor = "grab", e.addEventListener("pointerdown", pt), e.addEventListener("pointermove", ut), e.addEventListener("pointerup", Z), e.addEventListener("pointercancel", Z);
  const it = ue(o);
  function ft() {
    const d = Lt(), u = Math.min(window.devicePixelRatio || 1, d.dprCap), g = e.getBoundingClientRect();
    g.width < 1 || g.height < 1 || (a.setPixelRatio(u), a.setSize(g.width, g.height, !1), r.aspect = g.width / Math.max(1, g.height), r.updateProjectionMatrix(), n.setSize(g.width, g.height), E.resolution.set(g.width * u, g.height * u), b.setResolution(g.width * u, g.height * u));
  }
  const mt = new ResizeObserver(ft);
  mt.observe(e), ft();
  let gt = !0;
  const wt = new IntersectionObserver(
    (d) => {
      for (const u of d) gt = u.isIntersecting;
    },
    { rootMargin: "100px", threshold: 0 }
  );
  wt.observe(o);
  const bt = new h.Vector3(), Q = new h.Vector3(), Mt = new h.Vector3(), at = new h.Vector3(), yt = new h.Vector3(), ot = new h.Vector3(), lt = new h.Vector3(), Et = new h.Vector3(), vt = new h.Vector3(), Yt = new h.Vector3();
  function jt() {
    r.updateMatrixWorld();
    const d = r.matrixWorldInverse, u = Yt.set(0, 0, 0).applyMatrix4(d).z;
    for (const g of C) {
      g.getSpriteWorldPos(bt);
      const H = (bt.applyMatrix4(d).z - u) / j, T = h.MathUtils.smoothstep(H, 0.05, 0.35);
      g.setOpacity(T), g.setVisible(T > 0.02), g.setLabelVisible(T > 0.05);
    }
  }
  const Kt = se(c.snakeEase);
  let rt = -1, Ct = !1, St = 0, ct = 0;
  function Dt(d) {
    if (ct = requestAnimationFrame(Dt), !gt || a.domElement.width < 1 || a.domElement.height < 1) return;
    const u = d / 1e3, g = rt < 0 ? 1 / 60 : Math.min(u - rt, 0.1);
    rt = u;
    const F = c.pauseSpinOnDrag !== !1 && N;
    if (!s && c.autoSpin && !F) {
      const M = c.autoSpinSpeed, v = c.autoSpinAxis;
      v === "X (pitch)" ? st += M * g : v === "Both" ? (nt += M * g, st += M * g * 0.4) : nt += M * g;
    }
    if (!N) {
      const M = c.dragSpring ?? {}, v = M.stiffness ?? 110, B = M.damping ?? 18, tt = Math.max(0.05, M.mass ?? 1), Y = 4, et = g / Y;
      for (let xt = 0; xt < Y; xt++) {
        const qt = (-v * X - B * J) / tt, Xt = (-v * V - B * $) / tt;
        J += qt * et, $ += Xt * et, X += J * et, V += $ * et;
      }
    }
    it.update(g, {
      enabled: c.scrollPitchEnabled === !0,
      rangeDeg: c.scrollPitchRangeDeg ?? 30,
      smoothing: c.scrollPitchSmoothing ?? 8
    });
    const H = h.MathUtils.degToRad(c.basePitchDeg), T = h.MathUtils.degToRad(c.baseYawDeg);
    if (f.rotation.set(
      H + V + st + it.currentPitch,
      T + X + nt,
      0
    ), c.showSnake !== !1) {
      b.active || (Ct ? b.scheduled !== null && u >= b.scheduled && (b.scheduled = null, b.begin(u, I)) : (b.schedule(
        u,
        c.snakeIntervalMin,
        c.snakeIntervalMax
      ), Ct = !0));
      const M = c.snakeContinuous === !0, v = b.update(
        u,
        g,
        c.snakeSpeed,
        c.snakeIntensity,
        Kt,
        {
          continuous: M,
          pauseMin: c.snakeIntervalMin,
          pauseMax: c.snakeIntervalMax,
          countries: I,
          trailMin: c.snakeTrailMin,
          trailLength: c.snakeTrailLength,
          trailFollow: c.snakeTrailFollow,
          legMinDuration: c.snakeLegMinDuration ?? 0
        }
      );
      v >= 0 && v < C.length && (C[v].flash(u, c.snakeFlashDuration), M || b.schedule(
        u,
        c.snakeIntervalMin,
        c.snakeIntervalMax
      )), u - St > 30 && (b.prunePath(), St = u);
    }
    let G = !1;
    for (const M of C)
      if (M.flashUntil > 0) {
        G = !0;
        break;
      }
    if (G) {
      const M = c.snakeFlashDuration;
      for (const v of C)
        v.updateFlash(u, M, c.crossColor, c.accentColor);
    }
    if (r.updateMatrixWorld(), f.updateMatrixWorld(), jt(), c.showSnake !== !1 && c.showSnakeIcon !== !1 && !!b.active && b.active)
      if (b.sampleHeadAndTangent(Q, Mt)) {
        D.setLocalPosition(Q), at.copy(Q).applyMatrix4(f.matrixWorld), yt.copy(Q).add(Mt).applyMatrix4(f.matrixWorld), ot.copy(at).project(r), lt.copy(yt).project(r);
        const v = lt.x - ot.x, B = lt.y - ot.y;
        Math.hypot(v, B) > 1e-5 && D.setHeading(Math.atan2(v, B) * 180 / Math.PI), Et.copy(at).applyMatrix4(r.matrixWorldInverse), vt.set(0, 0, 0).applyMatrix4(f.matrixWorld).applyMatrix4(r.matrixWorldInverse);
        const tt = (Et.z - vt.z) / j, Y = h.MathUtils.smoothstep(tt, 0.05, 0.35) * c.snakeIconOpacity;
        D.setOpacity(Y), D.setVisible(Y > 0.02);
      } else
        D.setVisible(!1);
    else
      D.setVisible(!1);
    a.render(p, r), n.render(p, r);
  }
  ct = requestAnimationFrame(Dt), o.__dispose = () => {
    cancelAnimationFrame(ct), mt.disconnect(), wt.disconnect(), e.removeEventListener("pointerdown", pt), e.removeEventListener("pointermove", ut), e.removeEventListener("pointerup", Z), e.removeEventListener("pointercancel", Z), it.dispose();
    for (const d of C) d.dispose();
    D.dispose(), b.dispose();
    for (const d of W) d.geometry.dispose();
    E.dispose(), y.dispose(), S.dispose(), O.dispose(), n.domElement.parentElement && n.domElement.parentElement.removeChild(n.domElement), a.dispose();
  };
}
(function() {
  const o = /* @__PURE__ */ new Set();
  document.querySelectorAll('[data-webgl-experiment="globe-1"]').forEach((t) => o.add(t)), document.querySelectorAll("canvas[data-flow-globe-1]").forEach((t) => {
    t.parentElement && o.add(t.parentElement);
  });
  for (const t of o)
    we(t);
})();
