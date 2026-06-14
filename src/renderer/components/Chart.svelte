<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ApexCharts from 'apexcharts';
  import type { ProjectionResult } from '../lib/types';
  import { formatZARCompact, formatPct } from '../lib/formatter';

  export let result: ProjectionResult;
  export let retirementAge: number;

  let el: HTMLDivElement;
  let chart: ApexCharts | null = null;

  function buildOptions(r: ProjectionResult) {
    const ages = r.rows.map((row) => row.age);
    const balances = r.rows.map((row) => row.endBalance);
    const drawdownRates = r.rows.map((row) =>
      row.drawdownRate !== null ? parseFloat((row.drawdownRate * 100).toFixed(2)) : null
    );
    const coneLow = r.rowsLow.map((row) => row.endBalance);
    const coneHigh = r.rowsHigh.map((row) => row.endBalance);

    const coneData = ages.map((age, i) => ({
      x: age,
      y: [
        Math.round(coneLow[i] ?? balances[i]),
        Math.round(coneHigh[i] ?? balances[i]),
      ],
    }));

    const isNum = (v: unknown): v is number => typeof v === 'number' && !isNaN(v);

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
        gradient: {
          shade: 'light',
          type: 'vertical',
          opacityFrom: 0.35,
          opacityTo: 0.05,
        },
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
      // Use seriesName bindings so Balance + Uncertainty Band share the left ZAR axis,
      // and Drawdown Rate gets the right percentage axis.
      yaxis: [
        {
          seriesName: 'Balance',
          title: { text: 'Balance', style: { fontFamily: 'IBM Plex Sans', fontSize: '11px', color: '#6b7280' } },
          labels: {
            formatter: formatZARCompact,
            style: { fontFamily: 'IBM Plex Mono', fontSize: '11px' },
          },
        },
        {
          seriesName: 'Uncertainty Band',
          show: false,
        },
        {
          seriesName: 'Drawdown Rate',
          opposite: true,
          min: 0,
          max: 25,
          title: { text: 'Drawdown Rate', style: { fontFamily: 'IBM Plex Sans', fontSize: '11px', color: '#6b7280' } },
          labels: {
            formatter: (v: number) => `${v.toFixed(0)}%`,
            style: { fontFamily: 'IBM Plex Mono', fontSize: '11px' },
          },
        },
      ],
      annotations: {
        xaxis: [
          {
            x: retirementAge,
            borderColor: '#1b4965',
            borderWidth: 2,
            label: {
              text: 'Retirement',
              style: {
                color: '#1b4965',
                background: '#d6e8f0',
                fontFamily: 'IBM Plex Sans',
                fontSize: '11px',
              },
            },
          },
        ],
        yaxis: [
          {
            y: 15,
            seriesIndex: 2,
            yAxisIndex: 2,
            borderColor: '#b5830a',
            borderWidth: 1,
            strokeDashArray: 4,
            label: { text: '15%', style: { color: '#b5830a', fontFamily: 'IBM Plex Mono', fontSize: '10px', background: '#fff3cd' } },
          },
          {
            y: 17.5,
            seriesIndex: 2,
            yAxisIndex: 2,
            borderColor: '#9b2226',
            borderWidth: 1,
            strokeDashArray: 4,
            label: { text: '17.5% FSCA max', style: { color: '#9b2226', fontFamily: 'IBM Plex Mono', fontSize: '10px', background: '#f5d0d0' } },
          },
        ],
      },
      // Custom tooltip reads directly from the local data arrays, bypassing ApexCharts'
      // rangeArea formatter quirks that cause NaN in the shared y.formatter.
      tooltip: {
        custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
          if (dataPointIndex < 0 || dataPointIndex >= ages.length) return '';
          const age = ages[dataPointIndex];
          const bal = balances[dataPointIndex];
          const lo = coneData[dataPointIndex]?.y[0];
          const hi = coneData[dataPointIndex]?.y[1];
          const rate = drawdownRates[dataPointIndex];

          const fmtZAR = (v: unknown) => isNum(v) ? formatZARCompact(v) : '—';
          const fmtRate = (v: unknown) => isNum(v) ? formatPct(v / 100) : null;
          const rateStr = fmtRate(rate);

          return `<div style="padding:8px 10px;font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:#1a1a2e;background:#f8f6f1;border:1px solid #d1cdc4;border-radius:4px;min-width:180px">
            <div style="font-weight:600;margin-bottom:6px;font-size:11px;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280">Age ${age}</div>
            <div style="display:flex;justify-content:space-between;gap:20px;margin-bottom:2px">
              <span style="color:#6b7280">Balance</span>
              <span style="font-family:'IBM Plex Mono',monospace;font-weight:600">${fmtZAR(bal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:20px;margin-bottom:2px">
              <span style="color:#6b7280">Range</span>
              <span style="font-family:'IBM Plex Mono',monospace">${fmtZAR(lo)} – ${fmtZAR(hi)}</span>
            </div>
            ${rateStr ? `<div style="display:flex;justify-content:space-between;gap:20px;border-top:1px solid #d1cdc4;margin-top:4px;padding-top:4px">
              <span style="color:#6b7280">Drawdown Rate</span>
              <span style="font-family:'IBM Plex Mono',monospace;color:#c45d2e;font-weight:600">${rateStr}</span>
            </div>` : ''}
          </div>`;
        },
      },
      legend: { show: false },
      grid: {
        borderColor: '#d1cdc4',
        strokeDashArray: 3,
      },
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

<div class="chart-wrap" bind:this={el}></div>

<style>
  .chart-wrap {
    min-height: 260px;
    height: 300px;
    padding: 0.5rem 0.75rem 0.25rem;
  }
</style>
