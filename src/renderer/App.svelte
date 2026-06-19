<script lang="ts">
  import { onMount } from 'svelte';
  import * as XLSX from 'xlsx';
  import type { Inputs, ExpenseItem } from './lib/types';
  import { calculate } from './lib/calculator';
  import InputPanel from './components/InputPanel.svelte';
  import Chart from './components/Chart.svelte';
  import StatusBanner from './components/StatusBanner.svelte';
  import ProjectionTable from './components/ProjectionTable.svelte';
  import ExpenseSheet from './components/ExpenseSheet.svelte';
  import MortgageSheet from './components/MortgageSheet.svelte';
  import FundPerformanceTab from './components/FundPerformanceTab.svelte';
  import AiPanel from './components/AiPanel.svelte';

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
    vehicleFinanceBalance: 0,
    mortgageInterestRate: 0.115,
    surplusReinvestmentRate: 0,
    variableBonusEnabled: false,
    variableBonusRate: 0.5,
    variableBonusExclusions: [],
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
  let tab: 'plan' | 'expenses' | 'mortgage' | 'funds' = 'plan';
  let aiOpen = false;

  $: result = calculate(inputs, totalExpensesAfter);

  function computeMortgagePayment(balance: number, mRate: number, n: number): number {
    if (balance <= 0 || n <= 0) return 0;
    if (mRate === 0) return balance / n;
    const factor = Math.pow(1 + mRate, n);
    return (balance * mRate * factor) / (factor - 1);
  }
  $: mortgageMonths = Math.max(0, Math.round((inputs.retirementAge - inputs.currentAge) * 12));
  $: mortgageMonthlyPayment = computeMortgagePayment(
    inputs.mortgageBalance + inputs.vehicleFinanceBalance,
    inputs.mortgageInterestRate / 12,
    mortgageMonths
  );

  $: totalExpensesBefore = mortgageMonthlyPayment + expenses.reduce((s, e) => s + (e.beforeRetirement || 0), 0);
  $: totalExpensesAfter  = expenses.reduce((s, e) => s + (e.afterRetirement  || 0), 0);
  $: dirty = savedSnapshot !== '' && JSON.stringify({ name: scenarioName, inputs, expenses }) !== savedSnapshot;

  $: aiContext = JSON.stringify({
    inputs: {
      currentAge: inputs.currentAge,
      retirementAge: inputs.retirementAge,
      annualIncome: inputs.annualIncome,
      inflationRate: inputs.inflationRate,
      mySavings: {
        ra: inputs.raBalance, raReturn: inputs.raReturnRate,
        unitTrusts: inputs.unitTrustBalance, utReturn: inputs.unitTrustReturnRate,
        ukPension: inputs.ukPensionBalance, ukReturn: inputs.ukPensionReturnRate,
        tfSavings: inputs.tfSavingsBalance, tfReturn: inputs.tfSavingsReturnRate,
        annualSavings: inputs.annualSavings, savingsGrowth: inputs.savingsGrowthRate,
      },
      bonusTranches: inputs.bonusTranches,
      cathSavings: {
        tfSavings: inputs.cathTfSavingsBalance, tfReturn: inputs.cathTfSavingsReturnRate,
        unitTrusts: inputs.cathUnitTrustBalance, utReturn: inputs.cathUnitTrustReturnRate,
        ra: inputs.cathRaBalance, raReturn: inputs.cathRaReturnRate,
        mtn: inputs.cathMtnBalance, mtnReturn: inputs.cathMtnReturnRate,
      },
      rental: {
        grossAnnual: inputs.grossRentalIncome,
        escalation: inputs.rentalEscalationRate,
        vacancyCost: inputs.vacancyCostRate,
      },
      retirement: {
        years: inputs.retirementYears,
        incomeReplacement: inputs.incomeReplacementRate,
        otherPension: inputs.otherPensionIncome,
        pensionGrowth: inputs.pensionGrowthRate,
        postReturnRate: inputs.postReturnRate,
      },
      marginalTaxRate: inputs.marginalTaxRate,
    },
    projection: {
      finalBalance: result.finalBalance,
      successAge: result.successAge,
      failureAge: result.failureAge,
      raLumpSumTaxPaid: result.raLumpSumTaxPaid,
      rowCount: result.rows.length,
      atRetirement: result.rows.find(r => r.age === inputs.retirementAge),
    },
    expenses: expenses.map(e => ({
      description: e.description,
      beforeRetirement: e.beforeRetirement,
      afterRetirement: e.afterRetirement,
    })),
    mortgage: {
      mortgageBalance: inputs.mortgageBalance,
      vehicleFinance: inputs.vehicleFinanceBalance,
      interestRate: inputs.mortgageInterestRate,
      monthlyPayment: mortgageMonthlyPayment,
      monthsRemaining: mortgageMonths,
    },
  }, null, 2);

  function save() {
    window.api?.saveScenario(scenarioName, JSON.stringify(inputs), JSON.stringify(expenses));
    savedSnapshot = JSON.stringify({ name: scenarioName, inputs, expenses });
    dirty = false;
    justSaved = true;
    setTimeout(() => { justSaved = false; }, 1500);
  }

  function exportToExcel() {
    const wb = XLSX.utils.book_new();
    const tax      = inputs.marginalTaxRate;
    const retAge   = inputs.retirementAge;
    const inflation = inputs.inflationRate;

    // ── Sheet 1: Projection ──────────────────────────────────────────────────
    const projHeaders = [
      'Age', 'Phase', 'Opening Balance (R)', 'Interest (R)', 'Savings / (Drawdown) (R)',
      'Net Rental Income (R)', 'Pension p.m. (R)', 'Monthly Income post-tax (R)',
      'Monthly Expenses inflated (R)', 'Net vs Expenses (R)',
      'Reinvested p.m. (R)', 'Reinvestment Pot (R)', 'End Balance (R)', 'Drawdown Rate',
    ];

    const projRows = result.rows.map(row => {
      const isDrawdown = row.drawdownRate !== null;
      let monthlyIncome: number | null = null;
      let monthlyExp: number | null    = null;
      let netVsExp: number | null      = null;

      if (isDrawdown) {
        const portfolioNet = Math.abs(row.savingsOrDrawdown) * (1 - tax);
        const pensionNet   = row.pensionIncome * (1 - tax);
        monthlyIncome = (portfolioNet + row.netRentalIncome + pensionNet) / 12;
        monthlyExp    = totalExpensesAfter * Math.pow(1 + inflation, row.age - retAge);
        netVsExp      = monthlyIncome - monthlyExp;
      }

      return [
        row.age,
        isDrawdown ? 'Drawdown' : 'Accumulation',
        row.balance,
        row.interest,
        row.savingsOrDrawdown,
        row.netRentalIncome,
        isDrawdown ? row.pensionIncome / 12 : null,
        monthlyIncome,
        monthlyExp,
        netVsExp,
        row.availableToInvest > 0 ? row.availableToInvest : null,
        row.cumulativeReinvestment > 0 ? row.cumulativeReinvestment : null,
        row.endBalance,
        isDrawdown ? row.drawdownRate : null,
      ];
    });

    const ws1 = XLSX.utils.aoa_to_sheet([
      [scenarioName],
      [`Exported ${new Date().toLocaleDateString('en-ZA')} · Marginal tax rate ${(tax * 100).toFixed(0)}% · Expenses after retirement R${Math.round(totalExpensesAfter).toLocaleString('en-ZA')}/month`],
      [],
      projHeaders,
      ...projRows,
    ]);

    ws1['!cols'] = [
      { wch: 5 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 22 },
      { wch: 20 }, { wch: 16 }, { wch: 24 }, { wch: 24 }, { wch: 18 },
      { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 14 },
    ];

    // Format drawdown rate column as percentage (column N = index 13, data starts row 5 = index 4)
    const pctFmt = '0.0%';
    for (let r = 4; r < projRows.length + 4; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: 13 });
      if (ws1[addr] && ws1[addr].v !== null) ws1[addr].z = pctFmt;
    }

    XLSX.utils.book_append_sheet(wb, ws1, 'Projection');

    // ── Sheet 2: Inputs ──────────────────────────────────────────────────────
    const inputRows: (string | number | null)[][] = [
      ['Parameter', 'Value'],
      [],
      ['Current Age', inputs.currentAge],
      ['Retirement Age', inputs.retirementAge],
      ['Retirement Years', inputs.retirementYears],
      ['Annual Income', inputs.annualIncome],
      ['Inflation Rate', inputs.inflationRate],
      [],
      ['RA Balance', inputs.raBalance],
      ['RA Return Rate', inputs.raReturnRate],
      ['Unit Trust Balance', inputs.unitTrustBalance],
      ['Unit Trust Return Rate', inputs.unitTrustReturnRate],
      ['Annual Savings', inputs.annualSavings],
      ['Savings Growth Rate', inputs.savingsGrowthRate],
      [],
      ['Gross Rental Income (annual)', inputs.grossRentalIncome],
      ['Rental Escalation Rate', inputs.rentalEscalationRate],
      ['Vacancy & Cost Rate', inputs.vacancyCostRate],
      [],
      ['Income Replacement Rate', inputs.incomeReplacementRate],
      ['Post-retirement Return Rate', inputs.postReturnRate],
      ['Other Pension Income (annual)', inputs.otherPensionIncome],
      ['Pension Growth Rate', inputs.pensionGrowthRate],
      [],
      ['Marginal Tax Rate', inputs.marginalTaxRate],
      ['Surplus Reinvestment Rate', inputs.surplusReinvestmentRate],
      [],
      ['RA Lump Sum Tax (at retirement)', result.raLumpSumTaxPaid],
      [],
      ['Monthly Expenses Before Retirement', totalExpensesBefore],
      ['Monthly Expenses After Retirement', totalExpensesAfter],
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(inputRows);
    ws2['!cols'] = [{ wch: 36 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Inputs');

    // ── Write & send to main for save dialog ─────────────────────────────────
    const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' }) as string;
    const safeName = scenarioName.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'RetirementPlan';
    const date = new Date().toISOString().slice(0, 10);
    window.api?.exportXlsx(base64, `${safeName} ${date}.xlsx`);
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
          variableBonusExclusions: Array.isArray(loaded.variableBonusExclusions) ? loaded.variableBonusExclusions : [],
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
      <button class="export-btn" on:click={exportToExcel} title="Export projection to Excel">
        Export
      </button>
      <button class="ai-btn" class:active={aiOpen} on:click={() => aiOpen = !aiOpen}>
        ✦ Ask AI
      </button>
    </div>
  </header>

  <AiPanel bind:open={aiOpen} contextJson={aiContext} />

  <div class="body">
    <InputPanel bind:inputs />

    <main class="right">
      <nav class="tabs">
        <button class="tab" class:active={tab === 'plan'}     on:click={() => tab = 'plan'}>Plan</button>
        <button class="tab" class:active={tab === 'expenses'} on:click={() => tab = 'expenses'}>Expenses</button>
        <button class="tab" class:active={tab === 'mortgage'} on:click={() => tab = 'mortgage'}>Mortgage</button>
        <button class="tab" class:active={tab === 'funds'}    on:click={() => tab = 'funds'}>Funds</button>
      </nav>

      {#if tab === 'plan'}
        <div class="right-top">
          <StatusBanner {result} />
          {#if expenses.length > 0}
            <div class="expense-strip">
              <span class="strip-label">Monthly expenses</span>
              <span class="strip-item">Before retirement: <strong>R {Math.round(totalExpensesBefore).toLocaleString('en-ZA')}</strong></span>
              <span class="strip-sep">·</span>
              <span class="strip-item">After retirement: <strong>R {Math.round(totalExpensesAfter).toLocaleString('en-ZA')}</strong>{#if totalExpensesBefore > 0}<span class="strip-pct">{Math.round(totalExpensesAfter / totalExpensesBefore * 100)}%</span>{/if}</span>
            </div>
          {/if}
          <Chart {result} retirementAge={inputs.retirementAge} />
        </div>
        <div class="right-table">
          <ProjectionTable rows={result.rows} retirementAge={inputs.retirementAge} monthlyExpenses={totalExpensesAfter} inflationRate={inputs.inflationRate} marginalTaxRate={inputs.marginalTaxRate} />
        </div>
      {:else if tab === 'expenses'}
        <div class="right-table">
          <ExpenseSheet bind:expenses mortgagePayment={mortgageMonthlyPayment} />
        </div>
      {:else if tab === 'mortgage'}
        <div class="right-table">
          <MortgageSheet
            retirementAge={inputs.retirementAge}
            currentAge={inputs.currentAge}
            bind:mortgageBalance={inputs.mortgageBalance}
            bind:vehicleFinanceBalance={inputs.vehicleFinanceBalance}
            bind:mortgageInterestRate={inputs.mortgageInterestRate}
          />
        </div>
      {:else}
        <div class="right-table">
          <FundPerformanceTab {inputs} rows={result.rows} />
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

  .export-btn {
    font-family: var(--mono);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius);
    border: 1px solid var(--green);
    background: none;
    color: var(--green);
    cursor: pointer;
    transition: all 0.15s;
  }

  .export-btn:hover {
    background: var(--green);
    color: white;
  }

  .ai-btn {
    font-family: var(--sans);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius);
    border: 1px solid var(--accent);
    background: none;
    color: var(--accent);
    cursor: pointer;
    transition: all 0.15s;
  }

  .ai-btn:hover, .ai-btn.active {
    background: var(--accent);
    color: white;
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

  .strip-pct {
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--gray);
    margin-left: 0.35rem;
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
