<script lang="ts">
  export let retirementAge: number;
  export let currentAge: number;
  export let mortgageBalance: number;
  export let vehicleFinanceBalance: number;
  export let mortgageInterestRate: number;

  interface AmortRow {
    month: number;
    ageStr: string;
    payment: number;
    interest: number;
    principal: number;
    balance: number;
  }

  $: totalBalance = mortgageBalance + vehicleFinanceBalance;
  $: months = Math.max(0, Math.round((retirementAge - currentAge) * 12));
  $: monthlyRate = mortgageInterestRate / 12;
  $: monthlyPayment = computePayment(totalBalance, monthlyRate, months);
  $: rows = buildAmortisation(totalBalance, monthlyRate, monthlyPayment, months, currentAge);
  $: totalInterest = rows.reduce((s, r) => s + r.interest, 0);

  function computePayment(balance: number, mRate: number, n: number): number {
    if (balance <= 0 || n <= 0) return 0;
    if (mRate === 0) return balance / n;
    const factor = Math.pow(1 + mRate, n);
    return (balance * mRate * factor) / (factor - 1);
  }

  function buildAmortisation(
    principal: number,
    mRate: number,
    payment: number,
    n: number,
    startAge: number
  ): AmortRow[] {
    if (principal <= 0 || n <= 0 || payment <= 0) return [];
    const result: AmortRow[] = [];
    let bal = principal;
    const startMonths = Math.round(startAge) * 12;
    for (let m = 1; m <= n; m++) {
      const interest = bal * mRate;
      const princ = Math.min(payment - interest, bal);
      bal = Math.max(0, bal - princ);
      const totalM = startMonths + m;
      const y = Math.floor(totalM / 12);
      const mo = totalM % 12;
      result.push({
        month: m,
        ageStr: mo === 0 ? `${y}` : `${y}y ${mo}m`,
        payment,
        interest,
        principal: princ,
        balance: bal,
      });
      if (bal < 0.5) break;
    }
    return result;
  }

  function fmtR(v: number): string {
    return 'R ' + Math.round(v).toLocaleString('en-ZA');
  }

  function onBalanceChange(e: Event) {
    const raw = (e.target as HTMLInputElement).value.replace(/[\s, ]/g, '');
    const v = parseFloat(raw);
    if (!isNaN(v) && v >= 0) mortgageBalance = v;
  }

  function onVehicleChange(e: Event) {
    const raw = (e.target as HTMLInputElement).value.replace(/[\s, ]/g, '');
    const v = parseFloat(raw);
    if (!isNaN(v) && v >= 0) vehicleFinanceBalance = v;
  }

  function onRateChange(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v >= 0 && v <= 50) mortgageInterestRate = v / 100;
  }
</script>

