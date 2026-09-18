// ============================================================
// StateBridge — single writer for all state-as-data-attributes on
// the slot wrapper. Both UI modes go through this so designers see
// the same `[data-state="playing"]`, `[data-volume="mute"]`, etc.
// regardless of whether the control bar is JS-rendered or built
// from Webflow tree elements.
//
// JS never sets classes on UI elements. Default CSS rules in the
// embed `<style>` block respond to these attributes; designer CSS
// in Webflow's Custom Code can override.
// ============================================================

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'ended';
export type VolumeLevel = 'mute' | 'mid' | 'full';

export interface StateSnapshot {
  state?: PlaybackState;
  volume?: VolumeLevel;
  fullscreen?: boolean;
  menuOpen?: boolean;
  controlsIdle?: boolean;
  vimeoTier?: string;
}

export function createStateBridge(slot: HTMLElement) {
  function setAttr(name: string, value: string | null): void {
    if (value === null) slot.removeAttribute(name);
    else slot.setAttribute(name, value);
  }

  return {
    /** Playback state — driving icon swaps, hover behavior, etc. */
    setState(s: PlaybackState): void {
      setAttr('data-state', s);
    },
    /**
     * Derived from `muted` + `volume`. Drives the 3-way mute icon
     * (full / mid / mute).
     */
    setVolume(volume: number, muted: boolean): VolumeLevel {
      const level: VolumeLevel = muted || volume === 0 ? 'mute' : volume < 0.5 ? 'mid' : 'full';
      setAttr('data-volume', level);
      return level;
    },
    setFullscreen(active: boolean): void {
      setAttr('data-fullscreen', active ? 'true' : null);
    },
    setMenuOpen(open: boolean): void {
      setAttr('data-menu-open', open ? 'true' : null);
    },
    setControlsIdle(idle: boolean): void {
      setAttr('data-controls-idle', idle ? 'true' : null);
    },
    /** Set by PosterLoader once oEmbed resolves. */
    setVimeoTier(tier: string | null): void {
      setAttr('data-vimeo-tier', tier);
    },
    /** Mark the slot as having been booted (so we don't re-init). */
    setInit(): void {
      setAttr('data-vp-init', '1');
    },
    /** Mark the slot as having started playing (iframe injected). */
    setPlaying(): void {
      setAttr('data-vp-playing', '1');
    },
    /** Read the current state. Useful for idle-hide / menu logic. */
    get state(): PlaybackState | null {
      return (slot.getAttribute('data-state') as PlaybackState | null) ?? null;
    },
    get menuOpen(): boolean {
      return slot.getAttribute('data-menu-open') === 'true';
    },
    get inited(): boolean {
      return slot.getAttribute('data-vp-init') === '1';
    },
    get playing(): boolean {
      return slot.getAttribute('data-vp-playing') === '1';
    },
  };
}

export type StateBridge = ReturnType<typeof createStateBridge>;
