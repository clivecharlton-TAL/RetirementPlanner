<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ApexCharts from 'apexcharts';
  import type { ProjectionResult, ProjectionRow } from '../lib/types';
  import { formatZARCompact, formatPct } from '../lib/formatter';

  export let result: ProjectionResult;
  export let retirementAge: number;

  let el: HTMLDivElement;
  let chart: ApexCharts | null = null;

  // Svelte-owned tooltip state — updated from native DOM events
  let tipVisible = false;
  let tipX = 0;
  let tipY = 0;
  let tipRow: ProjectionRow | null = null;
  let tipLo: number | null = null;
  let tipHi: number | null = null;

  const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
  const fmtZAR  = (v: unknown) => isNum(v) ? formatZARCompact(v) : '—';
  const fmtRate = (v: number | null) => v !== null && isNum(v) ? formatPct(v) : null;

  // Map cursor clientX to the nearest row index using ApexCharts' internal plot dimensions
  function rowIndexFromClientX(clientX: number): number {
    if (!chart || !el || !result.rows.length) return -1;
    try {
      const g    = (chart as any).w?.globals;
      const rect = el.getBoundingClientRect();
      const plotX = clientX - rect.left - (g?.translateX ?? 0);
      const w     = g?.gridWidth ?? rect.width;
      const ratio = Math.max(0, Math.min(1, plotX / w));
      return Math.round(ratio * (result.rows.length - 1));
    } catch {
      return -1;
    }
  }

  function onMouseMove(e: MouseEvent) {
    tipX = e.clientX;
    tipY = e.clientY;
    const idx = rowIndexFromClientX(e.clientX);
    if (idx < 0 || idx >= result.rows.length) { tipVisible = false; return; }
    tipRow     = result.rows[idx];
    tipLo      = result.rowsLow[idx]?.endBalance  ?? null;
    tipHi      = result.rowsHigh[idx]?.endBalance ?? null;
    tipVisible = true;
  }

  function onMouseLeave() { tipVisible = false; }

  function buildOptions(r: ProjectionResult) {
    const ages  = r.rows.map((row) => row.age);
    const coneLow  = r.rowsLow.map((row)  => row.endBalance);
    const coneHigh = r.rowsHigh.map((row) => row.endBalance);
    const balances = r.rows.map((row) => row.endBalance);
    const drawdownRates = r.rows.map((row) =>
      row.drawdownRate !== null ? parseFloat((row.drawdownRate * 100).toFixed(2)) : null
    );
    const coneData = ages.map((age, i) => ({
      x: age,
      y: [Math.round(coneLow[i] ?? balances[i]), Math.round(coneHigh[i] ?? balances[i])],
    }));

    return {
      chart: {
        type: 'line',
        height: '100%',
        toolbar: { show: false },
        animations: { enabled: false },
        fontFamily: 'IBM Plex Sans, -apple-system, sans-serif',
        background: 'transparent',
        zoom: { enabled: false },
      },
      series: [
        {
          name: 'Balance',
          type: 'area',
          data: ages.map((age, i) => ({ x: age, y: Math.round(balances[i]) })),
        },
        {
          name: 'Uncertainty Band',
          type: 'rangeArea',
          data: coneData,
        },
        {
          name: 'Drawdown Rate',
          type: 'line',
          data: ages.map((age, i) => ({ x: age, y: drawdownRates[i] })),
        },
      ],
      colors: ['#1b4965', '#c45d2e', '#c45d2e'],
      fill: {
        opacity: [0.25, 0.12, 1],
        type: ['gradient', 'solid', 'solid'],
        gradient: { shade: 'light', type: 'vertical', opacityFrom: 0.35, opacityTo: 0.05 },
      },
      stroke: {
        curve: 'smooth',
        width: [2, 0, 1.5],
        dashArray: [0, 0, 3],
      },
      xaxis: {
        type: 'numeric',
        title: { text: 'Age', style: { fontFamily: 'IBM Plex Sans', fontSize: '11px', color: '#6b7280' } },
        labels: {
          formatter: (v: string) => String(Math.round(parseFloat(v))),
          style: { fontFamily: 'IBM Plex Mono', fontSize: '11px' },
        },
        tickAmount: Math.min(20, ages.length),
      },
      yaxis: [
        {
          seriesName: 'Balance',
          title: { text: 'Balance', style: { fontFamily: 'IBM Plex Sans', fontSize: '11px', color: '#6b7280' } },
          labels: { formatter: formatZARCompact, style: { fontFamily: 'IBM Plex Mono', fontSize: '11px' } },
        },
        { seriesName: 'Uncertainty Band', show: false },
        {
          seriesName: 'Drawdown Rate',
          opposite: true,
          min: 0,
          max: 25,
          title: { text: 'Drawdown Rate', style: { fontFamily: 'IBM Plex Sans', fontSize: '11px', color: '#6b7280' } },
          labels: { formatter: (v: number) => `${v.toFixed(0)}%`, style: { fontFamily: 'IBM Plex Mono', fontSize: '11px' } },
        },
      ],
      annotations: {
        xaxis: [{
          x: retirementAge,
          borderColor: '#1b4965', borderWidth: 2,
          label: { text: 'Retirement', style: { color: '#1b4965', background: '#d6e8f0', fontFamily: 'IBM Plex Sans', fontSize: '11px' } },
        }],
        yaxis: [
          {
            y: 15, seriesIndex: 2, yAxisIndex: 2,
            borderColor: '#b5830a', borderWidth: 1, strokeDashArray: 4,
            label: { text: '15%', style: { color: '#b5830a', fontFamily: 'IBM Plex Mono', fontSize: '10px', background: '#fff3cd' } },
          },
          {
            y: 17.5, seriesIndex: 2, yAxisIndex: 2,
            borderColor: '#9b2226', borderWidth: 1, strokeDashArray: 4,
            label: { text: '17.5% FSCA max', style: { color: '#9b2226', fontFamily: 'IBM Plex Mono', fontSize: '10px', background: '#f5d0d0' } },
          },
        ],
      },
      tooltip: { enabled: false },
      legend: { show: false },
      grid: { borderColor: '#d1cdc4', strokeDashArray: 3 },
      theme: { mode: 'light' },
    };
  }

  onMount(() => {
    chart = new ApexCharts(el, buildOptions(result));
    chart.render();
  });

  onDestroy(() => chart?.destroy());

  $: if (chart) chart.updateOptions(buildOptions(result), true, false);
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="chart-wrap"
  bind:this={el}
  on:mousemove={onMouseMove}
  on:mouseleave={onMouseLeave}
