/**
 * Équipe · Ventes — refonte v2 (maquette 03/13). La direction seulement
 * (`canManageSales`, gardes serveur sur sales_series / sales_overview /
 * prospect_claims_pending).
 *
 * Le gros chiffre de la période (« Octobre ⌄ » : un mois, ou 3 / 6 / 12 mois,
 * 12 semaines) ; on le touche pour passer d'un indicateur à l'autre
 * (paiements, dépôts, nouveaux clients, clients, prospects, fret avion, vols,
 * bateau). Dessous : « À vérifier » et une ligne par commercial (sa valeur,
 * ses clients, son objectif du mois). « … » : + Commercial, Sources des
 * clients.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronDown, Megaphone, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useProspectClaims, useSalesOverview, useSalesSeries } from '@/hooks/useSales';
import { groupClaimsByProspect, PROSPECT_CLAIMS_PATH } from '@/hooks/useAdminNotifications';
import { currentMonth, shiftMonth } from '@/lib/sales';
import { RANGE_PRESETS, rangeForPreset, type SalesRangePreset } from '@/lib/salesSeries';
import {
  ActionSheet, BottomSheet, EmptyLine, Initials, ItemList, ItemRow, MoreButton, SectionHead, Tag, TEXT, FOCUS_RING, SURFACE, useSheet,
} from '@/mobile/designKit';
import { BOARD_METRICS, figure, fromMetrics, fromTotals, objectivePct } from './salesFigures';
import { MonthSheet, TEAM_BASE, TeamTabs, monthName } from './teamParts';

export type Period = { kind: 'month'; month: string } | { kind: 'preset'; preset: SalesRangePreset };

export function periodLabel(p: Period): string {
  return p.kind === 'month' ? monthName(p.month) : RANGE_PRESETS.find((x) => x.value === p.preset)?.label ?? '';
}

export function periodRange(p: Period) {
  return p.kind === 'month' ? { from: p.month, to: shiftMonth(p.month, 1), grain: 'month' as const } : rangeForPreset(p.preset);
}

export function SalesBoardV2() {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canManageSales')) return <Navigate to="/m" replace />;
  return <Board />;
}

/** Le choix de la période : les 12 derniers mois, ou une plage (3 / 6 / 12 mois, 12 semaines). */
export function PeriodSheet({ open, onClose, value, onChange }: { open: boolean; onClose: () => void; value: Period; onChange: (p: Period) => void }) {
  const [months, setMonths] = useState(false);
  return (
    <>
      <BottomSheet open={open && !months} onClose={onClose}>
        <h3 className={cn('mb-2 text-[22px] font-semibold leading-tight', TEXT.strong)}>La période</h3>
        <button type="button" onClick={() => setMonths(true)} className="flex min-h-[52px] w-full items-center justify-between border-b border-[#D9D9D9] text-left dark:border-[#444444]">
          <span className={cn('text-[17px] font-semibold', TEXT.strong)}>Un mois</span>
          <span className={cn('text-[16px]', TEXT.muted)}>{value.kind === 'month' ? monthName(value.month) : ''}</span>
        </button>
        {RANGE_PRESETS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => { onChange({ kind: 'preset', preset: r.value }); onClose(); }}
            className="flex min-h-[52px] w-full items-center justify-between border-b border-[#D9D9D9] text-left last:border-b-0 dark:border-[#444444]"
          >
            <span className={cn('text-[17px] font-semibold', TEXT.strong)}>{r.label}</span>
            {value.kind === 'preset' && value.preset === r.value && <span className={cn('text-[16px] font-semibold', TEXT.strong)}>✓</span>}
          </button>
        ))}
      </BottomSheet>
      <MonthSheet
        open={open && months}
        onClose={() => { setMonths(false); onClose(); }}
        value={value.kind === 'month' ? value.month : ''}
        onChange={(m) => { onChange({ kind: 'month', month: m }); setMonths(false); }}
      />
    </>
  );
}

