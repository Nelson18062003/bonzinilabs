// ============================================================
// Tableau de bord des ventes — le classement des commerciaux sur la plage.
//
// Ordinateur : un tableau (rang, commercial, un chiffre par colonne avec
// sa ligne d'explication, tendance et mini-courbe de l'indicateur qui
// classe), la ligne « Équipe » en pied. Téléphone (< 768 px) : une carte par
// commercial. Les fiches archivées viennent après, en gris, sans rang. La
// pastille de couleur est celle du graphique d'évolution (même fiche, même
// couleur). Une ligne se touche tout entière (`onSelect`).
// ============================================================
import { ChevronRight } from 'lucide-react';
import type { SalesPoint, SalesSeries, SalesSeriesSource, SalesTotals } from '@/hooks/useSales';
import { cn } from '@/lib/utils';
import {
  SALES_METRICS,
  conversionRate,
  formatMetric,
  formatRate,
  isCurrentPeriod,
  metricDelta,
  metricSub,
  metricValues,
  num,
  rankSources,
  seriesColor,
  sourceSlots,
  type SalesMetricKey,
} from '@/lib/salesSeries';
import { DeltaBadge, EmptyState, SeriesSwatch, Sparkline } from './primitives';

export interface LeaderboardProps {
  series: SalesSeries;
  /** Ouvre la fiche d'un commercial ; sans elle, les lignes ne sont pas cliquables. */
  onSelect?: (sourceId: string) => void;
  /** Les colonnes, dans l'ordre (défaut : paiements, dépôts, nouveaux clients, prospects, fret avion, vols). */
  metrics?: SalesMetricKey[];
  /** L'indicateur qui classe, et qui porte la tendance et la mini-courbe (défaut : paiements). */
  rankBy?: SalesMetricKey;
  /** La ligne « Équipe » en pied (défaut : dès deux fiches). */
  showTeam?: boolean;
  /** « par rapport aux 3 mois précédents » (survol des tendances). */
  compareLabel?: string;
  now?: Date;
  className?: string;
}

const DEFAULT_COLUMNS: SalesMetricKey[] = ['payments_xaf', 'deposits_xaf', 'new_clients', 'prospects_new', 'air_kg', 'flights'];