></div>

{#if tipVisible && tipRow}
  {@const rateStr = fmtRate(tipRow.drawdownRate)}
  <div class="tip" style="left:{tipX + 14}px; top:{tipY - 10}px">
    <div class="tip-head">Age {tipRow.age}</div>
    <div class="tip-row">
      <span>Balance</span>
      <span class="mono">{fmtZAR(tipRow.endBalance)}</span>
    </div>
    <div class="tip-row">
      <span>Range</span>
      <span class="mono">{fmtZAR(tipLo)} – {fmtZAR(tipHi)}</span>
    </div>
    {#if rateStr}
      <div class="tip-divider"></div>
      <div class="tip-row rate">
        <span>Drawdown Rate</span>
        <span class="mono">{rateStr}</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .chart-wrap {
    min-height: 260px;
    height: 300px;
    padding: 0.5rem 0.75rem 0.25rem;
  }

  .tip {
    position: fixed;
    z-index: 999;
    pointer-events: none;
    padding: 8px 10px;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 12px;
    color: var(--ink);
    background: var(--paper);
    border: 1px solid var(--border);
    border-radius: 4px;
    min-width: 190px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  }

  .tip-head {
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--gray);
    margin-bottom: 6px;
  }

  .tip-row {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 2px;
    color: var(--gray);
  }

  .tip-row .mono {
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 600;
    color: var(--ink);
  }

  .tip-row.rate .mono { color: var(--accent); }

  .tip-divider {
    border-top: 1px solid var(--border);
    margin: 4px 0;
  }
</style>
