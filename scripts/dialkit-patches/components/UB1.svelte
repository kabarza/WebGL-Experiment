<script lang="ts">
  /**
   * UB1 — Label Drag
   * The label text IS the drag handle (cursor: ew-resize).
   * Value sits on the right. Pointer-lock for infinite drag.
   * Shift=10×, Alt=0.1×. Click value to type.
   * Visual: no track, no fill, no handle. The empty space IS the design.
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
  let isDragging = $state(false);
  let isHovered = $state(false);
  let inputValue = $state('');

  const dec = (s: number) => { const t = s.toString(), d = t.indexOf('.'); return d === -1 ? 0 : t.length - d - 1; };
  const rnd = (v: number) => Number.parseFloat((Math.round(v / step) * step).toFixed(dec(step)));
  const display = $derived(value.toFixed(dec(step)));

  let startVal = 0;
  let accDx = 0;

  const onLabelDown = (e: PointerEvent) => {
    if (isEditing) return;
    e.preventDefault();
    isDragging = true;
    startVal = value;
    accDx = 0;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    el.requestPointerLock?.();
  };

  const onLabelMove = (e: PointerEvent) => {
    if (!isDragging) return;
    const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
    accDx += e.movementX;
    onChange(rnd(startVal + accDx * step * mult));
  };

  const onLabelUp = () => {
    if (!isDragging) return;
    isDragging = false;
    document.exitPointerLock?.();
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

<div class="ub1" class:ub1--active={isDragging || isHovered}
  onmouseenter={() => isHovered = true} onmouseleave={() => isHovered = false}>

  <span class="ub1__label"
    onpointerdown={onLabelDown} onpointermove={onLabelMove}
    onpointerup={onLabelUp} onpointercancel={onLabelUp}>
    <svg class="ub1__arrows" viewBox="0 0 16 10" fill="none">
      <polyline points="4,1 1,5 4,9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
      <polyline points="12,1 15,5 12,9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    {label}
  </span>

  {#if isEditing}
    <input bind:this={inputRef} type="text" class="ub1__input" value={inputValue}
      oninput={(e) => inputValue = (e.currentTarget as HTMLInputElement).value}
      onkeydown={(e) => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') isEditing = false; e.stopPropagation(); }}
      onblur={submit} onclick={(e) => e.stopPropagation()} />
  {:else}
    <span class="ub1__value" onclick={edit}>{display}</span>
  {/if}
</div>
