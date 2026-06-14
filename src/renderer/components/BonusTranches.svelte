<script lang="ts">
  import type { BonusTranche } from '../lib/types';

  export let tranches: BonusTranche[];
  export let marginalTaxRate: number = 0;

  $: totalGross = tranches.reduce((s, t) => s + t.amount, 0);
  $: totalTax   = totalGross * marginalTaxRate;
  $: totalNet   = totalGross - totalTax;

  function fmtR(v: number): string {
    return 'R' + Math.round(v).toLocaleString('en-ZA');
  }

  function addTranche() {
    tranches = [...tranches, { amount: 0, yearsFromNow: 1 }];
  }

  function removeTranche(i: number) {
    tranches = tranches.filter((_, idx) => idx !== i);
  }

  function updateAmount(i: number, raw: string) {
    const v = parseInt(raw.replace(/\D/g, ''), 10);
    if (!isNaN(v)) {
      tranches = tranches.map((t, idx) => idx === i ? { ...t, amount: v } : t);
    }
  }

  function updateYears(i: number, raw: string) {
    const v = parseInt(raw, 10);
    if (!isNaN(v) && v >= 0 && v <= 30) {
      tranches = tranches.map((t, idx) => idx === i ? { ...t, yearsFromNow: v } : t);
    }
  }
</script>

<div class="tranches">
  {#if tranches.length === 0}
    <p class="empty">No tranches added.</p>
  {:else}
    <div class="header-row">
      <span class="col-amount">Gross Amount (R)</span>
      <span class="col-years">Years from now</span>
      <span class="col-action"></span>
    </div>
    {#each tranches as tranche, i}
      <div class="tranche-row">
        <input
          class="col-amount input"
          type="text"
          inputmode="numeric"
          value={tranche.amount.toLocaleString('en-ZA')}
          on:change={(e) => updateAmount(i, (e.target as HTMLInputElement).value)}
        />
        <input
          class="col-years input"
          type="number"
          min="0"
          max="30"
          value={tranche.yearsFromNow}
          on:change={(e) => updateYears(i, (e.target as HTMLInputElement).value)}
        />
        <button class="remove" on:click={() => removeTranche(i)} title="Remove tranche">×</button>
      </div>
    {/each}
  {/if}
  <button class="add" on:click={addTranche}>+ Add tranche</button>

  {#if tranches.length > 0}
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
  {/if}
</div>

<style>
  .tranches {
    padding: 0.25rem 0.75rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .empty {
    font-size: 0.75rem;
    color: var(--gray);
    margin: 0.25rem 0;
  }

  .header-row,
  .tranche-row {
    display: grid;
    grid-template-columns: 1fr 100px 28px;
    gap: 0.4rem;
    align-items: center;
  }

  .header-row {
    font-family: var(--mono);
    font-size: 0.6rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--gray);
    padding-bottom: 0.2rem;
    border-bottom: 1px solid var(--border);
  }

  .col-years {
    text-align: center;
  }

  .input {
    font-family: var(--mono);
    font-size: 0.75rem;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0.25rem 0.4rem;
    width: 100%;
    box-sizing: border-box;
    outline: none;
  }

  .input:focus {
    border-color: var(--accent);
  }

  /* Remove number spinners */
  .input[type='number']::-webkit-inner-spin-button,
  .input[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .remove {
    font-family: var(--sans);
    font-size: 0.85rem;
    color: var(--gray);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    width: 22px;
    height: 22px;
  }

  .remove:hover {
    color: var(--red);
    background: var(--red-light);
  }

  .add {
    margin-top: 0.35rem;
    align-self: flex-start;
    font-family: var(--sans);
    font-size: 0.72rem;
    color: var(--accent);
    background: none;
    border: 1px solid var(--accent);
    border-radius: 3px;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
  }

  .add:hover {
    background: var(--accent-light);
  }

  .tax-summary {
    margin-top: 0.5rem;
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

  .tax-row.tax {
    color: var(--red);
  }

  .tax-row.net {
    color: var(--green);
    font-weight: 600;
    border-top: 1px solid var(--border);
    padding-top: 0.2rem;
    margin-top: 0.1rem;
  }

  .mono {
    font-family: var(--mono);
  }
</style>
