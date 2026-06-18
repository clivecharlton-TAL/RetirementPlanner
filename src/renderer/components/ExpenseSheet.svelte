<script lang="ts">
  import type { ExpenseItem } from '../lib/types';

  export let expenses: ExpenseItem[];
  export let mortgagePayment: number = 0;

  $: totalBefore = mortgagePayment + expenses.reduce((s, e) => s + (e.beforeRetirement || 0), 0);
  $: totalAfter  = expenses.reduce((s, e) => s + (e.afterRetirement  || 0), 0);

  interface GroupBlock { name: string; items: ExpenseItem[] }
  $: grouped = (() => {
    const blocks: GroupBlock[] = [];
    for (const e of expenses) {
      const g = e.group || '';
      const last = blocks[blocks.length - 1];
      if (last && last.name === g) last.items.push(e);
      else blocks.push({ name: g, items: [e] });
    }
    return blocks;
  })();

  function fmtR(v: number): string {
    if (v === 0) return '—';
    const abs = Math.abs(Math.round(v)).toLocaleString('en-ZA');
    return v < 0 ? `(R ${abs})` : `R ${abs}`;
  }

  function addRowToGroup(groupName: string) {
    const id = `e${Date.now()}`;
    const newItem: ExpenseItem = { id, description: '', beforeRetirement: 0, afterRetirement: 0, group: groupName };
    const lastIdx = expenses.reduce((found, e, i) => e.group === groupName ? i : found, -1);
    if (lastIdx === -1) {
      expenses = [...expenses, newItem];
    } else {
      const arr = [...expenses];
      arr.splice(lastIdx + 1, 0, newItem);
      expenses = arr;
    }
  }

  function addRow() {
    const id = `e${Date.now()}`;
    expenses = [...expenses, { id, description: '', beforeRetirement: 0, afterRetirement: 0 }];
  }

  function removeRow(id: string) {
    expenses = expenses.filter(e => e.id !== id);
  }

  function parseAmount(raw: string): number {
    const cleaned = raw.replace(/[^0-9.\-]/g, '');
    const v = parseFloat(cleaned);
    return isNaN(v) ? 0 : v;
  }

  function updateField(id: string, field: 'description' | 'beforeRetirement' | 'afterRetirement', value: string) {
    expenses = expenses.map(e => {
      if (e.id !== id) return e;
      if (field === 'description') return { ...e, description: value };
      return { ...e, [field]: parseAmount(value) };
    });
  }
</script>

