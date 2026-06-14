<script lang="ts">
  import type { ProjectionRow } from '../lib/types';
  import { formatZAR, formatPct } from '../lib/formatter';

  export let rows: ProjectionRow[];
  export let retirementAge: number;

  function drawdownClass(row: ProjectionRow): string {
    if (row.drawdownRate === null) return '';
    if (row.drawdownRate > 0.175) return 'rate-danger';
    if (row.drawdownRate > 0.15) return 'rate-warn';
    return 'rate-ok';
  }

  function fmtDrawdown(row: ProjectionRow): string {
    if (row.drawdownRate === null) return '—';
    return formatPct(row.drawdownRate);
  }

  function fmtSavings(v: number): string {
    if (v >= 0) return formatZAR(v);
    return `(${formatZAR(Math.abs(v))})`;
  }

  function monthlyIncome(row: ProjectionRow): string {
    if (row.drawdownRate === null) return '—';
    const annual = Math.abs(row.savingsOrDrawdown) + row.netRentalIncome + row.pensionIncome;
    return formatZAR(annual / 12);
  }
</script>

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>Age</th>
        <th class="num">Balance</th>
        <th class="num">Interest</th>
        <th class="num">Savings / Drawdown</th>
        <th class="num">Net Rental</th>
        <th class="num">Pension (p.m.)</th>
        <th class="num highlight">Monthly Income</th>
        <th class="num">End Balance</th>
        <th class="num">Drawdown Rate</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row}
        <tr class:retirement-row={row.age === retirementAge} class:depleted={row.endBalance <= 0 && row.drawdownRate !== null}>
          <td class:bold={row.age === retirementAge}>{row.age}</td>
          <td class="num mono">{formatZAR(row.balance)}</td>
          <td class="num mono">{formatZAR(row.interest)}</td>
          <td class="num mono" class:drawdown={row.savingsOrDrawdown < 0}>{fmtSavings(row.savingsOrDrawdown)}</td>
          <td class="num mono">{formatZAR(row.netRentalIncome)}</td>
          <td class="num mono">{row.pensionIncome > 0 ? formatZAR(row.pensionIncome / 12) : '—'}</td>
          <td class="num mono highlight">{monthlyIncome(row)}</td>
          <td class="num mono">{formatZAR(row.endBalance)}</td>
          <td class="num mono {drawdownClass(row)}">
            {fmtDrawdown(row)}{#if row.drawdownCapped} <span class="cap-icon" title="FSCA limit applied">⚠</span>{/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-wrap {
    height: 100%;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;
    white-space: nowrap;
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--paper);
  }

  th {
    padding: 0.4rem 0.6rem;
    font-family: var(--sans);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--gray);
    border-bottom: 2px solid var(--border);
    text-align: left;
  }

  th.num { text-align: right; }

  td {
    padding: 0.3rem 0.6rem;
    border-bottom: 1px solid var(--paper);
    color: var(--ink);
  }

  td.num { text-align: right; }
  td.mono { font-family: var(--mono); }
  td.bold { font-weight: 600; }
  td.drawdown { color: var(--gray); }

  .retirement-row td { background: var(--blue-light); }
  .retirement-row td.bold { color: var(--blue); }

  .depleted td { color: var(--red); }

  th.highlight { color: var(--blue); }
  td.highlight { color: var(--blue); font-weight: 600; }

  .rate-ok { color: var(--green); }
  .rate-warn { color: var(--amber); font-weight: 600; }
  .rate-danger { color: var(--red); font-weight: 700; }

  .cap-icon {
    font-size: 0.65rem;
    cursor: help;
  }

  tbody tr:hover td { background: var(--accent-light); }
  .retirement-row:hover td { background: var(--blue-light); filter: brightness(0.97); }
</style>
