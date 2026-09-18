function U(e) {
  if (!e) return null;
  const t = e.trim();
  let n = t.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=|shorts\/|v\/))([\w-]{11})/i
  );
  return n ? { provider: "youtube", id: n[1], url: t } : /^[\w-]{11}$/.test(t) ? { provider: "youtube", id: t, url: t } : (n = t.match(/player\.vimeo\.com\/video\/(\d+)/i), n ? { provider: "vimeo", id: n[1], url: t } : (n = t.match(/vimeo\.com\/(?:[^/]+\/)*(\d+)/i), n ? { provider: "vimeo", id: n[1], url: t } : /^\d{6,}$/.test(t) ? { provider: "vimeo", id: t, url: t } : /\.m3u8(\?|#|$)/i.test(t) ? { provider: "hls", id: t, url: t } : /\.(mp4|webm|mov)(\?|#|$)/i.test(t) ? { provider: "mp4", id: t, url: t } : /^https?:\/\//.test(t) ? { provider: "mp4", id: t, url: t } : null));
}
async function Y(e, t = 1280) {
  if (e.provider === "youtube")
    return {
      url: `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
      width: 480,
      height: 360
    };
  if (e.provider === "vimeo")
    try {
      const n = "https://vimeo.com/api/oembed.json?url=" + encodeURIComponent("https://vimeo.com/" + e.id) + `&width=${t}`, r = await fetch(n);
      if (!r.ok) return null;
      const u = await r.json();
      if (!u.thumbnail_url) return null;
      const o = j(u.account_type) ? u.account_type : void 0;
      return {
        url: u.thumbnail_url,
        width: u.thumbnail_width,
        height: u.thumbnail_height,
        accountType: o,
        isPlus: u.is_plus === 1
      };
    } catch {
      return null;
    }
  return null;
}
function j(e) {
  return e === "basic" || e === "plus" || e === "pro" || e === "business" || e === "premium";
}
function X(e, t) {
  if (e.provider === "vimeo") {
    const n = new URLSearchParams();
    if (n.set("autoplay", "1"), t.muted && n.set("muted", "1"), t.loop && n.set("loop", "1"), n.set("controls", t.showControls === !1 ? "0" : "1"), t.showControls === !1 ? (n.set("title", "0"), n.set("byline", "0"), n.set("portrait", "0"), n.set("share", "0"), n.set("speed", "0"), n.set("keyboard", "0"), n.set("pip", "0"), n.set("transparent", "0")) : (n.set("title", t.showTitle ? "1" : "0"), n.set("byline", "0"), n.set("portrait", "0")), n.set("playsinline", t.playsinline === !1 ? "0" : "1"), t.accentColor) {
      const r = t.accentColor.replace(/^#/, "").slice(0, 6);
      /^[0-9a-fA-F]{6}$/.test(r) && n.set("color", r);
    }
    return n.set("dnt", "1"), `https://player.vimeo.com/video/${e.id}?${n.toString()}`;
  }
  if (e.provider === "youtube") {
    const n = new URLSearchParams();
    return n.set("enablejsapi", "1"), t.origin && n.set("origin", t.origin), n.set("autoplay", "1"), t.muted && n.set("mute", "1"), t.loop && (n.set("loop", "1"), n.set("playlist", e.id)), n.set("controls", t.showControls === !1 ? "0" : "1"), n.set("playsinline", t.playsinline === !1 ? "0" : "1"), n.set("rel", "0"), n.set("modestbranding", "1"), `https://www.youtube-nocookie.com/embed/${e.id}?${n.toString()}`;
  }
  return e.url;
}
function F(e) {
  if (!Number.isFinite(e) || e < 0) return "0:00";
  const t = Math.floor(e), n = Math.floor(t / 3600), r = Math.floor(t % 3600 / 60), u = t % 60, o = String(u).padStart(2, "0");
  return n > 0 ? `${n}:${String(r).padStart(2, "0")}:${o}` : `${r}:${o}`;
}
const K = [
  "play",
  "pause",
  "ended",
  "timeupdate",
  "progress",
  "volumechange",
  "playbackratechange",
  "durationchange",
  "bufferstart",
  "bufferend",
  "error"
];
function W(e) {
  const t = /* @__PURE__ */ new Map(), n = {
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    muted: !1,
    paused: !0,
    playbackRate: 1
  };
  let r = null;
  const u = new Promise((l) => {
    r = l;
  });
  let o = !1;
  function f(l, i) {
    if (!e.contentWindow) return;
    const c = { method: l };
    i !== void 0 && (c.value = i), e.contentWindow.postMessage(JSON.stringify(c), "*");
  }
  function a(l, i) {
    const c = t.get(l);
    if (c)
      for (const m of c)
        try {
          m(i);
        } catch {
        }
  }
  function p(l) {
    if (l.source !== e.contentWindow) return;
    let i;
    try {
      i = typeof l.data == "string" ? JSON.parse(l.data) : l.data;
    } catch {
      return;
    }
    if (i) {
      if (i.event === "ready" || i.method === "ping" && !o) {
        o = !0;
        for (const c of K) f("addEventListener", c);
        f("getDuration"), f("getVolume"), f("getMuted"), f("getPlaybackRate"), r == null || r(), a("ready");
        return;
      }
      switch (i.event) {
        case "play":
          n.paused = !1, a("play");
          break;
        case "pause":
          n.paused = !0, a("pause");
          break;
        case "ended":
          n.paused = !0, a("ended");
          break;
        case "timeupdate": {
          const c = i.data;
          (c == null ? void 0 : c.seconds) != null && (n.currentTime = c.seconds), (c == null ? void 0 : c.duration) != null && (n.duration = c.duration), a("timeupdate");
          break;
        }
        case "progress": {
          const c = i.data;
          (c == null ? void 0 : c.percent) != null && (n.buffered = c.percent), a("progress");
          break;
        }
        case "durationchange": {
          const c = i.data;
          (c == null ? void 0 : c.duration) != null && (n.duration = c.duration), a("durationchange");
          break;
        }
        case "volumechange": {
          const c = i.data;
          (c == null ? void 0 : c.volume) != null && (n.volume = c.volume), a("volumechange");
          break;
        }
        case "playbackratechange": {
          const c = i.data;
          (c == null ? void 0 : c.playbackRate) != null && (n.playbackRate = c.playbackRate), a("ratechange");
          break;
        }
        case "bufferstart":
          a("buffering");
          break;
        case "bufferend":
          a("playing");
          break;
        case "error":
          a("error", i.data);
          break;
      }
      i.method === "getDuration" && typeof i.value == "number" ? (n.duration = i.value, a("durationchange")) : i.method === "getVolume" && typeof i.value == "number" ? (n.volume = i.value, a("volumechange")) : i.method === "getMuted" && typeof i.value == "boolean" ? (n.muted = i.value, a("volumechange")) : i.method === "getPlaybackRate" && typeof i.value == "number" && (n.playbackRate = i.value, a("ratechange"));
    }
  }
  return window.addEventListener("message", p), {
    element: e,
    state: n,
    ready: () => u,
    play: () => f("play"),
    pause: () => f("pause"),
    seek: (l) => {
      n.currentTime = l, f("setCurrentTime", l);
    },
    setVolume: (l) => {
      n.volume = l, f("setVolume", l);
    },
    setMuted: (l) => {
      n.muted = l, f("setMuted", l);
    },
    setPlaybackRate: (l) => {
      n.playbackRate = l, f("setPlaybackRate", l);
    },
    on: (l, i) => {
      let c = t.get(l);
      return c || (c = /* @__PURE__ */ new Set(), t.set(l, c)), c.add(i), () => {
        c == null || c.delete(i);
      };
    },
    destroy: () => {
      window.removeEventListener("message", p), t.clear();
    }
  };
}
const R = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3
};
function J(e) {
  const t = /* @__PURE__ */ new Map(), n = {
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    muted: !1,
    paused: !0,
    playbackRate: 1
  };
  let r = null;
  const u = new Promise((m) => {
    r = m;
  });
  let o = null;
  function f(m, ...d) {
    if (!e.contentWindow) return;
    const s = { event: "command", func: m, args: d };
    e.contentWindow.postMessage(JSON.stringify(s), "*");
  }
  function a(m, d) {
    const s = t.get(m);
    if (s)
      for (const y of s)
        try {
          y(d);
        } catch {
        }
  }
  function p() {
    o || (o = setInterval(() => {
      f("getCurrentTime"), f("getVideoLoadedFraction");
    }, 250));
  }
  function l() {
    o && (clearInterval(o), o = null);
  }
  function i(m) {
    if (m.source !== e.contentWindow) return;
    let d;
    try {
      d = typeof m.data == "string" ? JSON.parse(m.data) : m.data;
    } catch {
      return;
    }
    if (d) {
      if (d.event === "onReady") {
        f("getDuration"), f("getVolume"), f("isMuted"), f("getPlaybackRate"), r == null || r(), a("ready");
        return;
      }
      if (d.event === "onStateChange") {
        const s = d.info;
        s === R.PLAYING ? (n.paused = !1, p(), a("playing"), a("play")) : s === R.PAUSED ? (n.paused = !0, l(), a("pause")) : s === R.ENDED ? (n.paused = !0, l(), a("ended")) : s === R.BUFFERING && a("buffering");
        return;
      }
      if (d.event === "infoDelivery" && d.info) {
        const s = d.info;
        let y = !1;
        typeof s.currentTime == "number" && (n.currentTime = s.currentTime, y = !0), typeof s.duration == "number" && (n.duration = s.duration, a("durationchange")), typeof s.videoLoadedFraction == "number" && (n.buffered = s.videoLoadedFraction, a("progress")), typeof s.volume == "number" && (n.volume = s.volume / 100, a("volumechange")), typeof s.muted == "boolean" && (n.muted = s.muted, a("volumechange")), typeof s.playbackRate == "number" && (n.playbackRate = s.playbackRate, a("ratechange")), y && a("timeupdate");
        return;
      }
      d.event === "onError" && a("error", d.info);
    }
  }
  window.addEventListener("message", i);
  function c() {
    e.contentWindow && e.contentWindow.postMessage(
      JSON.stringify({ event: "listening", id: "flow-player" }),
      "*"
    );
  }
  return e.addEventListener("load", c, { once: !0 }), setTimeout(c, 500), {
    element: e,
    state: n,
    ready: () => u,
    play: () => f("playVideo"),
    pause: () => f("pauseVideo"),
    seek: (m) => {
      n.currentTime = m, f("seekTo", m, !0);
    },
    setVolume: (m) => {
      n.volume = m, f("setVolume", Math.round(m * 100));
    },
    setMuted: (m) => {
      n.muted = m, f(m ? "mute" : "unMute");
    },
    setPlaybackRate: (m) => {
      n.playbackRate = m, f("setPlaybackRate", m);
    },
    on: (m, d) => {
      let s = t.get(m);
      return s || (s = /* @__PURE__ */ new Set(), t.set(m, s)), s.add(d), () => {
        s == null || s.delete(d);
      };
    },
    destroy: () => {
      l(), window.removeEventListener("message", i), t.clear();
    }
  };
}
const G = "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js";
let N = null;
function Q() {
  return typeof window > "u" ? Promise.resolve(null) : window.Hls ? Promise.resolve(window.Hls) : N || (N = new Promise((e) => {
    const t = document.querySelector("script[data-vp-hls]");
    if (t) {
      t.addEventListener("load", () => e(window.Hls ?? null), { once: !0 }), t.addEventListener("error", () => e(null), { once: !0 });
      return;
    }
    const n = document.createElement("script");
    n.src = G, n.async = !0, n.setAttribute("data-vp-hls", ""), n.addEventListener("load", () => e(window.Hls ?? null), { once: !0 }), n.addEventListener("error", () => e(null), { once: !0 }), document.head.appendChild(n);
  }), N);
}
function Z(e, t) {
  const n = /* @__PURE__ */ new Map(), r = {
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: e.volume ?? 1,
    muted: e.muted ?? !1,
    paused: e.paused !== !1,
    playbackRate: e.playbackRate ?? 1
  };
  let u = null;
  const o = new Promise((g) => {
    u = g;
  });
  let f = !1, a = null;
  function p(g, S) {
    const x = n.get(g);
    if (x)
      for (const A of x)
        try {
          A(S);
        } catch {
        }
  }
  function l() {
    return !e.buffered.length || !e.duration ? 0 : e.buffered.end(e.buffered.length - 1) / e.duration;
  }
  function i() {
    f || (f = !0, u == null || u(), p("ready"));
  }
  function c() {
    r.duration = e.duration, i(), p("durationchange");
  }
  function m() {
    r.currentTime = e.currentTime, p("timeupdate");
  }
  function d() {
    r.buffered = l(), p("progress");
  }
  function s() {
    r.paused = !1, p("play");
  }
  function y() {
    p("playing");
  }
  function b() {
    r.paused = !0, p("pause");
  }
  function h() {
    r.paused = !0, p("ended");
  }
  function L() {
    r.volume = e.volume, r.muted = e.muted, p("volumechange");
  }
  function E() {
    r.playbackRate = e.playbackRate, p("ratechange");
  }
  function k() {
    p("buffering");
  }
  function v() {
    p("error", e.error);
  }
  return e.addEventListener("loadedmetadata", c), e.addEventListener("timeupdate", m), e.addEventListener("progress", d), e.addEventListener("play", s), e.addEventListener("playing", y), e.addEventListener("pause", b), e.addEventListener("ended", h), e.addEventListener("volumechange", L), e.addEventListener("ratechange", E), e.addEventListener("waiting", k), e.addEventListener("error", v), typeof e.canPlayType == "function" && e.canPlayType("application/vnd.apple.mpegurl") !== "" ? e.src = t : Q().then((g) => {
    if (!g || !g.isSupported()) {
      e.src = t;
      return;
    }
    a = new g(), a.loadSource(t), a.attachMedia(e);
  }), {
    element: e,
    state: r,
    ready: () => o,
    play: () => {
      e.play().catch(() => {
      });
    },
    pause: () => e.pause(),
    seek: (g) => {
      r.currentTime = g;
      try {
        e.currentTime = g;
      } catch {
      }
    },
    setVolume: (g) => {
      r.volume = g, e.volume = Math.max(0, Math.min(1, g));
    },
    setMuted: (g) => {
      r.muted = g, e.muted = g;
    },
    setPlaybackRate: (g) => {
      r.playbackRate = g, e.playbackRate = g;
    },
    on: (g, S) => {
      let x = n.get(g);
      return x || (x = /* @__PURE__ */ new Set(), n.set(g, x)), x.add(S), () => {
        x == null || x.delete(S);
      };
    },
    destroy: () => {
      e.removeEventListener("loadedmetadata", c), e.removeEventListener("timeupdate", m), e.removeEventListener("progress", d), e.removeEventListener("play", s), e.removeEventListener("playing", y), e.removeEventListener("pause", b), e.removeEventListener("ended", h), e.removeEventListener("volumechange", L), e.removeEventListener("ratechange", E), e.removeEventListener("waiting", k), e.removeEventListener("error", v);
      try {
        a == null || a.destroy();
      } catch {
      }
      n.clear();
    }
  };
}
function ee(e, t) {
  const n = /* @__PURE__ */ new Map(), r = {
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: e.volume ?? 1,
    muted: e.muted ?? !1,
    paused: e.paused !== !1,
    playbackRate: e.playbackRate ?? 1
  };
  let u = null;
  const o = new Promise((v) => {
    u = v;
  });
  let f = !1;
  function a(v, w) {
    const g = n.get(v);
    if (g)
      for (const S of g)
        try {
          S(w);
        } catch {
        }
  }
  function p() {
    return !e.buffered.length || !e.duration ? 0 : e.buffered.end(e.buffered.length - 1) / e.duration;
  }
  function l() {
    f || (f = !0, u == null || u(), a("ready"));
  }
  function i() {
    r.duration = e.duration, l(), a("durationchange");
  }
  function c() {
    r.currentTime = e.currentTime, a("timeupdate");
  }
  function m() {
    r.buffered = p(), a("progress");
  }
  function d() {
    r.paused = !1, a("play");
  }
  function s() {
    a("playing");
  }
  function y() {
    r.paused = !0, a("pause");
  }
  function b() {
    r.paused = !0, a("ended");
  }
  function h() {
    r.volume = e.volume, r.muted = e.muted, a("volumechange");
  }
  function L() {
    r.playbackRate = e.playbackRate, a("ratechange");
  }
  function E() {
    a("buffering");
  }
  function k() {
    a("error", e.error);
  }
  return e.addEventListener("loadedmetadata", i), e.addEventListener("timeupdate", c), e.addEventListener("progress", m), e.addEventListener("play", d), e.addEventListener("playing", s), e.addEventListener("pause", y), e.addEventListener("ended", b), e.addEventListener("volumechange", h), e.addEventListener("ratechange", L), e.addEventListener("waiting", E), e.addEventListener("error", k), e.src = t, {
    element: e,
    state: r,
    ready: () => o,
    play: () => {
      e.play().catch(() => {
      });
    },
    pause: () => e.pause(),
    seek: (v) => {
      r.currentTime = v;
      try {
        e.currentTime = v;
      } catch {
      }
    },
    setVolume: (v) => {
      r.volume = v, e.volume = Math.max(0, Math.min(1, v));
    },
    setMuted: (v) => {
      r.muted = v, e.muted = v;
    },
    setPlaybackRate: (v) => {
      r.playbackRate = v, e.playbackRate = v;
    },
    on: (v, w) => {
      let g = n.get(v);
      return g || (g = /* @__PURE__ */ new Set(), n.set(v, g)), g.add(w), () => {
        g == null || g.delete(w);
      };
    },
    destroy: () => {
      e.removeEventListener("loadedmetadata", i), e.removeEventListener("timeupdate", c), e.removeEventListener("progress", m), e.removeEventListener("play", d), e.removeEventListener("playing", s), e.removeEventListener("pause", y), e.removeEventListener("ended", b), e.removeEventListener("volumechange", h), e.removeEventListener("ratechange", L), e.removeEventListener("waiting", E), e.removeEventListener("error", k), n.clear();
    }
  };
}
function te(e, t) {
  switch (e.provider) {
    case "vimeo":
      if (!(t instanceof HTMLIFrameElement))
        throw new Error("Vimeo provider requires an <iframe> element");
      return W(t);
    case "youtube":
      if (!(t instanceof HTMLIFrameElement))
        throw new Error("YouTube provider requires an <iframe> element");
      return J(t);
    case "hls":
      if (!(t instanceof HTMLVideoElement))
        throw new Error("HLS provider requires a <video> element");
      return Z(t, e.url);
    case "mp4":
      if (!(t instanceof HTMLVideoElement))
        throw new Error("MP4 provider requires a <video> element");
      return ee(t, e.url);
    default: {
      const n = e.provider;
      throw new Error(`Unknown provider: ${String(n)}`);
    }
  }
}
function ne(e) {
  function t(n, r) {
    r === null ? e.removeAttribute(n) : e.setAttribute(n, r);
  }
  return {
    setState(n) {
      t("data-state", n);
    },
    setVolume(n, r) {
      const u = r || n === 0 ? "mute" : n < 0.5 ? "mid" : "full";
      return t("data-volume", u), u;
    },
    setFullscreen(n) {
      t("data-fullscreen", n ? "true" : null);
    },
    setMenuOpen(n) {
      t("data-menu-open", n ? "true" : null);
    },
    setControlsIdle(n) {
      t("data-controls-idle", n ? "true" : null);
    },
    setBuffering(n) {
      t("data-buffering", n ? "true" : null);
    },
    /** Set by PosterLoader once Vimeo oEmbed resolves. Drives the
     *  auto-decision of whether to overlay our UI on top of theirs. */
    setVimeoTier(n) {
      t("data-vimeo-tier", n);
    },
    setInit() {
      t("data-vp-init", "1");
    },
    setPlaying() {
      t("data-vp-playing", "1");
    },
    get state() {
      return e.getAttribute("data-state") ?? null;
    },
    get menuOpen() {
      return e.getAttribute("data-menu-open") === "true";
    },
    get inited() {
      return e.getAttribute("data-vp-init") === "1";
    },
    get playing() {
      return e.getAttribute("data-vp-playing") === "1";
    }
  };
}
const C = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
  volumeFull: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"/></svg>',
  volumeMid: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12z"/></svg>',
  volumeMute: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.96 8.96 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.26c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>',
  fullscreenEnter: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
  fullscreenExit: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94 0 .31.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
};
function re(e) {
  const t = document.createElement("div");
  t.className = "vp-scrub", t.setAttribute("role", "slider"), t.setAttribute("aria-label", "Seek"), t.setAttribute("aria-valuemin", "0"), t.setAttribute("aria-valuemax", "100"), t.setAttribute("aria-valuenow", "0"), t.tabIndex = 0;
  const n = document.createElement("div");
  n.className = "vp-scrub-buffered";
  const r = document.createElement("div");
  r.className = "vp-scrub-played";
  const u = document.createElement("div");
  u.className = "vp-scrub-thumb", t.append(n, r, u);
  let o = !1, f = null;
  function a(s) {
    return s < 0 ? 0 : s > 1 ? 1 : s;
  }
  function p(s) {
    const y = t.getBoundingClientRect();
    return y.width === 0 ? 0 : a((s - y.left) / y.width);
  }
  function l(s, y) {
    const b = a(s), h = a(y);
    r.style.width = `${b * 100}%`, n.style.width = `${h * 100}%`, u.style.left = `${b * 100}%`, t.setAttribute("aria-valuenow", String(Math.round(b * 100)));
  }
  function i(s) {
    var b;
    if (s.button !== 0 && s.pointerType === "mouse") return;
    o = !0, f = s.pointerId, t.setPointerCapture(s.pointerId), t.classList.add("is-dragging"), (b = e.onScrubStart) == null || b.call(e);
    const y = p(s.clientX);
    l(y, parseFloat(n.style.width || "0") / 100), e.onScrub(y), s.preventDefault();
  }
  function c(s) {
    if (!o || s.pointerId !== f) return;
    const y = p(s.clientX);
    l(y, parseFloat(n.style.width || "0") / 100), e.onScrub(y);
  }
  function m(s) {
    var b;
    if (!o || s.pointerId !== f) return;
    const y = p(s.clientX);
    o = !1, f = null;
    try {
      t.releasePointerCapture(s.pointerId);
    } catch {
    }
    t.classList.remove("is-dragging"), e.onCommit(y), (b = e.onScrubEnd) == null || b.call(e);
  }
  function d(s) {
    const y = s.shiftKey ? 0.05 : 0.01, b = parseFloat(r.style.width || "0") / 100;
    let h = b;
    if (s.key === "ArrowRight" || s.key === "ArrowUp") h = a(b + y);
    else if (s.key === "ArrowLeft" || s.key === "ArrowDown") h = a(b - y);
    else if (s.key === "Home") h = 0;
    else if (s.key === "End") h = 1;
    else return;
    s.preventDefault(), l(h, parseFloat(n.style.width || "0") / 100), e.onCommit(h);
  }
  return t.addEventListener("pointerdown", i), t.addEventListener("pointermove", c), t.addEventListener("pointerup", m), t.addEventListener("pointercancel", m), t.addEventListener("keydown", d), {
    root: t,
    setProgress(s, y) {
      o || l(s, y);
    },
    isDragging: () => o,
    destroy: () => {
      t.removeEventListener("pointerdown", i), t.removeEventListener("pointermove", c), t.removeEventListener("pointerup", m), t.removeEventListener("pointercancel", m), t.removeEventListener("keydown", d);
    }
  };
}
const oe = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
function ae() {
  const e = document.createElement("div");
  e.className = "vp-settings";
  const t = document.createElement("div");
  t.className = "vp-control vp-btn-settings", t.setAttribute("role", "button"), t.setAttribute("tabindex", "0"), t.setAttribute("aria-label", "Settings"), t.setAttribute("aria-haspopup", "menu"), t.setAttribute("aria-expanded", "false"), t.setAttribute("data-tooltip", "Settings"), t.setAttribute("data-vp", "settings"), t.innerHTML = C.settings, e.appendChild(t);
  const n = document.createElement("div");
  return n.className = "vp-settings-menu", n.setAttribute("role", "menu"), n.setAttribute("aria-label", "Settings"), n.hidden = !0, e.appendChild(n), { wrap: e, trigger: t, menu: n };
}
function ie(e) {
  const t = document.createElement("div");
  t.className = "vp-settings-section";
  const n = document.createElement("div");
  return n.className = "vp-settings-heading", n.textContent = e, t.appendChild(n), t;
}
function se(e, t) {
  const n = document.createElement("div");
  n.className = "vp-settings-item", n.setAttribute("role", "menuitemradio"), n.setAttribute("tabindex", "-1"), n.setAttribute("aria-checked", t ? "true" : "false");
  const r = document.createElement("span");
  r.textContent = e, n.appendChild(r);
  const u = document.createElement("span");
  return u.className = "vp-settings-check", u.innerHTML = C.check, n.appendChild(u), n;
}
function q(e, t, n) {
  const { trigger: r, menu: u } = e, o = ie("Speed"), f = document.createElement("div");
  f.className = "vp-settings-list", o.appendChild(f);
  const a = [];
  for (const b of oe) {
    const h = se(b === 1 ? "Normal" : `${b}×`, b === 1);
    h.dataset.speed = String(b), h.addEventListener("click", () => {
      t.setPlaybackRate(b), p(b), c(), r.focus();
    }), h.addEventListener("keydown", (L) => {
      (L.key === "Enter" || L.key === " ") && (L.preventDefault(), h.click());
    }), f.appendChild(h), a.push(h);
  }
  u.appendChild(o);
  function p(b) {
    for (const h of a) {
      const L = Number(h.dataset.speed), E = Math.abs(L - b) < 0.01;
      h.setAttribute("aria-checked", E ? "true" : "false");
    }
  }
  let l = !1;
  function i() {
    var b;
    l || (l = !0, u.hidden = !1, r.setAttribute("aria-expanded", "true"), n.setMenuOpen(!0), document.addEventListener("click", m, !0), document.addEventListener("keydown", d), (b = u.querySelector('[aria-checked="true"]')) == null || b.focus());
  }
  function c() {
    l && (l = !1, u.hidden = !0, r.setAttribute("aria-expanded", "false"), n.setMenuOpen(!1), document.removeEventListener("click", m, !0), document.removeEventListener("keydown", d));
  }
  function m(b) {
    e.wrap.contains(b.target) || c();
  }
  function d(b) {
    b.key === "Escape" && (b.preventDefault(), c(), r.focus());
  }
  function s() {
    l ? c() : i();
  }
  r.addEventListener("click", s), r.addEventListener("keydown", (b) => {
    (b.key === "Enter" || b.key === " ") && (b.preventDefault(), s());
  });
  const y = t.on("ratechange", () => {
    p(t.state.playbackRate);
  });
  return () => {
    y(), c();
  };
}
function D(e) {
  const t = document.createElement("div");
  return t.className = e.className, t.setAttribute("role", "button"), t.setAttribute("tabindex", "0"), t.setAttribute("aria-label", e.ariaLabel), t.setAttribute("data-tooltip", e.tooltip), t.setAttribute("data-vp", e.dataVp), t.innerHTML = e.innerHTML, t.addEventListener("click", e.onClick), t.addEventListener("keydown", (n) => {
    (n.key === "Enter" || n.key === " ") && (n.preventDefault(), e.onClick());
  }), t;
}
function le(e) {
  const t = document.createElement("div");
  t.className = "vp-volume", t.setAttribute("role", "slider"), t.setAttribute("aria-label", "Volume"), t.setAttribute("aria-valuemin", "0"), t.setAttribute("aria-valuemax", "100"), t.setAttribute("aria-valuenow", "100"), t.tabIndex = 0;
  const n = document.createElement("div");
  n.className = "vp-volume-fill", t.appendChild(n);
  const r = document.createElement("div");
  r.className = "vp-volume-thumb", t.appendChild(r);
  let u = !1, o = null;
  function f(d) {
    return d < 0 ? 0 : d > 1 ? 1 : d;
  }
  function a(d) {
    const s = t.getBoundingClientRect();
    return s.width === 0 ? 0 : f((d - s.left) / s.width);
  }
  function p(d) {
    e.setVolume(d), d > 0 && e.state.muted && e.setMuted(!1);
  }
  function l(d) {
    d.button !== 0 && d.pointerType === "mouse" || (u = !0, o = d.pointerId, t.setPointerCapture(d.pointerId), p(a(d.clientX)), d.preventDefault());
  }
  function i(d) {
    !u || d.pointerId !== o || p(a(d.clientX));
  }
  function c(d) {
    if (!(!u || d.pointerId !== o)) {
      u = !1, o = null;
      try {
        t.releasePointerCapture(d.pointerId);
      } catch {
      }
    }
  }
  function m(d) {
    const s = d.shiftKey ? 0.1 : 0.05, y = e.state.volume;
    let b = y;
    if (d.key === "ArrowRight" || d.key === "ArrowUp") b = f(y + s);
    else if (d.key === "ArrowLeft" || d.key === "ArrowDown") b = f(y - s);
    else if (d.key === "Home") b = 0;
    else if (d.key === "End") b = 1;
    else return;
    d.preventDefault(), p(b);
  }
  return t.addEventListener("pointerdown", l), t.addEventListener("pointermove", i), t.addEventListener("pointerup", c), t.addEventListener("pointercancel", c), t.addEventListener("keydown", m), {
    root: t,
    sync(d, s) {
      const y = s ? 0 : f(d);
      n.style.width = `${y * 100}%`, r.style.left = `${y * 100}%`, t.setAttribute("aria-valuenow", String(Math.round(y * 100)));
    },
    destroy() {
      t.removeEventListener("pointerdown", l), t.removeEventListener("pointermove", i), t.removeEventListener("pointerup", c), t.removeEventListener("pointercancel", c), t.removeEventListener("keydown", m);
    }
  };
}
function ue(e) {
  const { provider: t, fullscreen: n, state: r, showControls: u } = e, o = document.createElement("div");
  o.className = "vp-controls", o.setAttribute("role", "group"), o.setAttribute("aria-label", "Video controls"), u || o.classList.add("vp-controls--hidden");
  const f = [], a = D({
    className: "vp-control vp-btn-play",
    ariaLabel: "Play",
    tooltip: "Play (Space)",
    innerHTML: `<span class="vp-icon-play">${C.play}</span><span class="vp-icon-pause">${C.pause}</span>`,
    dataVp: "play",
    onClick: () => {
      t.state.paused ? t.play() : t.pause();
    }
  });
  a.setAttribute("aria-pressed", "false"), f.push(
    t.on("play", () => {
      a.setAttribute("aria-pressed", "true"), a.setAttribute("aria-label", "Pause"), a.setAttribute("data-tooltip", "Pause (Space)"), r.setState("playing");
    })
  ), f.push(
    t.on("pause", () => {
      a.setAttribute("aria-pressed", "false"), a.setAttribute("aria-label", "Play"), a.setAttribute("data-tooltip", "Play (Space)"), r.setState("paused");
    })
  ), f.push(
    t.on("ended", () => {
      r.setState("ended");
    })
  ), o.appendChild(a);
  const p = re({
    onScrub: (v) => {
      const w = t.state.duration;
      w > 0 && (c.textContent = F(v * w));
    },
    onCommit: (v) => {
      const w = t.state.duration;
      w > 0 && t.seek(v * w);
    },
    onScrubStart: () => {
    }
  });
  o.appendChild(p.root), f.push(() => p.destroy());
  function l() {
    const v = t.state.duration;
    v > 0 && p.setProgress(t.state.currentTime / v, t.state.buffered);
  }
  f.push(t.on("timeupdate", l)), f.push(t.on("progress", l));
  const i = document.createElement("div");
  i.className = "vp-time";
  const c = document.createElement("span");
  c.className = "vp-time-current", c.textContent = "0:00";
  const m = document.createElement("span");
  m.className = "vp-time-sep", m.textContent = " / ";
  const d = document.createElement("span");
  d.className = "vp-time-duration", d.textContent = "0:00", i.append(c, m, d), o.appendChild(i);
  function s() {
    p.isDragging() || (c.textContent = F(t.state.currentTime)), d.textContent = F(t.state.duration);
  }
  f.push(t.on("timeupdate", s)), f.push(t.on("durationchange", s));
  const y = document.createElement("div");
  y.className = "vp-volume-group";
  const b = D({
    className: "vp-control vp-btn-mute",
    ariaLabel: "Mute",
    tooltip: "Mute (M)",
    innerHTML: `<span class="vp-icon-vol-full">${C.volumeFull}</span><span class="vp-icon-vol-mid">${C.volumeMid}</span><span class="vp-icon-vol-mute">${C.volumeMute}</span>`,
    dataVp: "mute",
    onClick: () => t.setMuted(!t.state.muted)
  });
  b.setAttribute("aria-pressed", "false"), y.appendChild(b);
  const h = le(t);
  y.appendChild(h.root), f.push(() => h.destroy()), o.appendChild(y);
  function L() {
    const v = r.setVolume(t.state.volume, t.state.muted);
    b.setAttribute("aria-pressed", v === "mute" ? "true" : "false"), b.setAttribute("aria-label", v === "mute" ? "Unmute" : "Mute"), b.setAttribute("data-tooltip", v === "mute" ? "Unmute (M)" : "Mute (M)"), b.dataset.level = v, h.sync(t.state.volume, t.state.muted);
  }
  f.push(t.on("volumechange", L)), L();
  const E = ae();
  o.appendChild(E.wrap), f.push(q(E, t, r));
  const k = D({
    className: "vp-control vp-btn-fullscreen",
    ariaLabel: "Enter fullscreen",
    tooltip: "Fullscreen (F)",
    innerHTML: `<span class="vp-icon-fs-enter">${C.fullscreenEnter}</span><span class="vp-icon-fs-exit">${C.fullscreenExit}</span>`,
    dataVp: "fullscreen",
    onClick: () => void n.toggle()
  });
  return k.setAttribute("aria-pressed", "false"), o.appendChild(k), {
    el: o,
    destroy: () => {
      for (const v of f)
        try {
          v();
        } catch {
        }
    }
  };
}
function ce(e, t) {
  const n = e.querySelector(".vp-btn-fullscreen");
  n && (n.setAttribute("aria-pressed", t ? "true" : "false"), n.setAttribute("aria-label", t ? "Exit fullscreen" : "Enter fullscreen"), n.setAttribute("data-tooltip", t ? "Exit fullscreen (F)" : "Fullscreen (F)"));
}
function T(e, t) {
  return e.querySelector(`[data-vp="${t}"]`);
}
function de(e) {
  return e < 0 ? 0 : e > 1 ? 1 : e;
}
function z(e, t) {
  let n = !1, r = null;
  function u(p) {
    const l = e.getBoundingClientRect();
    return l.width === 0 ? 0 : de((p - l.left) / l.width);
  }
  function o(p) {
    var l, i;
    p.button !== 0 && p.pointerType === "mouse" || (n = !0, r = p.pointerId, e.setPointerCapture(p.pointerId), e.classList.add("is-dragging"), (l = t.onScrubStart) == null || l.call(t), (i = t.onScrub) == null || i.call(t, u(p.clientX)), p.preventDefault());
  }
  function f(p) {
    var l;
    !n || p.pointerId !== r || (l = t.onScrub) == null || l.call(t, u(p.clientX));
  }
  function a(p) {
    var i;
    if (!n || p.pointerId !== r) return;
    const l = u(p.clientX);
    n = !1, r = null;
    try {
      e.releasePointerCapture(p.pointerId);
    } catch {
    }
    e.classList.remove("is-dragging"), t.onCommit(l), (i = t.onScrubEnd) == null || i.call(t);
  }
  return e.addEventListener("pointerdown", o), e.addEventListener("pointermove", f), e.addEventListener("pointerup", a), e.addEventListener("pointercancel", a), {
    isDragging: () => n,
    destroy: () => {
      e.removeEventListener("pointerdown", o), e.removeEventListener("pointermove", f), e.removeEventListener("pointerup", a), e.removeEventListener("pointercancel", a);
    }
  };
}
function pe(e) {
  const { slot: t, provider: n, fullscreen: r, state: u } = e, o = t.querySelector(".vp-controls");
  if (!o) return { el: null, destroy: () => {
  } };
  const f = [], a = (v) => {
    f.push(v);
  }, p = T(o, "play");
  if (p) {
    const v = () => {
      n.state.paused ? n.play() : n.pause();
    };
    p.addEventListener("click", v), a(() => p.removeEventListener("click", v)), a(
      n.on("play", () => {
        p.setAttribute("aria-pressed", "true"), p.setAttribute("aria-label", "Pause"), u.setState("playing");
      })
    ), a(
      n.on("pause", () => {
        p.setAttribute("aria-pressed", "false"), p.setAttribute("aria-label", "Play"), u.setState("paused");
      })
    );
  }
  a(n.on("ended", () => u.setState("ended")));
  const l = T(o, "progress");
  if (l) {
    const v = l.querySelector(".vp-scrub-played"), w = l.querySelector(".vp-scrub-buffered"), g = l.querySelector(".vp-scrub-thumb"), S = z(l, {
      onScrub: (A) => {
        v && (v.style.width = `${A * 100}%`), g && (g.style.left = `${A * 100}%`);
      },
      onCommit: (A) => {
        const P = n.state.duration;
        P > 0 && n.seek(A * P);
      }
    });
    a(() => S.destroy());
    const x = () => {
      if (S.isDragging()) return;
      const A = n.state.duration;
      if (A > 0) {
        const P = n.state.currentTime / A;
        v && (v.style.width = `${P * 100}%`), g && (g.style.left = `${P * 100}%`);
      }
      w && (w.style.width = `${n.state.buffered * 100}%`);
    };
    a(n.on("timeupdate", x)), a(n.on("progress", x));
  }
  const i = o.querySelector(".vp-time-current"), c = o.querySelector(".vp-time-duration");
  if (i || c) {
    const v = () => {
      i && (i.textContent = F(n.state.currentTime)), c && (c.textContent = F(n.state.duration));
    };
    a(n.on("timeupdate", v)), a(n.on("durationchange", v));
  }
  const m = T(o, "mute");
  if (m) {
    const v = () => n.setMuted(!n.state.muted);
    m.addEventListener("click", v), a(() => m.removeEventListener("click", v));
  }
  const d = T(o, "volume"), s = d == null ? void 0 : d.querySelector(".vp-volume-fill"), y = d == null ? void 0 : d.querySelector(".vp-volume-thumb");
  if (d) {
    const v = z(d, {
      onScrub: (w) => {
        n.setVolume(w), w > 0 && n.state.muted && n.setMuted(!1);
      },
      onCommit: (w) => {
        n.setVolume(w), w > 0 && n.state.muted && n.setMuted(!1);
      }
    });
    a(() => v.destroy());
  }
  const b = () => {
    const v = u.setVolume(n.state.volume, n.state.muted);
    m && (m.setAttribute("aria-pressed", v === "mute" ? "true" : "false"), m.setAttribute("aria-label", v === "mute" ? "Unmute" : "Mute"), m.dataset.level = v);
    const w = v === "mute" ? 0 : n.state.volume;
    s && (s.style.width = `${w * 100}%`), y && (y.style.left = `${w * 100}%`);
  };
  a(n.on("volumechange", b)), b();
  const h = o.querySelector(".vp-settings"), L = h == null ? void 0 : h.querySelector('[data-vp="settings"]'), E = h == null ? void 0 : h.querySelector(".vp-settings-menu");
  h && L && E && a(
    q(
      { wrap: h, trigger: L, menu: E },
      n,
      u
    )
  );
  const k = T(o, "fullscreen");
  if (k) {
    const v = () => void r.toggle();
    k.addEventListener("click", v), a(() => k.removeEventListener("click", v));
  }
  return {
    el: o,
    destroy: () => {
      for (const v of f)
        try {
          v();
        } catch {
        }
    }
  };
}
function fe(e, t) {
  if (!e) return;
  const n = e.querySelector('[data-vp="fullscreen"]');
  n && (n.setAttribute("aria-pressed", t ? "true" : "false"), n.setAttribute("aria-label", t ? "Exit fullscreen" : "Enter fullscreen"));
}
const V = "vp-pseudo-fullscreen";
function me(e, t) {
  const n = document;
  let r = !1;
  function u() {
    return !!(document.fullscreenElement || n.webkitFullscreenElement || n.mozFullScreenElement || n.msFullscreenElement);
  }
  function o() {
    return u() || r;
  }
  async function f() {
    const i = e;
    try {
      if (i.requestFullscreen) return void await i.requestFullscreen();
      if (i.webkitRequestFullscreen) return void await i.webkitRequestFullscreen();
      if (i.mozRequestFullScreen) return void await i.mozRequestFullScreen();
      if (i.msRequestFullscreen) return void await i.msRequestFullscreen();
    } catch {
    }
    r = !0, e.classList.add(V), t.setFullscreen(!0);
  }
  async function a() {
    if (r) {
      r = !1, e.classList.remove(V), t.setFullscreen(!1);
      return;
    }
    try {
      if (document.exitFullscreen) return void await document.exitFullscreen();
      if (n.webkitExitFullscreen) return void await n.webkitExitFullscreen();
      if (n.mozCancelFullScreen) return void await n.mozCancelFullScreen();
      if (n.msExitFullscreen) return void await n.msExitFullscreen();
    } catch {
    }
  }
  function p() {
    t.setFullscreen(u());
  }
  document.addEventListener("fullscreenchange", p), document.addEventListener("webkitfullscreenchange", p), document.addEventListener("mozfullscreenchange", p), document.addEventListener("MSFullscreenChange", p);
  function l(i) {
    i.key === "Escape" && r && a();
  }
  return document.addEventListener("keydown", l), {
    isActive: o,
    toggle: () => o() ? a() : f(),
    enter: f,
    exit: a,
    destroy: () => {
      document.removeEventListener("fullscreenchange", p), document.removeEventListener("webkitfullscreenchange", p), document.removeEventListener("mozfullscreenchange", p), document.removeEventListener("MSFullscreenChange", p), document.removeEventListener("keydown", l), r && e.classList.remove(V);
    }
  };
}
const I = 10, $ = 0.1;
function ve(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return !!(t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable);
}
function be() {
  const e = document.activeElement;
  return e instanceof HTMLElement ? e.getAttribute("role") === "button" : !1;
}
function ye(e, t, n) {
  e.hasAttribute("tabindex") || e.setAttribute("tabindex", "0");
  const r = (o, f, a) => Math.max(f, Math.min(a, o));
  function u(o) {
    if (ve(o.target) || !e.contains(document.activeElement)) return;
    const f = t.state.duration;
    switch (o.key) {
      case " ":
      case "k":
      case "K":
        if (be()) return;
        o.preventDefault(), t.state.paused ? t.play() : t.pause();
        return;
      case "ArrowLeft":
        o.preventDefault(), t.seek(Math.max(0, t.state.currentTime - I));
        return;
      case "ArrowRight":
        o.preventDefault(), t.seek(Math.min(f || 0, t.state.currentTime + I));
        return;
      case "ArrowUp":
        o.preventDefault(), t.setVolume(r(t.state.volume + $, 0, 1)), t.state.muted && t.setMuted(!1);
        return;
      case "ArrowDown":
        o.preventDefault(), t.setVolume(r(t.state.volume - $, 0, 1));
        return;
      case "m":
      case "M":
        o.preventDefault(), t.setMuted(!t.state.muted);
        return;
      case "f":
      case "F":
        o.preventDefault(), n.fullscreen.toggle();
        return;
    }
    if (/^[0-9]$/.test(o.key) && f > 0) {
      o.preventDefault();
      const a = Number(o.key) / 10;
      t.seek(a * f);
    }
  }
  return e.addEventListener("keydown", u), () => e.removeEventListener("keydown", u);
}
function H(e, t) {
  e.style.backgroundImage = `url('${t.replace(/'/g, "\\'")}')`, e.style.backgroundSize = "cover", e.style.backgroundPosition = "center";
}
async function he(e, t, n) {
  const r = e.querySelector(".vp-poster"), u = e.getAttribute("data-poster"), o = await Y(t).catch(() => null);
  return o != null && o.accountType && n.setVimeoTier(o.accountType), r ? u === "none" ? { tier: o == null ? void 0 : o.accountType } : u && u !== "auto" ? (H(r, u), { tier: o == null ? void 0 : o.accountType }) : r.children.length > 0 ? { tier: o == null ? void 0 : o.accountType } : (o != null && o.url && H(r, o.url), { tier: o == null ? void 0 : o.accountType }) : { tier: o == null ? void 0 : o.accountType };
}
function M(e, t, n) {
  const r = e.getAttribute(t);
  return r === null ? n : r === "" || r === "true" || r === "1";
}
function ge(e, t) {
  return {
    autoplay: M(e, "data-autoplay", !1),
    muted: M(e, "data-muted", t.muted),
    loop: M(e, "data-loop", t.loop),
    playsinline: M(e, "data-playsinline", t.playsinline),
    showControls: M(e, "data-show-controls", t.showControls),
    showTitle: M(e, "data-show-title", !1),
    showRelated: M(e, "data-show-related", !1),
    accentColor: e.getAttribute("data-accent-color") || ""
  };
}
function we(e) {
  const n = (e.getAttribute("data-accent-color") || "").replace(/^#/, "").slice(0, 6);
  /^[0-9a-fA-F]{6}$/.test(n) && e.style.setProperty("--vp-accent", "#" + n);
  const u = (e.getAttribute("data-thumb-color") || "").replace(/^#/, "").slice(0, 6);
  /^[0-9a-fA-F]{6}$/.test(u) && e.style.setProperty("--vp-thumb-color", "#" + u);
}
function Ee(e, t, n, r, u) {
  if (!r || !t) return () => {
  };
  let o = null;
  function f() {
    n.setControlsIdle(!1);
  }
  function a() {
    n.state !== "playing" || n.menuOpen || n.setControlsIdle(!0);
  }
  function p() {
    f(), o && clearTimeout(o), o = setTimeout(a, u);
  }
  return e.addEventListener("pointermove", p), e.addEventListener("touchstart", p, { passive: !0 }), () => {
    o && clearTimeout(o), e.removeEventListener("pointermove", p), e.removeEventListener("touchstart", p);
  };
}
function Le(e, t, n) {
  if (e.provider === "vimeo" || e.provider === "youtube") {
    const u = document.createElement("iframe");
    return u.allowFullscreen = !0, u.setAttribute(
      "allow",
      "autoplay; encrypted-media; fullscreen; picture-in-picture"
    ), u.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;display:block;z-index:1;", u.src = X(e, {
      ...t,
      showControls: !n,
      origin: typeof window < "u" ? window.location.origin : void 0
    }), u;
  }
  const r = document.createElement("video");
  return r.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;background:#000;z-index:1;object-fit:cover;", r.playsInline = t.playsinline, t.muted && (r.muted = !0), t.loop && (r.loop = !0), r.controls = !n, r;
}
function ke(e, t, n, r, u) {
  if (r.playing) return { destroy: () => {
  } };
  r.setPlaying();
  const o = ge(e, n.defaults), f = e.getAttribute("data-ui-mode") === "webflow" ? "webflow" : "js", a = e.querySelector(".vp-poster");
  a && (a.style.display = "none");
  const p = e.querySelector(".vp-play");
  p && (p.style.display = "none");
  const l = Le(t, o, u);
  if (e.appendChild(l), !u)
    return l instanceof HTMLVideoElement && o.autoplay && (l.muted || (l.muted = !0), l.play().catch(() => {
    })), {
      destroy() {
        l.parentElement && l.parentElement.removeChild(l), a && (a.style.display = ""), p && (p.style.display = "");
      }
    };
  const i = te(t, l);
  i.ready().then(() => {
    o.muted && i.setMuted(!0), i.play();
  });
  const c = me(e, r);
  let m, d;
  if (f === "webflow") {
    const E = pe({ slot: e, provider: i, fullscreen: c, state: r });
    m = { el: E.el, destroy: E.destroy }, d = (k) => fe(m.el, k);
  } else {
    const E = ue({
      provider: i,
      fullscreen: c,
      state: r,
      showControls: o.showControls
    });
    e.appendChild(E.el), m = { el: E.el, destroy: E.destroy }, d = (k) => ce(E.el, k);
  }
  const s = new MutationObserver(() => {
    d(e.getAttribute("data-fullscreen") === "true");
  });
  s.observe(e, { attributes: !0, attributeFilter: ["data-fullscreen"] });
  let y = () => {
  };
  n.defaults.keyboardShortcuts && (y = ye(e, i, { fullscreen: c }));
  const b = Ee(
    e,
    m.el,
    r,
    n.defaults.autoHide && o.showControls,
    n.defaults.idleTimeoutMs
  ), h = i.on("buffering", () => r.setBuffering(!0)), L = i.on("playing", () => r.setBuffering(!1));
  return {
    destroy() {
      s.disconnect(), b(), y(), h(), L(), c.destroy(), m.destroy(), i.destroy(), l.parentElement && l.parentElement.removeChild(l), a && (a.style.display = ""), p && (p.style.display = "");
    }
  };
}
function xe(e, t) {
  const n = ne(e);
  if (n.inited) return null;
  const r = e.getAttribute("data-video-url") || e.getAttribute("data-vimeo-url") || e.getAttribute("data-youtube-url") || "", u = U(r);
  if (!u) return null;
  n.setInit(), n.setState("idle"), we(e);
  const o = he(e, u, n), f = M(e, "data-autoplay", !1), a = e.getAttribute("data-vimeo-mode") || "auto";
  async function p() {
    let m = u.provider !== "vimeo";
    if (u.provider === "vimeo")
      if (a === "custom") m = !0;
      else if (a === "native") m = !1;
      else {
        const { tier: d } = await o;
        m = !!d && d !== "basic";
      }
    return ke(e, u, t, n, m);
  }
  let l = !1;
  if (f) {
    let m = null;
    return p().then((d) => {
      m = d, l && (m == null || m.destroy());
    }), {
      destroy() {
        l = !0, m == null || m.destroy();
      }
    };
  }
  let i = null;
  e.style.cursor = "pointer";
  async function c() {
    i = await p(), l && (i == null || i.destroy());
  }
  return e.addEventListener("click", c, { once: !0 }), {
    destroy() {
      l = !0, e.removeEventListener("click", c), i == null || i.destroy();
    }
  };
}
const Se = {
  muted: !1,
  loop: !1,
  playsinline: !0,
  showControls: !0,
  keyboardShortcuts: !0,
  autoHide: !0,
  idleTimeoutMs: 2500
}, Ae = [
  "position: relative",
  "width: 100%",
  "aspect-ratio: 16 / 9",
  "overflow: hidden",
  "border-radius: 8px",
  "background: #000",
  "outline: none",
  "--vp-accent: #00b3ff",
  "--vp-thumb-color: #ffffff",
  "--vp-track-color: rgba(255, 255, 255, 0.18)",
  "--vp-buffer-color: rgba(255, 255, 255, 0.35)",
  "--vp-icon-color: #ffffff",
  "--vp-icon-hover-color: var(--vp-accent, #00b3ff)",
  "--vp-time-color: rgba(255, 255, 255, 0.85)",
  "--vp-tooltip-bg: rgba(15, 15, 18, 0.95)",
  "--vp-tooltip-color: #ffffff",
  "--vp-bar-bg: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0))",
  "--vp-bar-pad: 10px 12px",
  "--vp-bar-pad-top: 32px",
  "--vp-button-size: 36px",
  "--vp-button-radius: 6px",
  "--vp-thumb-size: 14px",
  "--vp-track-height: 4px",
  "--vp-menu-bg: rgba(15, 15, 18, 0.95)",
  "--vp-menu-color: #ffffff",
  "--vp-menu-radius: 6px"
].join("; ") + ";", Ce = [
  // ── Wrapper / poster / overlay play ──
  { selector: ".vp-slot", body: Ae },
  { selector: ".vp-slot:focus-visible", body: "outline: 2px solid var(--vp-accent); outline-offset: 2px;" },
  { selector: ".vp-poster", body: "position: absolute; inset: 0; pointer-events: none; transition: opacity 0.3s ease;" },
  {
    selector: ".vp-play",
    body: "position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; color: var(--vp-accent, #00b3ff); transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);"
  },
  { selector: ".vp-slot:hover .vp-play", body: "transform: scale(1.06);" },
  // ── Control bar ──
  {
    selector: ".vp-controls",
    body: "position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 6px; padding: var(--vp-bar-pad); padding-top: var(--vp-bar-pad-top); background: var(--vp-bar-bg); color: var(--vp-icon-color); font: 12px/1 system-ui, sans-serif; z-index: 5; flex-wrap: nowrap; transition: opacity 0.25s, transform 0.25s;"
  },
  { selector: '.vp-slot[data-controls-idle="true"] .vp-controls', body: "opacity: 0; pointer-events: none; transform: translateY(8px);" },
  { selector: ".vp-controls--hidden", body: "display: none;" },
  // ── Buttons (div[role=button]) ──
  {
    selector: ".vp-control",
    body: "position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center; width: var(--vp-button-size); height: var(--vp-button-size); padding: 7px; background: transparent; color: inherit; cursor: pointer; border-radius: var(--vp-button-radius); transition: background 0.15s, color 0.15s, transform 0.1s; user-select: none;"
  },
  { selector: ".vp-control:hover", body: "background: rgba(255, 255, 255, 0.14); color: var(--vp-icon-hover-color);" },
  { selector: ".vp-control:active", body: "transform: scale(0.94);" },
  { selector: ".vp-control:focus-visible", body: "outline: 2px solid var(--vp-accent); outline-offset: 2px;" },
  { selector: ".vp-control[hidden]", body: "display: none;" },
  { selector: ".vp-control svg", body: "width: 100%; height: 100%; fill: currentColor; pointer-events: none;" },
  // ── Tooltips ──
  {
    selector: ".vp-control[data-tooltip]::after",
    body: "content: attr(data-tooltip); position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%) translateY(2px); padding: 5px 8px; background: var(--vp-tooltip-bg); color: var(--vp-tooltip-color); font-size: 11px; font-weight: 500; line-height: 1; white-space: nowrap; border-radius: 4px; pointer-events: none; opacity: 0; transition: opacity 0.12s, transform 0.12s; z-index: 4;"
  },
  {
    selector: ".vp-control:hover[data-tooltip]::after, .vp-control:focus-visible[data-tooltip]::after",
    body: "opacity: 1; transform: translateX(-50%) translateY(0);"
  },
  // ── Play / pause icon swap (data-state on slot) ──
  { selector: '.vp-slot[data-state="playing"] .vp-icon-play', body: "display: none;" },
  { selector: '.vp-slot:not([data-state="playing"]) .vp-icon-pause', body: "display: none;" },
  // ── Volume icon swap (data-volume on slot) ──
  { selector: '.vp-slot[data-volume="full"] .vp-icon-vol-mid, .vp-slot[data-volume="full"] .vp-icon-vol-mute', body: "display: none;" },
  { selector: '.vp-slot[data-volume="mid"] .vp-icon-vol-full, .vp-slot[data-volume="mid"] .vp-icon-vol-mute', body: "display: none;" },
  { selector: '.vp-slot[data-volume="mute"] .vp-icon-vol-full, .vp-slot[data-volume="mute"] .vp-icon-vol-mid', body: "display: none;" },
  // ── Fullscreen icon swap ──
  { selector: '.vp-slot:not([data-fullscreen="true"]) .vp-icon-fs-exit', body: "display: none;" },
  { selector: '.vp-slot[data-fullscreen="true"] .vp-icon-fs-enter', body: "display: none;" },
  // ── Volume group + div-based slider ──
  { selector: ".vp-volume-group", body: "display: inline-flex; align-items: center; gap: 4px;" },
  {
    selector: ".vp-volume",
    body: "position: relative; width: 0; opacity: 0; height: var(--vp-track-height); background: var(--vp-track-color); border-radius: 2px; cursor: pointer; transition: width 0.18s, opacity 0.18s; touch-action: none;"
  },
  { selector: ".vp-volume-group:hover .vp-volume, .vp-volume-group:focus-within .vp-volume", body: "width: 70px; opacity: 1;" },
  { selector: ".vp-volume-fill", body: "position: absolute; left: 0; top: 0; height: 100%; width: 0%; background: var(--vp-accent); border-radius: 2px; pointer-events: none;" },
  {
    selector: ".vp-volume-thumb",
    body: "position: absolute; top: 50%; left: 0%; width: 10px; height: 10px; background: var(--vp-thumb-color); border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; box-shadow: 0 1px 3px rgba(0,0,0,0.4);"
  },
  // ── Progress scrubber (div based — see Scrubber.ts) ──
  { selector: ".vp-scrub", body: "position: relative; flex: 1; min-width: 60px; height: 18px; cursor: pointer; touch-action: none;" },
  {
    selector: ".vp-scrub::before",
    body: 'content: ""; position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: var(--vp-track-height); background: var(--vp-track-color); border-radius: 2px; pointer-events: none;'
  },
  {
    selector: ".vp-scrub-buffered",
    body: "position: absolute; left: 0; top: 50%; transform: translateY(-50%); height: var(--vp-track-height); width: 0%; background: var(--vp-buffer-color); border-radius: 2px; pointer-events: none; transition: width 0.1s linear;"
  },
  {
    selector: ".vp-scrub-played",
    body: "position: absolute; left: 0; top: 50%; transform: translateY(-50%); height: var(--vp-track-height); width: 0%; background: var(--vp-accent); border-radius: 2px; pointer-events: none;"
  },
  {
    selector: ".vp-scrub-thumb",
    body: "position: absolute; top: 50%; left: 0%; width: var(--vp-thumb-size); height: var(--vp-thumb-size); background: var(--vp-thumb-color); border: 2px solid var(--vp-accent); border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; box-shadow: 0 1px 4px rgba(0,0,0,0.4); transition: transform 0.15s;"
  },
  { selector: ".vp-scrub:hover .vp-scrub-thumb, .vp-scrub.is-dragging .vp-scrub-thumb", body: "transform: translate(-50%, -50%) scale(1.2);" },
  { selector: ".vp-scrub:focus-visible", body: "outline: 2px solid var(--vp-accent); outline-offset: 2px; border-radius: 2px;" },
  // ── Time readout ──
  { selector: ".vp-time", body: "flex: none; font-variant-numeric: tabular-nums; padding: 0 6px; color: var(--vp-time-color); user-select: none;" },
  { selector: ".vp-time-sep", body: "opacity: 0.5;" },
  // ── Settings menu ──
  { selector: ".vp-settings", body: "position: relative;" },
  {
    selector: ".vp-settings-menu",
    body: "position: absolute; bottom: calc(100% + 12px); right: 0; min-width: 180px; max-height: 280px; overflow-y: auto; background: var(--vp-menu-bg); color: var(--vp-menu-color); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--vp-menu-radius); padding: 6px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45); animation: vp-pop 0.15s ease both; z-index: 6;"
  },
  { selector: ".vp-settings-menu[hidden]", body: "display: none;" },
  { selector: ".vp-settings-section", body: "display: flex; flex-direction: column; gap: 2px;" },
  { selector: ".vp-settings-list", body: "display: flex; flex-direction: column; gap: 1px;" },
  { selector: ".vp-settings-heading", body: "padding: 4px 10px 6px; font-size: 11px; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;" },
  {
    selector: ".vp-settings-item",
    body: "display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; background: transparent; color: inherit; font: 12px/1.2 inherit; text-align: left; cursor: pointer; border-radius: 4px; user-select: none;"
  },
  { selector: ".vp-settings-item:hover, .vp-settings-item:focus-visible", body: "background: rgba(255, 255, 255, 0.1); outline: none;" },
  { selector: ".vp-settings-check", body: "opacity: 0; width: 14px; height: 14px; flex: none;" },
  { selector: ".vp-settings-check svg", body: "width: 100%; height: 100%; fill: var(--vp-accent);" },
  { selector: '.vp-settings-item[aria-checked="true"] .vp-settings-check', body: "opacity: 1;" },
  // ── Pseudo-fullscreen (iOS Safari fallback) ──
  {
    selector: ".vp-pseudo-fullscreen",
    body: "position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; max-width: none !important; aspect-ratio: auto !important; border-radius: 0 !important; z-index: 99999 !important;"
  },
  // ── Animations / responsive ──
  { selector: "@keyframes vp-pop", body: "from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); }" },
  {
    selector: "@media (pointer: coarse)",
    body: ".vp-control { width: 44px; height: 44px; padding: 11px; } .vp-scrub { height: 22px; } .vp-volume-group:not(:focus-within) .vp-volume { width: 0; }"
  }
];
function Me() {
  return Ce.map((e) => `${e.selector} { ${e.body} }`).join(`
`);
}
function Pe() {
  if (typeof document > "u" || document.getElementById("vp-runtime-css")) return;
  const e = document.createElement("style");
  e.id = "vp-runtime-css", e.textContent = Me(), document.head.appendChild(e);
}
const _ = "2026-05-18-v4-init", Te = typeof window < "u" && window.__FLOW_PLAYER_4_CONFIG__ || {}, Fe = { ...Se, ...Te };
function O(e) {
  xe(e, { defaults: Fe });
}
function B() {
  Pe(), document.documentElement.setAttribute(
    "data-flow-player-4-version",
    _
  );
  const e = document.querySelectorAll(
    ".vp-slot[data-video-url], .vp-slot[data-vimeo-url], .vp-slot[data-youtube-url]"
  );
  for (const t of e)
    O(t);
}
typeof window < "u" && (window.__FLOW_PLAYER_4__ = {
  version: _,
  attach: O
});
typeof document < "u" && (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", B) : B());
export {
  _ as FLOW_PLAYER_4_BUNDLE_VERSION
};
