<script lang="ts">
  /**
   * UB8 — Magnetic Scrub (After Effects-style)
   * Ultra-minimal. No background box at rest. Just text.
   * The value text IS the drag target (underline on hover, ew-resize cursor).
   * Sensitivity auto-scales to value magnitude.
   * Click (without drag) → type. Shift=10×, Alt=0.1×.
   */
  import { tick } from 'svelte';

  let {
    label,
    value,
    onChange,
    step = 1,
  } = $props<{ label: string; value: number; onChange: (v: number) => void; step?: number }>();

  let inputRef: HTMLInputElement | undefined;
  let isDragging = $state(false);
  let isHovered = $state(false);
  let isEditing = $state(false);
  let isValHovered = $state(false);
  let inputValue = $state('');

  const dec = (s: number) => { const t = s.toString(), d = t.indexOf('.'); return d === -1 ? 0 : t.length - d - 1; };
  const rnd = (v: number) => Number.parseFloat((Math.round(v / step) * step).toFixed(dec(step)));
  const display = $derived(value.toFixed(dec(step)));

  let startX = 0;
  let startVal = 0;
  let isClick = true;

  const autoScale = (v: number) => {
    const a = Math.abs(v);
    if (a === 0) return step;
    return Math.max(step, Math.pow(10, Math.floor(Math.log10(a)) - 1));
  };

  const onValDown = (e: PointerEvent) => {
    if (isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startX = e.clientX;
    startVal = value;
    isClick = true;
  };

  const onValMove = (e: PointerEvent) => {
    if (isClick && Math.abs(e.clientX - startX) > 3) {
      isClick = false;
      isDragging = true;
    }
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
    onChange(rnd(startVal + dx * autoScale(startVal) * mult));
  };

  const onValUp = () => {
    if (isClick) {
      isEditing = true;
      inputValue = display;
      tick().then(() => { inputRef?.focus(); inputRef?.select(); });
    }
    isDragging = false;
    isClick = false;
  };

  const submit = () => {
    const p = Number.parseFloat(inputValue);
    if (!Number.isNaN(p)) onChange(rnd(p));
    isEditing = false;
  };
</script>

<div class="ub8" class:ub8--dragging={isDragging}
  onmouseenter={() => isHovered = true} onmouseleave={() => isHovered = false}>

  <span class="ub8__label">{label}</span>

  {#if isEditing}
    <input bind:this={inputRef} type="text" class="ub8__input" value={inputValue}
      oninput={(e) => inputValue = (e.currentTarget as HTMLInputElement).value}
      onkeydown={(e) => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') isEditing = false; e.stopPropagation(); }}
      onblur={submit} onclick={(e) => e.stopPropagation()} />
  {:else}
    <span class="ub8__value"
      class:ub8__value--hover={isValHovered}
      class:ub8__value--dragging={isDragging}
      onmouseenter={() => isValHovered = true}
      onmouseleave={() => isValHovered = false}
      onpointerdown={onValDown} onpointermove={onValMove}
      onpointerup={onValUp} onpointercancel={() => { isDragging = false; isClick = false; }}>
      {display}
    </span>
  {/if}
</div>
