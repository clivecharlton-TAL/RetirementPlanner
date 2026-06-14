<script lang="ts">
  import { onMount } from 'svelte';
  import type { Inputs } from './lib/types';
  import { calculate } from './lib/calculator';
  import InputPanel from './components/InputPanel.svelte';
  import Chart from './components/Chart.svelte';
  import StatusBanner from './components/StatusBanner.svelte';
  import ProjectionTable from './components/ProjectionTable.svelte';

  const DEFAULT_INPUTS: Inputs = {
    currentAge: 55,
    annualIncome: 3_795_000,
    inflationRate: 0.05,
    raBalance: 9_000_000,
    raReturnRate: 0.08,
    unitTrustBalance: 9_101_618,
    unitTrustReturnRate: 0.10,
    annualSavings: 360_000,
    savingsGrowthRate: 0.05,
    bonusTranches: [],
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
  };

  let inputs: Inputs = {
    ...DEFAULT_INPUTS,
    uncertainty: { ...DEFAULT_INPUTS.uncertainty },
    bonusTranches: [...DEFAULT_INPUTS.bonusTranches],
  };
  let scenarioName = 'My Plan';
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  $: result = calculate(inputs);

  function scheduleAutoSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      window.api?.saveScenario(scenarioName, JSON.stringify(inputs));
    }, 50);
  }

  $: { inputs; scheduleAutoSave(); }
  $: { scenarioName; scheduleAutoSave(); }

  onMount(async () => {
    try {
      const row = await window.api?.loadScenario();
      if (row) {
        scenarioName = row.name;
        const loaded = JSON.parse(row.inputs_json);
        // Deep-merge with defaults so newly added fields or missing sub-objects never produce NaN
        inputs = {
          ...DEFAULT_INPUTS,
          ...loaded,
          uncertainty: { ...DEFAULT_INPUTS.uncertainty, ...(loaded.uncertainty ?? {}) },
          bonusTranches: Array.isArray(loaded.bonusTranches) ? loaded.bonusTranches : [],
        };
      }
    } catch {
      // Running in browser dev mode without Electron — use defaults
    }
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
  </header>

  <div class="body">
    <InputPanel bind:inputs />

    <main class="right">
      <div class="right-top">
        <StatusBanner {result} />
        <Chart {result} retirementAge={inputs.retirementAge} />
      </div>
      <div class="right-table">
        <ProjectionTable rows={result.rows} retirementAge={inputs.retirementAge} />
      </div>
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
