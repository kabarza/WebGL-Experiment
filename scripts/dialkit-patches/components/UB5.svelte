<script lang="ts">
  /**
   * UB5 — Value Ladder (Houdini-style)
   * At rest: label + value with a small grip indicator.
   * Long-press on value → floating popup with 5 magnitude rungs:
   *   100, 10, 1, 0.1, 0.01
   * Drag left/right at any rung. Move up/down to switch precision.
   * Short click → type. The popup is the star feature.
   */
  import { tick } from 'svelte';

  let {
    label,
    value,
    onChange,
    step = 1,
  } = $props<{ label: string; value: number; onChange: (v: number) => void; step?: number }>();

  let wrapRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;
  let isEditing = $state(false);
  let isHovered = $state(false);
  let inputValue = $state('');

  let ladderOpen = $state(false);
  let activeRung = $state(2);
  let ladderX = $state(0);
  let ladderY = $state(0);

  const RUNGS = [100, 10, 1, 0.1, 0.01];
  const RUNG_H = 30;
  const HOLD_MS = 280;

  const dec = (s: number) => { const t = s.toString(), d = t.indexOf('.'); return d === -1 ? 0 : t.length - d - 1; };
  const rnd = (v: number) => Number.parseFloat((Math.round(v / step) * step).toFixed(dec(step)));
  const display = $derived(value.toFixed(dec(step)));

  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startVal = 0;
  let ladderAnchorY = 0;

  const onValDown = (e: PointerEvent) => {
    if (isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startX = e.clientX;
    startVal = value;
    activeRung = 2;

    pressTimer = setTimeout(() => {
      pressTimer = null;
      ladderOpen = true;
      if (wrapRef) {
        const r = wrapRef.getBoundingClientRect();
        ladderX = r.right - 80;
        ladderY = r.top - RUNGS.length * RUNG_H - 8;
        ladderAnchorY = r.top - 8 - (RUNGS.length * RUNG_H) / 2;
      }
    }, HOLD_MS);
  };

  const onValMove = (e: PointerEvent) => {
    if (!ladderOpen) {
      if (pressTimer && Math.abs(e.clientX - startX) > 5) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      return;
    }
    // Vertical = rung selection
    const relY = e.clientY - ladderAnchorY;
    const idx = Math.floor(relY / RUNG_H);
    activeRung = Math.max(0, Math.min(RUNGS.length - 1, idx));

    // Horizontal = value change
    const dx = e.clientX - startX;
    onChange(rnd(startVal + dx * RUNGS[activeRung]));
  };

  const onValUp = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
      // Short press → edit
      isEditing = true;
      inputValue = display;
      tick().then(() => { inputRef?.focus(); inputRef?.select(); });
    }
    ladderOpen = false;
  };

  const submit = () => {
    const p = Number.parseFloat(inputValue);
    if (!Number.isNaN(p)) onChange(rnd(p));
    isEditing = false;
  };
</script>

<div bind:this={wrapRef} class="ub5" class:ub5--active={ladderOpen || isHovered}
  onmouseenter={() => isHovered = true} onmouseleave={() => isHovered = false}>

  <span class="ub5__label">{label}</span>

  <div class="ub5__right">
    {#if isEditing}
      <input bind:this={inputRef} type="text" class="ub5__input" value={inputValue}
        oninput={(e) => inputValue = (e.currentTarget as HTMLInputElement).value}
        onkeydown={(e) => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') isEditing = false; e.stopPropagation(); }}
        onblur={submit} onclick={(e) => e.stopPropagation()} />
    {:else}
      <span class="ub5__value"
        onpointerdown={onValDown} onpointermove={onValMove}
        onpointerup={onValUp} onpointercancel={() => { ladderOpen = false; if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } }}>
        {display}
      </span>
      <!-- Grip indicator -->
      <svg class="ub5__grip" viewBox="0 0 6 10" fill="none">
        <line x1="0" y1="2" x2="6" y2="2" stroke="currentColor" stroke-width="1" />
        <line x1="0" y1="5" x2="6" y2="5" stroke="currentColor" stroke-width="1" />
        <line x1="0" y1="8" x2="6" y2="8" stroke="currentColor" stroke-width="1" />
      </svg>
    {/if}
  </div>
</div>

{#if ladderOpen}
  <div class="ub5__ladder" style:left={`${ladderX}px`} style:top={`${ladderY}px`}>
    {#each RUNGS as rung, i}
      <div class="ub5__rung" class:ub5__rung--active={i === activeRung}>
        <span class="ub5__rung-mag">{rung >= 1 ? `±${rung}` : `±${rung}`}</span>
      </div>
    {/each}
  </div>
{/if}
