// ============================================================
// Sfx — tiny synthesized sound engine for angry-slider-1.
// No audio assets: everything is oscillators + filtered noise.
// The AudioContext is created lazily on the first user gesture
// (pointerdown) so autoplay policies never block us.
// ============================================================

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  // Continuous "creak" voice while a thumb or rope is stretched
  private creakOsc: OscillatorNode | null = null;
  private creakGain: GainNode | null = null;
  private creakLfo: OscillatorNode | null = null;

  // Live settings, pushed from params every frame
  enabled = true;
  volume = 0.7;

  // Diagnostic counter (how many voices have been started)
  voices = 0;

  /** True once an AudioContext exists. */
  get contextReady(): boolean {
    return !!this.ctx;
  }

  /** Create / resume the AudioContext. Must be called from a user gesture. */
  ensure(): void {
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume * this.volume;
        this.master.connect(this.ctx.destination);

        // 1s of white noise, reused by every noise-based voice
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      // Audio is a nice-to-have; never let it break the experiment
      this.ctx = null;
    }
  }

  private ready(): boolean {
    return !!(this.enabled && this.ctx && this.master && this.ctx.state === 'running');
  }

  /** Push live volume from params. */
  setVolume(v: number): void {
    if (Math.abs(v - this.volume) < 0.001) return;
    this.volume = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.03);
    }
  }

  // ── Stretch creak ───────────────────────────────────────────

  startCreak(): void {
    if (!this.ready() || this.creakOsc) return;
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 70;

    // Slow vibrato makes it read as a strained rope rather than a beep
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 8.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 5;
    lfo.connect(lfoGain).connect(osc.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    osc.connect(filter).connect(gain).connect(this.master!);
    osc.start();
    lfo.start();

    this.creakOsc = osc;
    this.creakLfo = lfo;
    this.creakGain = gain;
    this.voices++;
  }

  /** ratio 0..1 — how far the stretch is. */
  updateCreak(ratio: number): void {
    if (!this.ctx || !this.creakOsc || !this.creakGain) return;
    const t = this.ctx.currentTime;
    this.creakOsc.frequency.setTargetAtTime(70 + ratio * 150, t, 0.04);
    this.creakGain.gain.setTargetAtTime(0.03 + ratio * 0.04, t, 0.05);
  }

  stopCreak(): void {
    if (!this.ctx || !this.creakOsc || !this.creakGain) return;
    const t = this.ctx.currentTime;
    this.creakGain.gain.setTargetAtTime(0, t, 0.03);
    const osc = this.creakOsc;
    const lfo = this.creakLfo;
    osc.stop(t + 0.15);
    lfo?.stop(t + 0.15);
    this.creakOsc = null;
    this.creakLfo = null;
    this.creakGain = null;
  }

  // ── One-shots ───────────────────────────────────────────────

  /** Airy release whoosh. power 0..1 scales loudness/brightness. */
  whoosh(power = 1): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(300 + 1400 * power, t);
    bp.frequency.exponentialRampToValueAtTime(220, t + 0.28);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14 * power, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    src.connect(bp).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + 0.35);
    this.voices++;
  }

  /** Springy "boing" for the rope launch. */
  boing(power = 1): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320 * power, t);
    osc.frequency.exponentialRampToValueAtTime(85, t + 0.2);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.25);
    this.voices++;
  }

  /** Wooden knock when a letter is hit. */
  knock(intensity = 1): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const i = Math.min(1, intensity);

    // Body: short pitch-dropping sine
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const f = 150 + Math.random() * 90;
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.22 * i, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(og).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.1);

    // Attack: tiny noise click
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.09 * i, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    src.connect(hp).connect(ng).connect(this.master!);
    src.start(t);
    src.stop(t + 0.05);
    this.voices++;
  }

  /** Low ground thud. intensity 0..1 from impact speed. */
  thud(intensity = 1): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const i = Math.min(1, intensity);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(85, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.3 * i, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(og).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.16);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.12 * i, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(lp).connect(ng).connect(this.master!);
    src.start(t);
    src.stop(t + 0.1);
    this.voices++;
  }

  /** Soft tick — value set / landing on the track. */
  tick(): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 820;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.035);
    this.voices++;
  }

  /** Soft smoke puff hiss. */
  puff(): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(250, t + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(lp).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + 0.25);
    this.voices++;
  }

  /**
   * Explosion — deliberately nothing like the plain landing thud: a
   * sub-bass drop, a wide noise burst and a sparse debris crackle, with
   * random pitch so no two blasts are identical.
   */
  boom(): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const detune = 0.85 + Math.random() * 0.3;

    // sub drop
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160 * detune, t);
    osc.frequency.exponentialRampToValueAtTime(26, t + 0.5);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.55, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(og).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.6);

    // burst
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(120, t + 0.45);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.4, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(bp).connect(ng).connect(this.master!);
    src.start(t);
    src.stop(t + 0.55);

    // debris crackle — sparse little pops after the main hit
    for (let i = 0; i < 5; i++) {
      const at = t + 0.09 + i * 0.06 + Math.random() * 0.03;
      const pop = ctx.createOscillator();
      pop.type = 'triangle';
      pop.frequency.value = (320 + Math.random() * 520) * detune;
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0.055, at);
      pg.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
      pop.connect(pg).connect(this.master!);
      pop.start(at);
      pop.stop(at + 0.08);
    }
    this.voices++;
  }

  dispose(): void {
    this.stopCreak();
    try {
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
    this.master = null;
  }
}
