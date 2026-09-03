/**
 * Croissance clients — la COURBE du parc, et rien d'autre.
 *
 * Deux corrections successives, toutes deux signalées par l'utilisateur.
 *
 * 1. Le graphique ne traçait RIEN : la série lisait `dataKey="count"` sur des
 *    points qui exposent `newClients` et `cumulative`. Recharts ne se plaint
 *    pas d'une clé absente, il dessine du vide — un graphique blanc sous un
 *    titre plein, indistinguable d'une période sans inscription. Garde-fou :
 *    les clés du graphique sont vérifiées à la COMPILATION contre le type des
 *    lignes (`GROWTH_KEYS satisfies Record<…, keyof GrowthRow>`), et un test
 *    rend le bloc pour vérifier que les chiffres en sortent.
 *
 * 2. « Il a une ligne, mais il a aussi des barres dedans, je ne comprends pas
 *    ce graphique. » C'était un graphique combiné : des barres (les nouveaux
 *    de chaque seau) et une aire (le total cumulé), sur deux axes de sens
 *    différents. Deux grandeurs, deux échelles, une seule surface : illisible.
 *    Les barres sont parties. Reste l'AIRE — le parc de clients au fil du
 *    temps, qui est exactement « comment ma clientèle grandit ».
 *
 * Le nombre de nouveaux par seau n'est pas perdu pour autant : l'infobulle le
 * donne, et l'en-tête donne le total de la période, le pic et la variation.
 * Le RYTHME (semaine après semaine, mois après mois) a désormais son propre
 * graphique — voir `GrowthMatrixBlock`.
 *
 * L'axe part du total au DÉBUT de la période, pas de zéro : de 1 180 à 1 240,
 * une échelle depuis zéro donnerait une ligne plate.
 */
import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { formatInteger } from '@/components/analytics';
import type { ClientGrowthPoint, ClientGrowthReport } from '@/hooks/analytics/useAnalytics';
import { bucketAxisLabel, type DateRange } from '@/lib/analytics/dateRange';
import { NUM, LABEL, Block, ChartSkeleton, EmptyBlock, DeltaBadge } from './dashboardKit';

export interface GrowthRow {
  label: string;
  axisLabel: string;
  nouveaux: number;
  total: number;
}

/**
 * Les clés lues par le graphique — vérifiées à la compilation contre
 * `GrowthRow`. `total` est la série dessinée ; `nouveaux` est lu par
 * l'infobulle. Une clé qui n'existe pas ne compile pas.
 */
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
 * Le bas de l'axe : juste sous le total de départ, avec une marge
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

/**
 * L'infobulle porte les DEUX chiffres — le total et les nouveaux du seau —
 * alors qu'une seule série est dessinée. C'est ce qui permet de retirer les
 * barres sans perdre l'information qu'elles portaient.
 */
function GrowthTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: GrowthRow }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-[12px] shadow-md">
      <p className="mb-1 font-semibold text-foreground">{row.label}</p>
      <p className="flex items-center gap-4">
        <span className="text-muted-foreground">Total clients</span>
        <span className={cn('ml-auto font-bold text-foreground', NUM)}>{formatInteger(row.total)}</span>
      </p>
      <p className="flex items-center gap-4">
        <span className="text-muted-foreground">Nouveaux</span>
        <span className={cn('ml-auto font-bold text-foreground', NUM)}>{formatInteger(row.nouveaux)}</span>
      </p>
    </div>
  );
}

export function ClientGrowthBlock({
  report,
  loading,
  range,
  color,
  height = 300,
}: {
  report: ClientGrowthReport | undefined;
  loading: boolean;
  range: DateRange;
  /** Couleur de la courbe du parc. */
  color: string;
  height?: number;
}) {
  const rows = useMemo(() => buildClientGrowthRows(report?.points ?? [], range), [report, range]);
  const floor = report ? totalAxisFloor(report.totalAtStart, report.totalAtEnd) : 0;

  return (
    <Block
      title="Parc de clients"
      description="Le total de clients au fil de la période"
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
            <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <defs>
                <linearGradient id="clientGrowthArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
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
              {/* UN seul axe : une seule série. Les deux axes d'avant
                  servaient les barres disparues. */}
              <YAxis
                domain={[floor, 'auto']}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => formatInteger(Number(v))}
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <Tooltip content={<GrowthTooltip />} />
              <Area
                type="monotone"
                dataKey={GROWTH_KEYS.total}
                name="Total clients"
                stroke={color}
                strokeWidth={2}
                fill="url(#clientGrowthArea)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}
    </Block>
  );
}
