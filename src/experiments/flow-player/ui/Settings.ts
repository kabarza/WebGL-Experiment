// ============================================================
// Settings menu — popup with playback speed selection and (when
// the provider exposes them) caption tracks. Triggered by the
// gear icon in the control bar.
//
// Plyr's pattern: role="menu" with role="menuitemradio" buttons,
// Escape + click-outside to close, focus returns to trigger.
// ============================================================

import type { Provider } from '../providers/types.ts';
import { ICONS } from '../icons.ts';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

interface SettingsHandles {
  trigger: HTMLButtonElement;
  menu: HTMLDivElement;
  destroy: () => void;
}

function buildSection(title: string): HTMLDivElement {
  const section = document.createElement('div');
  section.className = 'vp-settings-section';
  const heading = document.createElement('div');
  heading.className = 'vp-settings-heading';
  heading.textContent = title;
  section.appendChild(heading);
  return section;
}

function buildItem(label: string, checked: boolean): HTMLButtonElement {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'vp-settings-item';
  item.setAttribute('role', 'menuitemradio');
  item.setAttribute('aria-checked', checked ? 'true' : 'false');

  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  item.appendChild(labelEl);

  const check = document.createElement('span');
  check.className = 'vp-settings-check';
  check.innerHTML = ICONS.check;
  item.appendChild(check);

  return item;
}

export function createSettings(provider: Provider): SettingsHandles {
  const wrap = document.createElement('div');
  wrap.className = 'vp-settings';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'vp-control vp-settings-btn';
  trigger.setAttribute('aria-label', 'Settings');
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('data-tooltip', 'Settings');
  trigger.innerHTML = ICONS.settings;
  wrap.appendChild(trigger);

  const menu = document.createElement('div');
  menu.className = 'vp-settings-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Settings');
  menu.hidden = true;
  wrap.appendChild(menu);

  // ── Speed section ──
  const speedSection = buildSection('Speed');
  const speedList = document.createElement('div');
  speedList.className = 'vp-settings-list';
  speedSection.appendChild(speedList);

  const speedItems: HTMLButtonElement[] = [];
  for (const speed of SPEEDS) {
    const item = buildItem(speed === 1 ? 'Normal' : `${speed}×`, speed === 1);
    item.dataset.speed = String(speed);
    item.addEventListener('click', () => {
      provider.setPlaybackRate(speed);
      updateSpeedChecks(speed);
      close();
      trigger.focus();
    });
    speedList.appendChild(item);
    speedItems.push(item);
  }
  menu.appendChild(speedSection);

  function updateSpeedChecks(rate: number): void {
    for (const item of speedItems) {
      const itemSpeed = Number(item.dataset.speed);
      const matches = Math.abs(itemSpeed - rate) < 0.01;
      item.setAttribute('aria-checked', matches ? 'true' : 'false');
    }
  }

  // ── Captions section (added only when tracks are available) ──
  let captionsSection: HTMLDivElement | null = null;
  let captionsItems: HTMLButtonElement[] = [];

  function rebuildCaptionsSection(): void {
    const tracks = provider.getTextTracks();
    if (!tracks.length) {
      if (captionsSection) {
        captionsSection.remove();
        captionsSection = null;
        captionsItems = [];
      }
      return;
    }
    if (!captionsSection) {
      captionsSection = buildSection('Captions');
      const list = document.createElement('div');
      list.className = 'vp-settings-list';
      captionsSection.appendChild(list);

      const offItem = buildItem('Off', provider.getActiveTextTrack() === null);
      offItem.dataset.trackId = '';
      offItem.addEventListener('click', () => {
        provider.setTextTrack(null);
        updateCaptionsChecks(null);
        close();
        trigger.focus();
      });
      list.appendChild(offItem);
      captionsItems.push(offItem);

      for (const track of tracks) {
        const item = buildItem(
          track.label,
          provider.getActiveTextTrack() === track.id,
        );
        item.dataset.trackId = track.id;
        item.addEventListener('click', () => {
          provider.setTextTrack(track.id);
          updateCaptionsChecks(track.id);
          close();
          trigger.focus();
        });
        list.appendChild(item);
        captionsItems.push(item);
      }
      menu.appendChild(captionsSection);
    }
  }

  function updateCaptionsChecks(activeId: string | null): void {
    for (const item of captionsItems) {
      const id = item.dataset.trackId || null;
      item.setAttribute('aria-checked', id === activeId ? 'true' : 'false');
    }
  }

  // ── Open / close ──
  let isOpen = false;
  function open(): void {
    if (isOpen) return;
    isOpen = true;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', handleDocClick, true);
    document.addEventListener('keydown', handleEsc);
    const checked = menu.querySelector<HTMLButtonElement>('[aria-checked="true"]');
    checked?.focus();
  }
  function close(): void {
    if (!isOpen) return;
    isOpen = false;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', handleDocClick, true);
    document.removeEventListener('keydown', handleEsc);
  }
  function handleDocClick(e: MouseEvent): void {
    if (!wrap.contains(e.target as Node)) close();
  }
  function handleEsc(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      trigger.focus();
    }
  }

  trigger.addEventListener('click', () => (isOpen ? close() : open()));

  const offRate = provider.on('ratechange', () => {
    updateSpeedChecks(provider.state.playbackRate);
  });
  const offTracks = provider.on('tracks', () => {
    rebuildCaptionsSection();
  });

  return {
    trigger,
    menu: wrap as unknown as HTMLDivElement,
    destroy: () => {
      offRate();
      offTracks();
      close();
    },
  };
}

export const SETTINGS_SPEEDS = SPEEDS;
