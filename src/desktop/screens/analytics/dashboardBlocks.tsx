/**
 * Les blocs que la reconstruction desktop avait LAISSÉS DE CÔTÉ.
 *
 * L'écran mobile consomme 21 métriques ; la première version desktop n'en
 * montrait que 13. Sept graphiques avaient disparu — sources d'inscription
 * et canaux UTM, répartition par pays, entonnoir, délai de validation, statut
 * des dépôts dans le temps, évolution des taux. L'utilisateur les a réclamés
 * nommément. Les voici, sur les atomes du design system (`dashboardKit`) et
 * avec les axes contextuels du reste de l'écran.
 */
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { formatInteger, formatPercent } from '@/components/analytics';
import type {
  CountryDistributionRow,
  DepositStatusTimelinePoint,
  RateHistoryPoint,
  RegistrationSourceStats,
  UtmSourceRow,
} from '@/hooks/analytics/useAnalytics';
import { bucketAxisLabel, type DateRange } from '@/lib/analytics/dateRange';
import {
  NUM,
  LABEL,
  Block,
  ChartSkeleton,
  EmptyBlock,
  DTable,
  DHead,
  DBody,
  DRow,
  DTh,
  DTd,
} from './dashboardKit';

const axisTick = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } as const;

const tooltipStyle = {
  contentStyle: {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: 'hsl(var(--popover-foreground))', fontWeight: 600 },
} as const;

