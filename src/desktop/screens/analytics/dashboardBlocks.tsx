/**
 * Les blocs que la reconstruction desktop avait laissés de côté, et que
 * l'utilisateur a réclamés nommément : sources d'inscription et canaux UTM,
 * répartition par pays, délai de validation.
 *
 * Trois autres avaient été restaurés puis RETIRÉS à sa demande — « statut des
 * dépôts dans le temps », « qualité des dépôts » et « évolution des taux » :
 * « tu peux supprimer ce graphique, il ne me sert à rien pour le moment ».
 * Ils ne sont pas commentés, ils sont supprimés ; l'historique git les garde,
 * et les hooks correspondants (`useDepositStatusTimeline`, `useRateHistory`,
 * `useDepositStatusSummary`) vivent toujours pour l'écran mobile.
 */
import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { formatInteger, formatPercent } from '@/components/analytics';
import type {
  CountryDistributionRow,
  RegistrationSourceStats,
  UtmSourceRow,
} from '@/hooks/analytics/useAnalytics';
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
