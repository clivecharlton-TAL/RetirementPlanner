<script lang="ts">
  import type { Inputs } from '../lib/types';
  import InputSlider from './InputSlider.svelte';
  import InputSection from './InputSection.svelte';
  import BonusTranches from './BonusTranches.svelte';

  export let inputs: Inputs;

  function fmtR(v: number): string {
    return 'R ' + Math.round(v).toLocaleString('en-ZA');
  }
  function fmtPct(v: number): string {
    return (v * 100).toFixed(1) + '%';
  }

  // My portfolio totals
  $: myPortfolio = inputs.raBalance + inputs.unitTrustBalance + inputs.ukPensionBalance + inputs.tfSavingsBalance;
  $: myRaType    = inputs.raBalance;   // only Clive's RA is SA RA-type
  $: myDirect    = inputs.unitTrustBalance + inputs.ukPensionBalance + inputs.tfSavingsBalance;
  $: myBlended   = myPortfolio > 0
    ? (inputs.raBalance * inputs.raReturnRate
     + inputs.unitTrustBalance * inputs.unitTrustReturnRate
     + inputs.ukPensionBalance * inputs.ukPensionReturnRate
     + inputs.tfSavingsBalance * inputs.tfSavingsReturnRate) / myPortfolio
    : 0;

  // Cath's portfolio totals
  $: cathPortfolio = inputs.cathTfSavingsBalance + inputs.cathUnitTrustBalance + inputs.cathRaBalance + inputs.cathMtnBalance;
  $: cathRaType    = inputs.cathRaBalance + inputs.cathMtnBalance;
  $: cathDirect    = inputs.cathTfSavingsBalance + inputs.cathUnitTrustBalance;
  $: cathBlended   = cathPortfolio > 0
    ? (inputs.cathTfSavingsBalance  * inputs.cathTfSavingsReturnRate
     + inputs.cathUnitTrustBalance  * inputs.cathUnitTrustReturnRate
     + inputs.cathRaBalance         * inputs.cathRaReturnRate
     + inputs.cathMtnBalance        * inputs.cathMtnReturnRate) / cathPortfolio
    : 0;

  // Combined
  $: combinedPortfolio = myPortfolio + cathPortfolio;
  $: combinedRaType    = myRaType + cathRaType;
  $: combinedBlended   = combinedPortfolio > 0
    ? (myPortfolio * myBlended + cathPortfolio * cathBlended) / combinedPortfolio
    : 0;
</script>

