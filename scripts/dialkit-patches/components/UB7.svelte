<script lang="ts">
  /**
   * UB7 — Number Line Tape
   * The background IS a scrolling ruler with tick marks.
   * Center hairline marks current value. Drag to scroll.
   * Shift+scroll wheel to zoom in/out (changes visible range = precision).
   * Regular scroll wheel nudges value. Gradient fades at edges.
   */
  import { tick } from 'svelte';

  let {
    label,
    value,
    onChange,
    step = 1,
  } = $props<{ label: string; value: number; onChange: (v: number) => void; step?: number }>();

  let rowRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;
  let isDragging = $state(false);
  let isHovered = $state(false);
  let isEditing = $state(false);
  let inputValue = $state('');
  let zoom = $state(100);

  const dec = (s: number) => { const t = s.toString(), d = t.indexOf('.'); return d === -1 ? 0 : t.length - d - 1; };
  const rnd = (v: number) => Number.parseFloat((Math.round(v / step) * step).toFixed(dec(step)));
  const display = $derived(value.toFixed(dec(step)));

  let dragStartX = 0;
  let dragStartVal = 0;

  const niceStep = (range: number) => {
    const raw = range / 8;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)));
    const r = raw / mag;
    return r <= 1.5 ? mag : r <= 3.5 ? 2 * mag : r <= 7.5 ? 5 * mag : 10 * mag;
  };

  const halfRange = $derived(zoom / 2);
  const tickSz = $derived(niceStep(zoom));

  const ticks = $derived.by(() => {
    const wMin = value - halfRange, wMax = value + halfRange;
    const out: { pct: number; major: boolean }[] = [];
    const start = Math.ceil(wMin / tickSz) * tickSz;
    for (let t = start; t <= wMax; t += tickSz) {
      const pct = ((t - wMin) / zoom) * 100;
      if (pct >= 0 && pct <= 100) {
        out.push({ pct, major: Math.abs(t % (tickSz * 5)) < tickSz * 0.01 });
      }
    }
    return out;
  });

  const onDown = (e: PointerEvent) => {
    if (isEditing) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDragging = true;
    dragStartX = e.clientX;
    dragStartVal = value;
  };

  const onMove = (e: PointerEvent) => {
    if (!isDragging || !rowRef) return;
    const dx = e.clientX - dragStartX;
    const w = rowRef.offsetWidth || 200;
    onChange(rnd(dragStartVal - (dx / w) * zoom));
  };

  const onUp = () => { isDragging = false; };

  const onWheel = (e: WheelEvent) => {
    if (isEditing) return;
    e.preventDefault();
    if (e.shiftKey) {
      zoom = Math.max(0.1, Math.min(100000, zoom * (e.deltaY > 0 ? 1.3 : 0.77)));
    } else {
      const dir = e.deltaY > 0 ? 1 : -1;
      onChange(rnd(value + step * dir * (e.altKey ? 0.1 : 1)));
    }
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

<div bind:this={rowRef}
  class="ub7" class:ub7--active={isDragging || isHovered}
  onpointerdown={onDown} onpointermove={onMove}
  onpointerup={onUp} onpointercancel={onUp}
  onmouseenter={() => isHovered = true} onmouseleave={() => isHovered = false}
  onwheel={onWheel}>

  <!-- Scrolling tick marks -->
  <div class="ub7__ticks">
    {#each ticks as t, i (i)}
      <div class="ub7__tick" class:ub7__tick--major={t.major}
        style:left={`${t.pct}%`} />
    {/each}
  </div>

  <!-- Center hairline -->
  <div class="ub7__hairline" />

  <!-- Edge fades -->
  <div class="ub7__fade ub7__fade--left" />
  <div class="ub7__fade ub7__fade--right" />

  <span class="ub7__label">{label}</span>

  {#if isEditing}
    <input bind:this={inputRef} type="text" class="ub7__input" value={inputValue}
      oninput={(e) => inputValue = (e.currentTarget as HTMLInputElement).value}
      onkeydown={(e) => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') isEditing = false; e.stopPropagation(); }}
      onblur={submit} onclick={(e) => e.stopPropagation()}
      onpointerdown={(e) => e.stopPropagation()} />
  {:else}
    <span class="ub7__value" onclick={edit} onpointerdown={(e) => e.stopPropagation()}>{display}</span>
  {/if}
</div>
