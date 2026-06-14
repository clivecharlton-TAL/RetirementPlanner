<script lang="ts">
  export let label: string;
  export let value: number;
  export let min: number;
  export let max: number;
  export let step: number;
  export let format: 'currency' | 'percent' | 'integer' = 'integer';

  function displayValue(v: number): string {
    if (format === 'currency') return Math.round(v).toLocaleString('en-ZA');
    if (format === 'percent') return (v * 100).toFixed(1);
    return String(Math.round(v));
  }

  function parseInput(raw: string): number {
    const cleaned = raw.replace(/[^0-9.\-]/g, '');
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return value;
    const clamped = Math.min(max, Math.max(min, parsed));
    if (format === 'percent') return clamped / 100;
    return clamped;
  }

  let inputStr = displayValue(value);
  let editing = false;

  $: if (!editing) inputStr = displayValue(value);

  function onFieldFocus() {
    editing = true;
    inputStr = displayValue(value);
  }

  function onFieldBlur(e: Event) {
    editing = false;
    value = parseInput((e.target as HTMLInputElement).value);
    inputStr = displayValue(value);
  }

  function onFieldKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  }

  function sliderValue(v: number): number {
    return format === 'percent' ? v * 100 : v;
  }

  function fromSlider(v: number): number {
    return format === 'percent' ? v / 100 : v;
  }
</script>

<div class="input-row">
  <span class="label">{label}</span>
  <div class="controls">
    <input
      class="slider"
      type="range"
      min={format === 'percent' ? min * 100 : min}
      max={format === 'percent' ? max * 100 : max}
      step={format === 'percent' ? step * 100 : step}
      value={sliderValue(value)}
      on:input={(e) => { value = fromSlider(parseFloat((e.target as HTMLInputElement).value)); }}
    />
    <div class="field-wrap">
      {#if format === 'currency'}<span class="prefix">R</span>{/if}
      <input
        class="field"
        class:has-prefix={format === 'currency'}
        class:has-suffix={format === 'percent'}
        type="text"
        inputmode="decimal"
        value={inputStr}
        on:focus={onFieldFocus}
        on:blur={onFieldBlur}
        on:keydown={onFieldKeydown}
        on:input={(e) => { inputStr = (e.target as HTMLInputElement).value; }}
      />
      {#if format === 'percent'}<span class="suffix">%</span>{/if}
    </div>
  </div>
</div>

<style>
  .input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0;
  }

  .label {
    flex: 0 0 148px;
    font-size: 0.78rem;
    color: var(--ink);
    line-height: 1.3;
  }

  .controls {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .slider {
    flex: 1;
    -webkit-appearance: none;
    height: 3px;
    background: var(--border);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
    min-width: 0;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    border: 2px solid var(--surface);
    box-shadow: 0 0 0 1px var(--accent);
  }

  .slider:focus::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px var(--accent-light);
  }

  .field-wrap {
    position: relative;
    flex: 0 0 88px;
  }

  .prefix, .suffix {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--gray);
    pointer-events: none;
    z-index: 1;
  }

  .prefix { left: 5px; }
  .suffix { right: 5px; }

  .field {
    width: 100%;
    padding: 3px 5px;
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    text-align: right;
    outline: none;
  }

  .field.has-prefix { padding-left: 14px; }
  .field.has-suffix { padding-right: 18px; }

  .field:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-light);
  }
</style>
