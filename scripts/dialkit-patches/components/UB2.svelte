<script lang="ts">
  /**
   * UB2 — Spring Return Handle
   * A fat pill-shaped handle at the center. Grab it, drag left/right.
   * Quadratic acceleration: further from center = faster change.
   * Release → handle springs back to center, value stays.
   * Flick repeatedly for large changes.
   */
  import { tick } from 'svelte';
  import { Spring } from 'svelte/motion';

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

  const handlePos = new Spring(0, { stiffness: 0.15, damping: 0.55 });

  const dec = (s: number) => { const t = s.toString(), d = t.indexOf('.'); return d === -1 ? 0 : t.length - d - 1; };
  const rnd = (v: number) => Number.parseFloat((Math.round(v / step) * step).toFixed(dec(step)));
  const display = $derived(value.toFixed(dec(step)));

  let startVal = 0;
  let centerX = 0;
  let halfW = 100;

  const onDown = (e: PointerEvent) => {
    if (isEditing) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDragging = true;
    startVal = value;
    if (rowRef) {
      const r = rowRef.getBoundingClientRect();
      centerX = r.left + r.width / 2;
      halfW = r.width / 2;
    }
  };

  const onMove = (e: PointerEvent) => {
    if (!isDragging) return;
    const offset = e.clientX - centerX;
    const clamped = Math.max(-halfW, Math.min(halfW, offset));
    handlePos.set(clamped, { instant: true });

    // Quadratic acceleration
    const norm = clamped / halfW;
    const accel = Math.sign(norm) * Math.pow(Math.abs(norm), 2);
    const maxDelta = step * halfW * 0.5;
    onChange(rnd(startVal + accel * maxDelta));
  };

  const onUp = () => {
    if (!isDragging) return;
    isDragging = false;
    handlePos.set(0); // spring back
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

  const handleOp = $derived(isDragging ? 0.95 : isHovered ? 0.45 : 0.3);

  // Symmetric dots radiating from center
  const dots = [-0.7, -0.5, -0.3, -0.15, 0.15, 0.3, 0.5, 0.7];
</script>

<div bind:this={rowRef} class="ub2" class:ub2--active={isDragging || isHovered}
  onpointerdown={onDown} onpointermove={onMove}
  onpointerup={onUp} onpointercancel={onUp}
  onmouseenter={() => isHovered = true} onmouseleave={() => isHovered = false}>

  <!-- Center notch -->
  <div class="ub2__notch" />

  <!-- Symmetric dots -->
  {#each dots as d, i (i)}
    <div class="ub2__dot" style:left={`${50 + d * 50}%`} />
  {/each}

  <!-- Spring handle -->
  <div class="ub2__handle"
    style:transform={`translate(${handlePos.current}px, -50%)`}
    style:opacity={handleOp} />

  <!-- Label (top-left, smaller) -->
  <span class="ub2__label">{label}</span>

  <!-- Value (right side) -->
  {#if isEditing}
    <input bind:this={inputRef} type="text" class="ub2__input" value={inputValue}
      oninput={(e) => inputValue = (e.currentTarget as HTMLInputElement).value}
      onkeydown={(e) => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') isEditing = false; e.stopPropagation(); }}
      onblur={submit} onclick={(e) => e.stopPropagation()}
      onpointerdown={(e) => e.stopPropagation()} />
  {:else}
    <span class="ub2__value" onclick={edit}
      onpointerdown={(e) => e.stopPropagation()}>{display}</span>
  {/if}
</div>