<aside class="panel">
  <InputSection title="Now">
    <InputSlider label="Current Age" bind:value={inputs.currentAge} min={18} max={80} step={1} format="integer" />
    <InputSlider label="Annual Income" bind:value={inputs.annualIncome} min={0} max={50000000} step={10000} format="currency" />
    <InputSlider label="Inflation / Growth" bind:value={inputs.inflationRate} min={0} max={0.15} step={0.001} format="percent" />
  </InputSection>

  <InputSection title="My Savings">
    <InputSlider label="Retirement Annuity" bind:value={inputs.raBalance} min={0} max={200000000} step={10000} format="currency" />
    <InputSlider label="RA Return" bind:value={inputs.raReturnRate} min={0} max={0.25} step={0.001} format="percent" />
    <InputSlider label="Unit Trusts" bind:value={inputs.unitTrustBalance} min={0} max={200000000} step={10000} format="currency" />
    <InputSlider label="Unit Trust Return" bind:value={inputs.unitTrustReturnRate} min={0} max={0.25} step={0.001} format="percent" />
    <InputSlider label="UK Pension" bind:value={inputs.ukPensionBalance} min={0} max={200000000} step={10000} format="currency" />
    <InputSlider label="UK Pension Return" bind:value={inputs.ukPensionReturnRate} min={0} max={0.25} step={0.001} format="percent" />
    <InputSlider label="Tax Free Savings" bind:value={inputs.tfSavingsBalance} min={0} max={50000000} step={5000} format="currency" />
    <InputSlider label="TF Savings Return" bind:value={inputs.tfSavingsReturnRate} min={0} max={0.25} step={0.001} format="percent" />
    <InputSlider label="Annual Savings" bind:value={inputs.annualSavings} min={0} max={5000000} step={5000} format="currency" />
    <InputSlider label="Savings Growth" bind:value={inputs.savingsGrowthRate} min={0} max={0.20} step={0.001} format="percent" />

    {#if myPortfolio > 0}
      <div class="savings-summary">
        <div class="sum-row total">
          <span>My portfolio</span>
          <span class="mono">{fmtR(myPortfolio)}</span>
        </div>
        <div class="sum-row">
          <span>Blended return</span>
          <span class="mono">{fmtPct(myBlended)}</span>
        </div>
        <div class="sum-divider"></div>
        <div class="sum-row ra">
          <span>RA — lump sum tax at retirement</span>
          <span class="mono">{fmtR(myRaType)}</span>
        </div>
        <div class="sum-row ut">
          <span>Direct funds — no retirement tax</span>
          <span class="mono">{fmtR(myDirect)}</span>
        </div>
      </div>
    {/if}
  </InputSection>

  <InputSection title="Guaranteed Bonus Tranches">
    <BonusTranches bind:tranches={inputs.bonusTranches} marginalTaxRate={inputs.marginalTaxRate} />
  </InputSection>

  <InputSection title="Cath's Investments">
    <InputSlider label="Tax Free Savings" bind:value={inputs.cathTfSavingsBalance} min={0} max={50000000} step={5000} format="currency" />
    <InputSlider label="TF Savings Return" bind:value={inputs.cathTfSavingsReturnRate} min={0} max={0.25} step={0.001} format="percent" />
    <InputSlider label="Unit Trusts" bind:value={inputs.cathUnitTrustBalance} min={0} max={200000000} step={10000} format="currency" />
    <InputSlider label="Unit Trust Return" bind:value={inputs.cathUnitTrustReturnRate} min={0} max={0.25} step={0.001} format="percent" />
    <InputSlider label="Private RA" bind:value={inputs.cathRaBalance} min={0} max={200000000} step={10000} format="currency" />
    <InputSlider label="RA Return" bind:value={inputs.cathRaReturnRate} min={0} max={0.25} step={0.001} format="percent" />
    <InputSlider label="MTN Pension & Provident" bind:value={inputs.cathMtnBalance} min={0} max={200000000} step={10000} format="currency" />
    <InputSlider label="MTN Return" bind:value={inputs.cathMtnReturnRate} min={0} max={0.25} step={0.001} format="percent" />

    {#if cathPortfolio > 0}
      <div class="savings-summary">
        <div class="sum-row total">
          <span>Cath's portfolio</span>
          <span class="mono">{fmtR(cathPortfolio)}</span>
        </div>
        <div class="sum-row">
          <span>Blended return</span>
          <span class="mono">{fmtPct(cathBlended)}</span>
        </div>
        <div class="sum-divider"></div>
        <div class="sum-row ra">
          <span>RA + MTN — lump sum tax at retirement</span>
          <span class="mono">{fmtR(cathRaType)}</span>
        </div>
        <div class="sum-row ut">
          <span>TF Savings + UT — no retirement tax</span>
          <span class="mono">{fmtR(cathDirect)}</span>
        </div>
      </div>
    {/if}
  </InputSection>

  {#if combinedPortfolio > 0}
    <div class="combined-summary">
      <div class="comb-label">Combined Portfolio</div>
      <div class="comb-row">
        <span>Total</span>
        <span class="mono">{fmtR(combinedPortfolio)}</span>
      </div>
      <div class="comb-row">
        <span>Blended return</span>
        <span class="mono">{fmtPct(combinedBlended)}</span>
      </div>
      <div class="comb-row ra">
        <span>RA-type (lump sum tax on 1/3)</span>
        <span class="mono">{fmtR(combinedRaType)}</span>
      </div>
    </div>
  {/if}

  <InputSection title="Rental Income">
    <InputSlider label="Gross Annual Rental" bind:value={inputs.grossRentalIncome} min={0} max={5000000} step={5000} format="currency" />
    <InputSlider label="Rental Escalation" bind:value={inputs.rentalEscalationRate} min={0} max={0.20} step={0.001} format="percent" />
    <InputSlider label="Vacancy + Costs" bind:value={inputs.vacancyCostRate} min={0} max={0.50} step={0.005} format="percent" />

    {#if inputs.grossRentalIncome > 0}
      <div class="savings-summary">
        <div class="sum-row total">
          <span>Gross rental</span>
          <span class="mono">{fmtR(inputs.grossRentalIncome)}</span>
        </div>
        <div class="sum-row tax">
          <span>Vacancy + costs ({(inputs.vacancyCostRate * 100).toFixed(0)}%)</span>
          <span class="mono">({fmtR(inputs.grossRentalIncome * inputs.vacancyCostRate)})</span>
        </div>
        <div class="sum-row tax">
          <span>Income tax ({(inputs.marginalTaxRate * 100).toFixed(0)}% marginal)</span>
          <span class="mono">({fmtR(inputs.grossRentalIncome * (1 - inputs.vacancyCostRate) * inputs.marginalTaxRate)})</span>
        </div>
        <div class="sum-divider"></div>
        <div class="sum-row net">
          <span>Net rental income</span>
          <span class="mono">{fmtR(inputs.grossRentalIncome * (1 - inputs.vacancyCostRate) * (1 - inputs.marginalTaxRate))}</span>
        </div>
        <div class="sum-note">Escalates at {(inputs.rentalEscalationRate * 100).toFixed(0)}% p.a. — net offsets drawdown at retirement</div>
      </div>
    {/if}
  </InputSection>

  <InputSection title="At Retirement">
    <InputSlider label="Retirement Age" bind:value={inputs.retirementAge} min={45} max={80} step={1} format="integer" />
    <InputSlider label="Defined Pension (p.a.)" bind:value={inputs.otherPensionIncome} min={0} max={2000000} step={1000} format="currency" />
    <InputSlider label="Pension Growth" bind:value={inputs.pensionGrowthRate} min={0} max={0.15} step={0.001} format="percent" />
    <InputSlider label="Retirement Years" bind:value={inputs.retirementYears} min={5} max={50} step={1} format="integer" />
    <InputSlider label="Income Replacement" bind:value={inputs.incomeReplacementRate} min={0.10} max={1.0} step={0.01} format="percent" />
    <InputSlider label="Post-ret. Return" bind:value={inputs.postReturnRate} min={0} max={0.25} step={0.001} format="percent" />
  </InputSection>

  <InputSection title="Tax">
    <InputSlider label="Marginal Tax Rate" bind:value={inputs.marginalTaxRate} min={0} max={0.45} step={0.005} format="percent" />
  </InputSection>

  <InputSection title="Uncertainty (± per input)">
    <InputSlider label="Return Rate ±" bind:value={inputs.uncertainty.returnRate} min={0} max={0.10} step={0.001} format="percent" />
    <InputSlider label="Savings Amount ±" bind:value={inputs.uncertainty.savingsAmount} min={0} max={0.10} step={0.001} format="percent" />
    <InputSlider label="Savings Growth ±" bind:value={inputs.uncertainty.savingsGrowth} min={0} max={0.10} step={0.001} format="percent" />
    <InputSlider label="Pension Amount ±" bind:value={inputs.uncertainty.pensionAmount} min={0} max={0.10} step={0.001} format="percent" />
    <InputSlider label="Pension Growth ±" bind:value={inputs.uncertainty.pensionGrowth} min={0} max={0.10} step={0.001} format="percent" />
  </InputSection>
</aside>

<style>
  .panel {
    width: var(--panel-width);
    flex-shrink: 0;
    height: 100%;
    overflow-y: auto;
    background: var(--paper);
    border-right: 1px solid var(--border);
  }

  .savings-summary {
    margin-top: 0.5rem;
    padding: 0.4rem 0.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 3px;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .combined-summary {
    margin: 0.5rem 0.5rem 0.1rem;
    padding: 0.5rem 0.6rem;
    background: var(--blue-light);
    border: 1px solid var(--border);
    border-radius: 3px;
    display: flex;
    flex-direction: column;
    gap: 0.22rem;
  }

  .comb-label {
    font-family: var(--sans);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--blue);
    margin-bottom: 0.1rem;
  }

  .comb-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    color: var(--ink);
    font-weight: 600;
  }

  .comb-row.ra { color: var(--blue); font-weight: 400; }

  .sum-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    color: var(--gray);
  }

  .sum-row.total { color: var(--ink); font-weight: 600; }
  .sum-row.ra    { color: var(--blue); }
  .sum-row.ut    { color: var(--green); }
  .sum-row.tax   { color: var(--red); }
  .sum-row.net   { color: var(--green); font-weight: 600; }

  .sum-divider {
    border-top: 1px solid var(--border);
    margin: 0.15rem 0;
  }

  .sum-note {
    font-size: 0.65rem;
    color: var(--gray);
    font-style: italic;
    margin-top: -0.1rem;
    margin-bottom: 0.15rem;
    padding-left: 0.1rem;
  }

  .mono { font-family: var(--mono); }
</style>
