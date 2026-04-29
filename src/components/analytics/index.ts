/**
 * Primitives for the analytics / reporting UI.
 *
 * These components are deliberately opinionated so every metric is
 * rendered the same way across every dashboard. Change the KPI card
 * once → the whole app follows.
 */

export { KpiCard } from './KpiCard';
export type { KpiCardProps } from './KpiCard';

export { KpiRow } from './KpiRow';
export type { KpiRowProps } from './KpiRow';

export { ChartCard } from './ChartCard';
export type { ChartCardProps } from './ChartCard';

export { TrendBadge } from './TrendBadge';
export type { TrendBadgeProps } from './TrendBadge';

export { BreakdownBar } from './BreakdownBar';
export type { BreakdownBarProps, BreakdownItem } from './BreakdownBar';

export { DateRangePicker } from './DateRangePicker';

export { GranularityPicker, useReportGranularity } from './GranularityPicker';
export type { GranularityPickerProps } from './GranularityPicker';

export { timeXAxisProps, timeChartBottomMargin } from './chartAxis';

export { ExportButton } from './ExportButton';
export type { ExportButtonProps } from './ExportButton';

export {
  formatCurrency,
  formatCurrencyFull,
  formatAxisTick,
  chartTickInterval,
  formatInteger,
  formatCompact,
  formatPercent,
  computeDelta,
} from './format';
