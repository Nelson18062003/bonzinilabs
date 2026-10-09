// ============================================================
// Tableau de bord des ventes (08/10) — le kit de graphiques et de chiffres,
// partagé par « Mes équipes › Les commerciaux », la page d'un commercial et
// « Mon mois » de l'espace commercial (/v). Calculs : src/lib/salesSeries.ts ;
// données : useSalesSeries (src/hooks/useSales.ts).
// ============================================================
export { ChartPanel, SegmentedControl, DeltaBadge, Sparkline, SeriesSwatch, Skeleton, ChartSkeleton, EmptyState, ErrorState, PANEL, useElementWidth } from './primitives';
export type { ChartPanelProps, SegmentedOption } from './primitives';
export { PeriodPicker } from './PeriodPicker';
export type { PeriodPickerProps } from './PeriodPicker';
export { KpiTile, KpiGrid, KpiGridSkeleton } from './KpiTile';
export type { KpiTileProps, KpiTileData } from './KpiTile';
export { MetricSwitcher } from './MetricSwitcher';
export type { MetricSwitcherProps } from './MetricSwitcher';
export { EvolutionChart } from './EvolutionChart';
export type { EvolutionChartProps } from './EvolutionChart';
export { CargoChart } from './CargoChart';
export type { CargoChartProps } from './CargoChart';
export { ProspectFunnel } from './ProspectFunnel';
export type { ProspectFunnelProps } from './ProspectFunnel';
export { Leaderboard } from './Leaderboard';
export type { LeaderboardProps } from './Leaderboard';
