/**
 * Croissance d'un volume — dépôts ou paiements, isolément.
 *
 * Le graphique « Flux financier » superpose les deux séries pour répondre à
 * une question de trésorerie : est-ce qu'il entre plus qu'il ne sort ? Il
 * répond mal à une autre question, qui est celle de la croissance : est-ce
 * que MON volume de dépôts progresse ? Sur des barres jumelées, une série
 * écrase l'autre dès que les ordres de grandeur diffèrent, et l'œil compare
 * les deux séries au lieu de suivre l'une dans le temps.
 *
 * D'où ce bloc, un par flux :
 *   · les BARRES donnent le volume de chaque période — le rythme ;
 *   · la COURBE donne le cumul depuis le début de la période — la pente,
 *     c'est-à-dire la croissance elle-même ;
 *   · l'en-tête donne le total, le nombre d'opérations, le ticket moyen, le
 *     pic, et la variation par rapport à la période précédente.
 *
 * Les deux axes portent des montants ENTIERS, comme partout ailleurs.
 */
import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrencyFull, formatInteger } from '@/components/analytics';
import type { VolumeReport } from '@/hooks/analytics/useAnalytics';
import { bucketAxisLabel, type DateRange } from '@/lib/analytics/dateRange';
import { LABEL, Block, ChartSkeleton, EmptyBlock, DeltaBadge } from './dashboardKit';

interface Props {
  title: string;
  description: string;
  report: VolumeReport | undefined;
  loading: boolean;
  /** La plage courante : pour donner du contexte aux étiquettes de l'axe. */
  range: DateRange;
  /** Couleur des barres — la même que la série correspondante du flux. */
  color: string;
  /** Couleur de la courbe cumulée. */
  cumulativeColor: string;
  /** « opérations » / « dépôts » — l'unité comptée. */
  unit: string;
  height?: number;
}

/** Un chiffre-clé de l'en-tête du bloc. */
function HeadStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className={LABEL}>{label}</div>
      <div className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

export function VolumeGrowthBlock({
  title,
  description,
  report,
  loading,
  range,
  color,
  cumulativeColor,
  unit,
  height = 280,
}: Props) {
  const data = useMemo(() => {
    let running = 0;
    return (report?.series ?? []).map((p) => {
      running += p.amountXAF;
      return {
        label: p.label,
        axisLabel: bucketAxisLabel(new Date(p.bucket), range.granularity, range),
        volume: p.amountXAF,
        cumul: running,
        ops: p.opCount,
      };
    });
  }, [report, range]);

  const empty = data.length === 0 || data.every((p) => p.volume === 0);

  return (
    <Block
      title={title}
      description={description}
      toolbar={
        report && !loading ? (
          <div className="flex items-center gap-2">
            <span className={LABEL}>vs période précédente</span>
            <DeltaBadge value={report.trendPct} />
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <ChartSkeleton height={height} />
      ) : empty ? (
        <EmptyBlock height={height}>Aucun mouvement sur la période.</EmptyBlock>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 border-b border-border pb-3 sm:grid-cols-4">
            <HeadStat label="Total" value={formatCurrencyFull(report?.totalXAF ?? 0, 'XAF')} />
            <HeadStat label={unit} value={formatInteger(report?.opCount ?? 0)} />
            <HeadStat label="Ticket moyen" value={formatCurrencyFull(report?.avgXAF ?? 0, 'XAF')} />
            <HeadStat
              label="Pic"
              value={
                report?.peak
                  ? `${report.peak.label} · ${formatCurrencyFull(report.peak.amountXAF, 'XAF')}`
                  : '—'
              }
            />
          </div>

          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="axisLabel"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              {/* Deux axes Y, deux échelles — et c'était illisible : quand les
                  deux maxima coïncident (tout le volume dans un seul seau), les
                  deux axes affichent les MÊMES nombres, et rien ne dit lequel
                  va avec quoi. Chaque axe porte donc son titre ET la couleur
                  de sa série. Toujours en chiffres entiers, d'où la largeur —
                  on élargit l'axe plutôt que d'abréger en « 18,4 M ». */}
              <YAxis
                yAxisId="periode"
                tick={{ fontSize: 11, fill: color }}
                tickFormatter={(v) => formatInteger(Number(v))}
                axisLine={false}
                tickLine={false}
                width={112}
                label={{ value: 'Volume de la période', angle: -90, position: 'insideLeft', offset: 12, style: { fontSize: 10.5, fill: color, fontWeight: 600 } }}
              />
              <YAxis
                yAxisId="cumul"
                orientation="right"
                tick={{ fontSize: 11, fill: cumulativeColor }}
                tickFormatter={(v) => formatInteger(Number(v))}
                axisLine={false}
                tickLine={false}
                width={118}
                label={{ value: 'Cumul', angle: 90, position: 'insideRight', offset: 12, style: { fontSize: 10.5, fill: cumulativeColor, fontWeight: 600 } }}
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
                formatter={(value, name, item) => {
                  const v = Number(value);
                  if (name === 'Cumul') return [formatCurrencyFull(v, 'XAF'), 'Cumul depuis le début'];
                  const ops = (item?.payload as { ops?: number } | undefined)?.ops ?? 0;
                  return [`${formatCurrencyFull(v, 'XAF')} · ${formatInteger(ops)} ${unit.toLowerCase()}`, 'Volume'];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="periode" dataKey="volume" name="Volume" fill={color} radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Line
                yAxisId="cumul"
                type="monotone"
                dataKey="cumul"
                name="Cumul"
                stroke={cumulativeColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </Block>
  );
}
