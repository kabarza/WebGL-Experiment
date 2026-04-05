<script lang="ts">
  /**
   * UB4 — Stepper Buttons
   * Three-segment layout: [ − ]  value  [ + ]
   * Tap buttons or hold to accelerate (2/sec → 30/sec).
   * Click center value to type. Shift=10×, Alt=0.1×.
   * Visually segmented — clear button boundaries.
   */
  import { tick } from 'svelte';

  let {
    label,
    value,
    onChange,
    step = 1,
  } = $props<{ label: string; value: number; onChange: (v: number) => void; step?: number }>();

  let inputRef: HTMLInputElement | undefined;
  let isEditing = $state(false);
  let inputValue = $state('');
  let activeDir = $state(0);

  const dec = (s: number) => { const t = s.toString(), d = t.indexOf('.'); return d === -1 ? 0 : t.length - d - 1; };
  const rnd = (v: number) => Number.parseFloat((Math.round(v / step) * step).toFixed(dec(step)));
  const display = $derived(value.toFixed(dec(step)));

  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let holdSpeed = 400;

  const nudge = (dir: number, e?: PointerEvent) => {
    const mult = e?.shiftKey ? 10 : e?.altKey ? 0.1 : 1;
    onChange(rnd(value + step * dir * mult));
  };

  const startHold = (dir: number, e: PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    activeDir = dir;
    nudge(dir, e);
    holdSpeed = 400;
    const loop = () => {
      nudge(dir);
      holdSpeed = Math.max(33, holdSpeed * 0.82);
      holdTimer = setTimeout(loop, holdSpeed);
    };
    holdTimer = setTimeout(loop, holdSpeed);
  };

  const stopHold = () => {
    activeDir = 0;
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  };

  const edit = (e: MouseEvent) => {
    e.stopPropagation();
    isEditing = true;
    inputValue = display;
    tick().then(() => { inputRef?.focus(); inputRef?.select(); });
  };

  const submit = () => {
    const p = Number.parseFloat(inputValue);
    if (!Number.isNaN(p)) onChange(rnd(p));
    isEditing = false;
  };
</script>

<div class="ub4">
  <!-- Minus button -->
  <button class="ub4__btn ub4__btn--minus" class:ub4__btn--pressed={activeDir === -1}
    onpointerdown={(e) => startHold(-1, e)} onpointerup={stopHold}
    onpointerleave={stopHold} onpointercancel={stopHold}>
    <svg viewBox="0 0 14 14" fill="none">
      <line x1="4" y1="7" x2="10" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  </button>

  <!-- Center area -->
  <div class="ub4__center">
    <span class="ub4__label">{label}</span>
    {#if isEditing}
      <input bind:this={inputRef} type="text" class="ub4__input" value={inputValue}
        oninput={(e) => inputValue = (e.currentTarget as HTMLInputElement).value}
        onkeydown={(e) => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') isEditing = false; e.stopPropagation(); }}
        onblur={submit} onclick={(e) => e.stopPropagation()} />
    {:else}
      <span class="ub4__value" onclick={edit}>{display}</span>
    {/if}
  </div>

  <!-- Plus button -->
  <button class="ub4__btn ub4__btn--plus" class:ub4__btn--pressed={activeDir === 1}
    onpointerdown={(e) => startHold(1, e)} onpointerup={stopHold}
    onpointerleave={stopHold} onpointercancel={stopHold}>
    <svg viewBox="0 0 14 14" fill="none">
      <line x1="4" y1="7" x2="10" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      <line x1="7" y1="4" x2="7" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  </button>
</div>
