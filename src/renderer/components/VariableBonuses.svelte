<script lang="ts">
  export let enabled: boolean;
  export let rate: number;
  export let exclusions: number[];
  export let currentAge: number;
  export let retirementAge: number;
  export let annualIncome: number;
  export let inflationRate: number;
  export let marginalTaxRate: number;

  $: yearsWorking = Math.max(0, retirementAge - currentAge);

  $: rows = Array.from({ length: yearsWorking }, (_, y) => {
    const gross = annualIncome * Math.pow(1 + inflationRate, y) * rate;
    const tax   = gross * marginalTaxRate;
    const net   = gross - tax;
    return { y, age: currentAge + y, gross, tax, net };
  });

  // Summary totals only count included (checked) rows
  $: includedRows = rows.filter(r => !exclusions.includes(r.y));
  $: totalGross   = includedRows.reduce((s, r) => s + r.gross, 0);
  $: totalTax     = totalGross * marginalTaxRate;
  $: totalNet     = includedRows.reduce((s, r) => s + r.net,   0);

  function fmtR(v: number): string {
    return 'R' + Math.round(v).toLocaleString('en-ZA');
  }

  function onRateInput(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v)) rate = Math.min(1, Math.max(0, v / 100));
  }

  function onRateSlider(e: Event) {
    rate = parseFloat((e.target as HTMLInputElement).value) / 100;
  }

  function toggleYear(y: number) {
    if (exclusions.includes(y)) {
      exclusions = exclusions.filter(e => e !== y);
    } else {
      exclusions = [...exclusions, y];
    }
  }
</script>

