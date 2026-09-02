/**
 * Croissance clients — le graphique qui « ne marchait pas ».
 *
 * Il ne marchait pas au sens propre : la courbe lisait `dataKey="count"` sur
 * des points qui exposent `newClients` et `cumulative`. Recharts ne se plaint
 * pas d'une clé absente, il trace… rien. Un graphique vide sous un titre
 * plein, indistinguable d'une période sans inscription.
 *
 * Deux garde-fous contre la récidive : les clés du graphique sont DÉRIVÉES
 * du type des lignes (`GROWTH_KEYS satisfies Record<…, keyof GrowthRow>` —
 * une clé qui n'existe pas ne compile pas), et un test rend le bloc avec des
 * points et vérifie que les chiffres en sortent.
 *
 * Et puisqu'on le refait, on le fait bien. La question posée est « est-ce
 * que ma clientèle grandit ? », qui a deux lectures :
 *   · les BARRES : combien de nouveaux clients par période — le rythme ;
 *   · l'AIRE : le total de clients au fil du temps — la pente, c'est-à-dire
 *     la croissance elle-même. Son axe part du total au DÉBUT de la période
 *     (pas de zéro), sinon 1 180 → 1 240 est une ligne plate.
 * L'en-tête donne les nouveaux, le total, le pic et la variation par rapport
 * à la période précédente.
 */
import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatInteger } from '@/components/analytics';
import type { ClientGrowthPoint, ClientGrowthReport } from '@/hooks/analytics/useAnalytics';
import { bucketAxisLabel, type DateRange } from '@/lib/analytics/dateRange';
import { LABEL, Block, ChartSkeleton, EmptyBlock, DeltaBadge } from './dashboardKit';

export interface GrowthRow {
  label: string;
  axisLabel: string;
  nouveaux: number;
  total: number;
}

/** Les clés que le graphique lit — vérifiées à la compilation contre `GrowthRow`. */
export const GROWTH_KEYS = { nouveaux: 'nouveaux', total: 'total' } as const satisfies Record<string, keyof GrowthRow>;

/** Pure : des points du hook aux lignes du graphique. Testé isolément. */
export function buildClientGrowthRows(points: ReadonlyArray<ClientGrowthPoint>, range: DateRange): GrowthRow[] {
  return points.map((p) => ({
    label: p.label,
    axisLabel: bucketAxisLabel(new Date(p.bucket), range.granularity, range),
    nouveaux: p.newClients,
    total: p.cumulative,
  }));
}

/**
 * Le bas de l'axe « Total » : juste sous le total de départ, avec une marge
 * proportionnelle à la croissance — pour que la pente occupe la hauteur.
 * Jamais négatif ; et si rien n'a bougé, une petite marge fixe.
 */
export function totalAxisFloor(totalAtStart: number, totalAtEnd: number): number {
  const growth = totalAtEnd - totalAtStart;
  const margin = growth > 0 ? Math.max(1, Math.ceil(growth * 0.6)) : Math.max(1, Math.ceil(totalAtStart * 0.02));
  return Math.max(0, totalAtStart - margin);
}

function HeadStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className={LABEL}>{label}</div>
      <div className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

export function ClientGrowthBlock({
  report,
  loading,
  range,
  color,
  totalColor,
  height = 300,
}: {
  report: ClientGrowthReport | undefined;
  loading: boolean;
  range: DateRange;
  /** Couleur des barres (nouveaux clients). */
  color: string;
  /** Couleur de l'aire (total cumulé). */
  totalColor: string;
  height?: number;
}) {
  const rows = useMemo(() => buildClientGrowthRows(report?.points ?? [], range), [report, range]);
  const floor = report ? totalAxisFloor(report.totalAtStart, report.totalAtEnd) : 0;

  return (
    <Block
      title="Croissance clients"
      description="Nouveaux clients par période, et total de clients au fil du temps"
      toolbar={
        report && !loading && report.trendPct != null ? (
          <div className="flex items-center gap-2">
            <span className={LABEL}>vs période précédente</span>
            <DeltaBadge value={report.trendPct} />
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <ChartSkeleton height={height} />
      ) : !report || rows.length === 0 ? (
        <EmptyBlock height={height}>Aucune donnée sur la période.</EmptyBlock>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 border-b border-border pb-3 sm:grid-cols-4">
            <HeadStat label="Nouveaux sur la période" value={formatInteger(report.newClients)} />
            <HeadStat label="Total clients" value={formatInteger(report.totalAtEnd)} />
            <HeadStat
              label="Pic"
              value={report.peak ? `${report.peak.label} · ${formatInteger(report.peak.newClients)}` : '—'}
            />
            <HeadStat label="Période précédente" value={formatInteger(report.previousNewClients)} />
          </div>

          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <defs>
                <linearGradient id="clientGrowthArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={totalColor} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={totalColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="axisLabel"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              {/* Deux axes, deux échelles, chacun titré et coloré comme sa
                  série — sinon deux colonnes de nombres sans propriétaire. */}
              <YAxis
                yAxisId="nouveaux"
                tick={{ fontSize: 11, fill: color }}
                tickFormatter={(v) => formatInteger(Number(v))}
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                width={64}
                label={{ value: 'Nouveaux', angle: -90, position: 'insideLeft', offset: 14, style: { fontSize: 10.5, fill: color, fontWeight: 600 } }}
              />
              <YAxis
                yAxisId="total"
                orientation="right"
                domain={[floor, 'auto']}
                tick={{ fontSize: 11, fill: totalColor }}
                tickFormatter={(v) => formatInteger(Number(v))}
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                width={72}
                label={{ value: 'Total clients', angle: 90, position: 'insideRight', offset: 14, style: { fontSize: 10.5, fill: totalColor, fontWeight: 600 } }}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                labelFormatter={(_, payload) => String(payload?.[0]?.payload?.label ?? '')}
                formatter={(value, name) => [formatInteger(Number(value)), String(name)]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                yAxisId="total"
                type="monotone"
                dataKey={GROWTH_KEYS.total}
                name="Total clients"
                stroke={totalColor}
                strokeWidth={2}
                fill="url(#clientGrowthArea)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Bar yAxisId="nouveaux" dataKey={GROWTH_KEYS.nouveaux} name="Nouveaux clients" fill={color} radius={[3, 3, 0, 0]} maxBarSize={28} />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </Block>
  );
}