export function Leaderboard({ series, onSelect, metrics = DEFAULT_COLUMNS, rankBy = 'payments_xaf', showTeam, compareLabel, now, className }: LeaderboardProps) {
  if (!series.sources.length) {
    return <EmptyState title="Aucun commercial pour l’instant" className={className} />;
  }
  const slots = sourceSlots(series.sources);
  const ranked = rankSources(series.sources, rankBy);
  let rank = 0;
  const rows = ranked.map((s) => ({ s, rank: s.is_active ? ++rank : null, color: seriesColor(slots.get(s.source_id) ?? null) }));
  const team = showTeam ?? series.sources.length > 1;
  const current = !!series.periods.length && isCurrentPeriod(series.periods[series.periods.length - 1], series.grain, now);
  const columns = metrics.filter((m) => m !== rankBy);

  return (
    <div className={cn('sd min-w-0', className)}>
      {/* Ordinateur et tablette */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="text-left text-[13px] text-muted-foreground">
              <th scope="col" className="w-8 py-2 pl-5 pr-1 font-medium">
                <span className="sr-only">Rang</span>
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Commercial
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {SALES_METRICS[rankBy].label}
              </th>
              {columns.map((m) => (
                <th key={m} scope="col" className="px-3 py-2 text-right font-medium">
                  {SALES_METRICS[m].short === SALES_METRICS[m].label ? SALES_METRICS[m].label : SALES_METRICS[m].short}
                </th>
              ))}
              <th scope="col" className="py-2 pl-3 pr-5 text-right font-medium">
                Évolution
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, rank: r, color }) => (
              <tr key={s.source_id} className={cn('relative border-t border-border/60', onSelect && 'sd-press', !s.is_active && 'text-muted-foreground')}>
                <td className="py-3 pl-5 pr-1 align-top text-[13px] leading-[22px] tabular-nums text-muted-foreground">{r ?? ''}</td>
                <td className="py-3 pr-3 align-top">
                  <NameCell source={s} color={color} onSelect={onSelect} />
                </td>
                <td className="px-3 py-3 text-right align-top">
                  <div className={cn('font-semibold tabular-nums', s.is_active && num(s.totals?.[rankBy]) ? 'text-foreground' : 'text-muted-foreground')}>
                    {num(s.totals?.[rankBy]) ? formatMetric(rankBy, num(s.totals?.[rankBy])) : '—'}
                  </div>
                  <div className="mt-1 flex justify-end">
                    <DeltaBadge delta={metricDelta(rankBy, s.totals, s.previous_totals)} unit={SALES_METRICS[rankBy].unit} compareLabel={compareLabel} />
                  </div>
                </td>
                {columns.map((m) => (
                  <ValueCell key={m} metric={m} totals={s.totals} active={s.is_active} />
                ))}
                <td className="py-3 pl-3 pr-5 align-middle">
                  <div className="flex items-center justify-end gap-2">
                    <Sparkline values={metricValues(s.points, rankBy)} current={current} color={color} width={80} label={`Évolution : ${SALES_METRICS[rankBy].label.toLowerCase()}`} />
                    {onSelect && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {team && (
            <tfoot>
              <tr className="border-t-2 border-border/80">
                <td className="py-3 pl-5 pr-1" />
                <th scope="row" className="py-3 pr-3 text-left text-[15px] font-semibold text-foreground">
                  Équipe
                </th>
                <td className="px-3 py-3 text-right align-top">
                  <div className="font-semibold tabular-nums text-foreground">{formatMetric(rankBy, num(series.team.totals[rankBy]))}</div>
                  <div className="mt-1 flex justify-end">
                    <DeltaBadge delta={metricDelta(rankBy, series.team.totals, series.team.previous_totals)} unit={SALES_METRICS[rankBy].unit} compareLabel={compareLabel} />
                  </div>
                </td>
                {columns.map((m) => (
                  <ValueCell key={m} metric={m} totals={series.team.totals} active strong />
                ))}
                <td className="py-3 pl-3 pr-5">
                  <div className="flex justify-end pr-6">
                    <Sparkline values={metricValues(series.team.points, rankBy)} current={current} color="var(--sd-ink)" width={80} />
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Téléphone : une carte par commercial */}
      <ul className="divide-y divide-border/60 md:hidden">
        {rows.map(({ s, rank: r, color }) => (
          <li key={s.source_id}>
            <MobileCard source={s} rank={r} color={color} metrics={columns} rankBy={rankBy} current={current} onSelect={onSelect} compareLabel={compareLabel} />
          </li>
        ))}
        {team && (
          <li>
            <MobileCard
              team
              source={{ source_id: '', label: 'Équipe', is_active: true, staff_user_id: null, points: series.team.points, totals: series.team.totals, previous_totals: series.team.previous_totals, funnel: series.team.funnel }}
              rank={null}
              color="var(--sd-ink)"
              metrics={columns}
              rankBy={rankBy}
              current={current}
              compareLabel={compareLabel}
            />
          </li>
        )}
      </ul>
    </div>
  );
}

function NameCell({ source, color, onSelect }: { source: SalesSeriesSource; color: string; onSelect?: (id: string) => void }) {
  const note = !source.is_active ? 'fiche archivée' : !source.staff_user_id ? 'sans accès' : null;
  const name = (
    <span className="flex min-w-0 items-center gap-2.5">
      <SeriesSwatch color={color} shape="dot" muted={!source.is_active} />
      <span className="min-w-0">
        <span className={cn('block truncate text-[15px] font-semibold', source.is_active ? 'text-foreground' : 'text-muted-foreground')}>{source.label}</span>
        {note && <span className="block text-[13px] text-muted-foreground">{note}</span>}
      </span>
    </span>
  );
  if (!onSelect) return name;
  return (
    <button
      type="button"
      onClick={() => onSelect(source.source_id)}
      className="max-w-full text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-md focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-foreground"
      aria-label={`Ouvrir ${source.label}`}
    >
      {name}
    </button>
  );
}

function ValueCell({ metric, totals, active, strong }: { metric: SalesMetricKey; totals: SalesTotals; active: boolean; strong?: boolean }) {
  const v = num(totals?.[metric]);
  const sub = metric === 'prospects_new' ? conversionSub(totals) : v ? metricSub(metric, totals) : null;
  return (
    <td className="px-3 py-3 text-right align-top">
      <div className={cn('tabular-nums', strong ? 'font-semibold text-foreground' : 'font-medium', active && !strong && 'text-foreground', !v && 'text-muted-foreground')}>
        {v ? formatMetric(metric, v) : '—'}
      </div>
      {sub && <div className="mt-1 whitespace-nowrap text-[13px] text-muted-foreground">{sub}</div>}
    </td>
  );
}

/** Sous le nombre de prospects : le taux de conversion (devenus clients / ajoutés sur la plage). */
function conversionSub(t: SalesTotals): string | null {
  const r = conversionRate({ won: num(t.prospects_won), total: num(t.prospects_new) });
  return r == null ? null : `${formatRate(r)} convertis`;
}

function MobileCard({
  source,
  rank,
  color,
  metrics,
  rankBy,
  current,
  onSelect,
  compareLabel,
  team,
}: {
  source: SalesSeriesSource & { points: SalesPoint[] };
  rank: number | null;
  color: string;
  metrics: SalesMetricKey[];
  rankBy: SalesMetricKey;
  current: boolean;
  onSelect?: (id: string) => void;
  compareLabel?: string;
  team?: boolean;
}) {
  const t = source.totals;
  const note = team ? null : !source.is_active ? 'fiche archivée' : !source.staff_user_id ? 'sans accès' : null;
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        {team ? null : <SeriesSwatch color={color} shape="dot" muted={!source.is_active} />}
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[16px] font-semibold', source.is_active ? 'text-foreground' : 'text-muted-foreground')}>
            {rank != null && <span className="mr-1.5 text-[14px] font-medium tabular-nums text-muted-foreground">{rank}.</span>}
            {source.label}
          </span>
          {note && <span className="block text-[13px] text-muted-foreground">{note}</span>}
        </span>
        {onSelect && !team && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">{SALES_METRICS[rankBy].label}</p>
          <p className={cn('mt-0.5 truncate text-[20px] font-semibold tracking-[-0.01em]', source.is_active ? 'text-foreground' : 'text-muted-foreground')}>
            {num(t[rankBy]) ? formatMetric(rankBy, num(t[rankBy])) : '—'}
          </p>
          <div className="mt-1">
            <DeltaBadge delta={metricDelta(rankBy, t, source.previous_totals)} unit={SALES_METRICS[rankBy].unit} compareLabel={compareLabel} />
          </div>
        </div>
        <Sparkline values={metricValues(source.points, rankBy)} current={current} color={team ? 'var(--sd-ink)' : color} width={96} height={36} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2.5">
        {metrics.map((m) => {
          const v = num(t[m]);
          return (
            <div key={m} className="min-w-0">
              <dt className="truncate text-[13px] text-muted-foreground">{SALES_METRICS[m].short}</dt>
              <dd className={cn('truncate text-[14px] font-semibold tabular-nums', v ? 'text-foreground' : 'text-muted-foreground')}>{v ? formatMetric(m, v, 'compact') : '—'}</dd>
            </div>
          );
        })}
      </dl>
    </>
  );
  if (onSelect && !team) {
    return (
      <button type="button" onClick={() => onSelect(source.source_id)} className="sd-press block w-full px-4 py-4 text-left">
        {body}
      </button>
    );
  }
  return <div className={cn('px-4 py-4', team && 'bg-muted/40')}>{body}</div>;
}