<div class="vb-wrap">
  <!-- Toggle always interactive -->
  <label class="toggle-row">
    <input type="checkbox" class="toggle-input" bind:checked={enabled} />
    <span class="track"><span class="thumb"></span></span>
    <span class="toggle-label">{enabled ? 'Enabled' : 'Disabled'}</span>
  </label>

  <!-- Content greyed out when disabled -->
  <div class="vb-body" class:inactive={!enabled}>
    <!-- Rate slider -->
    <div class="rate-row">
      <span class="rate-label">Bonus % of salary</span>
      <div class="rate-controls">
        <input
          type="range"
          class="slider"
          min="0" max="100" step="1"
          value={rate * 100}
          disabled={!enabled}
          on:input={onRateSlider}
          on:wheel|preventDefault={(e) => {
            const panel = (e.currentTarget as HTMLElement).closest('.panel') as HTMLElement | null;
            if (panel) panel.scrollTop += (e as WheelEvent).deltaY;
          }}
        />
        <div class="field-wrap">
          <input
            type="text"
            class="field"
            value={(rate * 100).toFixed(0)}
            disabled={!enabled}
            on:change={onRateInput}
          />
          <span class="suffix">%</span>
        </div>
      </div>
    </div>

    {#if yearsWorking > 0}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="col-check" title="Invest this year's bonus into Unit Trust"></th>
              <th class="col-age">Age</th>
              <th class="num">Gross Bonus</th>
              <th class="num">Tax ({(marginalTaxRate * 100).toFixed(0)}%)</th>
              <th class="num">Net to UT</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row}
              {@const excluded = exclusions.includes(row.y)}
              <tr class:excluded>
                <td class="col-check">
                  <input
                    type="checkbox"
                    class="row-check"
                    checked={!excluded}
                    on:change={() => toggleYear(row.y)}
                    title={excluded ? 'Click to invest this bonus' : 'Click to skip this bonus'}
                  />
                </td>
                <td class="col-age mono">{row.age}</td>
                <td class="num mono">{fmtR(row.gross)}</td>
                <td class="num mono dim">({fmtR(row.tax)})</td>
                <td class="num mono net">{fmtR(row.net)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="tax-summary">
        <div class="tax-row">
          <span>Gross total</span>
          <span class="mono">{fmtR(totalGross)}</span>
        </div>
        <div class="tax-row tax">
          <span>Tax ({(marginalTaxRate * 100).toFixed(0)}% marginal)</span>
          <span class="mono">({fmtR(totalTax)})</span>
        </div>
        <div class="tax-row net">
          <span>Net invested</span>
          <span class="mono">{fmtR(totalNet)}</span>
        </div>
      </div>
    {:else}
      <p class="empty">Set a retirement age greater than current age to see year-by-year entries.</p>
    {/if}
  </div>
</div>

<style>
  .vb-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.1rem 0 0.25rem;
  }

  /* ── Toggle switch ─────────────────────────────────────── */
  .toggle-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
    padding: 0.1rem 0;
  }

  .toggle-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .track {
    position: relative;
    display: inline-block;
    width: 32px;
    height: 18px;
    background: var(--border);
    border-radius: 9px;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .toggle-input:checked + .track {
    background: var(--green);
  }

  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    transition: transform 0.2s;
  }

  .toggle-input:checked + .track .thumb {
    transform: translateX(14px);
  }

  .toggle-label {
    font-family: var(--sans);
    font-size: 0.75rem;
    color: var(--gray);
  }

  /* ── Inactive overlay ──────────────────────────────────── */
  .vb-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    transition: opacity 0.2s;
  }

  .vb-body.inactive {
    opacity: 0.35;
    pointer-events: none;
  }

  /* ── Rate slider row ───────────────────────────────────── */
  .rate-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.2rem 0;
  }

  .rate-label {
    flex: 0 0 148px;
    font-size: 0.78rem;
    color: var(--ink);
  }

  .rate-controls {
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

  .field-wrap {
    position: relative;
    flex: 0 0 72px;
  }

  .suffix {
    position: absolute;
    top: 50%;
    right: 5px;
    transform: translateY(-50%);
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--gray);
    pointer-events: none;
  }

  .field {
    width: 100%;
    padding: 3px 18px 3px 5px;
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    text-align: right;
    outline: none;
    box-sizing: border-box;
  }

  .field:focus {
    border-color: var(--accent);
  }

  /* ── Year-by-year table ────────────────────────────────── */
  .table-wrap {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: var(--surface);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.72rem;
    table-layout: fixed;
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--paper);
  }

  th {
    padding: 0.3rem 0.4rem;
    font-family: var(--mono);
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--gray);
    border-bottom: 1px solid var(--border);
    text-align: left;
    overflow: hidden;
  }

  th.col-check { width: 26px; padding: 0.3rem 0.3rem; }
  th.col-age   { width: 36px; }
  th.num { text-align: right; }

  td {
    padding: 0.2rem 0.4rem;
    border-bottom: 1px solid var(--paper);
    color: var(--ink);
    overflow: hidden;
  }

  td.col-check {
    padding: 0 0.3rem;
    text-align: center;
    vertical-align: middle;
  }

  td.col-age { font-family: var(--mono); }
  td.num  { text-align: right; }
  td.mono { font-family: var(--mono); }
  td.dim  { color: var(--red); }
  td.net  { color: var(--green); }

  /* ── Row checkbox ──────────────────────────────────────── */
  .row-check {
    width: 13px;
    height: 13px;
    cursor: pointer;
    accent-color: var(--green);
    display: block;
    margin: 0 auto;
  }

  /* ── Excluded (unchecked) rows ─────────────────────────── */
  tr.excluded td:not(.col-check) {
    opacity: 0.3;
  }

  tbody tr:hover td { background: var(--accent-light); }
  tbody tr.excluded:hover td { background: var(--accent-light); }

  /* ── Summary box ───────────────────────────────────────── */
  .tax-summary {
    margin-top: 0.25rem;
    padding: 0.4rem 0.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 3px;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .tax-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    color: var(--gray);
  }

  .tax-row.tax { color: var(--red); }

  .tax-row.net {
    color: var(--green);
    font-weight: 600;
    border-top: 1px solid var(--border);
    padding-top: 0.2rem;
    margin-top: 0.1rem;
  }

  .empty {
    font-size: 0.72rem;
    color: var(--gray);
    margin: 0.25rem 0;
    font-style: italic;
  }
</style>