/** « 95 min » en dessous de deux heures, « 3 h 20 » au-delà. */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  if (minutes < 120) return `${formatInteger(Math.round(minutes))} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/* ── Sources d'inscription ──────────────────────────────────────────── */

export function RegistrationSourcesBlock({
  stats,
  utm,
  loading,
}: {
  stats: RegistrationSourceStats | undefined;
  utm: ReadonlyArray<UtmSourceRow>;
  loading: boolean;
}) {
  const total = stats?.totalNew ?? 0;
  const adminPct = stats?.adminCreatedPct ?? 0;
  return (
    <Block title="Sources d'inscription" description="D'où viennent les nouveaux clients de la période">
      {loading ? (
        <ChartSkeleton height={240} />
      ) : !stats || total === 0 ? (
        <EmptyBlock height={240}>Aucune inscription sur la période.</EmptyBlock>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={LABEL}>Créés par un administrateur</div>
              <div className={cn('mt-1 text-[20px] font-bold text-foreground', NUM)}>{formatInteger(stats.adminCreated)}</div>
              <div className="text-[11.5px] text-muted-foreground">{formatPercent(adminPct)} des nouveaux</div>
            </div>
            <div>
              <div className={LABEL}>Inscrits par l'application</div>
              <div className={cn('mt-1 text-[20px] font-bold text-foreground', NUM)}>{formatInteger(stats.selfRegistered)}</div>
              <div className="text-[11.5px] text-muted-foreground">{formatPercent(1 - adminPct)} des nouveaux</div>
            </div>
          </div>
          {/* La part, en une barre : l'œil compare des longueurs mieux que
              deux pourcentages. */}
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full bg-indigo-600" style={{ width: `${adminPct * 100}%` }} />
            <div className="h-full bg-emerald-600" style={{ width: `${(1 - adminPct) * 100}%` }} />
          </div>

          <div>
            <div className={cn(LABEL, 'mb-2')}>Canaux UTM des inscriptions par l'application</div>
            {utm.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">Aucune source UTM sur la période.</p>
            ) : (
              <DTable>
                <DHead>
                  <DRow className="hover:bg-transparent">
                    <DTh>Source</DTh>
                    <DTh>Medium</DTh>
                    <DTh>Campagne</DTh>
                    <DTh align="right">Clients</DTh>
                  </DRow>
                </DHead>
                <DBody>
                  {utm.map((r) => (
                    <DRow key={`${r.source}|${r.medium}|${r.campaign}`}>
                      <DTd className="font-semibold text-foreground">{r.source}</DTd>
                      <DTd className="text-muted-foreground">{r.medium === '(none)' ? '—' : r.medium}</DTd>
                      <DTd className="text-muted-foreground">{r.campaign === '(none)' ? '—' : r.campaign}</DTd>
                      <DTd align="right" className={cn(NUM, 'font-semibold')}>{formatInteger(r.count)}</DTd>
                    </DRow>
                  ))}
                </DBody>
              </DTable>
            )}
          </div>
        </div>
      )}
    </Block>
  );
}

/* ── Répartition par pays ───────────────────────────────────────────── */

const COUNTRY_PALETTE = ['#4F46E5', '#D97706', '#059669', '#0EA5E9', '#DB2777'] as const;
const COUNTRY_OTHER = 'hsl(220 13% 65%)';
const COUNTRY_UNKNOWN = 'hsl(0 0% 78%)';

interface CountrySlice extends CountryDistributionRow {
  color: string;
}

/** Pure : top 5 + « Autres » + « Non renseigné », chacun avec sa couleur. */
export function buildCountrySlices(rows: ReadonlyArray<CountryDistributionRow>): { slices: CountrySlice[]; total: number; unknownShare: number } {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const unknown = rows.find((r) => r.key === 'unknown') ?? null;
  const known = rows.filter((r) => r.key !== 'unknown');
  const slices: CountrySlice[] = known.slice(0, 5).map((r, i) => ({ ...r, color: COUNTRY_PALETTE[i % COUNTRY_PALETTE.length] }));
  const rest = known.slice(5).reduce((s, r) => s + r.count, 0);
  if (rest > 0) slices.push({ key: 'other', country: 'Autres', count: rest, share: total === 0 ? 0 : rest / total, color: COUNTRY_OTHER });
  if (unknown) slices.push({ ...unknown, color: COUNTRY_UNKNOWN });
  return { slices, total, unknownShare: unknown && total > 0 ? unknown.count / total : 0 };
}

export function CountryDistributionBlock({
  rows,
  loading,
}: {
  rows: ReadonlyArray<CountryDistributionRow>;
  loading: boolean;
}) {
  const { slices, total, unknownShare } = useMemo(() => buildCountrySlices(rows), [rows]);
  return (
    <Block
      title="Répartition des clients par pays"
      description="Tous les clients, hors filtre période · top 5 pays + Autres"
      toolbar={
        unknownShare >= 0.1 ? (
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            {formatPercent(unknownShare)} sans pays renseigné
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <ChartSkeleton height={240} />
      ) : slices.length === 0 ? (
        <EmptyBlock height={240}>Aucun client.</EmptyBlock>
      ) : (
        <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)] md:items-center">
          <div className="relative mx-auto h-[190px] w-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="count"
                  nameKey="country"
                  innerRadius={56}
                  outerRadius={90}
                  paddingAngle={1}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                >
                  {slices.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value, name, item) => {
                    const share = (item?.payload as CountrySlice | undefined)?.share ?? 0;
                    return [`${formatInteger(Number(value))} · ${formatPercent(share)}`, String(name)];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-[22px] font-bold leading-none text-foreground', NUM)}>{formatInteger(total)}</span>
              <span className={cn(LABEL, 'mt-1')}>clients</span>
            </div>
          </div>
          <DTable>
            <DHead>
              <DRow className="hover:bg-transparent">
                <DTh>Pays</DTh>
                <DTh align="right">Clients</DTh>
                <DTh align="right">Part</DTh>
              </DRow>
            </DHead>
            <DBody>
              {slices.map((s) => (
                <DRow key={s.key}>
                  <DTd className="font-semibold text-foreground">
                    <span className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: s.color }} />
                    {s.country}
                  </DTd>
                  <DTd align="right" className={cn(NUM, 'font-semibold')}>{formatInteger(s.count)}</DTd>
                  <DTd align="right" className={cn(NUM, 'text-muted-foreground')}>{formatPercent(s.share)}</DTd>
                </DRow>
              ))}
            </DBody>
          </DTable>
        </div>
      )}
    </Block>
  );
}

/* ── Statut des dépôts dans le temps ────────────────────────────────── */

const STATUS_COLORS = { validated: '#059669', pending: '#D97706', rejected: '#DC2626' } as const;

export function DepositStatusTimelineBlock({
  points,
  loading,
  range,
  height = 260,
}: {
  points: ReadonlyArray<DepositStatusTimelinePoint> | undefined;
  loading: boolean;
  range: DateRange;
  height?: number;
}) {
  const rows = useMemo(
    () => (points ?? []).map((p) => ({ ...p, axisLabel: bucketAxisLabel(new Date(p.bucket), range.granularity, range) })),
    [points, range],
  );
  const empty = rows.length === 0 || rows.every((p) => p.validated + p.rejected + p.pending === 0);
  return (
    <Block title="Statut des dépôts dans le temps" description="Dépôts SOUMIS par période, empilés par statut actuel">
      {loading ? (
        <ChartSkeleton height={height} />
      ) : empty ? (
        <EmptyBlock height={height}>Aucun dépôt soumis sur la période.</EmptyBlock>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="axisLabel" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={44} />
            <Tooltip
              {...tooltipStyle}
              cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
              labelFormatter={(_, payload) => String(payload?.[0]?.payload?.label ?? '')}
              formatter={(v, name) => [formatInteger(Number(v)), String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="validated" stackId="s" name="Validés" fill={STATUS_COLORS.validated} maxBarSize={28} />
            <Bar dataKey="pending" stackId="s" name="En attente" fill={STATUS_COLORS.pending} maxBarSize={28} />
            <Bar dataKey="rejected" stackId="s" name="Rejetés" fill={STATUS_COLORS.rejected} radius={[3, 3, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Block>
  );
}

/* ── Évolution des taux ─────────────────────────────────────────────── */

export const RATE_METHODS = [
  { key: 'alipay', label: 'Alipay', color: '#1677ff' },
  { key: 'wechat', label: 'WeChat', color: '#07c160' },
  { key: 'virement', label: 'Virement', color: '#4F46E5' },
  { key: 'cash', label: 'Cash', color: '#EA580C' },
] as const satisfies ReadonlyArray<{ key: keyof RateHistoryPoint; label: string; color: string }>;

export interface RateInsights {
  /** Moyenne Alipay sur la période — la méthode la plus utilisée. */
  avgAlipay: number | null;
  /** Variation Alipay entre la première et la dernière publication. */
  alipayDelta: number | null;
  /** Écart moyen entre la méthode la plus chère et la moins chère. */
  avgSpread: number | null;
  /** Bornes de toutes les valeurs, pour resserrer l'axe. */
  min: number | null;
  max: number | null;
}

/** Pure : de l'historique aux chiffres de tête et aux bornes de l'axe. */
export function computeRateInsights(points: ReadonlyArray<RateHistoryPoint>): RateInsights {
  const alipay = points.map((p) => p.alipay).filter((v): v is number => v != null);
  const spreads: number[] = [];
  let min: number | null = null;
  let max: number | null = null;
  for (const p of points) {
    const vals = RATE_METHODS.map((m) => p[m.key]).filter((v): v is number => typeof v === 'number');
    for (const v of vals) {
      min = min === null ? v : Math.min(min, v);
      max = max === null ? v : Math.max(max, v);
    }
    if (vals.length >= 2) spreads.push(Math.max(...vals) - Math.min(...vals));
  }
  const first = alipay[0];
  const last = alipay[alipay.length - 1];
  return {
    avgAlipay: alipay.length === 0 ? null : alipay.reduce((s, v) => s + v, 0) / alipay.length,
    alipayDelta: first && last ? (last - first) / first : null,
    avgSpread: spreads.length === 0 ? null : spreads.reduce((s, v) => s + v, 0) / spreads.length,
    min,
    max,
  };
}

function RateStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className={LABEL}>{label}</div>
      <div className={cn('mt-0.5 truncate text-[13px] font-semibold text-foreground', NUM)}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function RateEvolutionBlock({
  points,
  loading,
  range,
  height = 280,
}: {
  points: ReadonlyArray<RateHistoryPoint> | undefined;
  loading: boolean;
  range: DateRange;
  height?: number;
}) {
  const insights = useMemo(() => computeRateInsights(points ?? []), [points]);
  const rows = useMemo(
    () =>
      (points ?? []).map((p) => ({
        ...p,
        // Une publication a une date, pas un seau : le contexte de jour suffit.
        axisLabel: bucketAxisLabel(new Date(p.bucket), 'day', range),
      })),
    [points, range],
  );
  // Domaine resserré : des taux entre 11 480 et 11 620 sur un axe qui part
  // de zéro seraient une ligne plate.
  const domain = useMemo<[number, number] | ['auto', 'auto']>(() => {
    if (insights.min === null || insights.max === null) return ['auto', 'auto'];
    const pad = Math.max((insights.max - insights.min) * 0.2, insights.max * 0.005);
    return [Math.floor(insights.min - pad), Math.ceil(insights.max + pad)];
  }, [insights]);

  return (
    <Block title="Évolution des taux" description="CNY pour 1 000 000 XAF, par méthode de paiement — chaque point est une publication">
      {loading ? (
        <ChartSkeleton height={height} />
      ) : rows.length === 0 ? (
        <EmptyBlock height={height}>Aucun taux publié sur la période.</EmptyBlock>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 border-b border-border pb-3 sm:grid-cols-4">
            <RateStat
              label="Alipay moyen"
              value={insights.avgAlipay != null ? `${formatInteger(Math.round(insights.avgAlipay))} ¥` : '—'}
            />
            <RateStat
              label="Variation Alipay"
              value={insights.alipayDelta != null ? formatPercent(insights.alipayDelta, { withSign: true }) : '—'}
              hint="première → dernière publication"
            />
            <RateStat
              label="Écart moyen entre méthodes"
              value={insights.avgSpread != null ? `${formatInteger(Math.round(insights.avgSpread))} ¥` : '—'}
              hint="la plus chère − la moins chère"
            />
            <RateStat label="Publications" value={formatInteger(rows.length)} />
          </div>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="axisLabel" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
              <YAxis
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                domain={domain}
                tickFormatter={(v) => formatInteger(Math.round(Number(v)))}
                width={64}
              />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={(_, payload) => String(payload?.[0]?.payload?.label ?? '')}
                formatter={(v, name) => [`${formatInteger(Math.round(Number(v)))} ¥`, String(name)]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {RATE_METHODS.map((m) => (
                <Line
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  name={m.label}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={rows.length <= 40 ? { r: 2.5, strokeWidth: 0 } : false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </Block>
  );
}
