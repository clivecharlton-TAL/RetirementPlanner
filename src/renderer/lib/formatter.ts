const zarFormatter = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  currencyDisplay: 'symbol',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatZAR(value: number): string {
  return zarFormatter.format(value).replace('ZAR', 'R').replace(/\s/, '');
}

export function formatZARCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `R${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `R${(value / 1_000).toFixed(0)}K`;
  }
  return formatZAR(value);
}

export function formatPct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function parsePct(value: number): number {
  return value / 100;
}
