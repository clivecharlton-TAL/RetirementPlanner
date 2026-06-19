<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ApexCharts from 'apexcharts';
  import { formatZARCompact, formatZAR } from '../lib/formatter';

  export let name: string;
  export let color: string;
  export let returnRate: number;
  export let data: { age: number; balance: number }[];

  let el: HTMLDivElement;
  let chart: ApexCharts | null = null;

  // Tooltip state
  let tipVisible = false;
  let tipX = 0;
  let tipY = 0;
  let tipAge = 0;
  let tipBalance = 0;

  function rowIndexFromClientX(clientX: number): number {
    if (!chart || !el || !data.length) return -1;
    try {
      const g    = (chart as any).w?.globals;
      const rect = el.getBoundingClientRect();
      const plotX = clientX - rect.left - (g?.translateX ?? 0);
      const w     = g?.gridWidth ?? rect.width;
      const ratio = Math.max(0, Math.min(1, plotX / w));
      return Math.round(ratio * (data.length - 1));
    } catch {
      return -1;
    }
  }

  function onMouseMove(e: MouseEvent) {
    tipX = e.clientX;
    tipY = e.clientY;
    const idx = rowIndexFromClientX(e.clientX);
    if (idx < 0 || idx >= data.length) { tipVisible = false; return; }
    tipAge = data[idx].age;
    tipBalance = data[idx].balance;
    tipVisible = true;
  }

  function onMouseLeave() { tipVisible = false; }

  function buildOptions(d: { age: number; balance: number }[]) {
    return {
      chart: {
        type: 'area',
        height: 160,
        toolbar: { show: false },
        animations: { enabled: false },
        fontFamily: 'IBM Plex Sans, -apple-system, sans-serif',
        background: 'transparent',
        zoom: { enabled: false },
        sparkline: { enabled: false },
      },
      series: [{
        name,
        data: d.map(p => ({ x: p.age, y: Math.round(p.balance) })),
      }],
      colors: [color],
      fill: {
        type: 'gradient',
        gradient: { shade: 'light', type: 'vertical', opacityFrom: 0.35, opacityTo: 0.04 },
      },
      stroke: { curve: 'smooth', width: 2 },
      xaxis: {
        type: 'numeric',
        title: { text: 'Age', style: { fontFamily: 'IBM Plex Sans', fontSize: '10px', color: '#6b7280' } },
        labels: {
          formatter: (v: string) => String(Math.round(parseFloat(v))),
          style: { fontFamily: 'IBM Plex Mono', fontSize: '10px' },
        },
        tickAmount: Math.min(10, d.length),
      },
      yaxis: {
        labels: {
          formatter: formatZARCompact,
          style: { fontFamily: 'IBM Plex Mono', fontSize: '10px' },
        },
      },
      tooltip: { enabled: false },
      legend: { show: false },
      grid: { borderColor: '#d1cdc4', strokeDashArray: 3 },
      theme: { mode: 'light' },
    };
  }

  onMount(() => {
    chart = new ApexCharts(el, buildOptions(data));
    chart.render();
  });

  onDestroy(() => chart?.destroy());

  $: if (chart) chart.updateOptions(buildOptions(data), true, false);

  $: finalBalance = data[data.length - 1]?.balance ?? 0;
  $: initialBalance = data[0]?.balance ?? 0;
  $: growth = initialBalance > 0 ? (finalBalance - initialBalance) / initialBalance : 0;
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="fund-card">
  <div class="fund-header">
    <div class="fund-title-row">
      <span class="fund-dot" style="background:{color}"></span>
      <span class="fund-name">{name}</span>
      <span class="fund-rate">{(returnRate * 100).toFixed(1)}% p.a.</span>
    </div>
    <div class="fund-stats">
      <span class="stat-item">
        <span class="stat-label">Start</span>
        <span class="stat-val">{formatZARCompact(initialBalance)}</span>
      </span>
      <span class="stat-arrow">→</span>
      <span class="stat-item">
        <span class="stat-label">At retirement</span>
        <span class="stat-val" style="color:{color}">{formatZARCompact(finalBalance)}</span>
      </span>
      <span class="stat-growth" class:positive={growth > 0}>
        {growth >= 0 ? '+' : ''}{(growth * 100).toFixed(0)}%
      </span>
    </div>
  </div>
  <div
    class="chart-wrap"
    bind:this={el}
    on:mousemove={onMouseMove}
    on:mouseleave={onMouseLeave}
  ></div>
</div>

{#if tipVisible}
  {@const tipLeft = tipX + 14 + 160 > window.innerWidth ? tipX - 174 : tipX + 14}
  <div class="tip" style="left:{tipLeft}px; top:{tipY - 10}px">
    <div class="tip-head">Age {tipAge}</div>
    <div class="tip-row">
      <span>{name}</span>
      <span class="mono">{formatZAR(tipBalance)}</span>
    </div>
  </div>
{/if}

<style>
  .fund-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .fund-header {
    padding: 0.55rem 0.75rem 0.3rem;
    border-bottom: 1px solid var(--border);
    background: var(--paper);
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .fund-title-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .fund-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .fund-name {
    font-family: var(--sans);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--ink);
    flex: 1;
  }

  .fund-rate {
    font-family: var(--mono);
    font-size: 0.68rem;
    color: var(--gray);
  }

  .fund-stats {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .stat-label {
    font-family: var(--sans);
    font-size: 0.58rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--gray);
  }

  .stat-val {
    font-family: var(--mono);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--ink);
  }

  .stat-arrow {
    font-size: 0.72rem;
    color: var(--border);
    padding-top: 0.9rem;
  }

  .stat-growth {
    margin-left: auto;
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--gray);
    padding-top: 0.9rem;
  }

  .stat-growth.positive { color: var(--green); }

  .chart-wrap {
    padding: 0.25rem 0.25rem 0;
  }

  /* ── Tooltip ───────────────────────────────── */
  .tip {
    position: fixed;
    z-index: 999;
    pointer-events: none;
    padding: 7px 10px;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 12px;
    color: var(--ink);
    background: var(--paper);
    border: 1px solid var(--border);
    border-radius: 4px;
    min-width: 160px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  }

  .tip-head {
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--gray);
    margin-bottom: 4px;
  }

  .tip-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    color: var(--gray);
  }

  .tip-row .mono {
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 600;
    color: var(--ink);
  }
</style>
