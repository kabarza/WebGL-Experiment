<script lang="ts">
  import { Spring } from 'svelte/motion';

  export interface SegmentedControlOption<T extends string = string> {
    value: T;
    label: string;
  }

  let { options, value, onChange } = $props<{
    options: SegmentedControlOption[];
    value: string;
    onChange: (value: string) => void;
  }>();

  let containerRef: HTMLDivElement | undefined;
  const buttonRefs = new Map<string, HTMLButtonElement>();
  let pillReady = $state(false);
  let hasAnimated = false;

  const pillLeft = new Spring(0, { stiffness: 0.2, damping: 0.6 });
  const pillWidth = new Spring(0, { stiffness: 0.2, damping: 0.6 });

  const buttonRef = (node: HTMLButtonElement, key: string) => {
    buttonRefs.set(key, node);
    return {
      destroy() {
        buttonRefs.delete(key);
      },
    };
  };

  const measurePill = () => {
    const button = buttonRefs.get(value);
    if (!button || !containerRef) return null;
    const containerRect = containerRef.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    return {
      left: buttonRect.left - containerRect.left,
      width: buttonRect.width,
    };
  };

  const updatePill = (shouldAnimate: boolean) => {
    const next = measurePill();
    if (!next) return;

    if (!pillReady) {
      pillLeft.set(next.left, { instant: true });
      pillWidth.set(next.width, { instant: true });
      pillReady = true;
      return;
    }

    if (!shouldAnimate || !hasAnimated) {
      pillLeft.set(next.left, { instant: true });
      pillWidth.set(next.width, { instant: true });
      return;
    }

    pillLeft.set(next.left);
    pillWidth.set(next.width);
  };

  $effect(() => {
    value;
    if (!pillReady) return;
    updatePill(true);
  });

  $effect(() => {
    if (!containerRef || typeof ResizeObserver === 'undefined') return;

    requestAnimationFrame(() => {
      updatePill(false);
      hasAnimated = true;
    });

    const ro = new ResizeObserver(() => updatePill(false));
    ro.observe(containerRef);

    return () => {
      ro.disconnect();
    };
  });
</script>

<div bind:this={containerRef} class="dialkit-segmented">
  <div
    class="dialkit-segmented-pill"
    style:left={`${pillLeft.current}px`}
    style:width={`${pillWidth.current}px`}
    style:visibility={pillReady ? 'visible' : 'hidden'}
  />

  {#each options as option (option.value)}
    <button
      use:buttonRef={option.value}
      onclick={() => onChange(option.value)}
      class="dialkit-segmented-button"
      data-active={String(value === option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>
