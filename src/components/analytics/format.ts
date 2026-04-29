/**
 * Formatting helpers for analytics primitives.
 * Locale is pinned to French (France) and currency formats use
 * thin-space grouping which is the Bonzini convention.
 */

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nfCompact = new Intl.NumberFormat('fr-FR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const pctFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

export function formatInteger(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return nf.format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return nfCompact.format(value);
}

export function formatCurrency(
  value: number | null | undefined,
  currency: 'XAF' | 'RMB' | 'CNY' = 'XAF',
  options: { compact?: boolean } = {},
): string {
  if (value == null || Number.isNaN(value)) return '—';
  const symbol = currency === 'XAF' ? 'XAF' : '¥';
  const formatted = options.compact ? nfCompact.format(value) : nf.format(value);
  return currency === 'XAF' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

/**
 * Always renders the full amount (never compact). Use for KPI primary
 * values, tooltips and any place where the user expects the exact figure.
 * Example: 1 200 000 XAF, ¥45 230.
 */
export function formatCurrencyFull(
  value: number | null | undefined,
  currency: 'XAF' | 'RMB' | 'CNY' = 'XAF',
): string {
  return formatCurrency(value, currency, { compact: false });
}

/**
 * Smart formatter for chart axis ticks: compact when the value would not
 * fit in a typical 60–80px tick label, else full integer. The unit symbol
 * is intentionally omitted — the axis label or chart subtitle carries it.
 */
export function formatAxisTick(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  if (Math.abs(value) < 10_000) return nf.format(value);
  return nfCompact.format(value);
}

/**
 * Computes a sensible `interval` prop for a Recharts XAxis so the
 * number of visible ticks stays around `maxTicks`. Returns 0 when all
 * labels fit, else N where 1 of every (N+1) ticks is rendered.
 */
export function chartTickInterval(dataLength: number, maxTicks = 8): number {
  if (dataLength <= maxTicks) return 0;
  return Math.ceil(dataLength / maxTicks) - 1;
}

/** Formats a decimal 0-1 (or raw number if already %) as a signed percentage. */
export function formatPercent(
  value: number | null | undefined,
  options: { withSign?: boolean } = {},
): string {
  if (value == null || Number.isNaN(value)) return '—';
  const str = pctFormatter.format(Math.abs(value));
  if (!options.withSign) return str;
  if (value > 0) return `+${str}`;
  if (value < 0) return `-${str}`;
  return str;
}

/** Computes the relative delta (curr-prev)/prev as a decimal. Handles zero. */
export function computeDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null || Number.isNaN(current) || Number.isNaN(previous)) {
    return null;
  }
  if (previous === 0) {
    if (current === 0) return 0;
    return null; // cannot compute a meaningful ratio
  }
  return (current - previous) / Math.abs(previous);
}
