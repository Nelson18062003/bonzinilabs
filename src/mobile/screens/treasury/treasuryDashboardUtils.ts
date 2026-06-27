/**
 * Pure helpers for the treasury dashboard (period presets, date range, number
 * formatting, rate conversion). Kept in their own module so both the mobile and
 * desktop dashboards can share them without mixing non-component exports into a
 * component file (which would break React Fast Refresh).
 */

export type Preset = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

export const PRESETS: { value: Preset; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Année' },
  { value: 'all', label: 'Tout' },
  { value: 'custom', label: 'Custom' },
];

export function getRange(preset: Preset, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  switch (preset) {
    case 'day':
      from.setHours(0, 0, 0, 0);
      break;
    case 'week': {
      // Monday-based start.
      const dayOfWeek = from.getDay() || 7; // Sun=7
      from.setDate(from.getDate() - (dayOfWeek - 1));
      from.setHours(0, 0, 0, 0);
      break;
    }
    case 'month':
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
    case 'quarter': {
      const m = from.getMonth();
      const startMonth = m - (m % 3);
      from.setMonth(startMonth, 1);
      from.setHours(0, 0, 0, 0);
      break;
    }
    case 'year':
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      break;
    case 'all':
      from.setFullYear(2020, 0, 1);
      from.setHours(0, 0, 0, 0);
      break;
    case 'custom':
      return {
        from: customFrom ? new Date(customFrom + 'T00:00:00') : new Date(to.getFullYear(), to.getMonth(), 1),
        to: customTo ? new Date(customTo + 'T23:59:59') : to,
      };
  }
  return { from, to };
}

export function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** "1M XAF → X CNY" representation of a XAF/CNY rate. */
export function toCnyPer1MXaf(xafPerCny: number | null | undefined): number | null {
  if (xafPerCny === null || xafPerCny === undefined || !Number.isFinite(xafPerCny) || xafPerCny <= 0) return null;
  return 1_000_000 / xafPerCny;
}
