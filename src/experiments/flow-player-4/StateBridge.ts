// ============================================================
// StateBridge — single writer for state-as-data-attributes on the
// slot wrapper. Both UI modes (JS-rendered + Webflow-tree) go
// through this so designers see the same data-* hooks regardless
// of how the bar is built.
//
// JS never sets classes on UI elements. CSS reacts to data-*.
// ============================================================

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'ended';
export type VolumeLevel = 'mute' | 'mid' | 'full';

export function createStateBridge(slot: HTMLElement) {
  function setAttr(name: string, value: string | null): void {
    if (value === null) slot.removeAttribute(name);
    else slot.setAttribute(name, value);
  }

  return {
    setState(s: PlaybackState): void {
      setAttr('data-state', s);
    },
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
    setBuffering(active: boolean): void {
      setAttr('data-buffering', active ? 'true' : null);
    },
    /** Set by PosterLoader once Vimeo oEmbed resolves. Drives the
     *  auto-decision of whether to overlay our UI on top of theirs. */
    setVimeoTier(tier: string | null): void {
      setAttr('data-vimeo-tier', tier);
    },
    setInit(): void {
      setAttr('data-vp-init', '1');
    },
    setPlaying(): void {
      setAttr('data-vp-playing', '1');
    },
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
