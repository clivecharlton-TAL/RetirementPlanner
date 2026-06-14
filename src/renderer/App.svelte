<script lang="ts">
  import { onMount } from 'svelte';
  import type { Inputs, ExpenseItem } from './lib/types';
  import { calculate } from './lib/calculator';
  import InputPanel from './components/InputPanel.svelte';
  import Chart from './components/Chart.svelte';
  import StatusBanner from './components/StatusBanner.svelte';
  import ProjectionTable from './components/ProjectionTable.svelte';
  import ExpenseSheet from './components/ExpenseSheet.svelte';
  import MortgageSheet from './components/MortgageSheet.svelte';

  const DEFAULT_INPUTS: Inputs = {
    currentAge: 55,
    annualIncome: 3_795_000,
    inflationRate: 0.05,
    raBalance: 9_000_000,
    raReturnRate: 0.08,
    unitTrustBalance: 9_101_618,
    unitTrustReturnRate: 0.10,
    ukPensionBalance: 0,
    ukPensionReturnRate: 0.07,
    tfSavingsBalance: 0,
    tfSavingsReturnRate: 0.10,
    annualSavings: 360_000,
    savingsGrowthRate: 0.05,
    bonusTranches: [],
    cathTfSavingsBalance: 0,
    cathTfSavingsReturnRate: 0.10,
    cathUnitTrustBalance: 0,
    cathUnitTrustReturnRate: 0.10,
    cathRaBalance: 0,
    cathRaReturnRate: 0.08,
    cathMtnBalance: 0,
    cathMtnReturnRate: 0.08,
    grossRentalIncome: 0,
    rentalEscalationRate: 0.06,
    vacancyCostRate: 0.15,
    retirementAge: 65,
    otherPensionIncome: 50_000,
    pensionGrowthRate: 0.05,
    retirementYears: 30,
    incomeReplacementRate: 0.5,
    postReturnRate: 0.08,
    marginalTaxRate: 0.36,
    uncertainty: {
      returnRate: 0.01,
      savingsAmount: 0.01,
      savingsGrowth: 0.01,
      pensionAmount: 0.01,
      pensionGrowth: 0.01,
    },
    mortgageBalance: 0,
    mortgageInterestRate: 0.115,
  };

  let inputs: Inputs = {
    ...DEFAULT_INPUTS,
    uncertainty: { ...DEFAULT_INPUTS.uncertainty },
    bonusTranches: [...DEFAULT_INPUTS.bonusTranches],
  };
  let expenses: ExpenseItem[] = [];
  let scenarioName = 'My Plan';
  let savedSnapshot = '';
  let dirty = false;
  let justSaved = false;
  let tab: 'plan' | 'expenses' | 'mortgage' = 'plan';

  $: result = calculate(inputs);
  $: totalExpensesBefore = expenses.reduce((s, e) => s + (e.beforeRetirement || 0), 0);
  $: totalExpensesAfter  = expenses.reduce((s, e) => s + (e.afterRetirement  || 0), 0);
  $: dirty = savedSnapshot !== '' && JSON.stringify({ name: scenarioName, inputs, expenses }) !== savedSnapshot;

  function save() {
    window.api?.saveScenario(scenarioName, JSON.stringify(inputs), JSON.stringify(expenses));
    savedSnapshot = JSON.stringify({ name: scenarioName, inputs, expenses });
    dirty = false;
    justSaved = true;
    setTimeout(() => { justSaved = false; }, 1500);
  }

  onMount(async () => {
    try {
      const row = await window.api?.loadScenario();
      if (row) {
        scenarioName = row.name;
        const loaded = JSON.parse(row.inputs_json);
        inputs = {
          ...DEFAULT_INPUTS,
          ...loaded,
          uncertainty: { ...DEFAULT_INPUTS.uncertainty, ...(loaded.uncertainty ?? {}) },
          bonusTranches: Array.isArray(loaded.bonusTranches) ? loaded.bonusTranches : [],
        };
        expenses = Array.isArray(JSON.parse(row.expenses_json)) ? JSON.parse(row.expenses_json) : [];
      }
    } catch {
      // Running in browser dev mode without Electron — use defaults
    }
    savedSnapshot = JSON.stringify({ name: scenarioName, inputs, expenses });
  });

  function onNameBlur(e: FocusEvent) {
    const val = (e.target as HTMLElement).textContent?.trim();
    if (val) scenarioName = val;
  }

  function onNameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  }
</script>

