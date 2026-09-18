// ============================================================
// GDPR / privacy consent gate. When the slot has data-consent="required",
// the iframe doesn't load until the visitor explicitly accepts.
//
// Acceptance is stored in localStorage under a per-provider key, so a
// repeat visitor sees the gate at most once per provider per browser.
// Site owners can revoke by deleting the key — no UI for that here;
// they wire one up themselves with a custom button if they want.
//
// We progressively enhance: if the slot already has a `.vp-consent`
// element in the Webflow tree, we use it (the user can edit copy
// and styling). If not, we create a default one.
// ============================================================

import type { ProviderName } from '../helpers.ts';

const STORAGE_PREFIX = 'flow-player:consent:';

export function isConsented(provider: ProviderName): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + provider) === '1';
  } catch {
    return false;
  }
}

export function setConsented(provider: ProviderName): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + provider, '1');
  } catch {
    /* private browsing / disabled storage — accept lasts only this session */
  }
}

interface ConsentDefaults {
  vimeo: { title: string; body: string; accept: string };
  youtube: { title: string; body: string; accept: string };
}

const DEFAULTS: ConsentDefaults = {
  vimeo: {
    title: 'Load video from Vimeo',
    body:
      'Loading the player will send your IP address and browser information to Vimeo. They may set cookies and process this data according to their privacy policy.',
    accept: 'Accept and play',
  },
  youtube: {
    title: 'Load video from YouTube',
    body:
      'Loading the player will send your IP address and browser information to YouTube (Google). They may set cookies and process this data according to their privacy policy.',
    accept: 'Accept and play',
  },
};

/**
 * Show the consent gate over a slot, calling `onAccept` if the user
 * agrees. Returns a cleanup function that removes the overlay.
 */
export function showConsentGate(
  slot: HTMLElement,
  provider: ProviderName,
  onAccept: () => void,
): () => void {
  // Reuse a Webflow-tree consent element if present. The user may have
  // edited the copy, dropped in a logo, restyled the buttons.
  let el = slot.querySelector<HTMLElement>('.vp-consent');
  let acceptBtn = el?.querySelector<HTMLButtonElement>('.vp-consent-accept') ?? null;

  if (!el) {
    // Fallback: build one from defaults.
    el = document.createElement('div');
    el.className = 'vp-consent';

    const inner = document.createElement('div');
    inner.className = 'vp-consent-inner';

    const title = document.createElement('div');
    title.className = 'vp-consent-title';
    title.textContent = DEFAULTS[provider].title;

    const body = document.createElement('div');
    body.className = 'vp-consent-body';
    body.textContent = DEFAULTS[provider].body;

    acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'vp-consent-accept';
    acceptBtn.textContent = DEFAULTS[provider].accept;

    inner.appendChild(title);
    inner.appendChild(body);
    inner.appendChild(acceptBtn);
    el.appendChild(inner);
    slot.appendChild(el);
  }

  // The class ships with `display: none` by default — opt in here.
  el.style.display = 'flex';
  el.hidden = false;

  function handleAccept(): void {
    setConsented(provider);
    onAccept();
  }

  acceptBtn?.addEventListener('click', handleAccept);

  return () => {
    acceptBtn?.removeEventListener('click', handleAccept);
    if (el) {
      el.style.display = 'none';
      el.hidden = true;
    }
  };
}
