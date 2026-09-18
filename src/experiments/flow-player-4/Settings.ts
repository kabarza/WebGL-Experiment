// ============================================================
// Settings menu — speed only.
//
// V4 dropped captions and Picture-in-Picture (v3 carried them but
// designers rarely used the result, and they added DOM complexity
// that fought with Webflow's data model in mode 2).
//
// Mode-agnostic: in JS mode the trigger + menu are both built by
// createSettingsDom(); in Webflow mode the host supplies the
// trigger and menu container as tree nodes, and we just append
// speed items into the menu container.
//
// Note: trigger is a div[role=button], NOT a <button>. The v3
// version used <button>, which Webflow's data model rewrote into
// a Block node with a tag override — one of the corruption
// contributors.
// ============================================================

import type { Provider } from './providers/types.ts';
import { ICONS } from './icons.ts';
import type { StateBridge } from './StateBridge.ts';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export interface SettingsElements {
  wrap: HTMLElement;
  trigger: HTMLElement;
  menu: HTMLElement;
}

export function createSettingsDom(): SettingsElements {
  const wrap = document.createElement('div');
  wrap.className = 'vp-settings';

  const trigger = document.createElement('div');
  trigger.className = 'vp-control vp-btn-settings';
  trigger.setAttribute('role', 'button');
  trigger.setAttribute('tabindex', '0');
  trigger.setAttribute('aria-label', 'Settings');
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('data-tooltip', 'Settings');
  trigger.setAttribute('data-vp', 'settings');
  trigger.innerHTML = ICONS.settings;
  wrap.appendChild(trigger);

  const menu = document.createElement('div');
  menu.className = 'vp-settings-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Settings');
  menu.hidden = true;
  wrap.appendChild(menu);

  return { wrap, trigger, menu };
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

function buildItem(label: string, checked: boolean): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'vp-settings-item';
  item.setAttribute('role', 'menuitemradio');
  item.setAttribute('tabindex', '-1');
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

export function bindSettings(
  els: SettingsElements,
  provider: Provider,
  state: StateBridge,
): () => void {
  const { trigger, menu } = els;

  // ── Speed ──
  const speedSection = buildSection('Speed');
  const speedList = document.createElement('div');
  speedList.className = 'vp-settings-list';
  speedSection.appendChild(speedList);

  const speedItems: HTMLDivElement[] = [];
  for (const speed of SPEEDS) {
    const item = buildItem(speed === 1 ? 'Normal' : `${speed}×`, speed === 1);
    item.dataset.speed = String(speed);
    item.addEventListener('click', () => {
      provider.setPlaybackRate(speed);
      updateSpeedChecks(speed);
      close();
      trigger.focus();
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.click();
      }
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

  // ── Open / close ──
  let isOpen = false;
  function open(): void {
    if (isOpen) return;
    isOpen = true;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    state.setMenuOpen(true);
    document.addEventListener('click', handleDocClick, true);
    document.addEventListener('keydown', handleEsc);
    menu.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }
  function close(): void {
    if (!isOpen) return;
    isOpen = false;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    state.setMenuOpen(false);
    document.removeEventListener('click', handleDocClick, true);
    document.removeEventListener('keydown', handleEsc);
  }
  function handleDocClick(e: MouseEvent): void {
    if (!els.wrap.contains(e.target as Node)) close();
  }
  function handleEsc(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      trigger.focus();
    }
  }

  function onTriggerActivate(): void {
    if (isOpen) close();
    else open();
  }
  trigger.addEventListener('click', onTriggerActivate);
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTriggerActivate();
    }
  });

  const offRate = provider.on('ratechange', () => {
    updateSpeedChecks(provider.state.playbackRate);
  });

  return () => {
    offRate();
    close();
  };
}