function Board() {
  const navigate = useNavigate();
  const more = useSheet();
  const [period, setPeriod] = useState<Period>({ kind: 'month', month: currentMonth() });
  const [pick, setPick] = useState(false);
  const [metricIdx, setMetricIdx] = useState(0);
  const month = period.kind === 'month' ? period.month : currentMonth();
  const overview = useSalesOverview(month);
  const series = useSalesSeries(periodRange(period));
  const claims = useProspectClaims();
  const toVerify = useMemo(() => groupClaimsByProspect(claims.data ?? []).length, [claims.data]);

  const metric = BOARD_METRICS[metricIdx];
  const cards = useMemo(() => overview.data ?? [], [overview.data]);
  const team = series.data?.team?.totals;
  const sumMetrics = (key: typeof metric.key) => {
    if (period.kind !== 'month' || !overview.data) return null;
    const vals = cards.map((c) => fromMetrics(c.metrics, key));
    return vals.some((v) => v == null) ? null : (vals as number[]).reduce((a, b) => a + b, 0);
  };
  const total = fromTotals(team, metric.key) ?? sumMetrics(metric.key);
  const newClients = fromTotals(team, 'new_clients') ?? sumMetrics('new_clients');
  const pct = period.kind === 'month' ? objectivePct(cards, metric.objective ?? 'payments_xaf') : null;
  const big = figure(metric.key, total);

  // Une ligne par commercial : la série s'il y en a une, sinon le tableau du mois.
  const rows = useMemo(() => {
    const bySource = new Map(cards.map((c) => [c.source.id, c]));
    const list = series.data?.sources?.length
      ? series.data.sources.map((s) => ({ id: s.source_id, label: bySource.get(s.source_id)?.staff?.name || s.label, active: s.is_active, value: fromTotals(s.totals, metric.key), clients: fromTotals(s.totals, 'clients_total'), card: bySource.get(s.source_id) }))
      : cards.map((c) => ({ id: c.source.id, label: c.staff?.name || c.source.label, active: c.source.is_active, value: period.kind === 'month' ? fromMetrics(c.metrics, metric.key) : null, clients: fromMetrics(c.metrics, 'clients_total'), card: c }));
    return list.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  }, [cards, series.data, metric.key, period.kind]);

  const loading = overview.isLoading && series.isLoading;

  return (
    <div className="flex min-h-full flex-col pb-6">
      <TeamTabs tab="sales" right={<MoreButton bordered onClick={more.show} />} />

      <div className="px-5 pt-3.5">
        <div className={cn('rounded-lg border px-[18px] pb-4 pt-[18px]', SURFACE.divider)}>
          <div className="flex items-start justify-between gap-3">
            <button type="button" onClick={() => setMetricIdx((i) => (i + 1) % BOARD_METRICS.length)} className={cn('text-left text-[16px] font-medium', TEXT.muted, FOCUS_RING)}>
              {metric.label}
            </button>
            <button type="button" onClick={() => setPick(true)} className={cn('-mr-1 inline-flex h-8 items-center gap-1 rounded px-1 text-[16px] font-semibold', TEXT.strong, FOCUS_RING)}>
              {periodLabel(period)} <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={() => setMetricIdx((i) => (i + 1) % BOARD_METRICS.length)} className={cn('block w-full text-left', FOCUS_RING)} aria-label="Indicateur suivant">
            <span className={cn('mt-1.5 block text-[40px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums', TEXT.strong)}>
              {loading ? '—' : big.value}
              {big.unit && <span className={cn('ml-1.5 text-[20px] font-semibold', TEXT.muted)}>{big.unit}</span>}
            </span>
            <span className={cn('mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[16px] font-medium', TEXT.body)}>
              {metric.key !== 'new_clients' && newClients != null && <span><b className="font-bold">{newClients}</b> nouveaux clients</span>}
              {pct != null && <span><b className="font-bold">{pct} %</b> de l'objectif</span>}
            </span>
          </button>
        </div>
      </div>

      {toVerify > 0 && (
        <div className="px-5 pt-3.5">
          <button
            type="button"
            onClick={() => navigate(PROSPECT_CLAIMS_PATH)}
            className={cn('flex w-full items-center gap-3.5 rounded-lg border px-3.5 py-3 text-left active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING)}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[22px] font-bold dark:bg-[#383838]">!</span>
            <span className="min-w-0 flex-1">
              <span className={cn('block text-[17px] font-semibold', TEXT.strong)}>À vérifier</span>
              <span className={cn('block text-[15px]', TEXT.muted)}>Prospects déjà clients</span>
            </span>
            <Tag tone="pending">{toVerify}</Tag>
            <svg viewBox="0 0 24 24" className={cn('h-5 w-5 shrink-0', TEXT.muted)} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      )}

      <SectionHead title="Par commercial" />
      {loading ? (
        <ItemList>{[0, 1, 2].map((i) => <div key={i} className="my-2 h-14 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />)}</ItemList>
      ) : rows.length === 0 ? (
        <EmptyLine action={{ label: 'Ajouter un commercial', onClick: () => navigate(`${TEAM_BASE}/nouveau?role=commercial`) }}>Aucun commercial.</EmptyLine>
      ) : (
        <ItemList>
          {rows.map((r) => {
            const f = figure(metric.key, r.value);
            const p = period.kind === 'month' && r.card ? objectivePct([r.card], metric.objective ?? 'payments_xaf') : null;
            return (
              <ItemRow
                key={r.id}
                leading={<Initials name={r.label} />}
                title={r.label}
                subtitle={[r.clients != null ? `${r.clients} client${r.clients > 1 ? 's' : ''}` : null, p != null ? `${p} % de l'objectif` : null, r.active ? null : 'archivée'].filter(Boolean).join(' · ')}
                right={
                  <span className="shrink-0 text-right">
                    <span className={cn('block text-[17px] font-bold tabular-nums', TEXT.strong)}>{f.value}</span>
                    {f.unit && <span className={cn('block text-[15px]', TEXT.muted)}>{f.unit}</span>}
                  </span>
                }
                onClick={() => navigate(`${TEAM_BASE}/ventes/${r.id}`)}
              />
            );
          })}
        </ItemList>
      )}

      <PeriodSheet open={pick} onClose={() => setPick(false)} value={period} onChange={setPeriod} />
      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Commercial', hint: 'Nouvel accès', icon: UserPlus, onClick: () => navigate(`${TEAM_BASE}/nouveau?role=commercial`) },
          { label: 'Sources des clients', icon: Megaphone, onClick: () => navigate('/m/clients/sources') },
        ]}
      />
    </div>
  );
}
