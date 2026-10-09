// ============================================================
// Tableau de bord des ventes — la tuile d'un chiffre : son nom, sa valeur
// (l'unité plus petite), une ligne qui l'éclaire (« 23 paiements »), la
// tendance par rapport à la plage précédente et la mini-courbe de la plage.
// Cliquable (`onClick`) : elle choisit alors l'indicateur du graphique.
//
// Deux façons de la remplir :
//   <KpiTile metric="payments_xaf" data={series.team} />     tout est calculé
//   <KpiTile label="Conversion" value="19 %" sub="18 sur 95" /> à la main
// ============================================================
import type { CSSProperties, ReactNode } from 'react';
import type { SalesGrain, SalesPoint, SalesTotals } from '@/hooks/useSales';
import { cn } from '@/lib/utils';
import {
  SALES_METRICS,
  isCurrentPeriod,
  metricDelta,
  metricSub,
  metricValues,
  valueParts,
  type SalesDelta,
  type SalesMetricKey,
  type SalesUnit,
} from '@/lib/salesSeries';
import { DeltaBadge, PANEL, Skeleton, Sparkline } from './primitives';

export interface KpiTileData {
  totals: SalesTotals;
  previous_totals?: SalesTotals | null;
  points?: SalesPoint[] | null;
}

export interface KpiTileProps {
  /** L'indicateur : libellé, valeur, ligne du dessous, tendance et courbe se déduisent de `data`. */
  metric?: SalesMetricKey;
  data?: KpiTileData | null;
  /** Remplacent ce qui est déduit (ou servent seuls, sans `metric`). */
  label?: ReactNode;
  value?: ReactNode;
  unit?: string | null;
  sub?: ReactNode;
  delta?: SalesDelta | null;
  /** L'unité de l'écart (« +3 » pour un petit compte, « +12 % » sinon). */
  deltaUnit?: SalesUnit;
  spark?: number[] | null;
  /** Le dernier point de la courbe est la période en cours (point creux). Déduit de `grain` s'il est donné. */
  sparkCurrent?: boolean;
  /** Le grain des points : la tuile reconnaît alors seule la période en cours. */
  grain?: SalesGrain;
  /** « Aujourd'hui » (captures, tests) ; défaut : maintenant. */
  now?: Date;
  /** « par rapport aux 3 mois précédents » (survol, lecteur d'écran). */
  compareLabel?: string;
  /** Rendue comme un bouton : choisit l'indicateur du graphique. */
  onClick?: () => void;
  selected?: boolean;
  loading?: boolean;
  className?: string;
}

export function KpiTile({
  metric,
  data,
  label,
  value,
  unit,
  sub,
  delta,
  deltaUnit,
  spark,
  sparkCurrent,
  grain,
  now,
  compareLabel,
  onClick,
  selected,
  loading,
  className,
}: KpiTileProps) {
  const def = metric ? SALES_METRICS[metric] : null;
  const parts = def && data ? valueParts(def.unit, data.totals[def.key]) : null;
  const shownLabel = label ?? def?.label ?? '';
  const shownValue = value ?? parts?.number ?? '—';
  const shownUnit = unit !== undefined ? unit : (parts?.unit ?? null);
  const shownSub = sub !== undefined ? sub : def && data ? metricSub(def.key, data.totals) : null;
  const shownDelta = delta !== undefined ? delta : def && data?.previous_totals ? metricDelta(def.key, data.totals, data.previous_totals) : null;
  const shownSpark = spark !== undefined ? spark : def && data?.points ? metricValues(data.points, def.key) : null;
  const unitForDelta = deltaUnit ?? def?.unit ?? 'xaf';
  const lastPeriod = data?.points?.[data.points.length - 1]?.period;
  const current = sparkCurrent ?? (grain && lastPeriod ? isCurrentPeriod(lastPeriod, grain, now) : false);

  const body = loading ? (
    <>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-7 w-28" />
      <Skeleton className="mt-2 h-4 w-20" />
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-6 w-14 rounded-full" />
        <Skeleton className="h-6 w-16" />
      </div>
    </>
  ) : (
    <>
      <p className="truncate text-[14px] font-medium leading-tight text-muted-foreground" title={def?.definition}>
        {shownLabel}
      </p>
      <p className="mt-2 flex min-w-0 items-baseline gap-1 whitespace-nowrap leading-none text-foreground" title={parts?.full}>
        <span className="truncate text-[26px] font-semibold tracking-[-0.02em] sm:text-[28px]">{shownValue}</span>
        {shownUnit && <span className="shrink-0 text-[14px] font-medium text-muted-foreground">{shownUnit}</span>}
      </p>
      <p className="mt-1.5 min-h-[20px] truncate text-[14px] leading-tight text-muted-foreground">{shownSub ?? ' '}</p>
      <div className="mt-3 flex min-h-[28px] items-center justify-between gap-2">
        {shownDelta && shownDelta.kind !== 'none' ? (
          <DeltaBadge delta={shownDelta} unit={unitForDelta} compareLabel={compareLabel} />
        ) : (
          <span className="text-[13px] text-muted-foreground" title={compareLabel}>
            {shownDelta ? '—' : ''}
          </span>
        )}
        {shownSpark && shownSpark.length > 1 && <Sparkline values={shownSpark} current={current} />}
      </div>
    </>
  );

  const cls = cn(PANEL, 'sd-tile flex min-w-0 flex-col p-4 text-left', className);
  if (onClick && !loading) {
    return (
      <button type="button" onClick={onClick} aria-pressed={!!selected} className={cn(cls, 'sd-press w-full')}>
        {body}
      </button>
    );
  }
  return (
    <div className={cls} aria-busy={loading || undefined}>
      {body}
    </div>
  );
}

/**
 * La grille des tuiles : 2 colonnes sur un téléphone, autant qu'il en tient
 * ensuite (160 px au moins chacune). `columns` force un nombre à partir de
 * 1024 px (6 tuiles sur une ligne, par exemple).
 */
export function KpiGrid({ children, columns, className }: { children: ReactNode; columns?: number; className?: string }) {
  return (
    <div
      className={cn('grid min-w-0 grid-cols-2 gap-2.5 sm:gap-3 sm:[grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]', columns && 'lg:[grid-template-columns:var(--sd-cols)]', className)}
      style={columns ? ({ '--sd-cols': `repeat(${columns}, minmax(0, 1fr))` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

/** Des tuiles en chargement, à la place exacte des vraies. */
export function KpiGridSkeleton({ count = 6, columns, className }: { count?: number; columns?: number; className?: string }) {
  return (
    <KpiGrid columns={columns} className={className}>
      {Array.from({ length: count }, (_, i) => (
        <KpiTile key={i} loading />
      ))}
    </KpiGrid>
  );
}
