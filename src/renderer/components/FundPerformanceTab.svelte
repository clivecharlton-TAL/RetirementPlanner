<script lang="ts">
  import type { Inputs, ProjectionRow } from '../lib/types';
  import FundChart from './FundChart.svelte';

  export let inputs: Inputs;
  export let rows: ProjectionRow[];

  interface FundDef {
    key: keyof NonNullable<ProjectionRow['fundEndBalances']>;
    name: string;
    color: string;
    initialBalance: number;
    returnRate: number;
    group: 'mine' | 'cath';
  }

  const fundDefs: FundDef[] = [
    { key: 'ra',       name: "Clive's RA",          color: '#1b4965', initialBalance: 0, returnRate: 0, group: 'mine' },
    { key: 'ut',       name: "Clive's Unit Trust",   color: '#2d6a4f', initialBalance: 0, returnRate: 0, group: 'mine' },
    { key: 'ukPension',name: "UK Pension",            color: '#5c4a8a', initialBalance: 0, returnRate: 0, group: 'mine' },
    { key: 'tfSavings',name: "Clive's TF Savings",   color: '#0d7680', initialBalance: 0, returnRate: 0, group: 'mine' },
    { key: 'cathRa',   name: "Cath's RA",            color: '#c45d2e', initialBalance: 0, returnRate: 0, group: 'cath' },
    { key: 'cathUt',   name: "Cath's Unit Trust",    color: '#b5830a', initialBalance: 0, returnRate: 0, group: 'cath' },
    { key: 'cathTf',   name: "Cath's TF Savings",    color: '#9b2226', initialBalance: 0, returnRate: 0, group: 'cath' },
    { key: 'cathMtn',  name: "Cath's MTN",           color: '#7a4419', initialBalance: 0, returnRate: 0, group: 'cath' },
  ];

  // Build per-fund series from accumulation rows
  $: fundData = (() => {
    const accumRows = rows.filter(r => r.fundEndBalances !== undefined);
    if (accumRows.length === 0) return [];

    const rateMap: Record<string, number> = {
      ra: inputs.raReturnRate,
      ut: inputs.unitTrustReturnRate,
      ukPension: inputs.ukPensionReturnRate,
      tfSavings: inputs.tfSavingsReturnRate,
      cathRa: inputs.cathRaReturnRate,
      cathUt: inputs.cathUnitTrustReturnRate,
      cathTf: inputs.cathTfSavingsReturnRate,
      cathMtn: inputs.cathMtnReturnRate,
    };

    const initMap: Record<string, number> = {
      ra: inputs.raBalance,
      ut: inputs.unitTrustBalance,
      ukPension: inputs.ukPensionBalance,
      tfSavings: inputs.tfSavingsBalance,
      cathRa: inputs.cathRaBalance,
      cathUt: inputs.cathUnitTrustBalance,
      cathTf: inputs.cathTfSavingsBalance,
      cathMtn: inputs.cathMtnBalance,
    };

    return fundDefs
      .filter(f => initMap[f.key] > 0)
      .map(f => {
        // Series: opening point at currentAge + one point per accumulation year end
        const series = [
          { age: inputs.currentAge, balance: initMap[f.key] },
          ...accumRows.map(r => ({
            age: r.age + 1,
            balance: r.fundEndBalances![f.key],
          })),
        ];
        return { ...f, initialBalance: initMap[f.key], returnRate: rateMap[f.key], series };
      });
  })();

  $: mineFunds = fundData.filter(f => f.group === 'mine');
  $: cathFunds = fundData.filter(f => f.group === 'cath');
</script>

<div class="tab-wrap">
  {#if fundData.length === 0}
    <div class="empty">No fund balances entered. Add balances in the input panel to see performance charts.</div>
  {:else}
    {#if mineFunds.length > 0}
      <div class="group-header">
        <span class="group-label">Clive's Funds</span>
        <span class="group-sub">{inputs.currentAge} → {inputs.retirementAge} (accumulation phase)</span>
      </div>
      <div class="fund-grid">
        {#each mineFunds as f (f.key)}
          <FundChart
            name={f.name}
            color={f.color}
            returnRate={f.returnRate}
            data={f.series}
          />
        {/each}
      </div>
    {/if}

    {#if cathFunds.length > 0}
      <div class="group-header">
        <span class="group-label">Cath's Funds</span>
        <span class="group-sub">{inputs.currentAge} → {inputs.retirementAge} (accumulation phase)</span>
      </div>
      <div class="fund-grid">
        {#each cathFunds as f (f.key)}
          <FundChart
            name={f.name}
            color={f.color}
            returnRate={f.returnRate}
            data={f.series}
          />
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .tab-wrap {
    height: 100%;
    overflow-y: auto;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .empty {
    font-family: var(--sans);
    font-size: 0.82rem;
    color: var(--gray);
    font-style: italic;
    padding: 2rem 0.5rem;
  }

  .group-header {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    padding: 0.2rem 0.1rem 0;
  }

  .group-label {
    font-family: var(--mono);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .group-sub {
    font-family: var(--sans);
    font-size: 0.68rem;
    color: var(--gray);
  }

  .fund-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 0.65rem;
  }
</style>
