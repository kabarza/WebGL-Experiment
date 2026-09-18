function U(n) {
  if (!n) return null;
  const e = n.trim();
  let t = e.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=|shorts\/|v\/))([\w-]{11})/i
  );
  return t ? { provider: "youtube", id: t[1] } : /^[\w-]{11}$/.test(e) ? { provider: "youtube", id: e } : (t = e.match(/player\.vimeo\.com\/video\/(\d+)/i), t ? { provider: "vimeo", id: t[1] } : (t = e.match(/vimeo\.com\/(?:[^/]+\/)*(\d+)/i), t ? { provider: "vimeo", id: t[1] } : /^\d{6,}$/.test(e) ? { provider: "vimeo", id: e } : null));
}
async function G(n, e = 1280) {
  if (n.provider === "youtube")
    return {
      url: `https://i.ytimg.com/vi/${n.id}/hqdefault.jpg`,
      width: 480,
      height: 360
    };
  try {
    const t = "https://vimeo.com/api/oembed.json?url=" + encodeURIComponent("https://vimeo.com/" + n.id) + `&width=${e}`, a = await fetch(t);
    if (!a.ok) return null;
    const o = await a.json();
    if (!o.thumbnail_url) return null;
    const c = Y(o.account_type) ? o.account_type : void 0;
    return {
      url: o.thumbnail_url,
      width: o.thumbnail_width,
      height: o.thumbnail_height,
      accountType: c,
      isPlus: o.is_plus === 1
    };
  } catch {
    return null;
  }
}
function Y(n) {
  return n === "basic" || n === "plus" || n === "pro" || n === "business" || n === "premium";
}
function J(n, e) {
  if (n.provider === "vimeo") {
    const a = new URLSearchParams();
    if (a.set("autoplay", "1"), e.muted && a.set("muted", "1"), e.loop && a.set("loop", "1"), a.set("controls", e.showControls === !1 ? "0" : "1"), e.showControls === !1 ? (a.set("title", "0"), a.set("byline", "0"), a.set("portrait", "0"), a.set("share", "0"), a.set("speed", "0"), a.set("keyboard", "0"), a.set("pip", "0"), a.set("transparent", "0")) : (a.set("title", e.showTitle ? "1" : "0"), a.set("byline", "0"), a.set("portrait", "0")), a.set("playsinline", e.playsinline === !1 ? "0" : "1"), e.accentColor) {
      const o = e.accentColor.replace(/^#/, "").slice(0, 6);
      /^[0-9a-fA-F]{6}$/.test(o) && a.set("color", o);
    }
    return a.set("dnt", "1"), `https://player.vimeo.com/video/${n.id}?${a.toString()}`;
  }
  const t = new URLSearchParams();
  return t.set("enablejsapi", "1"), e.origin && t.set("origin", e.origin), t.set("autoplay", "1"), e.muted && t.set("mute", "1"), e.loop && (t.set("loop", "1"), t.set("playlist", n.id)), t.set("controls", e.showControls === !1 ? "0" : "1"), t.set("playsinline", e.playsinline === !1 ? "0" : "1"), t.set("rel", e.showRelated ? "1" : "0"), t.set("modestbranding", "1"), `https://www.youtube-nocookie.com/embed/${n.id}?${t.toString()}`;
}
const W = [
  "play",
  "pause",
  "ended",
  "timeupdate",
  "progress",
  "volumechange",
  "playbackratechange",
  "loaded",
  "durationchange",
  "bufferstart",
  "bufferend",
  "texttrackchange",
  "error"
];
function j(n) {
  const e = /* @__PURE__ */ new Map(), t = {
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    muted: !1,
    paused: !0,
    playbackRate: 1
  };
  let a = null;
  const o = new Promise((f) => {
    a = f;
  });
  let c = !1, s = [], d = null;
  function u(f) {
    return `${f.language}-${f.kind}`;
  }
  function l(f, i) {
    if (!n.contentWindow) return;
    const r = { method: f };
    i !== void 0 && (r.value = i), n.contentWindow.postMessage(JSON.stringify(r), "*");
  }
  function p(f, i) {
    const r = e.get(f);
    if (r)
      for (const v of r)
        try {
          v(i);
        } catch {
        }
  }
  function y(f) {
    if (f.source !== n.contentWindow) return;
    let i;
    try {
      i = typeof f.data == "string" ? JSON.parse(f.data) : f.data;
    } catch {
      return;
    }
    if (i) {
      if (i.event === "ready" || i.method === "ping" && !c) {
        c = !0;
        for (const r of W) l("addEventListener", r);
        l("getDuration"), l("getVolume"), l("getMuted"), l("getPlaybackRate"), l("getTextTracks"), a == null || a(), p("ready");
        return;
      }
      switch (i.event) {
        case "play":
          t.paused = !1, p("play");
          break;
        case "pause":
          t.paused = !0, p("pause");
          break;
        case "ended":
          t.paused = !0, p("ended");
          break;
        case "timeupdate": {
          const r = i.data;
          (r == null ? void 0 : r.seconds) != null && (t.currentTime = r.seconds), (r == null ? void 0 : r.duration) != null && (t.duration = r.duration), p("timeupdate");
          break;
        }
        case "progress": {
          const r = i.data;
          (r == null ? void 0 : r.percent) != null && (t.buffered = r.percent), p("progress");
          break;
        }
        case "durationchange": {
          const r = i.data;
          (r == null ? void 0 : r.duration) != null && (t.duration = r.duration), p("durationchange");
          break;
        }
        case "volumechange": {
          const r = i.data;
          (r == null ? void 0 : r.volume) != null && (t.volume = r.volume), p("volumechange");
          break;
        }
        case "playbackratechange": {
          const r = i.data;
          (r == null ? void 0 : r.playbackRate) != null && (t.playbackRate = r.playbackRate), p("ratechange");
          break;
        }
        case "bufferstart":
          p("buffering");
          break;
        case "bufferend":
          p("playing");
          break;
        case "texttrackchange": {
          const r = i.data;
          d = r ? u(r) : null, p("volumechange");
          break;
        }
        case "error":
          p("error", i.data);
          break;
      }
      if (i.method === "getDuration" && typeof i.value == "number")
        t.duration = i.value, p("durationchange");
      else if (i.method === "getVolume" && typeof i.value == "number")
        t.volume = i.value, p("volumechange");
      else if (i.method === "getMuted" && typeof i.value == "boolean")
        t.muted = i.value, p("volumechange");
      else if (i.method === "getPlaybackRate" && typeof i.value == "number")
        t.playbackRate = i.value, p("ratechange");
      else if (i.method === "getTextTracks" && Array.isArray(i.value)) {
        s = i.value.filter(
          (v) => v.kind === "captions" || v.kind === "subtitles"
        );
        const r = s.find((v) => v.mode === "showing");
        d = r ? u(r) : null, p("tracks");
      }
    }
  }
  return window.addEventListener("message", y), {
    iframe: n,
    state: t,
    ready: () => o,
    play: () => l("play"),
    pause: () => l("pause"),
    seek: (f) => {
      t.currentTime = f, l("setCurrentTime", f);
    },
    setVolume: (f) => {
      t.volume = f, l("setVolume", f);
    },
    setMuted: (f) => {
      t.muted = f, l("setMuted", f);
    },
    setPlaybackRate: (f) => {
      t.playbackRate = f, l("setPlaybackRate", f);
    },
    requestPictureInPicture: async () => (l("requestPictureInPicture"), !0),
    getTextTracks: () => s.map(
      (f) => ({
        id: u(f),
        label: f.label || f.language,
        language: f.language,
        kind: f.kind === "captions" ? "captions" : "subtitles"
      })
    ),
    getActiveTextTrack: () => d,
    setTextTrack: (f) => {
      if (!f) {
        l("disableTextTrack"), d = null;
        return;
      }
      const i = s.find((r) => u(r) === f);
      i && (l("enableTextTrack", { language: i.language, kind: i.kind }), d = f);
    },
    on: (f, i) => {
      let r = e.get(f);
      return r || (r = /* @__PURE__ */ new Set(), e.set(f, r)), r.add(i), () => {
        r == null || r.delete(i);
      };
    },
    destroy: () => {
      window.removeEventListener("message", y), e.clear();
    }
  };
}
const N = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3
};
function K(n) {
  const e = /* @__PURE__ */ new Map(), t = {
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    muted: !1,
    paused: !0,
    playbackRate: 1
  };
  let a = null;
  const o = new Promise((r) => {
    a = r;
  });
  let c = null, s = [], d = null;
  function u(r, ...v) {
    if (!n.contentWindow) return;
    const m = { event: "command", func: r, args: v };
    n.contentWindow.postMessage(JSON.stringify(m), "*");
  }
  function l(r, v) {
    const m = e.get(r);
    if (m)
      for (const h of m)
        try {
          h(v);
        } catch {
        }
  }
  function p() {
    c || (c = setInterval(() => {
      u("getCurrentTime"), u("getVideoLoadedFraction");
    }, 250));
  }
  function y() {
    c && (clearInterval(c), c = null);
  }
  function f(r) {
    if (r.source !== n.contentWindow) return;
    let v;
    try {
      v = typeof r.data == "string" ? JSON.parse(r.data) : r.data;
    } catch {
      return;
    }
    if (v) {
      if (v.event === "onReady") {
        u("getDuration"), u("getVolume"), u("isMuted"), u("getPlaybackRate"), u("getOptions", "captions"), a == null || a(), l("ready");
        return;
      }
      if (v.event === "onApiChange") {
        u("getOption", "captions", "tracklist"), u("getOption", "captions", "track");
        return;
      }
      if (v.event === "onStateChange") {
        const m = v.info;
        m === N.PLAYING ? (t.paused = !1, p(), l("playing"), l("play")) : m === N.PAUSED ? (t.paused = !0, y(), l("pause")) : m === N.ENDED ? (t.paused = !0, y(), l("ended")) : m === N.BUFFERING && l("buffering");
        return;
      }
      if (v.event === "infoDelivery" && v.info) {
        const m = v.info;
        let h = !1;
        typeof m.currentTime == "number" && (t.currentTime = m.currentTime, h = !0), typeof m.duration == "number" && (t.duration = m.duration, l("durationchange")), typeof m.videoLoadedFraction == "number" && (t.buffered = m.videoLoadedFraction, l("progress")), typeof m.volume == "number" && (t.volume = m.volume / 100, l("volumechange")), typeof m.muted == "boolean" && (t.muted = m.muted, l("volumechange")), typeof m.playbackRate == "number" && (t.playbackRate = m.playbackRate, l("ratechange")), h && l("timeupdate");
        return;
      }
      if (v.event === "onError") {
        l("error", v.info);
        return;
      }
      if (v.event === "infoDelivery" && v.info) {
        const m = v.info;
        Array.isArray(m.tracklist) && (s = m.tracklist.filter((k) => !!k.languageCode).map(
          (k) => ({
            id: k.languageCode,
            label: k.displayName || k.languageName || k.languageCode,
            language: k.languageCode,
            kind: "captions"
          })
        ), l("tracks")), m.track && typeof m.track == "object" && (d = m.track.languageCode || null);
      }
    }
  }
  window.addEventListener("message", f);
  function i() {
    n.contentWindow && n.contentWindow.postMessage(
      JSON.stringify({ event: "listening", id: "flow-player" }),
      "*"
    );
  }
  return n.addEventListener("load", i, { once: !0 }), setTimeout(i, 500), {
    iframe: n,
    state: t,
    ready: () => o,
    play: () => u("playVideo"),
    pause: () => u("pauseVideo"),
    seek: (r) => {
      t.currentTime = r, u("seekTo", r, !0);
    },
    setVolume: (r) => {
      t.volume = r, u("setVolume", Math.round(r * 100));
    },
    setMuted: (r) => {
      t.muted = r, u(r ? "mute" : "unMute");
    },
    setPlaybackRate: (r) => {
      t.playbackRate = r, u("setPlaybackRate", r);
    },
    requestPictureInPicture: async () => !1,
    getTextTracks: () => s.slice(),
    getActiveTextTrack: () => d,
    setTextTrack: (r) => {
      if (!r) {
        u("unloadModule", "captions"), u("loadModule", "captions"), d = null;
        return;
      }
      u("setOption", "captions", "track", { languageCode: r }), d = r;
    },
    on: (r, v) => {
      let m = e.get(r);
      return m || (m = /* @__PURE__ */ new Set(), e.set(r, m)), m.add(v), () => {
        m == null || m.delete(v);
      };
    },
    destroy: () => {
      y(), window.removeEventListener("message", f), e.clear();
    }
  };
}
function X(n, e) {
  return n === "vimeo" ? j(e) : K(e);
}
function Q(n) {
  function e(t, a) {
    a === null ? n.removeAttribute(t) : n.setAttribute(t, a);
  }
  return {
    /** Playback state — driving icon swaps, hover behavior, etc. */
    setState(t) {
      e("data-state", t);
    },
    /**
     * Derived from `muted` + `volume`. Drives the 3-way mute icon
     * (full / mid / mute).
     */
    setVolume(t, a) {
      const o = a || t === 0 ? "mute" : t < 0.5 ? "mid" : "full";
      return e("data-volume", o), o;
    },
    setFullscreen(t) {
      e("data-fullscreen", t ? "true" : null);
    },
    setMenuOpen(t) {
      e("data-menu-open", t ? "true" : null);
    },
    setControlsIdle(t) {
      e("data-controls-idle", t ? "true" : null);
    },
    /** Set by PosterLoader once oEmbed resolves. */
    setVimeoTier(t) {
      e("data-vimeo-tier", t);
    },
    /** Mark the slot as having been booted (so we don't re-init). */
    setInit() {
      e("data-vp-init", "1");
    },
    /** Mark the slot as having started playing (iframe injected). */
    setPlaying() {
      e("data-vp-playing", "1");
    },
    /** Read the current state. Useful for idle-hide / menu logic. */
    get state() {
      return n.getAttribute("data-state") ?? null;
    },
    get menuOpen() {
      return n.getAttribute("data-menu-open") === "true";
    },
    get inited() {
      return n.getAttribute("data-vp-init") === "1";
    },
    get playing() {
      return n.getAttribute("data-vp-playing") === "1";
    }
  };
}
const A = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
  volumeFull: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"/></svg>',
  volumeMid: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12z"/></svg>',
  volumeMute: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.96 8.96 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.26c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>',
  fullscreenEnter: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
  fullscreenExit: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',
  pip: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94 0 .31.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
  restart: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>',
  captionsOn: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg>'
};
function Z() {
  const n = document.createElement("div");
  n.className = "vp-progress", n.setAttribute("data-vp", "progress");
  const e = document.createElement("div");
  e.className = "vp-progress-track", n.appendChild(e);
  const t = document.createElement("div");
  t.className = "vp-progress-buffer", e.appendChild(t);
  const a = document.createElement("div");
  a.className = "vp-progress-fill", e.appendChild(a);
  const o = document.createElement("div");
  o.className = "vp-progress-thumb", n.appendChild(o);
  const c = document.createElement("input");
  return c.className = "vp-progress-range", c.type = "range", c.min = "0", c.max = "1", c.step = "0.0001", c.value = "0", c.setAttribute("role", "slider"), c.setAttribute("aria-label", "Seek"), c.setAttribute("aria-valuemin", "0"), c.setAttribute("aria-valuemax", "100"), c.setAttribute("aria-valuenow", "0"), c.setAttribute("aria-valuetext", "0:00 of 0:00"), n.appendChild(c), { wrap: n, range: c };
}
function B(n, e) {
  const { wrap: t, range: a } = n;
  let o = !1, c = !1;
  function s(m) {
    t.style.setProperty("--vp-progress-frac", String(m));
  }
  function d(m) {
    t.style.setProperty("--vp-buffer-frac", String(m));
  }
  function u() {
    if (o) return;
    const m = e.state.duration, h = e.state.currentTime, k = m > 0 ? h / m : 0;
    a.value = String(k), a.setAttribute("aria-valuenow", String(Math.round(k * 100))), a.setAttribute("aria-valuetext", `${M(h)} of ${M(m)}`), s(k);
  }
  function l() {
    d(e.state.buffered);
  }
  const p = e.on("timeupdate", u), y = e.on("durationchange", u), f = e.on("progress", l), i = () => {
    o = !0, e.state.paused || (c = !0, e.pause());
  }, r = () => {
    o && (o = !1, c && (c = !1, e.play()));
  }, v = () => {
    const m = Math.max(0, Math.min(1, Number(a.value)));
    if (s(m), a.setAttribute("aria-valuenow", String(Math.round(m * 100))), e.state.duration > 0) {
      const h = m * e.state.duration;
      e.seek(h), a.setAttribute("aria-valuetext", `${M(h)} of ${M(e.state.duration)}`);
    }
  };
  return a.addEventListener("pointerdown", i), a.addEventListener("pointerup", r), a.addEventListener("pointercancel", r), a.addEventListener("input", v), u(), l(), () => {
    p(), y(), f(), a.removeEventListener("pointerdown", i), a.removeEventListener("pointerup", r), a.removeEventListener("pointercancel", r), a.removeEventListener("input", v);
  };
}
function M(n) {
  (!isFinite(n) || n < 0) && (n = 0);
  const e = Math.floor(n), t = Math.floor(e / 3600), a = Math.floor(e % 3600 / 60), o = e % 60, c = t > 0 ? String(a).padStart(2, "0") : String(a), s = String(o).padStart(2, "0");
  return t > 0 ? `${t}:${c}:${s}` : `${c}:${s}`;
}
const ee = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
function te() {
  const n = document.createElement("div");
  n.className = "vp-settings";
  const e = document.createElement("button");
  e.type = "button", e.className = "vp-control vp-btn-settings", e.setAttribute("aria-label", "Settings"), e.setAttribute("aria-haspopup", "menu"), e.setAttribute("aria-expanded", "false"), e.setAttribute("data-tooltip", "Settings"), e.setAttribute("data-vp", "settings"), e.innerHTML = A.settings, n.appendChild(e);
  const t = document.createElement("div");
  return t.className = "vp-settings-menu", t.setAttribute("role", "menu"), t.setAttribute("aria-label", "Settings"), t.hidden = !0, n.appendChild(t), { wrap: n, trigger: e, menu: t };
}
function z(n) {
  const e = document.createElement("div");
  e.className = "vp-settings-section";
  const t = document.createElement("div");
  return t.className = "vp-settings-heading", t.textContent = n, e.appendChild(t), e;
}
function F(n, e) {
  const t = document.createElement("button");
  t.type = "button", t.className = "vp-settings-item", t.setAttribute("role", "menuitemradio"), t.setAttribute("aria-checked", e ? "true" : "false");
  const a = document.createElement("span");
  a.textContent = n, t.appendChild(a);
  const o = document.createElement("span");
  return o.className = "vp-settings-check", o.innerHTML = A.check, t.appendChild(o), t;
}
function O(n, e, t) {
  const { trigger: a, menu: o } = n, c = z("Speed"), s = document.createElement("div");
  s.className = "vp-settings-list", c.appendChild(s);
  const d = [];
  for (const E of ee) {
    const C = F(E === 1 ? "Normal" : `${E}×`, E === 1);
    C.dataset.speed = String(E), C.addEventListener("click", () => {
      e.setPlaybackRate(E), u(E), v(), a.focus();
    }), s.appendChild(C), d.push(C);
  }
  o.appendChild(c);
  function u(E) {
    for (const C of d) {
      const T = Number(C.dataset.speed), b = Math.abs(T - E) < 0.01;
      C.setAttribute("aria-checked", b ? "true" : "false");
    }
  }
  let l = null, p = [];
  function y() {
    const E = e.getTextTracks();
    if (!E.length) {
      l && (l.remove(), l = null, p = []);
      return;
    }
    if (!l) {
      l = z("Captions");
      const C = document.createElement("div");
      C.className = "vp-settings-list", l.appendChild(C);
      const T = F("Off", e.getActiveTextTrack() === null);
      T.dataset.trackId = "", T.addEventListener("click", () => {
        e.setTextTrack(null), f(null), v(), a.focus();
      }), C.appendChild(T), p.push(T);
      for (const b of E) {
        const g = F(b.label, e.getActiveTextTrack() === b.id);
        g.dataset.trackId = b.id, g.addEventListener("click", () => {
          e.setTextTrack(b.id), f(b.id), v(), a.focus();
        }), C.appendChild(g), p.push(g);
      }
      o.appendChild(l);
    }
  }
  function f(E) {
    for (const C of p) {
      const T = C.dataset.trackId || null;
      C.setAttribute("aria-checked", T === E ? "true" : "false");
    }
  }
  let i = !1;
  function r() {
    var E;
    i || (i = !0, o.hidden = !1, a.setAttribute("aria-expanded", "true"), t.setMenuOpen(!0), document.addEventListener("click", m, !0), document.addEventListener("keydown", h), (E = o.querySelector('[aria-checked="true"]')) == null || E.focus());
  }
  function v() {
    i && (i = !1, o.hidden = !0, a.setAttribute("aria-expanded", "false"), t.setMenuOpen(!1), document.removeEventListener("click", m, !0), document.removeEventListener("keydown", h));
  }
  function m(E) {
    n.wrap.contains(E.target) || v();
  }
  function h(E) {
    E.key === "Escape" && (E.preventDefault(), v(), a.focus());
  }
  a.addEventListener("click", () => i ? v() : r());
  const k = e.on("ratechange", () => {
    u(e.state.playbackRate);
  }), w = e.on("tracks", () => {
    y();
  });
  return () => {
    k(), w(), v();
  };
}
function P(n) {
  const e = document.createElement("button");
  return e.type = "button", e.className = n.className, e.setAttribute("aria-label", n.ariaLabel), e.setAttribute("data-tooltip", n.tooltip), e.setAttribute("data-vp", n.dataVp), e.innerHTML = n.innerHTML, e.addEventListener("click", n.onClick), e;
}
function ne(n) {
  const { provider: e, providerName: t, fullscreen: a, state: o, showControls: c } = n, s = document.createElement("div");
  s.className = "vp-controls", s.setAttribute("role", "group"), s.setAttribute("aria-label", "Video controls"), c || s.classList.add("vp-controls--hidden");
  const d = [], u = P({
    className: "vp-control vp-btn-play",
    ariaLabel: "Play",
    tooltip: "Play (Space)",
    innerHTML: `<span class="vp-icon-play">${A.play}</span><span class="vp-icon-pause">${A.pause}</span>`,
    dataVp: "play",
    onClick: () => {
      e.state.paused ? e.play() : e.pause();
    }
  });
  u.setAttribute("aria-pressed", "false"), d.push(
    e.on("play", () => {
      u.setAttribute("aria-pressed", "true"), u.setAttribute("aria-label", "Pause"), u.setAttribute("data-tooltip", "Pause (Space)"), o.setState("playing");
    })
  ), d.push(
    e.on("pause", () => {
      u.setAttribute("aria-pressed", "false"), u.setAttribute("aria-label", "Play"), u.setAttribute("data-tooltip", "Play (Space)"), o.setState("paused");
    })
  ), d.push(
    e.on("ended", () => {
      o.setState("ended");
    })
  ), s.appendChild(u), s.appendChild(
    P({
      className: "vp-control vp-btn-restart",
      ariaLabel: "Restart",
      tooltip: "Restart",
      innerHTML: A.restart,
      dataVp: "restart",
      onClick: () => e.seek(0)
    })
  );
  const l = Z();
  s.appendChild(l.wrap), d.push(B(l, e));
  const p = document.createElement("div");
  p.className = "vp-time";
  const y = document.createElement("span");
  y.className = "vp-time-current", y.textContent = "0:00";
  const f = document.createElement("span");
  f.className = "vp-time-sep", f.textContent = " / ";
  const i = document.createElement("span");
  i.className = "vp-time-duration", i.textContent = "0:00", p.appendChild(y), p.appendChild(f), p.appendChild(i), s.appendChild(p);
  function r() {
    y.textContent = M(e.state.currentTime), i.textContent = M(e.state.duration);
  }
  d.push(e.on("timeupdate", r)), d.push(e.on("durationchange", r));
  const v = P({
    className: "vp-control vp-btn-captions",
    ariaLabel: "Toggle captions",
    tooltip: "Captions",
    innerHTML: A.captionsOn,
    dataVp: "captions",
    onClick: () => {
      const b = e.getTextTracks();
      e.getActiveTextTrack() ? (e.setTextTrack(null), v.setAttribute("aria-pressed", "false")) : b.length && (e.setTextTrack(b[0].id), v.setAttribute("aria-pressed", "true"));
    }
  });
  v.setAttribute("aria-pressed", "false"), v.hidden = !0, s.appendChild(v);
  function m() {
    const b = e.getTextTracks();
    v.hidden = b.length === 0;
    const g = e.getActiveTextTrack();
    v.setAttribute("aria-pressed", g ? "true" : "false");
  }
  d.push(e.on("tracks", m));
  const h = document.createElement("div");
  h.className = "vp-volume-group";
  const k = P({
    className: "vp-control vp-btn-mute",
    ariaLabel: "Mute",
    tooltip: "Mute (M)",
    innerHTML: `<span class="vp-icon-vol-full">${A.volumeFull}</span><span class="vp-icon-vol-mid">${A.volumeMid}</span><span class="vp-icon-vol-mute">${A.volumeMute}</span>`,
    dataVp: "mute",
    onClick: () => e.setMuted(!e.state.muted)
  });
  k.setAttribute("aria-pressed", "false"), h.appendChild(k);
  const w = document.createElement("input");
  w.type = "range", w.className = "vp-volume", w.setAttribute("data-vp", "volume"), w.min = "0", w.max = "1", w.step = "0.01", w.value = "1", w.setAttribute("aria-label", "Volume"), w.addEventListener("input", () => {
    const b = Number(w.value);
    e.setVolume(b), b > 0 && e.state.muted && e.setMuted(!1);
  }), h.appendChild(w), s.appendChild(h);
  function E() {
    const b = o.setVolume(e.state.volume, e.state.muted);
    k.setAttribute("aria-pressed", b === "mute" ? "true" : "false"), k.setAttribute("aria-label", b === "mute" ? "Unmute" : "Mute"), k.setAttribute("data-tooltip", b === "mute" ? "Unmute (M)" : "Mute (M)"), k.dataset.level = b, w.matches(":active") || (w.value = String(b === "mute" ? 0 : e.state.volume)), h.style.setProperty("--vp-volume", `${(b === "mute" ? 0 : e.state.volume) * 100}%`);
  }
  d.push(e.on("volumechange", E)), E();
  const C = te();
  s.appendChild(C.wrap), d.push(O(C, e, o)), t === "vimeo" && s.appendChild(
    P({
      className: "vp-control vp-btn-pip",
      ariaLabel: "Picture in picture",
      tooltip: "Picture in picture",
      innerHTML: A.pip,
      dataVp: "pip",
      onClick: () => {
        e.requestPictureInPicture().catch(() => {
        });
      }
    })
  );
  const T = P({
    className: "vp-control vp-btn-fullscreen",
    ariaLabel: "Enter fullscreen",
    tooltip: "Fullscreen (F)",
    innerHTML: `<span class="vp-icon-fs-enter">${A.fullscreenEnter}</span><span class="vp-icon-fs-exit">${A.fullscreenExit}</span>`,
    dataVp: "fullscreen",
    onClick: () => a.toggle()
  });
  return T.setAttribute("aria-pressed", "false"), s.appendChild(T), {
    el: s,
    destroy: () => {
      for (const b of d)
        try {
          b();
        } catch {
        }
    }
  };
}
function ae(n, e) {
  const t = n.querySelector(".vp-btn-fullscreen");
  t && (t.setAttribute("aria-pressed", e ? "true" : "false"), t.setAttribute("aria-label", e ? "Exit fullscreen" : "Enter fullscreen"), t.setAttribute("data-tooltip", e ? "Exit fullscreen (F)" : "Fullscreen (F)"));
}
function L(n, e) {
  return n.querySelector(`[data-vp="${e}"]`);
}
function re(n) {
  const { slot: e, provider: t, providerName: a, fullscreen: o, state: c } = n, s = e.querySelector(".vp-controls");
  if (!s)
    return { el: null, destroy: () => {
    } };
  const d = [], u = L(s, "play");
  if (u) {
    const g = () => {
      t.state.paused ? t.play() : t.pause();
    };
    u.addEventListener("click", g), d.push(() => u.removeEventListener("click", g)), d.push(
      t.on("play", () => {
        u.setAttribute("aria-pressed", "true"), u.setAttribute("aria-label", "Pause"), c.setState("playing");
      })
    ), d.push(
      t.on("pause", () => {
        u.setAttribute("aria-pressed", "false"), u.setAttribute("aria-label", "Play"), c.setState("paused");
      })
    );
  }
  d.push(t.on("ended", () => c.setState("ended")));
  const l = L(s, "restart");
  if (l) {
    const g = () => t.seek(0);
    l.addEventListener("click", g), d.push(() => l.removeEventListener("click", g));
  }
  const p = L(s, "progress"), y = p == null ? void 0 : p.querySelector(".vp-progress-range");
  p && y && d.push(B({ wrap: p, range: y }, t));
  const f = s.querySelector(".vp-time-current"), i = s.querySelector(".vp-time-duration");
  if (f || i) {
    const g = () => {
      f && (f.textContent = M(t.state.currentTime)), i && (i.textContent = M(t.state.duration));
    };
    d.push(t.on("timeupdate", g)), d.push(t.on("durationchange", g));
  }
  const r = L(s, "captions");
  if (r) {
    r.hidden = !0;
    const g = () => {
      const x = t.getTextTracks();
      t.getActiveTextTrack() ? (t.setTextTrack(null), r.setAttribute("aria-pressed", "false")) : x.length && (t.setTextTrack(x[0].id), r.setAttribute("aria-pressed", "true"));
    };
    r.addEventListener("click", g), d.push(() => r.removeEventListener("click", g)), d.push(
      t.on("tracks", () => {
        const x = t.getTextTracks();
        r.hidden = x.length === 0;
        const I = t.getActiveTextTrack();
        r.setAttribute("aria-pressed", I ? "true" : "false");
      })
    );
  }
  const v = s.querySelector(".vp-volume-group"), m = L(s, "mute"), h = L(s, "volume");
  if (m) {
    const g = () => t.setMuted(!t.state.muted);
    m.addEventListener("click", g), d.push(() => m.removeEventListener("click", g));
  }
  if (h) {
    const g = () => {
      const x = Number(h.value);
      t.setVolume(x), x > 0 && t.state.muted && t.setMuted(!1);
    };
    h.addEventListener("input", g), d.push(() => h.removeEventListener("input", g));
  }
  const k = () => {
    const g = c.setVolume(t.state.volume, t.state.muted);
    m && (m.setAttribute("aria-pressed", g === "mute" ? "true" : "false"), m.setAttribute("aria-label", g === "mute" ? "Unmute" : "Mute"), m.dataset.level = g), h && !h.matches(":active") && (h.value = String(g === "mute" ? 0 : t.state.volume)), v && v.style.setProperty("--vp-volume", `${(g === "mute" ? 0 : t.state.volume) * 100}%`);
  };
  d.push(t.on("volumechange", k)), k();
  const w = s.querySelector(".vp-settings"), E = w == null ? void 0 : w.querySelector(
    '[data-vp="settings"]'
  ), C = w == null ? void 0 : w.querySelector(".vp-settings-menu");
  w && E && C && d.push(
    O(
      { wrap: w, trigger: E, menu: C },
      t,
      c
    )
  );
  const T = L(s, "pip");
  if (T)
    if (a !== "vimeo")
      T.hidden = !0;
    else {
      const g = () => {
        t.requestPictureInPicture().catch(() => {
        });
      };
      T.addEventListener("click", g), d.push(() => T.removeEventListener("click", g));
    }
  const b = L(s, "fullscreen");
  if (b) {
    const g = () => o.toggle();
    b.addEventListener("click", g), d.push(() => b.removeEventListener("click", g));
  }
  return {
    el: s,
    destroy: () => {
      for (const g of d)
        try {
          g();
        } catch {
        }
    }
  };
}
function se(n, e) {
  if (!n) return;
  const t = n.querySelector('[data-vp="fullscreen"]');
  t && (t.setAttribute("aria-pressed", e ? "true" : "false"), t.setAttribute("aria-label", e ? "Exit fullscreen" : "Enter fullscreen"));
}
const V = "vp-pseudo-fullscreen";
function ie(n, e) {
  const t = document;
  let a = !1;
  function o() {
    return !!(document.fullscreenElement || t.webkitFullscreenElement || t.mozFullScreenElement || t.msFullscreenElement);
  }
  function c() {
    return o() || a;
  }
  async function s() {
    const p = n;
    try {
      if (p.requestFullscreen) {
        await p.requestFullscreen();
        return;
      }
      if (p.webkitRequestFullscreen) {
        await p.webkitRequestFullscreen();
        return;
      }
      if (p.mozRequestFullScreen) {
        await p.mozRequestFullScreen();
        return;
      }
      if (p.msRequestFullscreen) {
        await p.msRequestFullscreen();
        return;
      }
    } catch {
    }
    a = !0, n.classList.add(V), e.setFullscreen(!0);
  }
  async function d() {
    if (a) {
      a = !1, n.classList.remove(V), e.setFullscreen(!1);
      return;
    }
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        return;
      }
      if (t.webkitExitFullscreen) {
        await t.webkitExitFullscreen();
        return;
      }
      if (t.mozCancelFullScreen) {
        await t.mozCancelFullScreen();
        return;
      }
      if (t.msExitFullscreen) {
        await t.msExitFullscreen();
        return;
      }
    } catch {
    }
  }
  function u() {
    e.setFullscreen(o());
  }
  document.addEventListener("fullscreenchange", u), document.addEventListener("webkitfullscreenchange", u), document.addEventListener("mozfullscreenchange", u), document.addEventListener("MSFullscreenChange", u);
  function l(p) {
    p.key === "Escape" && a && d();
  }
  return document.addEventListener("keydown", l), {
    isActive: c,
    toggle: () => c() ? d() : s(),
    enter: s,
    exit: d,
    destroy: () => {
      document.removeEventListener("fullscreenchange", u), document.removeEventListener("webkitfullscreenchange", u), document.removeEventListener("mozfullscreenchange", u), document.removeEventListener("MSFullscreenChange", u), document.removeEventListener("keydown", l), a && n.classList.remove(V);
    }
  };
}
const H = 10, $ = 0.1;
function oe(n) {
  if (!(n instanceof HTMLElement)) return !1;
  const e = n.tagName;
  return !!(e === "INPUT" || e === "TEXTAREA" || e === "SELECT" || n.isContentEditable);
}
function ce(n, e, t) {
  n.hasAttribute("tabindex") || n.setAttribute("tabindex", "0");
  function a(c, s, d) {
    return Math.max(s, Math.min(d, c));
  }
  function o(c) {
    if (oe(c.target) || !n.contains(document.activeElement)) return;
    const s = e.state.duration;
    switch (c.key) {
      case " ":
      case "k":
      case "K":
        if (document.activeElement instanceof HTMLButtonElement || document.activeElement instanceof HTMLInputElement)
          return;
        c.preventDefault(), e.state.paused ? e.play() : e.pause();
        return;
      case "ArrowLeft":
        c.preventDefault(), e.seek(Math.max(0, e.state.currentTime - H));
        return;
      case "ArrowRight":
        c.preventDefault(), e.seek(Math.min(s || 0, e.state.currentTime + H));
        return;
      case "ArrowUp":
        c.preventDefault(), e.setVolume(a(e.state.volume + $, 0, 1)), e.state.muted && e.setMuted(!1);
        return;
      case "ArrowDown":
        c.preventDefault(), e.setVolume(a(e.state.volume - $, 0, 1));
        return;
      case "m":
      case "M":
        c.preventDefault(), e.setMuted(!e.state.muted);
        return;
      case "f":
      case "F":
        c.preventDefault(), t.fullscreen.toggle();
        return;
    }
    if (/^[0-9]$/.test(c.key) && s > 0) {
      c.preventDefault();
      const d = Number(c.key) / 10;
      e.seek(d * s);
    }
  }
  return n.addEventListener("keydown", o), () => n.removeEventListener("keydown", o);
}
const _ = "flow-player:consent:";
function le(n) {
  try {
    return localStorage.getItem(_ + n) === "1";
  } catch {
    return !1;
  }
}
function ue(n) {
  try {
    localStorage.setItem(_ + n, "1");
  } catch {
  }
}
const R = {
  vimeo: {
    title: "Load video from Vimeo",
    body: "Loading the player will send your IP address and browser information to Vimeo. They may set cookies and process this data according to their privacy policy.",
    accept: "Accept and play"
  },
  youtube: {
    title: "Load video from YouTube",
    body: "Loading the player will send your IP address and browser information to YouTube (Google). They may set cookies and process this data according to their privacy policy.",
    accept: "Accept and play"
  }
};
function de(n, e, t) {
  let a = n.querySelector(".vp-consent"), o = (a == null ? void 0 : a.querySelector(".vp-consent-accept")) ?? null;
  if (!a) {
    a = document.createElement("div"), a.className = "vp-consent";
    const s = document.createElement("div");
    s.className = "vp-consent-inner";
    const d = document.createElement("div");
    d.className = "vp-consent-title", d.textContent = R[e].title;
    const u = document.createElement("div");
    u.className = "vp-consent-body", u.textContent = R[e].body, o = document.createElement("button"), o.type = "button", o.className = "vp-consent-accept", o.textContent = R[e].accept, s.appendChild(d), s.appendChild(u), s.appendChild(o), a.appendChild(s), n.appendChild(a);
  }
  a.style.display = "flex", a.hidden = !1;
  function c() {
    ue(e), t();
  }
  return o == null || o.addEventListener("click", c), () => {
    o == null || o.removeEventListener("click", c), a && (a.style.display = "none", a.hidden = !0);
  };
}
function D(n, e) {
  n.style.backgroundImage = `url('${e.replace(/'/g, "\\'")}')`, n.style.backgroundSize = "cover", n.style.backgroundPosition = "center";
}
async function pe(n, e, t) {
  const a = n.querySelector(".vp-poster"), o = n.getAttribute("data-poster"), s = await G(e);
  return s != null && s.accountType && t.setVimeoTier(s.accountType), a ? o === "none" ? { tier: s == null ? void 0 : s.accountType } : o && o !== "auto" ? (D(a, o), { tier: s == null ? void 0 : s.accountType }) : a.children.length > 0 ? { tier: s == null ? void 0 : s.accountType } : (s != null && s.url && D(a, s.url), { tier: s == null ? void 0 : s.accountType }) : { tier: s == null ? void 0 : s.accountType };
}
function S(n, e, t) {
  const a = n.getAttribute(e);
  return a === null ? t : a === "" || a === "true" || a === "1";
}
function fe(n, e) {
  return {
    autoplay: S(n, "data-autoplay", !1),
    muted: S(n, "data-muted", e.muted),
    loop: S(n, "data-loop", e.loop),
    playsinline: S(n, "data-playsinline", e.playsinline),
    showControls: S(n, "data-show-controls", e.showControls),
    showTitle: S(n, "data-show-title", !1),
    showRelated: S(n, "data-show-related", !1),
    accentColor: n.getAttribute("data-accent-color") || ""
  };
}
function me(n) {
  const t = (n.getAttribute("data-accent-color") || "").replace(/^#/, "").slice(0, 6);
  /^[0-9a-fA-F]{6}$/.test(t) && n.style.setProperty("--vp-accent", "#" + t);
  const o = (n.getAttribute("data-thumb-color") || "").replace(/^#/, "").slice(0, 6);
  /^[0-9a-fA-F]{6}$/.test(o) && n.style.setProperty("--vp-thumb-color", "#" + o);
}
function ve(n, e, t, a, o) {
  if (!a || !e) return () => {
  };
  let c = null;
  function s() {
    t.setControlsIdle(!1);
  }
  function d() {
    t.state !== "playing" || t.menuOpen || t.setControlsIdle(!0);
  }
  function u() {
    s(), c && clearTimeout(c), c = setTimeout(d, o);
  }
  function l() {
    u();
  }
  return n.addEventListener("pointermove", l), n.addEventListener("touchstart", l, { passive: !0 }), () => {
    c && clearTimeout(c), n.removeEventListener("pointermove", l), n.removeEventListener("touchstart", l);
  };
}
function he(n, e, t, a, o) {
  if (a.playing) return { destroy: () => {
  } };
  a.setPlaying();
  const c = fe(n, t.defaults), s = n.getAttribute("data-ui-mode") === "webflow" ? "webflow" : "js", d = n.querySelector(".vp-poster");
  d && (d.style.display = "none");
  const u = n.querySelector(".vp-play");
  u && (u.style.display = "none");
  const l = document.createElement("iframe");
  if (l.allowFullscreen = !0, l.setAttribute(
    "allow",
    "autoplay; encrypted-media; fullscreen; picture-in-picture"
  ), l.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;display:block;z-index:1;", l.src = J(e, {
    ...c,
    showControls: !o,
    origin: typeof window < "u" ? window.location.origin : void 0
  }), n.appendChild(l), !o)
    return {
      destroy() {
        l.parentElement && l.parentElement.removeChild(l), d && (d.style.display = ""), u && (u.style.display = "");
      }
    };
  const p = X(e.provider, l);
  p.ready().then(() => {
    c.muted && p.setMuted(!0);
  });
  const y = ie(n, a);
  let f, i;
  if (s === "webflow") {
    const h = re({
      slot: n,
      provider: p,
      providerName: e.provider,
      fullscreen: y,
      state: a
    });
    f = { el: h.el, destroy: h.destroy }, i = (k) => se(f.el, k);
  } else {
    const h = ne({
      provider: p,
      providerName: e.provider,
      fullscreen: y,
      state: a,
      showControls: c.showControls
    });
    n.appendChild(h.el), f = { el: h.el, destroy: h.destroy }, i = (k) => ae(h.el, k);
  }
  const r = (() => {
    const h = new MutationObserver(() => {
      i(n.getAttribute("data-fullscreen") === "true");
    });
    return h.observe(n, { attributes: !0, attributeFilter: ["data-fullscreen"] }), () => h.disconnect();
  })();
  let v = () => {
  };
  t.defaults.keyboardShortcuts && (v = ce(n, p, { fullscreen: y }));
  const m = ve(
    n,
    f.el,
    a,
    t.defaults.autoHide && c.showControls,
    t.defaults.idleTimeoutMs
  );
  return {
    destroy() {
      r(), m(), v(), y.destroy(), f.destroy(), p.destroy(), l.parentElement && l.parentElement.removeChild(l), d && (d.style.display = ""), u && (u.style.display = "");
    }
  };
}
function ge(n, e) {
  const t = Q(n);
  if (t.inited) return null;
  const a = n.getAttribute("data-vimeo-url") || n.getAttribute("data-video-url") || n.getAttribute("data-youtube-url") || "", o = U(a);
  if (!o) return null;
  t.setInit(), t.setState("idle"), me(n);
  const c = pe(n, o, t), s = n.getAttribute("data-consent") || "off", d = S(n, "data-autoplay", !1), u = n.getAttribute("data-vimeo-mode") || "auto";
  async function l() {
    let i = o.provider === "youtube";
    if (o.provider === "vimeo")
      if (u === "custom") i = !0;
      else if (u === "native") i = !1;
      else {
        const { tier: r } = await c;
        i = !!r && r !== "basic";
      }
    return he(n, o, e, t, i);
  }
  let p = !1;
  if (s === "required" && !le(o.provider)) {
    let i = null;
    const r = de(n, o.provider, async () => {
      r(), i = await l(), p && (i == null || i.destroy());
    });
    return {
      destroy() {
        p = !0, r(), i == null || i.destroy();
      }
    };
  }
  if (d) {
    let i = null;
    return l().then((r) => {
      i = r, p && (i == null || i.destroy());
    }), {
      destroy() {
        p = !0, i == null || i.destroy();
      }
    };
  }
  let y = null;
  n.style.cursor = "pointer";
  async function f() {
    y = await l(), p && (y == null || y.destroy());
  }
  return n.addEventListener("click", f, { once: !0 }), {
    destroy() {
      p = !0, n.removeEventListener("click", f), y == null || y.destroy();
    }
  };
}
const ye = {
  muted: !1,
  loop: !1,
  playsinline: !0,
  showControls: !0,
  keyboardShortcuts: !0,
  autoHide: !0,
  idleTimeoutMs: 2500
}, be = "2026-05-16-fouc-fix", ke = typeof window < "u" && window.__FLOW_PLAYER_3_CONFIG__ || {}, Ee = { ...ye, ...ke };
function q() {
  document.documentElement.setAttribute(
    "data-flow-player-3-version",
    be
  );
  const n = document.querySelectorAll(
    ".vp-slot[data-vimeo-url], .vp-slot[data-video-url], .vp-slot[data-youtube-url]"
  );
  for (const e of n)
    ge(e, { defaults: Ee });
}
typeof document < "u" && (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", q) : q());