<div class="sheet-wrap">
  <div class="table-scroll">
  <table>
    <thead>
      <tr>
        <th class="col-desc">Expense</th>
        <th class="col-amount">Before Retirement (p.m.)</th>
        <th class="col-amount">After Retirement (p.m.)</th>
        <th class="col-action"></th>
      </tr>
    </thead>
    <tbody>
      {#if mortgagePayment > 0}
        <tr class="locked-row">
          <td><span class="locked-desc">Mortgage &amp; Vehicle Finance</span></td>
          <td><span class="locked-amount">{fmtR(mortgagePayment)}</span></td>
          <td><span class="locked-amount">—</span></td>
          <td class="col-action"><span class="locked-badge" title="Calculated from Mortgage tab">auto</span></td>
        </tr>
      {/if}

      {#each grouped as block}
        {#if block.name}
          {@const subBefore = block.items.reduce((s, e) => s + (e.beforeRetirement || 0), 0)}
          {@const subAfter  = block.items.reduce((s, e) => s + (e.afterRetirement  || 0), 0)}
          <tr class="group-header">
            <td class="group-name">{block.name}</td>
            <td class="group-subtotal">{fmtR(subBefore)}</td>
            <td class="group-subtotal">{fmtR(subAfter)}</td>
            <td class="col-action">
              <button class="add-to-group" on:click={() => addRowToGroup(block.name)} title="Add row to {block.name}">+</button>
            </td>
          </tr>
        {/if}
        {#each block.items as expense (expense.id)}
          <tr class:negative={expense.beforeRetirement < 0 || expense.afterRetirement < 0}>
            <td>
              <input
                class="cell-input desc"
                type="text"
                value={expense.description}
                placeholder="Description"
                on:change={(e) => updateField(expense.id, 'description', (e.target as HTMLInputElement).value)}
              />
            </td>
            <td>
              <input
                class="cell-input amount"
                class:is-negative={expense.beforeRetirement < 0}
                type="text"
                inputmode="numeric"
                value={expense.beforeRetirement !== 0 ? Math.abs(expense.beforeRetirement).toLocaleString('en-ZA') : ''}
                placeholder="0"
                on:change={(e) => updateField(expense.id, 'beforeRetirement', (e.target as HTMLInputElement).value)}
              />
            </td>
            <td>
              <input
                class="cell-input amount"
                class:is-negative={expense.afterRetirement < 0}
                type="text"
                inputmode="numeric"
                value={expense.afterRetirement !== 0 ? Math.abs(expense.afterRetirement).toLocaleString('en-ZA') : ''}
                placeholder="0"
                on:change={(e) => updateField(expense.id, 'afterRetirement', (e.target as HTMLInputElement).value)}
              />
            </td>
            <td class="col-action">
              <button class="remove" on:click={() => removeRow(expense.id)} title="Remove">×</button>
            </td>
          </tr>
        {/each}
      {/each}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td class="total-label">Monthly Total</td>
        <td class="total-amount" class:over={totalBefore > 0}>{fmtR(totalBefore)}</td>
        <td class="total-amount" class:over={totalAfter > 0}>{fmtR(totalAfter)}</td>
        <td></td>
      </tr>
      <tr class="annual-row">
        <td class="total-label">Annual Total</td>
        <td class="total-amount">{fmtR(totalBefore * 12)}</td>
        <td class="total-amount">{fmtR(totalAfter * 12)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
  </div>

  <button class="add-row" on:click={addRow}>+ Add expense</button>
</div>

<style>
  .sheet-wrap {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    gap: 0.5rem;
    overflow: hidden;
  }

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
    z-index: 2;
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

  th.col-amount { text-align: right; width: 180px; }
  th.col-action { width: 32px; }

  /* ── Group headers ──────────────────── */
  .group-header {
    position: sticky;
    top: 36px;
    z-index: 1;
    background: var(--paper);
  }

  .group-header td {
    padding: 0.3rem 0.75rem 0.2rem;
    border-bottom: 1px solid var(--border);
    border-top: 2px solid var(--border);
  }

  .group-name {
    font-family: var(--mono);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .group-subtotal {
    font-family: var(--mono);
    font-size: 0.68rem;
    font-weight: 600;
    text-align: right;
    color: var(--gray);
    padding: 0.3rem 0.75rem 0.2rem;
    border-bottom: 1px solid var(--border);
    border-top: 2px solid var(--border);
  }

  .add-to-group {
    background: none;
    border: 1px solid var(--border);
    color: var(--gray);
    font-size: 0.8rem;
    line-height: 1;
    padding: 0 0.3rem;
    border-radius: 2px;
    cursor: pointer;
    font-family: var(--mono);
  }

  .add-to-group:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-light);
  }

  /* ── Data rows ──────────────────────── */
  tbody tr:not(.group-header):not(.locked-row):hover { background: var(--accent-light); }
  tbody tr.negative td { color: var(--green); }

  td {
    padding: 0.2rem 0.4rem;
    border-bottom: 1px solid var(--paper);
  }

  .cell-input {
    width: 100%;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 2px;
    padding: 0.2rem 0.4rem;
    font-family: var(--sans);
    font-size: 0.78rem;
    color: var(--ink);
    outline: none;
  }

  .cell-input.desc { font-family: var(--sans); }
  .cell-input.amount { font-family: var(--mono); text-align: right; }
  .cell-input.amount.is-negative { color: var(--green); }

  .cell-input:focus {
    border-color: var(--accent);
    background: var(--surface);
  }

  .remove {
    background: none;
    border: none;
    color: var(--gray);
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0.1rem 0.3rem;
    border-radius: 2px;
    line-height: 1;
  }

  .remove:hover { color: var(--red); background: var(--red-light); }

  /* ── Footer ─────────────────────────── */
  tfoot {
    position: sticky;
    bottom: 0;
    z-index: 1;
  }

  tfoot tr { border-top: 2px solid var(--border); }

  .total-row td { padding: 0.4rem 0.75rem; background: var(--paper); }
  .annual-row td { padding: 0.3rem 0.75rem; background: var(--paper); }

  .total-label {
    font-family: var(--sans);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--gray);
  }

  .total-amount {
    font-family: var(--mono);
    font-size: 0.82rem;
    font-weight: 700;
    text-align: right;
    color: var(--ink);
  }

  .total-amount.over { color: var(--accent); }

  .annual-row .total-amount {
    font-size: 0.72rem;
    font-weight: 400;
    color: var(--gray);
  }

  .add-row {
    align-self: flex-start;
    font-family: var(--sans);
    font-size: 0.72rem;
    color: var(--accent);
    background: none;
    border: 1px solid var(--accent);
    border-radius: 3px;
    padding: 0.25rem 0.6rem;
    cursor: pointer;
  }

  .add-row:hover { background: var(--accent-light); }

  /* ── Locked mortgage row ────────────── */
  .locked-row td { background: var(--blue-light); border-bottom: 1px solid var(--border); }

  .locked-desc {
    display: block;
    padding: 0.2rem 0.4rem;
    font-family: var(--sans);
    font-size: 0.78rem;
    color: var(--blue);
    font-weight: 500;
  }

  .locked-amount {
    display: block;
    padding: 0.2rem 0.4rem;
    font-family: var(--mono);
    font-size: 0.78rem;
    color: var(--blue);
    text-align: right;
  }

  .locked-badge {
    display: inline-block;
    font-family: var(--mono);
    font-size: 0.58rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--blue);
    border: 1px solid var(--blue);
    border-radius: 2px;
    padding: 0 0.3rem;
    opacity: 0.7;
  }
</style>
