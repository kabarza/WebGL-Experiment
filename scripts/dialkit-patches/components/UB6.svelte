<script lang="ts">
  /**
   * UB6 — Vertical Speed Zones (Figma-inspired)
   * Drag horizontally to change value.
   * Move cursor UP = 10× speed, DOWN = 0.01× speed.
   * Four discrete zones. A floating badge shows the current multiplier.
   * The vertical axis is claimed for speed control.
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
  let speedMult = $state(1);
  let badgeY = $state(0);

  const ZONES = [
    { label: '×10', mult: 10 },
    { label: '×1', mult: 1 },
    { label: '×0.1', mult: 0.1 },
    { label: '×0.01', mult: 0.01 },
  ];

  const dec = (s: number) => { const t = s.toString(), d = t.indexOf('.'); return d === -1 ? 0 : t.length - d - 1; };
  const rnd = (v: number) => Number.parseFloat((Math.round(v / step) * step).toFixed(dec(step)));
  const display = $derived(value.toFixed(dec(step)));

  let startVal = 0;
  let accDx = 0;
  let rowTop = 0;
  let rowH = 36;

  const onDown = (e: PointerEvent) => {
    if (isEditing) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDragging = true;
    startVal = value;
    accDx = 0;
    speedMult = 1;
    if (rowRef) {
      const r = rowRef.getBoundingClientRect();
      rowTop = r.top;
      rowH = r.height;
    }
  };

  const onMove = (e: PointerEvent) => {
    if (!isDragging) return;

    // Vertical → speed zone
    const relY = e.clientY - rowTop;
    const zone = 50;
    if (relY < -zone) { speedMult = 10; badgeY = -zone; }
    else if (relY < rowH * 0.5) { speedMult = 1; badgeY = 0; }
    else if (relY < rowH + zone) { speedMult = 0.1; badgeY = rowH; }
    else { speedMult = 0.01; badgeY = rowH + zone; }

    accDx += e.movementX;
    onChange(rnd(startVal + accDx * step * speedMult));
  };

  const onUp = () => { isDragging = false; };

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

  const speedLabel = $derived(ZONES.find(z => z.mult === speedMult)?.label ?? '×1');
</script>

<div bind:this={rowRef} class="ub6" class:ub6--active={isHovered} class:ub6--dragging={isDragging}
  onpointerdown={onDown} onpointermove={onMove}
  onpointerup={onUp} onpointercancel={onUp}
  onmouseenter={() => isHovered = true} onmouseleave={() => isHovered = false}>

  <!-- Speed badge -->
  {#if isDragging}
    <div class="ub6__badge">{speedLabel}</div>
  {/if}

  <!-- Zone lines (always visible as guide) -->
  <div class="ub6__zones">
    <div class="ub6__zone-line" style:top="0" />
    <div class="ub6__zone-line" style:bottom="0" />
  </div>

  <span class="ub6__label">{label}</span>

  {#if isEditing}
    <input bind:this={inputRef} type="text" class="ub6__input" value={inputValue}
      oninput={(e) => inputValue = (e.currentTarget as HTMLInputElement).value}
      onkeydown={(e) => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') isEditing = false; e.stopPropagation(); }}
      onblur={submit} onclick={(e) => e.stopPropagation()}
      onpointerdown={(e) => e.stopPropagation()} />
  {:else}
    <span class="ub6__value" onclick={edit} onpointerdown={(e) => e.stopPropagation()}>{display}</span>
  {/if}
</div>
