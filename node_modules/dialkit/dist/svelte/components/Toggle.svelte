<script lang="ts">
  import SegmentedControl from './SegmentedControl.svelte';

  let { label, checked, onChange } = $props<{
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }>();
</script>

<div class="dialkit-labeled-control">
  <span class="dialkit-labeled-control-label">{label}</span>
  <SegmentedControl
    options={[
      { value: 'off', label: 'Off' },
      { value: 'on', label: 'On' },
    ]}
    value={checked ? 'on' : 'off'}
    onChange={(val) => onChange(val === 'on')}
  />
</div>
