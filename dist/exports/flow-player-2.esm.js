function se(e) {
  if (!e) return null;
  const u = e.trim();
  if (!u) return null;
  let a = u.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=|shorts\/|v\/))([\w-]{11})/i
  );
  return a ? { provider: "youtube", id: a[1] } : (a = u.match(/player\.vimeo\.com\/video\/(\d+)/i), a ? { provider: "vimeo", id: a[1] } : (a = u.match(/vimeo\.com\/(?:[^/]+\/)*(\d+)/i), a ? { provider: "vimeo", id: a[1] } : { provider: "native", src: u }));
}
function ue(e, u = {}) {
  if (e.provider === "vimeo") {
    const t = new URLSearchParams();
    return u.autoplay && t.set("autoplay", "1"), u.muted && t.set("muted", "1"), u.loop && t.set("loop", "1"), t.set("controls", "0"), t.set("playsinline", u.playsinline === !1 ? "0" : "1"), t.set("title", "0"), t.set("byline", "0"), t.set("portrait", "0"), t.set("dnt", "1"), `https://player.vimeo.com/video/${e.id}?${t.toString()}`;
  }
  const a = new URLSearchParams();
  return a.set("enablejsapi", "1"), u.origin && a.set("origin", u.origin), u.autoplay && a.set("autoplay", "1"), u.muted && a.set("mute", "1"), u.loop && (a.set("loop", "1"), a.set("playlist", e.id)), a.set("controls", "0"), a.set("playsinline", u.playsinline === !1 ? "0" : "1"), a.set("rel", "0"), a.set("modestbranding", "1"), `https://www.youtube-nocookie.com/embed/${e.id}?${a.toString()}`;
}
const le = [
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
function ce(e) {
  const u = /* @__PURE__ */ new Map(), a = {
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    muted: !1,
    paused: !0,
    playbackRate: 1
  };
  let t = null;
  const f = new Promise((s) => {
    t = s;
  });
  let b = !1, M = [], d = null;
  function g(s) {
    return `${s.language}-${s.kind}`;
  }
  function m(s, i) {
    if (!e.contentWindow) return;
    const n = { method: s };
    i !== void 0 && (n.value = i), e.contentWindow.postMessage(JSON.stringify(n), "*");
  }
  function y(s, i) {
    const n = u.get(s);
    if (n)
      for (const v of n)
        try {
          v(i);
        } catch {
        }
  }
  function P(s) {
    if (s.source !== e.contentWindow) return;
    let i;
    try {
      i = typeof s.data == "string" ? JSON.parse(s.data) : s.data;
    } catch {
      return;
    }
    if (i) {
      if (i.event === "ready" || i.method === "ping" && !b) {
        b = !0;
        for (const n of le) m("addEventListener", n);
        m("getDuration"), m("getVolume"), m("getMuted"), m("getPlaybackRate"), m("getTextTracks"), t == null || t(), y("ready");
        return;
      }
      switch (i.event) {
        case "play":
          a.paused = !1, y("play");
          break;
        case "pause":
          a.paused = !0, y("pause");
          break;
        case "ended":
          a.paused = !0, y("ended");
          break;
        case "timeupdate": {
          const n = i.data;
          (n == null ? void 0 : n.seconds) != null && (a.currentTime = n.seconds), (n == null ? void 0 : n.duration) != null && (a.duration = n.duration), y("timeupdate");
          break;
        }
        case "progress": {
          const n = i.data;
          (n == null ? void 0 : n.percent) != null && (a.buffered = n.percent), y("progress");
          break;
        }
        case "durationchange": {
          const n = i.data;
          (n == null ? void 0 : n.duration) != null && (a.duration = n.duration), y("durationchange");
          break;
        }
        case "volumechange": {
          const n = i.data;
          (n == null ? void 0 : n.volume) != null && (a.volume = n.volume), y("volumechange");
          break;
        }
        case "playbackratechange": {
          const n = i.data;
          (n == null ? void 0 : n.playbackRate) != null && (a.playbackRate = n.playbackRate), y("ratechange");
          break;
        }
        case "bufferstart":
          y("buffering");
          break;
        case "bufferend":
          y("playing");
          break;
        case "texttrackchange": {
          const n = i.data;
          d = n ? g(n) : null, y("volumechange");
          break;
        }
        case "error":
          y("error", i.data);
          break;
      }
      if (i.method === "getDuration" && typeof i.value == "number")
        a.duration = i.value, y("durationchange");
      else if (i.method === "getVolume" && typeof i.value == "number")
        a.volume = i.value, y("volumechange");
      else if (i.method === "getMuted" && typeof i.value == "boolean")
        a.muted = i.value, y("volumechange");
      else if (i.method === "getPlaybackRate" && typeof i.value == "number")
        a.playbackRate = i.value, y("ratechange");
      else if (i.method === "getTextTracks" && Array.isArray(i.value)) {
        M = i.value.filter(
          (v) => v.kind === "captions" || v.kind === "subtitles"
        );
        const n = M.find((v) => v.mode === "showing");
        d = n ? g(n) : null, y("tracks");
      }
    }
  }
  return window.addEventListener("message", P), {
    iframe: e,
    state: a,
    ready: () => f,
    play: () => m("play"),
    pause: () => m("pause"),
    seek: (s) => {
      a.currentTime = s, m("setCurrentTime", s);
    },
    setVolume: (s) => {
      a.volume = s, m("setVolume", s);
    },
    setMuted: (s) => {
      a.muted = s, m("setMuted", s);
    },
    setPlaybackRate: (s) => {
      a.playbackRate = s, m("setPlaybackRate", s);
    },
    requestPictureInPicture: async () => (m("requestPictureInPicture"), !0),
    getTextTracks: () => M.map(
      (s) => ({
        id: g(s),
        label: s.label || s.language,
        language: s.language,
        kind: s.kind === "captions" ? "captions" : "subtitles"
      })
    ),
    getActiveTextTrack: () => d,
    setTextTrack: (s) => {
      if (!s) {
        m("disableTextTrack"), d = null;
        return;
      }
      const i = M.find((n) => g(n) === s);
      i && (m("enableTextTrack", { language: i.language, kind: i.kind }), d = s);
    },
    on: (s, i) => {
      let n = u.get(s);
      return n || (n = /* @__PURE__ */ new Set(), u.set(s, n)), n.add(i), () => {
        n == null || n.delete(i);
      };
    },
    destroy: () => {
      window.removeEventListener("message", P), u.clear();
    }
  };
}
const N = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3
};
function de(e) {
  const u = /* @__PURE__ */ new Map(), a = {
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    muted: !1,
    paused: !0,
    playbackRate: 1
  };
  let t = null;
  const f = new Promise((n) => {
    t = n;
  });
  let b = null, M = [], d = null;
  function g(n, ...v) {
    if (!e.contentWindow) return;
    const c = { event: "command", func: n, args: v };
    e.contentWindow.postMessage(JSON.stringify(c), "*");
  }
  function m(n, v) {
    const c = u.get(n);
    if (c)
      for (const S of c)
        try {
          S(v);
        } catch {
        }
  }
  function y() {
    b || (b = setInterval(() => {
      g("getCurrentTime"), g("getVideoLoadedFraction");
    }, 250));
  }
  function P() {
    b && (clearInterval(b), b = null);
  }
  function s(n) {
    if (n.source !== e.contentWindow) return;
    let v;
    try {
      v = typeof n.data == "string" ? JSON.parse(n.data) : n.data;
    } catch {
      return;
    }
    if (v) {
      if (v.event === "onReady") {
        g("getDuration"), g("getVolume"), g("isMuted"), g("getPlaybackRate"), g("getOptions", "captions"), t == null || t(), m("ready");
        return;
      }
      if (v.event === "onApiChange") {
        g("getOption", "captions", "tracklist"), g("getOption", "captions", "track");
        return;
      }
      if (v.event === "onStateChange") {
        const c = v.info;
        c === N.PLAYING ? (a.paused = !1, y(), m("playing"), m("play")) : c === N.PAUSED ? (a.paused = !0, P(), m("pause")) : c === N.ENDED ? (a.paused = !0, P(), m("ended")) : c === N.BUFFERING && m("buffering");
        return;
      }
      if (v.event === "infoDelivery" && v.info) {
        const c = v.info;
        let S = !1;
        typeof c.currentTime == "number" && (a.currentTime = c.currentTime, S = !0), typeof c.duration == "number" && (a.duration = c.duration, m("durationchange")), typeof c.videoLoadedFraction == "number" && (a.buffered = c.videoLoadedFraction, m("progress")), typeof c.volume == "number" && (a.volume = c.volume / 100, m("volumechange")), typeof c.muted == "boolean" && (a.muted = c.muted, m("volumechange")), typeof c.playbackRate == "number" && (a.playbackRate = c.playbackRate, m("ratechange")), S && m("timeupdate");
        return;
      }
      if (v.event === "onError") {
        m("error", v.info);
        return;
      }
      if (v.event === "infoDelivery" && v.info) {
        const c = v.info;
        Array.isArray(c.tracklist) && (M = c.tracklist.filter((k) => !!k.languageCode).map(
          (k) => ({
            id: k.languageCode,
            label: k.displayName || k.languageName || k.languageCode,
            language: k.languageCode,
            kind: "captions"
          })
        ), m("tracks")), c.track && typeof c.track == "object" && (d = c.track.languageCode || null);
      }
    }
  }
  window.addEventListener("message", s);
  function i() {
    e.contentWindow && e.contentWindow.postMessage(
      JSON.stringify({ event: "listening", id: "flow-player" }),
      "*"
    );
  }
  return e.addEventListener("load", i, { once: !0 }), setTimeout(i, 500), {
    iframe: e,
    state: a,
    ready: () => f,
    play: () => g("playVideo"),
    pause: () => g("pauseVideo"),
    seek: (n) => {
      a.currentTime = n, g("seekTo", n, !0);
    },
    setVolume: (n) => {
      a.volume = n, g("setVolume", Math.round(n * 100));
    },
    setMuted: (n) => {
      a.muted = n, g(n ? "mute" : "unMute");
    },
    setPlaybackRate: (n) => {
      a.playbackRate = n, g("setPlaybackRate", n);
    },
    requestPictureInPicture: async () => !1,
    getTextTracks: () => M.slice(),
    getActiveTextTrack: () => d,
    setTextTrack: (n) => {
      if (!n) {
        g("unloadModule", "captions"), g("loadModule", "captions"), d = null;
        return;
      }
      g("setOption", "captions", "track", { languageCode: n }), d = n;
    },
    on: (n, v) => {
      let c = u.get(n);
      return c || (c = /* @__PURE__ */ new Set(), u.set(n, c)), c.add(v), () => {
        c == null || c.delete(v);
      };
    },
    destroy: () => {
      P(), window.removeEventListener("message", s), u.clear();
    }
  };
}
function fe(e, u) {
  return e === "vimeo" ? ce(u) : de(u);
}
function me(e) {
  const u = [];
  function a() {
    const t = e.duration;
    if (!Number.isFinite(t) || t <= 0) return 0;
    let f = 0;
    for (let b = 0; b < e.buffered.length; b++)
      f = Math.max(f, e.buffered.end(b));
    return Math.min(1, f / t);
  }
  return {
    element: e,
    get currentTime() {
      return e.currentTime;
    },
    get duration() {
      return Number.isFinite(e.duration) ? e.duration : 0;
    },
    get buffered() {
      return a();
    },
    get volume() {
      return e.volume;
    },
    get muted() {
      return e.muted;
    },
    get paused() {
      return e.paused;
    },
    get ended() {
      return e.ended;
    },
    get playbackRate() {
      return e.playbackRate;
    },
    play() {
      e.play().catch(() => {
      });
    },
    pause() {
      e.pause();
    },
    seek(t) {
      e.currentTime = t;
    },
    setVolume(t) {
      e.volume = Math.max(0, Math.min(1, t)), e.volume === 0 ? e.muted = !0 : e.muted && (e.muted = !1);
    },
    setMuted(t) {
      e.muted = t;
    },
    setPlaybackRate(t) {
      e.playbackRate = t;
    },
    on(t, f) {
      return e.addEventListener(t, f), () => e.removeEventListener(t, f);
    },
    destroy() {
      for (const t of u) t();
    }
  };
}
function pe(e, u = {}) {
  const a = document.createElement("iframe");
  a.allowFullscreen = !0, a.setAttribute(
    "allow",
    "autoplay; encrypted-media; fullscreen; picture-in-picture"
  ), a.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;display:block;", a.src = ue(e, {
    ...u,
    origin: typeof window < "u" ? window.location.origin : void 0
  });
  const t = fe(e.provider, a);
  return t.ready().then(() => {
    u.muted && t.setMuted(!0);
  }), {
    element: a,
    get currentTime() {
      return t.state.currentTime;
    },
    get duration() {
      return t.state.duration;
    },
    get buffered() {
      return t.state.buffered;
    },
    get volume() {
      return t.state.volume;
    },
    get muted() {
      return t.state.muted;
    },
    get paused() {
      return t.state.paused;
    },
    get ended() {
      return t.state.paused && t.state.currentTime >= t.state.duration && t.state.duration > 0;
    },
    get playbackRate() {
      return t.state.playbackRate;
    },
    play() {
      t.play();
    },
    pause() {
      t.pause();
    },
    seek(f) {
      t.seek(f);
    },
    setVolume(f) {
      t.setVolume(Math.max(0, Math.min(1, f)));
    },
    setMuted(f) {
      t.setMuted(f);
    },
    setPlaybackRate(f) {
      t.setPlaybackRate(f);
    },
    on(f, b) {
      return t.on(f, b);
    },
    destroy() {
      t.destroy(), a.parentElement && a.parentElement.removeChild(a);
    }
  };
}
const ve = {
  skipSeconds: 10,
  idleTimeoutMs: 2500
};
function Z(e) {
  if (!Number.isFinite(e) || e < 0) return "0:00";
  const u = Math.floor(e), a = Math.floor(u / 60), t = Math.floor(a / 60), f = t ? String(a % 60).padStart(2, "0") : String(a), b = String(u % 60).padStart(2, "0");
  return t ? `${t}:${f}:${b}` : `${f}:${b}`;
}
function H(e) {
  return e.muted || e.volume === 0 ? "mute" : e.volume < 0.5 ? "mid" : "full";
}
function ge(e, u = {}) {
  var z;
  if (e.dataset.fpInit === "1") return () => {
  };
  e.dataset.fpInit = "1";
  const a = { ...ve, ...u }, t = [], f = (r) => e.querySelector(r), b = (r) => Array.from(e.querySelectorAll(r)), M = f('[data-video="video"]');
  if (!M) return () => {
  };
  const d = M, g = (r, l) => {
    if (!l) return;
    const p = l.replace(/^#/, "").slice(0, 6);
    /^[0-9a-fA-F]{6}$/.test(p) ? e.style.setProperty(r, "#" + p) : (/^rgba?\(/.test(l) || /^[a-zA-Z]+$/.test(l)) && e.style.setProperty(r, l);
  };
  g("--fp-accent", e.getAttribute("data-accent")), g("--fp-track", e.getAttribute("data-track")), g("--fp-buffer", e.getAttribute("data-buffer"));
  const m = (r, l) => {
    const p = e.getAttribute(r);
    return p === null ? l : p === "" || p === "true" || p === "1";
  }, y = m("data-autoplay", !1), P = m("data-muted", !1), s = m("data-loop", !1), i = m("data-playsinline", !0), n = e.getAttribute("data-poster");
  if (n) {
    const r = f('[data-video="poster"] img');
    r && (r.src = n);
  }
  const v = e.getAttribute("data-src") || "", c = ((z = d.querySelector("source")) == null ? void 0 : z.getAttribute("src")) || "", k = se(v || c);
  if (!k)
    return delete e.dataset.fpInit, () => {
    };
  e.dataset.provider = k.provider;
  let o;
  if (k.provider === "native") {
    const r = d.querySelector("source");
    r && v && r.getAttribute("src") !== v && (r.setAttribute("src", v), d.load()), P && (d.muted = !0), s && (d.loop = !0), i && (d.playsInline = !0), o = me(d);
  } else {
    d.style.display = "none";
    const r = d.parentElement || e;
    o = pe(k, {
      autoplay: y,
      muted: P,
      loop: s,
      playsinline: i
    }), r.appendChild(o.element), t.push(() => {
      d.style.display = "";
    });
  }
  t.push(() => o.destroy());
  const V = (() => {
    const r = b("[data-video-quality]");
    return r.length === 0 ? null : r[0].closest(".fp-menu-section");
  })();
  k.provider !== "native" && V && (V.style.display = "none", t.push(() => {
    V.style.display = "";
  })), e.dataset.state = o.paused ? "paused" : "playing", e.dataset.menu = "closed", e.dataset.volume = H(o);
  function q() {
    o.ended ? e.dataset.state = "ended" : o.paused ? e.dataset.state = "paused" : e.dataset.state = "playing";
  }
  function $() {
    const r = o.duration, l = o.currentTime, p = r > 0 ? Math.min(1, l / r) : 0;
    e.style.setProperty("--fp-progress-frac", String(p));
    const T = f('[data-video="current-time"]');
    T && (T.textContent = Z(l));
  }
  function O() {
    const r = f('[data-video="duration"]');
    r && (r.textContent = Z(o.duration));
  }
  function U() {
    e.style.setProperty("--fp-buffer-frac", String(o.buffered));
  }
  function W() {
    e.dataset.volume = H(o);
    const r = f('[data-video="volume-slider"]'), l = o.muted ? 0 : Math.round(o.volume * 100);
    if (r) {
      const p = String(o.muted ? 0 : o.volume);
      r.value !== p && (r.value = p);
    }
    e.style.setProperty("--fp-volume", `${l}%`);
  }
  t.push(o.on("play", () => {
    e.dataset.played = "1", q(), a.idleTimeoutMs > 0 && Y();
  })), t.push(o.on("pause", () => {
    q(), D(), e.removeAttribute("data-idle");
  })), t.push(o.on("ended", () => {
    q(), D(), e.removeAttribute("data-idle");
  })), t.push(o.on("timeupdate", $)), t.push(o.on("durationchange", () => {
    O(), $();
  })), t.push(o.on("progress", U)), t.push(o.on("volumechange", W)), t.push(o.on("ratechange", () => {
  })), O(), $(), U(), W();
  function A(r, l) {
    const p = f(r);
    p && (p.addEventListener("click", l), t.push(() => p.removeEventListener("click", l)));
  }
  const Q = (r) => {
    r.preventDefault(), o.play();
  }, ee = (r) => {
    r.preventDefault(), o.pause();
  }, te = (r) => {
    r.preventDefault(), o.seek(0), o.play();
  }, ne = (r) => {
    r.preventDefault(), o.seek(Math.max(0, o.currentTime - a.skipSeconds));
  }, ae = (r) => {
    r.preventDefault();
    const l = o.duration;
    o.seek(l > 0 ? Math.min(l, o.currentTime + a.skipSeconds) : o.currentTime + a.skipSeconds);
  }, re = (r) => {
    r.preventDefault(), o.muted || o.volume === 0 ? (o.setMuted(!1), o.volume === 0 && o.setVolume(1)) : o.setMuted(!0);
  };
  if (A('[data-video="play"]', Q), A('[data-video="pause"]', ee), A('[data-video="replay"]', te), A('[data-video="back"]', ne), A('[data-video="forward"]', ae), A('[data-video="mute"]', re), A('[data-video="big-play"]', (r) => {
    r.preventDefault(), o.play();
  }), k.provider === "native") {
    const r = (l) => {
      l.target instanceof Element && (l.target.closest('[data-video="controls"]') || (o.paused ? o.play() : o.pause()));
    };
    d.addEventListener("click", r), t.push(() => d.removeEventListener("click", r));
  }
  const I = f('[data-video="volume-slider"]');
  if (I) {
    const r = () => {
      const l = Math.max(0, Math.min(1, parseFloat(I.value)));
      o.setVolume(l), l === 0 ? o.setMuted(!0) : o.muted && o.setMuted(!1);
    };
    I.addEventListener("input", r), t.push(() => I.removeEventListener("input", r));
  }
  const E = f('[data-video="track"]');
  if (E) {
    let r = !1;
    const l = (h) => {
      const R = E.getBoundingClientRect();
      if (R.width <= 0) return;
      const C = Math.max(0, Math.min(1, (h - R.left) / R.width)), F = o.duration;
      F > 0 && o.seek(C * F), e.style.setProperty("--fp-progress-frac", String(C));
    }, p = (h) => {
      r = !0, E.setPointerCapture(h.pointerId), l(h.clientX);
    }, T = (h) => {
      r && l(h.clientX);
    }, L = (h) => {
      if (r) {
        r = !1;
        try {
          E.releasePointerCapture(h.pointerId);
        } catch {
        }
      }
    };
    E.addEventListener("pointerdown", p), E.addEventListener("pointermove", T), E.addEventListener("pointerup", L), E.addEventListener("pointercancel", L), t.push(() => {
      E.removeEventListener("pointerdown", p), E.removeEventListener("pointermove", T), E.removeEventListener("pointerup", L), E.removeEventListener("pointercancel", L);
    });
  }
  const w = f('[data-video="menu-toggle"]');
  if (w) {
    const r = (p) => {
      p.preventDefault(), p.stopPropagation(), e.dataset.menu = e.dataset.menu === "open" ? "closed" : "open";
    };
    w.addEventListener("click", r), t.push(() => w.removeEventListener("click", r));
    const l = (p) => {
      p.target instanceof Node && (e.contains(p.target) || (e.dataset.menu = "closed"));
    };
    document.addEventListener("click", l), t.push(() => document.removeEventListener("click", l));
  }
  const _ = b("[data-video-speed]");
  for (const r of _) {
    const l = (p) => {
      p.preventDefault();
      const T = parseFloat(r.getAttribute("data-video-speed") || "1");
      if (Number.isFinite(T) && T > 0) {
        o.setPlaybackRate(T);
        for (const h of _)
          h.setAttribute("aria-checked", h === r ? "true" : "false");
        const L = f('[data-video="speed-text"]');
        L && (L.textContent = T === 1 ? "Normal" : `${T}x`);
      }
      e.dataset.menu = "closed";
    };
    r.addEventListener("click", l), t.push(() => r.removeEventListener("click", l)), Math.abs(parseFloat(r.getAttribute("data-video-speed") || "1") - 1) < 1e-6 && r.setAttribute("aria-checked", "true");
  }
  if (k.provider === "native") {
    const r = b("[data-video-quality]");
    for (const l of r) {
      const p = (T) => {
        T.preventDefault();
        const L = l.getAttribute("data-video-quality") || "", h = d.querySelector(
          `source[data-video-src-quality="${L}"]`
        );
        if (h) {
          const C = d.currentTime, F = !d.paused, oe = d.muted, ie = d.volume;
          d.src = h.getAttribute("src") || "", d.muted = oe, d.volume = ie;
          const X = () => {
            d.currentTime = C, F && d.play(), d.removeEventListener("loadedmetadata", X);
          };
          d.addEventListener("loadedmetadata", X);
        }
        for (const C of r)
          C.setAttribute("aria-checked", C === l ? "true" : "false");
        const R = f('[data-video="quality-text"]');
        R && (R.textContent = L), e.dataset.menu = "closed";
      };
      l.addEventListener("click", p), t.push(() => l.removeEventListener("click", p));
    }
  }
  function B() {
    return document.fullscreenElement === e;
  }
  const G = (r) => {
    var l;
    if (r.preventDefault(), B())
      document.exitFullscreen();
    else if (e.requestFullscreen)
      e.requestFullscreen();
    else if (k.provider === "native") {
      const p = d;
      (l = p.webkitEnterFullscreen) == null || l.call(p);
    }
  };
  A('[data-video="fullscreen"]', G), A('[data-video="minimize"]', G);
  const J = () => {
    B() ? e.dataset.fullscreen = "1" : e.removeAttribute("data-fullscreen");
  };
  document.addEventListener("fullscreenchange", J), t.push(() => document.removeEventListener("fullscreenchange", J));
  let x = null;
  function D() {
    x && (clearTimeout(x), x = null);
  }
  function Y() {
    D(), !(a.idleTimeoutMs <= 0) && (x = setTimeout(() => {
      o.paused || (e.dataset.idle = "1");
    }, a.idleTimeoutMs));
  }
  const j = () => {
    e.removeAttribute("data-idle"), o.paused || Y();
  };
  return e.addEventListener("pointermove", j), e.addEventListener("pointerleave", () => {
    !o.paused && a.idleTimeoutMs > 0 && (e.dataset.idle = "1");
  }), t.push(() => {
    e.removeEventListener("pointermove", j);
  }), y && o.play(), () => {
    D();
    for (const r of t) r();
    delete e.dataset.fpInit, delete e.dataset.played, delete e.dataset.idle, delete e.dataset.fullscreen, delete e.dataset.provider;
  };
}
function ye(e = {}) {
  const u = document.querySelectorAll(
    '.fp-wrapper, [data-video="wrapper"]'
  );
  for (const a of u) ge(a, e);
}
const be = typeof window < "u" && window.__FLOW_PLAYER_2_CONFIG__ || {};
function K() {
  ye(be);
}
typeof document < "u" && (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", K) : K());