<div class="app">
  <header>
    <span class="app-name">RetirementPlanner</span>
    <span
      class="scenario-name"
      contenteditable="true"
      bind:textContent={scenarioName}
      on:blur={onNameBlur}
      on:keydown={onNameKeydown}
      spellcheck="false"
      role="textbox"
      tabindex="0"
      aria-label="Scenario name"
    ></span>
    <div class="header-right">
      {#if dirty}
        <span class="unsaved-dot" title="Unsaved changes"></span>
      {/if}
      <button
        class="save-btn"
        class:dirty
        class:saved={justSaved}
        on:click={save}
        disabled={!dirty}
      >
        {justSaved ? '✓ Saved' : 'Save'}
      </button>
    </div>
  </header>

  <div class="body">
    <InputPanel bind:inputs />

    <main class="right">
      <nav class="tabs">
        <button class="tab" class:active={tab === 'plan'}     on:click={() => tab = 'plan'}>Plan</button>
        <button class="tab" class:active={tab === 'expenses'} on:click={() => tab = 'expenses'}>Expenses</button>
        <button class="tab" class:active={tab === 'mortgage'} on:click={() => tab = 'mortgage'}>Mortgage</button>
      </nav>

      {#if tab === 'plan'}
        <div class="right-top">
          <StatusBanner {result} />
          {#if expenses.length > 0}
            <div class="expense-strip">
              <span class="strip-label">Monthly expenses</span>
              <span class="strip-item">Before retirement: <strong>R {Math.round(totalExpensesBefore).toLocaleString('en-ZA')}</strong></span>
              <span class="strip-sep">·</span>
              <span class="strip-item">After retirement: <strong>R {Math.round(totalExpensesAfter).toLocaleString('en-ZA')}</strong></span>
            </div>
          {/if}
          <Chart {result} retirementAge={inputs.retirementAge} />
        </div>
        <div class="right-table">
          <ProjectionTable rows={result.rows} retirementAge={inputs.retirementAge} monthlyExpenses={totalExpensesAfter} inflationRate={inputs.inflationRate} />
        </div>
      {:else if tab === 'expenses'}
        <div class="right-table">
          <ExpenseSheet bind:expenses />
        </div>
      {:else}
        <div class="right-table">
          <MortgageSheet
            retirementAge={inputs.retirementAge}
            currentAge={inputs.currentAge}
            bind:mortgageBalance={inputs.mortgageBalance}
            bind:mortgageInterestRate={inputs.mortgageInterestRate}
          />
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  header {
    display: flex;
    align-items: center;
    height: 44px;
    padding: 0 1rem 0 84px; /* 84px to clear macOS traffic lights */
    background: var(--paper);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    gap: 1rem;
    -webkit-app-region: drag;
  }

  .app-name {
    font-family: var(--mono);
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gray);
    -webkit-app-region: no-drag;
  }

  .scenario-name {
    font-family: var(--serif);
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--ink);
    border-bottom: 1px dashed transparent;
    outline: none;
    cursor: text;
    -webkit-app-region: no-drag;
    padding: 0 2px;
    min-width: 60px;
  }

  .scenario-name:focus {
    border-bottom-color: var(--accent);
    color: var(--accent);
  }

  .header-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    -webkit-app-region: no-drag;
  }

  .unsaved-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--amber);
  }

  .save-btn {
    font-family: var(--mono);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--paper);
    color: var(--gray);
    cursor: default;
    transition: all 0.15s;
  }

  .save-btn.dirty {
    border-color: var(--accent);
    color: var(--accent);
    cursor: pointer;
  }

  .save-btn.dirty:hover {
    background: var(--accent);
    color: white;
  }

  .save-btn.saved {
    border-color: var(--green);
    color: var(--green);
    cursor: default;
  }

  .body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .right {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--paper);
  }

  .tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    padding: 0 0.75rem;
  }

  .tab {
    font-family: var(--sans);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    padding: 0.5rem 1rem;
    border: none;
    background: none;
    color: var(--gray);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }

  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab:hover:not(.active) { color: var(--ink); }

  .expense-strip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 1rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    font-size: 0.75rem;
    color: var(--gray);
    flex-shrink: 0;
  }

  .strip-label {
    font-family: var(--mono);
    font-size: 0.65rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-right: 0.25rem;
  }

  .strip-item strong {
    font-family: var(--mono);
    color: var(--ink);
    font-weight: 600;
  }

  .strip-sep { color: var(--border); }

  .right-top {
    flex-shrink: 0;
    overflow: hidden;
  }

  .right-table {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 0 0.75rem 0.75rem;
  }
</style>