<div class="sheet-wrap">
  <div class="vars">
    <div class="var-group">
      <label class="var-label">Mortgage Balance</label>
      <div class="var-field">
        <span class="var-affix">R</span>
        <input
          class="var-input balance"
          type="text"
          inputmode="numeric"
          value={mortgageBalance > 0 ? mortgageBalance.toLocaleString('en-ZA') : ''}
          placeholder="0"
          on:change={onBalanceChange}
        />
      </div>
    </div>

    <div class="var-group">
      <label class="var-label">Vehicle Finance</label>
      <div class="var-field">
        <span class="var-affix">R</span>
        <input
          class="var-input balance"
          type="text"
          inputmode="numeric"
          value={vehicleFinanceBalance > 0 ? vehicleFinanceBalance.toLocaleString('en-ZA') : ''}
          placeholder="0"
          on:change={onVehicleChange}
        />
      </div>
    </div>

    <div class="var-group">
      <label class="var-label">Annual Interest Rate</label>
      <div class="var-field">
        <input
          class="var-input rate"
          type="number"
          min="0"
          max="30"
          step="0.25"
          value={+(mortgageInterestRate * 100).toFixed(3)}
          on:change={onRateChange}
        />
        <span class="var-affix suffix">% p.a.</span>
      </div>
    </div>

    <div class="var-group">
      <label class="var-label">Target Payoff</label>
      <div class="var-display">
        {#if months > 0}
          Age {retirementAge} &mdash; {months} months
        {:else}
          Set retirement age &gt; current age
        {/if}
      </div>
    </div>
  </div>

  {#if monthlyPayment > 0}
    <div class="summary">
      <div class="summary-main">
        <span class="summary-label">Required Monthly Payment</span>
        <span class="summary-payment">{fmtR(monthlyPayment)}</span>
      </div>
      <div class="summary-stats">
        {#if vehicleFinanceBalance > 0}
          <span class="stat">
            <span class="stat-label">Mortgage</span>
            <span class="stat-value">{fmtR(mortgageBalance)}</span>
          </span>
          <span class="stat-sep">+</span>
          <span class="stat">
            <span class="stat-label">Vehicle</span>
            <span class="stat-value">{fmtR(vehicleFinanceBalance)}</span>
          </span>
          <span class="stat-sep">=</span>
          <span class="stat">
            <span class="stat-label">Total</span>
            <span class="stat-value">{fmtR(totalBalance)}</span>
          </span>
          <span class="stat-sep">·</span>
        {/if}
        <span class="stat">
          <span class="stat-label">Total interest</span>
          <span class="stat-value red">{fmtR(totalInterest)}</span>
        </span>
        <span class="stat-sep">·</span>
        <span class="stat">
          <span class="stat-label">Total paid</span>
          <span class="stat-value">{fmtR(totalBalance + totalInterest)}</span>
        </span>
        <span class="stat-sep">·</span>
        <span class="stat">
          <span class="stat-label">Interest / principal</span>
          <span class="stat-value">{totalBalance > 0 ? ((totalInterest / totalBalance) * 100).toFixed(1) : 0}%</span>
        </span>
      </div>
    </div>
  {:else if totalBalance === 0}
    <div class="empty-state">Enter your outstanding balances above to generate the amortisation schedule.</div>
  {:else if months === 0}
    <div class="empty-state warn">Set retirement age greater than current age to calculate payoff schedule.</div>
  {/if}

  {#if rows.length > 0}
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th class="col-num">Month</th>
            <th class="col-age">Age</th>
            <th class="col-amt">Payment</th>
            <th class="col-amt">Interest</th>
            <th class="col-amt">Principal</th>
            <th class="col-amt">Balance</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row}
            <tr>
              <td class="mono center dim">{row.month}</td>
              <td class="mono" style="white-space: nowrap">{row.ageStr}</td>
              <td class="mono right">{fmtR(row.payment)}</td>
              <td class="mono right red">{fmtR(row.interest)}</td>
              <td class="mono right green">{fmtR(row.principal)}</td>
              <td class="mono right">{fmtR(row.balance)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .sheet-wrap {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    overflow: hidden;
  }

  /* ── Variables row ─────────────────────────────── */
  .vars {
    display: flex;
    gap: 1.25rem;
    align-items: flex-end;
    flex-shrink: 0;
    flex-wrap: wrap;
    padding: 0.55rem 0.75rem;
    background: var(--paper);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .var-group {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .var-label {
    font-family: var(--sans);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--gray);
  }

  .var-field {
    display: flex;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0.22rem 0.5rem;
    background: var(--surface);
    gap: 0.25rem;
  }

  .var-field:focus-within {
    border-color: var(--accent);
  }

  .var-affix {
    font-family: var(--mono);
    font-size: 0.75rem;
    color: var(--gray);
    user-select: none;
    flex-shrink: 0;
  }

  .var-affix.suffix { order: 2; }

  .var-input {
    font-family: var(--mono);
    font-size: 0.82rem;
    color: var(--ink);
    background: transparent;
    border: none;
    outline: none;
    text-align: right;
  }

  .var-input.balance { width: 130px; }
  .var-input.rate    { width: 52px; }

  .var-display {
    font-family: var(--mono);
    font-size: 0.82rem;
    color: var(--ink);
    padding: 0.28rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: var(--surface);
    white-space: nowrap;
  }

  /* ── Summary banner ────────────────────────────── */
  .summary {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 2rem;
    flex-wrap: wrap;
    padding: 0.55rem 0.9rem;
    background: var(--blue-light);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .summary-main {
    display: flex;
    align-items: baseline;
    gap: 0.65rem;
  }

  .summary-label {
    font-family: var(--sans);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--blue);
  }

  .summary-payment {
    font-family: var(--mono);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--blue);
  }

  .summary-stats {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .stat {
    display: flex;
    gap: 0.35rem;
    align-items: center;
  }

  .stat-label {
    font-family: var(--sans);
    font-size: 0.72rem;
    color: var(--gray);
  }

  .stat-value {
    font-family: var(--mono);
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--ink);
  }

  .stat-value.red { color: var(--red); }

  .stat-sep { color: var(--border); }

  /* ── Empty state ───────────────────────────────── */
  .empty-state {
    font-family: var(--sans);
    font-size: 0.8rem;
    color: var(--gray);
    padding: 0.4rem 0.1rem;
    font-style: italic;
    flex-shrink: 0;
  }

  .empty-state.warn { color: var(--amber); font-style: normal; }

  /* ── Amortisation table ────────────────────────── */
  .table-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
    background: var(--surface);
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  th {
    padding: 0.45rem 0.75rem;
    font-family: var(--sans);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--gray);
    background: var(--paper);
    border-bottom: 2px solid var(--border);
    text-align: left;
    white-space: nowrap;
  }

  th.col-num  { width: 64px; }
  th.col-age  { min-width: 100px; white-space: nowrap; }
  th.col-amt  { text-align: right; }

  td {
    padding: 0.22rem 0.75rem;
    border-bottom: 1px solid var(--paper);
  }

  tbody tr:hover { background: var(--accent-light); }

  .mono        { font-family: var(--mono); }
  .center      { text-align: center; }
  .right       { text-align: right; }
  .nowrap      { white-space: nowrap; }
  .dim         { color: var(--gray); }
  .red         { color: var(--red); }
  .green       { color: var(--green); }
</style>
