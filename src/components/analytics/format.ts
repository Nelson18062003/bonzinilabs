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
