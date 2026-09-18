function _(t) {
  if (!t) return null;
  const e = t.trim();
  let n = e.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=|shorts\/|v\/))([\w-]{11})/i
  );
  return n ? { provider: "youtube", id: n[1] } : /^[\w-]{11}$/.test(e) ? { provider: "youtube", id: e } : (n = e.match(/player\.vimeo\.com\/video\/(\d+)/i), n ? { provider: "vimeo", id: n[1] } : (n = e.match(/vimeo\.com\/(?:[^/]+\/)*(\d+)/i), n ? { provider: "vimeo", id: n[1] } : /^\d{6,}$/.test(e) ? { provider: "vimeo", id: e } : null));
}
async function U(t, e = 1280) {
  if (t.provider === "youtube")
    return {
      url: `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`,
      width: 480,
      height: 360
    };
  try {
    const n = "https://vimeo.com/api/oembed.json?url=" + encodeURIComponent("https://vimeo.com/" + t.id) + `&width=${e}`, a = await fetch(n);
    if (!a.ok) return null;
    const c = await a.json();
    return c.thumbnail_url ? {
      url: c.thumbnail_url,
      width: c.thumbnail_width,
      height: c.thumbnail_height
    } : null;
  } catch {
    return null;
  }
}
function W(t, e) {
  if (t.provider === "vimeo") {
    const a = new URLSearchParams();
    if (a.set("autoplay", "1"), e.muted && a.set("muted", "1"), e.loop && a.set("loop", "1"), a.set("controls", e.showControls === !1 ? "0" : "1"), e.showControls === !1 ? (a.set("title", "0"), a.set("byline", "0"), a.set("portrait", "0"), a.set("share", "0"), a.set("speed", "0"), a.set("keyboard", "0"), a.set("pip", "0"), a.set("transparent", "0")) : (a.set("title", e.showTitle ? "1" : "0"), a.set("byline", "0"), a.set("portrait", "0")), a.set("playsinline", e.playsinline === !1 ? "0" : "1"), e.accentColor) {
      const c = e.accentColor.replace(/^#/, "").slice(0, 6);
      /^[0-9a-fA-F]{6}$/.test(c) && a.set("color", c);
    }
    return a.set("dnt", "1"), `https://player.vimeo.com/video/${t.id}?${a.toString()}`;
  }
  const n = new URLSearchParams();
  return n.set("enablejsapi", "1"), e.origin && n.set("origin", e.origin), n.set("autoplay", "1"), e.muted && n.set("mute", "1"), e.loop && (n.set("loop", "1"), n.set("playlist", t.id)), n.set("controls", e.showControls === !1 ? "0" : "1"), n.set("playsinline", e.playsinline === !1 ? "0" : "1"), n.set("rel", e.showRelated ? "1" : "0"), n.set("modestbranding", "1"), `https://www.youtube-nocookie.com/embed/${t.id}?${n.toString()}`;
}
const G = [
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
function Y(t) {
  const e = /* @__PURE__ */ new Map(), n = {
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    muted: !1,
    paused: !0,
    playbackRate: 1
  };
  let a = null;
  const c = new Promise((u) => {
    a = u;
  });
  let i = !1, s = [], p = null;
  function l(u) {
    return `${u.language}-${u.kind}`;
  }
  function o(u, d) {
    if (!t.contentWindow) return;
    const r = { method: u };
    d !== void 0 && (r.value = d), t.contentWindow.postMessage(JSON.stringify(r), "*");
  }
  function f(u, d) {
    const r = e.get(u);
    if (r)
      for (const v of r)
        try {
          v(d);
        } catch {
        }
  }
  function b(u) {
    if (u.source !== t.contentWindow) return;
    let d;
    try {
      d = typeof u.data == "string" ? JSON.parse(u.data) : u.data;
    } catch {
      return;
    }
    if (d) {
      if (d.event === "ready" || d.method === "ping" && !i) {
        i = !0;
        for (const r of G) o("addEventListener", r);
        o("getDuration"), o("getVolume"), o("getMuted"), o("getPlaybackRate"), o("getTextTracks"), a == null || a(), f("ready");
        return;
      }
      switch (d.event) {
        case "play":
          n.paused = !1, f("play");
          break;
        case "pause":
          n.paused = !0, f("pause");
          break;
        case "ended":
          n.paused = !0, f("ended");
          break;
        case "timeupdate": {
          const r = d.data;
          (r == null ? void 0 : r.seconds) != null && (n.currentTime = r.seconds), (r == null ? void 0 : r.duration) != null && (n.duration = r.duration), f("timeupdate");
          break;
        }
        case "progress": {
          const r = d.data;
          (r == null ? void 0 : r.percent) != null && (n.buffered = r.percent), f("progress");
          break;
        }
        case "durationchange": {
          const r = d.data;
          (r == null ? void 0 : r.duration) != null && (n.duration = r.duration), f("durationchange");
          break;
        }
        case "volumechange": {
          const r = d.data;
          (r == null ? void 0 : r.volume) != null && (n.volume = r.volume), f("volumechange");
          break;
        }
        case "playbackratechange": {
          const r = d.data;
          (r == null ? void 0 : r.playbackRate) != null && (n.playbackRate = r.playbackRate), f("ratechange");
          break;
        }
        case "bufferstart":
          f("buffering");
          break;
        case "bufferend":
          f("playing");
          break;
        case "texttrackchange": {
          const r = d.data;
          p = r ? l(r) : null, f("volumechange");
          break;
        }
        case "error":
          f("error", d.data);
          break;
      }
      if (d.method === "getDuration" && typeof d.value == "number")
        n.duration = d.value, f("durationchange");
      else if (d.method === "getVolume" && typeof d.value == "number")
        n.volume = d.value, f("volumechange");
      else if (d.method === "getMuted" && typeof d.value == "boolean")
        n.muted = d.value, f("volumechange");
      else if (d.method === "getPlaybackRate" && typeof d.value == "number")
        n.playbackRate = d.value, f("ratechange");
      else if (d.method === "getTextTracks" && Array.isArray(d.value)) {
        s = d.value.filter(
          (v) => v.kind === "captions" || v.kind === "subtitles"
        );
        const r = s.find((v) => v.mode === "showing");
        p = r ? l(r) : null, f("tracks");
      }
    }
  }
  return window.addEventListener("message", b), {
    iframe: t,
    state: n,
    ready: () => c,
    play: () => o("play"),
    pause: () => o("pause"),
    seek: (u) => {
      n.currentTime = u, o("setCurrentTime", u);
    },
    setVolume: (u) => {
      n.volume = u, o("setVolume", u);
    },
    setMuted: (u) => {
      n.muted = u, o("setMuted", u);
    },
    setPlaybackRate: (u) => {
      n.playbackRate = u, o("setPlaybackRate", u);
    },
    requestPictureInPicture: async () => (o("requestPictureInPicture"), !0),
    getTextTracks: () => s.map(
      (u) => ({
        id: l(u),
        label: u.label || u.language,
        language: u.language,
        kind: u.kind === "captions" ? "captions" : "subtitles"
      })
    ),
    getActiveTextTrack: () => p,
    setTextTrack: (u) => {
      if (!u) {
        o("disableTextTrack"), p = null;
        return;
      }
      const d = s.find((r) => l(r) === u);
      d && (o("enableTextTrack", { language: d.language, kind: d.kind }), p = u);
    },
    on: (u, d) => {
      let r = e.get(u);
      return r || (r = /* @__PURE__ */ new Set(), e.set(u, r)), r.add(d), () => {
        r == null || r.delete(d);
      };
    },
    destroy: () => {
      window.removeEventListener("message", b), e.clear();
    }
  };
}
const P = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3
};
function j(t) {
  const e = /* @__PURE__ */ new Map(), n = {
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    muted: !1,
    paused: !0,
    playbackRate: 1
  };
  let a = null;
  const c = new Promise((r) => {
    a = r;
  });
  let i = null, s = [], p = null;
  function l(r, ...v) {
    if (!t.contentWindow) return;
    const m = { event: "command", func: r, args: v };
    t.contentWindow.postMessage(JSON.stringify(m), "*");
  }
  function o(r, v) {
    const m = e.get(r);
    if (m)
      for (const g of m)
        try {
          g(v);
        } catch {
        }
  }
  function f() {
    i || (i = setInterval(() => {
      l("getCurrentTime"), l("getVideoLoadedFraction");
    }, 250));
  }
  function b() {
    i && (clearInterval(i), i = null);
  }
  function u(r) {
    if (r.source !== t.contentWindow) return;
    let v;
    try {
      v = typeof r.data == "string" ? JSON.parse(r.data) : r.data;
    } catch {
      return;
    }
    if (v) {
      if (v.event === "onReady") {
        l("getDuration"), l("getVolume"), l("isMuted"), l("getPlaybackRate"), l("getOptions", "captions"), a == null || a(), o("ready");
        return;
      }
      if (v.event === "onApiChange") {
        l("getOption", "captions", "tracklist"), l("getOption", "captions", "track");
        return;
      }
      if (v.event === "onStateChange") {
        const m = v.info;
        m === P.PLAYING ? (n.paused = !1, f(), o("playing"), o("play")) : m === P.PAUSED ? (n.paused = !0, b(), o("pause")) : m === P.ENDED ? (n.paused = !0, b(), o("ended")) : m === P.BUFFERING && o("buffering");
        return;
      }
      if (v.event === "infoDelivery" && v.info) {
        const m = v.info;
        let g = !1;
        typeof m.currentTime == "number" && (n.currentTime = m.currentTime, g = !0), typeof m.duration == "number" && (n.duration = m.duration, o("durationchange")), typeof m.videoLoadedFraction == "number" && (n.buffered = m.videoLoadedFraction, o("progress")), typeof m.volume == "number" && (n.volume = m.volume / 100, o("volumechange")), typeof m.muted == "boolean" && (n.muted = m.muted, o("volumechange")), typeof m.playbackRate == "number" && (n.playbackRate = m.playbackRate, o("ratechange")), g && o("timeupdate");
        return;
      }
      if (v.event === "onError") {
        o("error", v.info);
        return;
      }
      if (v.event === "infoDelivery" && v.info) {
        const m = v.info;
        Array.isArray(m.tracklist) && (s = m.tracklist.filter((E) => !!E.languageCode).map(
          (E) => ({
            id: E.languageCode,
            label: E.displayName || E.languageName || E.languageCode,
            language: E.languageCode,
            kind: "captions"
          })
        ), o("tracks")), m.track && typeof m.track == "object" && (p = m.track.languageCode || null);
      }
    }
  }
  window.addEventListener("message", u);
  function d() {
    t.contentWindow && t.contentWindow.postMessage(
      JSON.stringify({ event: "listening", id: "flow-player" }),
      "*"
    );
  }
  return t.addEventListener("load", d, { once: !0 }), setTimeout(d, 500), {
    iframe: t,
    state: n,
    ready: () => c,
    play: () => l("playVideo"),
    pause: () => l("pauseVideo"),
    seek: (r) => {
      n.currentTime = r, l("seekTo", r, !0);
    },
    setVolume: (r) => {
      n.volume = r, l("setVolume", Math.round(r * 100));
    },
    setMuted: (r) => {
      n.muted = r, l(r ? "mute" : "unMute");
    },
    setPlaybackRate: (r) => {
      n.playbackRate = r, l("setPlaybackRate", r);
    },
    requestPictureInPicture: async () => !1,
    getTextTracks: () => s.slice(),
    getActiveTextTrack: () => p,
    setTextTrack: (r) => {
      if (!r) {
        l("unloadModule", "captions"), l("loadModule", "captions"), p = null;
        return;
      }
      l("setOption", "captions", "track", { languageCode: r }), p = r;
    },
    on: (r, v) => {
      let m = e.get(r);
      return m || (m = /* @__PURE__ */ new Set(), e.set(r, m)), m.add(v), () => {
        m == null || m.delete(v);
      };
    },
    destroy: () => {
      b(), window.removeEventListener("message", u), e.clear();
    }
  };
}
function J(t, e) {
  return t === "vimeo" ? Y(e) : j(e);
}
const C = {
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
  rewind10: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="16" font-family="system-ui, sans-serif" font-size="7" font-weight="700" text-anchor="middle">10</text></svg>',
  forward10: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="12" y="16" font-family="system-ui, sans-serif" font-size="7" font-weight="700" text-anchor="middle">10</text></svg>',
  captionsOn: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg>'
};
function x(t) {
  (!isFinite(t) || t < 0) && (t = 0);
  const e = Math.floor(t), n = Math.floor(e / 3600), a = Math.floor(e % 3600 / 60), c = e % 60, i = n > 0 ? String(a).padStart(2, "0") : String(a), s = String(c).padStart(2, "0");
  return n > 0 ? `${n}:${i}:${s}` : `${i}:${s}`;
}
function K(t) {
  const e = document.createElement("div");
  e.className = "vp-progress";
  const n = document.createElement("div");
  n.className = "vp-progress-track", e.appendChild(n);
  const a = document.createElement("div");
  a.className = "vp-progress-buffer", n.appendChild(a);
  const c = document.createElement("div");
  c.className = "vp-progress-fill", n.appendChild(c);
  const i = document.createElement("div");
  i.className = "vp-progress-thumb", e.appendChild(i);
  const s = document.createElement("input");
  s.className = "vp-progress-range", s.type = "range", s.min = "0", s.max = "1", s.step = "0.0001", s.value = "0", s.setAttribute("role", "slider"), s.setAttribute("aria-label", "Seek"), s.setAttribute("aria-valuemin", "0"), s.setAttribute("aria-valuemax", "100"), s.setAttribute("aria-valuenow", "0"), s.setAttribute("aria-valuetext", "0:00 of 0:00"), e.appendChild(s);
  function p(g) {
    e.style.setProperty("--vp-progress-frac", String(g));
  }
  function l(g) {
    e.style.setProperty("--vp-buffer-frac", String(g));
  }
  let o = !1, f = !1;
  function b() {
    if (o) return;
    const g = t.state.duration, E = t.state.currentTime, h = g > 0 ? E / g : 0;
    s.value = String(h), s.setAttribute("aria-valuenow", String(Math.round(h * 100))), s.setAttribute("aria-valuetext", `${x(E)} of ${x(g)}`), p(h);
  }
  function u() {
    l(t.state.buffered);
  }
  const d = t.on("timeupdate", b), r = t.on("durationchange", b), v = t.on("progress", u);
  s.addEventListener("pointerdown", () => {
    o = !0, t.state.paused || (f = !0, t.pause());
  });
  function m() {
    o && (o = !1, f && (f = !1, t.play()));
  }
  return s.addEventListener("pointerup", m), s.addEventListener("pointercancel", m), s.addEventListener("input", () => {
    const g = Math.max(0, Math.min(1, Number(s.value)));
    if (p(g), s.setAttribute("aria-valuenow", String(Math.round(g * 100))), t.state.duration > 0) {
      const E = g * t.state.duration;
      t.seek(E), s.setAttribute(
        "aria-valuetext",
        `${x(E)} of ${x(t.state.duration)}`
      );
    }
  }), b(), u(), {
    el: e,
    range: s,
    destroy: () => {
      d(), r(), v();
    }
  };
}
const I = x, X = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
function H(t) {
  const e = document.createElement("div");
  e.className = "vp-settings-section";
  const n = document.createElement("div");
  return n.className = "vp-settings-heading", n.textContent = t, e.appendChild(n), e;
}
function N(t, e) {
  const n = document.createElement("button");
  n.type = "button", n.className = "vp-settings-item", n.setAttribute("role", "menuitemradio"), n.setAttribute("aria-checked", e ? "true" : "false");
  const a = document.createElement("span");
  a.textContent = t, n.appendChild(a);
  const c = document.createElement("span");
  return c.className = "vp-settings-check", c.innerHTML = C.check, n.appendChild(c), n;
}
function Q(t) {
  const e = document.createElement("div");
  e.className = "vp-settings";
  const n = document.createElement("button");
  n.type = "button", n.className = "vp-control vp-settings-btn", n.setAttribute("aria-label", "Settings"), n.setAttribute("aria-haspopup", "menu"), n.setAttribute("aria-expanded", "false"), n.setAttribute("data-tooltip", "Settings"), n.innerHTML = C.settings, e.appendChild(n);
  const a = document.createElement("div");
  a.className = "vp-settings-menu", a.setAttribute("role", "menu"), a.setAttribute("aria-label", "Settings"), a.hidden = !0, e.appendChild(a);
  const c = H("Speed"), i = document.createElement("div");
  i.className = "vp-settings-list", c.appendChild(i);
  const s = [];
  for (const h of X) {
    const y = N(h === 1 ? "Normal" : `${h}×`, h === 1);
    y.dataset.speed = String(h), y.addEventListener("click", () => {
      t.setPlaybackRate(h), p(h), r(), n.focus();
    }), i.appendChild(y), s.push(y);
  }
  a.appendChild(c);
  function p(h) {
    for (const y of s) {
      const k = Number(y.dataset.speed), T = Math.abs(k - h) < 0.01;
      y.setAttribute("aria-checked", T ? "true" : "false");
    }
  }
  let l = null, o = [];
  function f() {
    const h = t.getTextTracks();
    if (!h.length) {
      l && (l.remove(), l = null, o = []);
      return;
    }
    if (!l) {
      l = H("Captions");
      const y = document.createElement("div");
      y.className = "vp-settings-list", l.appendChild(y);
      const k = N("Off", t.getActiveTextTrack() === null);
      k.dataset.trackId = "", k.addEventListener("click", () => {
        t.setTextTrack(null), b(null), r(), n.focus();
      }), y.appendChild(k), o.push(k);
      for (const T of h) {
        const S = N(
          T.label,
          t.getActiveTextTrack() === T.id
        );
        S.dataset.trackId = T.id, S.addEventListener("click", () => {
          t.setTextTrack(T.id), b(T.id), r(), n.focus();
        }), y.appendChild(S), o.push(S);
      }
      a.appendChild(l);
    }
  }
  function b(h) {
    for (const y of o) {
      const k = y.dataset.trackId || null;
      y.setAttribute("aria-checked", k === h ? "true" : "false");
    }
  }
  let u = !1;
  function d() {
    if (u) return;
    u = !0, a.hidden = !1, n.setAttribute("aria-expanded", "true"), document.addEventListener("click", v, !0), document.addEventListener("keydown", m);
    const h = a.querySelector('[aria-checked="true"]');
    h == null || h.focus();
  }
  function r() {
    u && (u = !1, a.hidden = !0, n.setAttribute("aria-expanded", "false"), document.removeEventListener("click", v, !0), document.removeEventListener("keydown", m));
  }
  function v(h) {
    e.contains(h.target) || r();
  }
  function m(h) {
    h.key === "Escape" && (h.preventDefault(), r(), n.focus());
  }
  n.addEventListener("click", () => u ? r() : d());
  const g = t.on("ratechange", () => {
    p(t.state.playbackRate);
  }), E = t.on("tracks", () => {
    f();
  });
  return {
    trigger: n,
    menu: e,
    destroy: () => {
      g(), E(), r();
    }
  };
}
const M = 10;
function A(t) {
  const e = document.createElement("button");
  return e.type = "button", e.className = t.className, e.setAttribute("aria-label", t.ariaLabel), e.setAttribute("data-tooltip", t.tooltip), e.innerHTML = t.innerHTML, e.addEventListener("click", t.onClick), e;
}
function Z(t) {
  const { provider: e, providerName: n, fullscreen: a, showControls: c } = t, i = document.createElement("div");
  i.className = "vp-controls", i.setAttribute("role", "group"), i.setAttribute("aria-label", "Video controls"), c || i.classList.add("vp-controls--hidden");
  const s = [], p = A({
    className: "vp-control vp-controls-play",
    ariaLabel: "Play",
    tooltip: "Play (Space)",
    innerHTML: `<span class="vp-icon-play">${C.play}</span><span class="vp-icon-pause">${C.pause}</span>`,
    onClick: () => {
      e.state.paused ? e.play() : e.pause();
    }
  });
  p.setAttribute("aria-pressed", "false"), s.push(
    e.on("play", () => {
      p.setAttribute("aria-pressed", "true"), p.setAttribute("aria-label", "Pause"), p.setAttribute("data-tooltip", "Pause (Space)");
    })
  ), s.push(
    e.on("pause", () => {
      p.setAttribute("aria-pressed", "false"), p.setAttribute("aria-label", "Play"), p.setAttribute("data-tooltip", "Play (Space)");
    })
  ), i.appendChild(p);
  const l = A({
    className: "vp-control vp-restart",
    ariaLabel: "Restart",
    tooltip: "Restart",
    innerHTML: C.restart,
    onClick: () => e.seek(0)
  });
  i.appendChild(l);
  const o = A({
    className: "vp-control vp-rewind",
    ariaLabel: `Rewind ${M} seconds`,
    tooltip: `Rewind ${M}s (←)`,
    innerHTML: C.rewind10,
    onClick: () => {
      e.seek(Math.max(0, e.state.currentTime - M));
    }
  });
  i.appendChild(o);
  const f = A({
    className: "vp-control vp-forward",
    ariaLabel: `Forward ${M} seconds`,
    tooltip: `Forward ${M}s (→)`,
    innerHTML: C.forward10,
    onClick: () => {
      const w = e.state.duration || 1 / 0;
      e.seek(Math.min(w, e.state.currentTime + M));
    }
  });
  i.appendChild(f);
  const b = K(e);
  i.appendChild(b.el), s.push(b.destroy);
  const u = document.createElement("div");
  u.className = "vp-time";
  const d = document.createElement("span");
  d.className = "vp-time-current", d.textContent = "0:00";
  const r = document.createElement("span");
  r.className = "vp-time-sep", r.textContent = " / ";
  const v = document.createElement("span");
  v.className = "vp-time-duration", v.textContent = "0:00", u.appendChild(d), u.appendChild(r), u.appendChild(v), i.appendChild(u);
  function m() {
    d.textContent = I(e.state.currentTime), v.textContent = I(e.state.duration);
  }
  s.push(e.on("timeupdate", m)), s.push(e.on("durationchange", m));
  const g = A({
    className: "vp-control vp-captions",
    ariaLabel: "Toggle captions",
    tooltip: "Captions",
    innerHTML: C.captionsOn,
    onClick: () => {
      const w = e.getTextTracks();
      e.getActiveTextTrack() ? (e.setTextTrack(null), g.setAttribute("aria-pressed", "false")) : w.length && (e.setTextTrack(w[0].id), g.setAttribute("aria-pressed", "true"));
    }
  });
  g.setAttribute("aria-pressed", "false"), g.hidden = !0, i.appendChild(g);
  function E() {
    const w = e.getTextTracks();
    g.hidden = w.length === 0;
    const V = e.getActiveTextTrack();
    g.setAttribute("aria-pressed", V ? "true" : "false");
  }
  s.push(e.on("tracks", E));
  const h = document.createElement("div");
  h.className = "vp-volume-group";
  const y = A({
    className: "vp-control vp-mute",
    ariaLabel: "Mute",
    tooltip: "Mute (M)",
    innerHTML: `<span class="vp-icon-vol-full">${C.volumeFull}</span><span class="vp-icon-vol-mid">${C.volumeMid}</span><span class="vp-icon-vol-mute">${C.volumeMute}</span>`,
    onClick: () => {
      e.setMuted(!e.state.muted);
    }
  });
  y.setAttribute("aria-pressed", "false"), h.appendChild(y);
  const k = document.createElement("input");
  k.type = "range", k.className = "vp-volume", k.min = "0", k.max = "1", k.step = "0.01", k.value = "1", k.setAttribute("aria-label", "Volume"), k.addEventListener("input", () => {
    const w = Number(k.value);
    e.setVolume(w), w > 0 && e.state.muted && e.setMuted(!1);
  }), h.appendChild(k), i.appendChild(h);
  function T() {
    const w = e.state.muted || e.state.volume === 0;
    y.setAttribute("aria-pressed", w ? "true" : "false"), y.setAttribute("aria-label", w ? "Unmute" : "Mute"), y.setAttribute("data-tooltip", w ? "Unmute (M)" : "Mute (M)"), y.dataset.level = w ? "mute" : e.state.volume < 0.5 ? "mid" : "full", k.matches(":active") || (k.value = String(w ? 0 : e.state.volume)), h.style.setProperty(
      "--vp-volume",
      `${(w ? 0 : e.state.volume) * 100}%`
    );
  }
  s.push(e.on("volumechange", T)), T();
  const S = Q(e);
  if (i.appendChild(S.menu), s.push(S.destroy), n === "vimeo") {
    const w = A({
      className: "vp-control vp-pip",
      ariaLabel: "Picture in picture",
      tooltip: "Picture in picture",
      innerHTML: C.pip,
      onClick: () => {
        e.requestPictureInPicture().catch(() => {
        });
      }
    });
    i.appendChild(w);
  }
  const z = A({
    className: "vp-control vp-fullscreen",
    ariaLabel: "Enter fullscreen",
    tooltip: "Fullscreen (F)",
    innerHTML: `<span class="vp-icon-fs-enter">${C.fullscreenEnter}</span><span class="vp-icon-fs-exit">${C.fullscreenExit}</span>`,
    onClick: () => a.toggle()
  });
  return z.setAttribute("aria-pressed", "false"), i.appendChild(z), {
    el: i,
    destroy: () => {
      for (const w of s)
        try {
          w();
        } catch {
        }
    }
  };
}
function ee(t, e) {
  const n = t.querySelector(".vp-fullscreen");
  n && (n.setAttribute("aria-pressed", e ? "true" : "false"), n.setAttribute(
    "aria-label",
    e ? "Exit fullscreen" : "Enter fullscreen"
  ), n.setAttribute(
    "data-tooltip",
    e ? "Exit fullscreen (F)" : "Fullscreen (F)"
  ));
}
const F = "vp-pseudo-fullscreen";
function te(t, e) {
  const n = document;
  let a = !1;
  function c() {
    return !!(document.fullscreenElement || n.webkitFullscreenElement || n.mozFullScreenElement || n.msFullscreenElement);
  }
  function i() {
    return c() || a;
  }
  async function s() {
    const f = t;
    try {
      if (f.requestFullscreen) {
        await f.requestFullscreen();
        return;
      }
      if (f.webkitRequestFullscreen) {
        await f.webkitRequestFullscreen();
        return;
      }
      if (f.mozRequestFullScreen) {
        await f.mozRequestFullScreen();
        return;
      }
      if (f.msRequestFullscreen) {
        await f.msRequestFullscreen();
        return;
      }
    } catch {
    }
    a = !0, t.classList.add(F), e(!0);
  }
  async function p() {
    if (a) {
      a = !1, t.classList.remove(F), e(!1);
      return;
    }
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        return;
      }
      if (n.webkitExitFullscreen) {
        await n.webkitExitFullscreen();
        return;
      }
      if (n.mozCancelFullScreen) {
        await n.mozCancelFullScreen();
        return;
      }
      if (n.msExitFullscreen) {
        await n.msExitFullscreen();
        return;
      }
    } catch {
    }
  }
  function l() {
    e(c());
  }
  document.addEventListener("fullscreenchange", l), document.addEventListener("webkitfullscreenchange", l), document.addEventListener("mozfullscreenchange", l), document.addEventListener("MSFullscreenChange", l);
  function o(f) {
    f.key === "Escape" && a && p();
  }
  return document.addEventListener("keydown", o), {
    isActive: i,
    toggle: () => i() ? p() : s(),
    enter: s,
    exit: p,
    destroy: () => {
      document.removeEventListener("fullscreenchange", l), document.removeEventListener("webkitfullscreenchange", l), document.removeEventListener("mozfullscreenchange", l), document.removeEventListener("MSFullscreenChange", l), document.removeEventListener("keydown", o), a && t.classList.remove(F);
    }
  };
}
const $ = 10, B = 0.1;
function ne(t) {
  if (!(t instanceof HTMLElement)) return !1;
  const e = t.tagName;
  return !!(e === "INPUT" || e === "TEXTAREA" || e === "SELECT" || t.isContentEditable);
}
function ae(t, e, n) {
  t.hasAttribute("tabindex") || t.setAttribute("tabindex", "0");
  function a(i, s, p) {
    return Math.max(s, Math.min(p, i));
  }
  function c(i) {
    if (ne(i.target) || !t.contains(document.activeElement)) return;
    const s = e.state.duration;
    switch (i.key) {
      case " ":
      case "k":
      case "K":
        if (document.activeElement instanceof HTMLButtonElement || document.activeElement instanceof HTMLInputElement)
          return;
        i.preventDefault(), e.state.paused ? e.play() : e.pause();
        return;
      case "ArrowLeft":
        i.preventDefault(), e.seek(Math.max(0, e.state.currentTime - $));
        return;
      case "ArrowRight":
        i.preventDefault(), e.seek(Math.min(s || 0, e.state.currentTime + $));
        return;
      case "ArrowUp":
        i.preventDefault(), e.setVolume(a(e.state.volume + B, 0, 1)), e.state.muted && e.setMuted(!1);
        return;
      case "ArrowDown":
        i.preventDefault(), e.setVolume(a(e.state.volume - B, 0, 1));
        return;
      case "m":
      case "M":
        i.preventDefault(), e.setMuted(!e.state.muted);
        return;
      case "f":
      case "F":
        i.preventDefault(), n.fullscreen.toggle();
        return;
    }
    if (/^[0-9]$/.test(i.key) && s > 0) {
      i.preventDefault();
      const p = Number(i.key) / 10;
      e.seek(p * s);
    }
  }
  return t.addEventListener("keydown", c), () => t.removeEventListener("keydown", c);
}
const q = "flow-player:consent:";
function re(t) {
  try {
    return localStorage.getItem(q + t) === "1";
  } catch {
    return !1;
  }
}
function se(t) {
  try {
    localStorage.setItem(q + t, "1");
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
function ie(t, e, n) {
  let a = t.querySelector(".vp-consent"), c = (a == null ? void 0 : a.querySelector(".vp-consent-accept")) ?? null;
  if (!a) {
    a = document.createElement("div"), a.className = "vp-consent";
    const s = document.createElement("div");
    s.className = "vp-consent-inner";
    const p = document.createElement("div");
    p.className = "vp-consent-title", p.textContent = R[e].title;
    const l = document.createElement("div");
    l.className = "vp-consent-body", l.textContent = R[e].body, c = document.createElement("button"), c.type = "button", c.className = "vp-consent-accept", c.textContent = R[e].accept, s.appendChild(p), s.appendChild(l), s.appendChild(c), a.appendChild(s), t.appendChild(a);
  }
  a.style.display = "flex", a.hidden = !1;
  function i() {
    se(e), n();
  }
  return c == null || c.addEventListener("click", i), () => {
    c == null || c.removeEventListener("click", i), a && (a.style.display = "none", a.hidden = !0);
  };
}
function D(t, e) {
  t.style.backgroundImage = `url('${e.replace(/'/g, "\\'")}')`, t.style.backgroundSize = "cover", t.style.backgroundPosition = "center";
}
async function oe(t, e) {
  const n = t.querySelector(".vp-poster");
  if (!n) return;
  const a = t.getAttribute("data-poster");
  if (a === "none") return;
  if (a && a !== "auto") {
    D(n, a);
    return;
  }
  if (n.children.length > 0) return;
  const c = await U(e);
  c != null && c.url && D(n, c.url);
}
function L(t, e, n) {
  const a = t.getAttribute(e);
  return a === null ? n : a === "" || a === "true" || a === "1";
}
function le(t, e) {
  return {
    autoplay: L(t, "data-autoplay", !1),
    muted: L(t, "data-muted", e.muted),
    loop: L(t, "data-loop", e.loop),
    playsinline: L(t, "data-playsinline", e.playsinline),
    showControls: L(t, "data-show-controls", e.showControls),
    showTitle: L(t, "data-show-title", !1),
    showRelated: L(t, "data-show-related", !1),
    accentColor: t.getAttribute("data-accent-color") || ""
  };
}
function ce(t) {
  const n = (t.getAttribute("data-accent-color") || "").replace(/^#/, "").slice(0, 6);
  if (/^[0-9a-fA-F]{6}$/.test(n)) {
    t.style.setProperty("--vp-accent", "#" + n);
    const i = t.querySelector(".vp-play");
    i && (i.style.color = "#" + n);
  }
  const c = (t.getAttribute("data-thumb-color") || "").replace(/^#/, "").slice(0, 6);
  /^[0-9a-fA-F]{6}$/.test(c) && t.style.setProperty("--vp-thumb-color", "#" + c);
}
function ue(t, e, n, a) {
  if (!n) return () => {
  };
  let c = null, i = !1;
  function s() {
    e.classList.remove("vp-controls--idle");
  }
  function p() {
  }
  function l() {
    s(), c && clearTimeout(c), c = setTimeout(p, a);
  }
  function o() {
    l();
  }
  function f() {
    s();
  }
  function b() {
    l();
  }
  const u = e.querySelector(".vp-settings-btn");
  let d = null;
  return u && (d = new MutationObserver(() => {
    i = u.getAttribute("aria-expanded") === "true", i || l();
  }), d.observe(u, { attributes: !0, attributeFilter: ["aria-expanded"] })), t.addEventListener("pointermove", o), t.addEventListener("touchstart", o, { passive: !0 }), e.addEventListener("pointerenter", f), e.addEventListener("pointerleave", b), () => {
    c && clearTimeout(c), d == null || d.disconnect(), t.removeEventListener("pointermove", o), t.removeEventListener("touchstart", o), e.removeEventListener("pointerenter", f), e.removeEventListener("pointerleave", b);
  };
}
function de(t, e, n) {
  if (t.dataset.vpPlaying === "1") return { destroy: () => {
  } };
  t.dataset.vpPlaying = "1";
  const a = le(t, n.defaults), c = e.provider === "youtube" || L(t, "data-vimeo-pro", !1), i = t.querySelector(".vp-poster");
  i && (i.style.display = "none");
  const s = t.querySelector(".vp-play");
  s && (s.style.display = "none");
  const p = document.createElement("iframe");
  if (p.allowFullscreen = !0, p.setAttribute(
    "allow",
    "autoplay; encrypted-media; fullscreen; picture-in-picture"
  ), p.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;display:block;z-index:1;", p.src = W(e, {
    ...a,
    // Custom UI mode → ask provider to hide its chrome.
    // Native UI mode  → keep provider's chrome visible.
    showControls: !c,
    origin: typeof window < "u" ? window.location.origin : void 0
  }), t.appendChild(p), !c)
    return {
      destroy() {
        p.parentElement && p.parentElement.removeChild(p), t.dataset.vpPlaying = "", i && (i.style.display = ""), s && (s.style.display = "");
      }
    };
  const l = J(e.provider, p);
  l.ready().then(() => {
    a.muted && l.setMuted(!0);
  });
  let o = t.querySelector(".vp-loading");
  o || (o = document.createElement("div"), o.className = "vp-loading", o.innerHTML = '<span class="vp-loading-spinner"></span>', t.appendChild(o)), o.style.display = "";
  let f = !1;
  function b() {
    o && (o.style.display = "none");
  }
  function u() {
    o && (o.style.display = "");
  }
  const d = l.on("buffering", u), r = l.on("playing", () => {
    f = !0, b();
  }), v = l.on("play", () => {
    f && b();
  }), m = l.on("pause", b), g = te(t, (k) => {
    ee(E.el, k);
  }), E = Z({
    provider: l,
    providerName: e.provider,
    fullscreen: g,
    showControls: a.showControls
  });
  t.appendChild(E.el);
  let h = () => {
  };
  n.defaults.keyboardShortcuts && (h = ae(t, l, { fullscreen: g }));
  const y = ue(
    t,
    E.el,
    n.defaults.autoHide && a.showControls,
    n.defaults.idleTimeoutMs
  );
  return {
    destroy() {
      d(), r(), v(), m(), y(), h(), g.destroy(), E.destroy(), l.destroy(), p.parentElement && p.parentElement.removeChild(p), o && (o.style.display = "none"), t.dataset.vpPlaying = "", i && (i.style.display = ""), s && (s.style.display = "");
    }
  };
}
function pe(t, e) {
  if (t.dataset.vpInit === "1") return null;
  const n = t.getAttribute("data-vimeo-url") || t.getAttribute("data-video-url") || t.getAttribute("data-youtube-url") || "", a = _(n);
  if (!a) return null;
  t.dataset.vpInit = "1", ce(t), oe(t, a);
  const c = t.getAttribute("data-consent") || "off", i = L(t, "data-autoplay", !1);
  function s() {
    return de(t, a, e);
  }
  if (c === "required" && !re(a.provider)) {
    let o = null;
    const f = ie(t, a.provider, () => {
      f(), o = s();
    });
    return {
      destroy() {
        f(), o == null || o.destroy();
      }
    };
  }
  if (i)
    return s();
  let p = null;
  t.style.cursor = "pointer";
  function l() {
    p = s();
  }
  return t.addEventListener("click", l, { once: !0 }), {
    destroy() {
      t.removeEventListener("click", l), p == null || p.destroy();
    }
  };
}
const fe = {
  muted: !1,
  loop: !1,
  playsinline: !0,
  showControls: !0,
  keyboardShortcuts: !0,
  autoHide: !0,
  idleTimeoutMs: 2500
}, me = "2026-05-09-hybrid-vimeo-pro-flag", ve = typeof window < "u" && window.__FLOW_PLAYER_CONFIG__ || {}, he = { ...fe, ...ve };
function O() {
  document.documentElement.setAttribute("data-flow-player-version", me);
  const t = document.querySelectorAll(".vp-slot[data-vimeo-url], .vp-slot[data-video-url], .vp-slot[data-youtube-url]");
  for (const e of t)
    pe(e, { defaults: he });
}
typeof document < "u" && (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", O) : O());
