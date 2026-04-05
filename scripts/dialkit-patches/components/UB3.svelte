<script lang="ts">
  /**
   * UB3 — Velocity Pad
   * Press-and-displace: distance from origin = speed of value change.
   * Value continuously increases/decreases while held.
   * Animated flowing dots show direction and speed.
   * Release to stop. Like a jog wheel / analog stick.
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
  let inputValue = $state('');
  let displacement = $state(0);

  const dec = (s: number) => { const t = s.toString(), d = t.indexOf('.'); return d === -1 ? 0 : t.length - d - 1; };
  const rnd = (v: number) => Number.parseFloat((Math.round(v / step) * step).toFixed(dec(step)));
  const display = $derived(value.toFixed(dec(step)));

  let dragStartX = 0;
  let accumulator = 0;
  const SPEED_SCALE = 0.08;

  const onDown = (e: PointerEvent) => {
    if (isEditing) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDragging = true;
    dragStartX = e.clientX;
    displacement = 0;
    accumulator = value;
  };

  const onMove = (e: PointerEvent) => {
    if (!isDragging) return;
    displacement = e.clientX - dragStartX;
  };

  const onUp = () => { isDragging = false; displacement = 0; };

  // Continuous value update loop while dragging
  $effect(() => {
    if (!isDragging) return;
    let frameId: number;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const speed = displacement * Math.abs(displacement) * step * SPEED_SCALE * 0.01;
      accumulator += speed * dt * 60;
      onChange(rnd(accumulator));
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  });

  const edit = (e: MouseEvent) => {
    e.stopPropagation();
    isEditing = true;
    inputValue = display;
    tick().then(() => { inputRef?.focus(); inputRef?.select(); });
  };

  const submit = () => {
    const p = Number.parseFloat(inputValue);
    if (!Number.isNaN(p)) { onChange(rnd(p)); accumulator = p; }
    isEditing = false;
  };

  const dir = $derived(displacement > 4 ? 1 : displacement < -4 ? -1 : 0);
  const intensity = $derived(Math.min(Math.abs(displacement) / 50, 1));
  // Dot flow offset for animation
  const dotPhase = $derived(dir * intensity * 20);
</script>

<div class="ub3" class:ub3--active={isHovered} class:ub3--dragging={isDragging}
  onpointerdown={onDown} onpointermove={onMove}
  onpointerup={onUp} onpointercancel={onUp}
  onmouseenter={() => isHovered = true} onmouseleave={() => isHovered = false}>

  <!-- Flow dots layer -->
  <div class="ub3__flow" style:opacity={isDragging ? intensity * 0.6 : 0}>
    <div class="ub3__dots" style:transform={`translateX(${dotPhase}px)`}>
      {#each Array(15) as _, i}
        <div class="ub3__dot" />
      {/each}
    </div>
  </div>

  <!-- Origin marker -->
  {#if isDragging}
    <div class="ub3__origin" />
  {/if}

  <span class="ub3__label">{label}</span>

  {#if isEditing}
    <input bind:this={inputRef} type="text" class="ub3__input" value={inputValue}
      oninput={(e) => inputValue = (e.currentTarget as HTMLInputElement).value}
      onkeydown={(e) => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') isEditing = false; e.stopPropagation(); }}
      onblur={submit} onclick={(e) => e.stopPropagation()}
      onpointerdown={(e) => e.stopPropagation()} />
  {:else}
    <span class="ub3__value" onclick={edit} onpointerdown={(e) => e.stopPropagation()}>{display}</span>
  {/if}
</div>
