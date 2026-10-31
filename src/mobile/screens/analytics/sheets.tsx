/**
 * Analyses mobile v2 — les feuilles et vues plein écran du module :
 * « … » (22), Période (23), Période personnalisée (24), Pas, Exporter (25),
 * Partager l'image (26) et Voir en tableau.
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BarChart3, CalendarDays, ChevronLeft, ChevronRight, Download, FileText, Image as ImageIcon, LineChart as LineIcon, List, Sheet as SheetIcon, Table2, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  BigButton, BottomSheet, BoxSegmented, Chip, FOCUS_RING, KVBox, SURFACE, TEXT, Tag,
} from '@/mobile/designKit';
import {
  buildRangeFromPreset, defaultGranularityOf, granularityIsCompatible, type Granularity, type PresetId,
} from '@/lib/analytics/dateRange';
import { Switch } from './parts';
import { dayKey, int, MONTH_NAMES, periodLabel, STEP_NOUN } from './format';
import { exportCsv, exportFileName, exportPdf, savePng, sharePng, copyPng, type ExportFormat } from './export';
import { useAnalyticsUi, type ChartDataset } from './state';
import {
  useActiveData, useBasketData, useClientsData, useCountriesData, useDelaysData, useDepositsData, useFlowData, useGrowthData,
  useMethodsData, useMoneyData, usePaymentsData, useSourcesData, useTeamData, useTopData, useTreasuryData,
} from './datasets';

/** Toutes les feuilles du module, pilotées par `useAnalyticsUi().sheet`. */
export function AnalyticsSheets() {
  const ui = useAnalyticsUi();
  const s = ui.sheet;
  return (
    <>
      <MenuSheet ds={s?.type === 'menu' ? s.ds : null} />
      <PeriodSheet open={s?.type === 'period'} />
      <StepSheet stepKey={s?.type === 'step' ? s.key : null} />
      <ExportSheet ds={s?.type === 'export' ? s.ds : null} open={s?.type === 'export'} />
      {s?.type === 'custom' && <CustomPeriod />}
      {s?.type === 'share' && <ShareView ds={s.ds} />}
      {s?.type === 'table' && <TableView ds={s.ds} />}
    </>
  );
}

/* ── Une ligne de feuille : rond, titre, mention, chevron ou interrupteur ── */
function SheetRow({
  icon: Icon, title, hint, onClick, right,
}: { icon: React.ElementType; title: React.ReactNode; hint?: React.ReactNode; onClick?: () => void; right?: React.ReactNode }) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn('flex min-h-[64px] w-full items-center gap-3.5 border-b py-2.5 text-left last:border-b-0', SURFACE.divider, onClick && cn('active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING))}
    >
      <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] dark:bg-[#383838]', TEXT.strong)}>
        <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[17px] font-semibold', TEXT.strong)}>{title}</span>
        {hint != null && <span className={cn('mt-0.5 block truncate text-[15px]', TEXT.muted)}>{hint}</span>}
      </span>
      {right ?? (onClick ? <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} /> : null)}
    </Wrapper>
  );
}

/* ── 22 · Le menu « … » d'un graphe ───────────────────────────────────── */
function MenuSheet({ ds }: { ds: ChartDataset | null }) {
  const ui = useAnalyticsUi();
  const navigate = useNavigate();
  const [last, setLast] = React.useState<ChartDataset | null>(ds);
  React.useEffect(() => { if (ds) setLast(ds); }, [ds]);
  const d = ds ?? last;
  return (
    <BottomSheet open={ds != null} onClose={ui.close}>
      {d && (
        <div>
          <SheetRow icon={CalendarDays} title="Période" hint={periodLabel(ui.range)} onClick={() => ui.open({ type: 'period' })} />
          {d.compare && (
            <SheetRow
              icon={LineIcon}
              title="Comparer"
              hint="À la période précédente"
              right={<Switch checked={ui.range.compareToPrevious} onChange={ui.setCompare} label="Comparer à la période précédente" />}
            />
          )}
          {d.stepKey && (
            <SheetRow icon={BarChart3} title="Pas" hint={ui.steps.map((g) => STEP_NOUN[g]).join(' · ')} onClick={() => ui.open({ type: 'step', key: d.stepKey! })} />
          )}
          {d.compare && (
            <SheetRow icon={LineIcon} title="Courbe comparée" hint="Cette période contre la précédente" onClick={() => { ui.close(); navigate(`/m/dashboard/comparer?serie=${d.key === 'depots' ? 'depots' : d.key === 'clients' ? 'clients' : 'paiements'}`); }} />
          )}
          {d.list && <SheetRow icon={List} title={d.list.label} onClick={() => { ui.close(); navigate(d.list!.href); }} />}
          <SheetRow icon={Table2} title="Voir en tableau" onClick={() => ui.open({ type: 'table', ds: d })} />
          <SheetRow icon={Download} title="Exporter" hint="CSV, PDF ou image" onClick={() => ui.open({ type: 'export', ds: d })} />
        </div>
      )}
    </BottomSheet>
  );
}

/* ── 23 · Choisir la période ──────────────────────────────────────────── */
const GROUPS: { label: string; items: PresetId[] }[] = [
  { label: 'Jour et semaine', items: ['today', 'yesterday', 'last_7_days', 'this_week', 'last_week'] },
  { label: 'Mois et plus', items: ['last_30_days', 'this_month', 'last_month', 'last_90_days', 'this_quarter', 'this_year', 'last_year', 'all_time'] },
];
const SHORT: Partial<Record<PresetId, string>> = { last_90_days: '90 jours' };
const LABEL: Record<PresetId, string> = {
  today: "Aujourd'hui", yesterday: 'Hier', last_7_days: '7 derniers jours', this_week: 'Cette semaine', last_week: 'Semaine dernière',
  last_30_days: '30 derniers jours', this_month: 'Ce mois', last_month: 'Mois dernier', last_90_days: '90 jours', this_quarter: 'Ce trimestre',
  this_year: 'Cette année', last_year: 'Année dernière', all_time: 'Tout', custom: 'Personnalisé',
};
const ALL_STEPS: Granularity[] = ['hour', 'day', 'week', 'month', 'quarter', 'year'];

function PeriodSheet({ open }: { open: boolean }) {
  const ui = useAnalyticsUi();
  const [preset, setPreset] = React.useState<PresetId>(ui.range.preset);
  const [compare, setCompare] = React.useState(ui.range.compareToPrevious);
  const [step, setStep] = React.useState<Granularity | null>(null);
  React.useEffect(() => {
    if (open) { setPreset(ui.range.preset); setCompare(ui.range.compareToPrevious); setStep(null); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pending = React.useMemo(() => (preset === 'custom' ? ui.range : buildRangeFromPreset(preset)), [preset, ui.range]);
  const options = React.useMemo(() => {
    const ok = ALL_STEPS.filter((g) => granularityIsCompatible(g, pending));
    return ok.length > 4 ? ok.slice(ok.length - 4) : ok;
  }, [pending]);
  const shownStep = step ?? (preset === ui.range.preset ? ui.range.granularity : defaultGranularityOf(pending));

  const apply = () => {
    if (preset !== ui.range.preset && preset !== 'custom') ui.setPreset(preset);
    if (compare !== ui.range.compareToPrevious) ui.setCompare(compare);
    if (step && options.includes(step)) ui.setGranularity(step);
    ui.close();
  };

  return (
    <BottomSheet open={open} onClose={ui.close}>
      <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Période</h3>
      {GROUPS.map((g) => (
        <div key={g.label}>
          <div className={cn('mt-4 text-[14px] font-semibold uppercase tracking-[0.05em]', TEXT.muted)}>{g.label}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {g.items.map((p) => (
              <Chip key={p} label={SHORT[p] ?? LABEL[p]} active={preset === p} onClick={() => { setPreset(p); setStep(null); }} />
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => ui.open({ type: 'custom' })}
        className={cn('mt-4 flex min-h-[56px] w-full items-center gap-3 border-y text-left text-[17px] font-semibold', SURFACE.divider, FOCUS_RING, TEXT.strong)}
      >
        <CalendarDays className="h-6 w-6" strokeWidth={2} />
        <span className="flex-1">{preset === 'custom' ? periodLabel(ui.range) : 'Personnalisé'}</span>
        <ChevronRight className={cn('h-5 w-5', TEXT.muted)} />
      </button>
      <div className="flex min-h-[60px] items-center justify-between gap-3">
        <span className={cn('text-[17px] font-semibold', TEXT.strong)}>Comparer à la précédente</span>
        <Switch checked={compare} onChange={setCompare} label="Comparer à la période précédente" />
      </div>
      {options.length > 1 && (
        <BoxSegmented
          ariaLabel="Pas"
          options={options.map((g) => ({ value: g, label: STEP_NOUN[g] }))}
          value={options.includes(shownStep) ? shownStep : options[0]}
          onChange={(g) => setStep(g)}
        />
      )}
      <BigButton className="mt-5" onClick={apply}>Appliquer</BigButton>
    </BottomSheet>
  );
}

/* ── Pas d'un graphe ──────────────────────────────────────────────────── */
function StepSheet({ stepKey }: { stepKey: string | null }) {
  const ui = useAnalyticsUi();
  const [key, setKey] = React.useState(stepKey);
  React.useEffect(() => { if (stepKey) setKey(stepKey); }, [stepKey]);
  return (
    <BottomSheet open={stepKey != null} onClose={ui.close}>
      <h3 className={cn('mb-4 text-[22px] font-semibold leading-tight', TEXT.strong)}>Pas</h3>
      {key && ui.steps.length > 0 && (
        <BoxSegmented
          ariaLabel="Pas"
          options={ui.steps.map((g) => ({ value: g, label: STEP_NOUN[g] }))}
          value={ui.stepFor(key)}
          onChange={(g) => { ui.setStep(key, g); ui.close(); }}
        />
      )}
    </BottomSheet>
  );
}

/* ── Les vues plein écran (24, 26, tableau) ───────────────────────────── */
function FullScreen({ title, onClose, children, dock }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; dock?: React.ReactNode }) {
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" className={cn('fixed inset-0 z-[70] flex flex-col', SURFACE.canvas)}>
      <header className={cn('border-b pt-[env(safe-area-inset-top)]', SURFACE.divider)}>
        <div className="flex h-14 items-center gap-1.5 pl-1.5 pr-4">
          <button type="button" onClick={onClose} aria-label="Fermer" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING, TEXT.strong)}>
            <X className="h-7 w-7" strokeWidth={2} />
          </button>
          <h1 className={cn('min-w-0 flex-1 truncate text-[18px] font-semibold', TEXT.strong)}>{title}</h1>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      {dock && (
        <div className={cn('border-t px-5 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3', SURFACE.divider)}>
          <div className="mx-auto flex max-w-lg flex-col gap-2.5">{dock}</div>
        </div>
      )}
    </div>
  );
}

/* ── 24 · Période personnalisée ───────────────────────────────────────── */
const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DOW = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MON = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function parseDay(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m: m - 1, d };
}
function keyOf(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function longDay(s: string): string {
  const { y, m, d } = parseDay(s);
  const dow = new Date(Date.UTC(y, m, d)).getUTCDay();
  return `${DOW[dow]} ${d}\u00A0${MON[m]}`;
}
function daysBetween(a: string, b: string): number {
  const pa = parseDay(a); const pb = parseDay(b);
  return Math.round((Date.UTC(pb.y, pb.m, pb.d) - Date.UTC(pa.y, pa.m, pa.d)) / 86_400_000) + 1;
}

function CustomPeriod() {
  const ui = useAnalyticsUi();
  const today = dayKey(new Date());
  const [from, setFrom] = React.useState(() => dayKey(ui.range.from));
  const [to, setTo] = React.useState(() => {
    const t = dayKey(new Date(ui.range.to.getTime() - 1));
    return t > today ? today : t;
  });
  const [focus, setFocus] = React.useState<'from' | 'to'>('from');
  const [view, setView] = React.useState(() => { const p = parseDay(to); return { y: p.y, m: p.m }; });
  const t = parseDay(today);
  const canNext = view.y < t.y || (view.y === t.y && view.m < t.m);

  const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const lead = (first + 6) % 7;
  const count = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => keyOf(view.y, view.m, i + 1))];

  const pick = (k: string) => {
    if (focus === 'from') {
      setFrom(k);
      if (k > to) setTo(k);
      setFocus('to');
    } else if (k < from) {
      setFrom(k);
    } else {
      setTo(k);
    }
  };
  const shift = (n: number) => setView((v) => { const d = new Date(Date.UTC(v.y, v.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const n = daysBetween(from, to);

  return (
    <FullScreen
      title="Période personnalisée"
      onClose={ui.close}
      dock={<BigButton onClick={() => { ui.setCustom(from, to); ui.close(); }}>Appliquer · {n} jour{n > 1 ? 's' : ''}</BigButton>}
    >
      <div className="grid grid-cols-2 gap-2.5 px-5 pt-4">
        {(['from', 'to'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFocus(f)}
            aria-pressed={focus === f}
            className={cn('rounded-lg px-3.5 py-2 text-left', FOCUS_RING, focus === f ? 'border-2 border-[#2C2C2C] dark:border-[#E3E3E3]' : cn('border', SURFACE.field))}
          >
            <span className={cn('block text-[14px] font-medium', TEXT.muted)}>{f === 'from' ? 'Du' : 'Au'}</span>
            <span className={cn('block text-[17px] font-semibold', TEXT.strong)}>{longDay(f === 'from' ? from : to)}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <span className={cn('text-[18px] font-semibold', TEXT.strong)}>{MONTH_NAMES[view.m]} {view.y}</span>
        <span className="flex gap-1">
          <button type="button" aria-label="Mois précédent" onClick={() => shift(-1)} className={cn('flex h-11 w-11 items-center justify-center rounded-full', FOCUS_RING, TEXT.strong)}><ChevronLeft className="h-6 w-6" /></button>
          <button type="button" aria-label="Mois suivant" disabled={!canNext} onClick={() => shift(1)} className={cn('flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-30', FOCUS_RING, TEXT.strong)}><ChevronRight className="h-6 w-6" /></button>
        </span>
      </div>
      <div className="grid grid-cols-7 px-3.5">
        {WEEK.map((w, i) => <span key={i} className={cn('flex h-8 items-center justify-center text-[14px] font-semibold', TEXT.muted)}>{w}</span>)}
        {cells.map((k, i) => {
          if (!k) return <span key={i} className="h-12" />;
          const fut = k > today;
          const edge = k === from || k === to;
          const inside = k > from && k < to;
          const d = parseDay(k).d;
          return (
            <span key={i} className={cn('relative flex h-12 items-center justify-center', (inside || (edge && from !== to)) && 'bg-[#F5F5F5] dark:bg-[#383838]', k === from && from !== to && 'rounded-l-full', k === to && from !== to && 'rounded-r-full')}>
              <button
                type="button"
                disabled={fut}
                onClick={() => pick(k)}
                aria-label={longDay(k)}
                aria-pressed={edge}
                className={cn(
                  'relative z-[1] flex h-11 w-11 items-center justify-center rounded-full text-[17px] tabular-nums',
                  FOCUS_RING,
                  edge ? 'bg-[#2C2C2C] font-bold text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : fut ? 'text-[#B3B3B3] dark:text-[#767676]' : TEXT.strong,
                  k === today && !edge && 'font-bold underline underline-offset-4',
                )}
              >
                {d}
              </button>
            </span>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2.5 px-5 pb-6 pt-5">
        <Chip label="Semaine dernière" onClick={() => { ui.setPreset('last_week'); ui.close(); }} />
        <Chip label="Mois dernier" onClick={() => { ui.setPreset('last_month'); ui.close(); }} />
      </div>
    </FullScreen>
  );
}

/* ── 25 · Exporter ────────────────────────────────────────────────────── */
function ExportSheet({ ds, open }: { ds: ChartDataset | null; open: boolean }) {
  const ui = useAnalyticsUi();
  const [last, setLast] = React.useState<ChartDataset | null>(ds);
  const [format, setFormat] = React.useState<ExportFormat>('csv');
  const [scope, setScope] = React.useState<'one' | 'all'>('one');
  const [all, setAll] = React.useState<ChartDataset[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (ds) { setLast(ds); setScope('one'); } }, [ds]);
  const d = ds ?? last;
  if (!d) return <BottomSheet open={false} onClose={ui.close}><span /></BottomSheet>;

  const effectiveScope = format === 'png' ? 'one' : scope;
  const list = effectiveScope === 'all' ? all ?? [] : [d];
  const ext = format === 'csv' ? 'csv' : format === 'pdf' ? 'pdf' : 'png';
  const name = exportFileName(effectiveScope === 'all' ? null : d, ui.range, ext);
  const lines = effectiveScope === 'all' ? `${all?.length ?? '…'} graphiques` : `${int(d.rows.length)} ligne${d.rows.length > 1 ? 's' : ''}`;
  const waiting = effectiveScope === 'all' && !all;

  const run = async () => {
    if (format === 'png') { ui.open({ type: 'share', ds: d }); return; }
    setBusy(true);
    try {
      if (format === 'csv') exportCsv(list, ui.range, effectiveScope === 'all' ? null : d);
      else exportPdf(list, ui.range, effectiveScope === 'all' ? null : d);
      ui.close();
    } catch {
      toast.error("L'export n'a pas pu être créé.");
    } finally {
      setBusy(false);
    }
  };

  const FORMATS: { value: ExportFormat; icon: React.ElementType; label: string; sub: string }[] = [
    { value: 'csv', icon: SheetIcon, label: 'CSV', sub: 'Tableur' },
    { value: 'pdf', icon: FileText, label: 'PDF', sub: 'Rapport' },
    { value: 'png', icon: ImageIcon, label: 'Image', sub: 'PNG' },
  ];

  return (
    <BottomSheet open={open} onClose={ui.close}>
      <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Exporter</h3>
      <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{effectiveScope === 'all' ? 'Toutes les analyses' : d.title} · {periodLabel(ui.range)}</p>
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {FORMATS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFormat(f.value)}
            aria-pressed={format === f.value}
            className={cn('flex h-[100px] flex-col items-center justify-center gap-1 rounded-lg', FOCUS_RING, format === f.value ? 'border-2 border-[#2C2C2C] dark:border-[#E3E3E3]' : cn('border', SURFACE.divider))}
          >
            <f.icon className={cn('h-7 w-7', TEXT.strong)} strokeWidth={2} />
            <span className={cn('text-[17px] font-bold', TEXT.strong)}>{f.label}</span>
            <span className={cn('text-[15px]', TEXT.muted)}>{f.sub}</span>
          </button>
        ))}
      </div>
      {format !== 'png' && (
        <BoxSegmented
          className="mt-4"
          ariaLabel="Contenu"
          options={[{ value: 'one', label: 'Ce graphique' }, { value: 'all', label: 'Toutes les analyses' }]}
          value={scope}
          onChange={setScope}
        />
      )}
      <KVBox className="mt-4" rows={[{ label: 'Contenu', value: lines }, { label: 'Fichier', value: <span className="break-all">{name}</span> }]} />
      {open && effectiveScope === 'all' && <AllDatasets onReady={setAll} />}
      <BigButton className="mt-5" onClick={() => void run()} loading={busy || waiting}>
        {format === 'png' ? "Créer l'image" : `Exporter en ${format.toUpperCase()}`}
      </BigButton>
    </BottomSheet>
  );
}

/** Monté seulement quand on exporte « Toutes les analyses » : rassemble les jeux de données. */
function AllDatasets({ onReady }: { onReady: (list: ChartDataset[]) => void }) {
  const { hasPermission } = useAdminAuth();
  const canTreasury = hasPermission('canViewTreasury');
  const [treasury, setTreasury] = React.useState<ChartDataset | null>(null);
  const a = [
    usePaymentsData(), useDepositsData(), useFlowData(), useMethodsData('paiements'), useMethodsData('depots'), useBasketData(),
    useMoneyData(), useClientsData(), useActiveData(), useTopData(), useCountriesData(), useSourcesData(), useDelaysData(),
    useTeamData(), useGrowthData('week', 'paiements'), useGrowthData('month', 'clients'),
  ];
  const loading = a.some((x) => x.loading);
  const sig = a.map((x) => `${x.ds.key}:${x.ds.rows.length}:${x.ds.figure.value}`).join('|') + (treasury ? `|${treasury.rows.length}` : '');
  React.useEffect(() => {
    if (loading) return;
    onReady([...a.map((x) => x.ds), ...(canTreasury && treasury ? [treasury] : [])]);
  }, [loading, sig]); // eslint-disable-line react-hooks/exhaustive-deps
  return canTreasury ? <TreasuryDataset onReady={setTreasury} /> : null;
}

function TreasuryDataset({ onReady }: { onReady: (ds: ChartDataset) => void }) {
  const t = useTreasuryData();
  React.useEffect(() => { if (!t.loading) onReady(t.ds); }, [t.loading, t.ds.rows.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/* ── 26 · Partager l'image ────────────────────────────────────────────── */
function ShareBars({ data, dark }: { data: NonNullable<ChartDataset['bars']>; dark: boolean }) {
  const W = 300;
  const H = 120;
  const n = Math.max(data.length, 1);
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const gap = n > 40 ? 1.5 : n > 20 ? 3 : 6;
  const bw = Math.max((W - gap * (n - 1)) / n, 1);
  const ink = dark ? '#F5F5F5' : '#2C2C2C';
  const signed = data.some((d) => d.value < 0);
  const zero = signed ? H / 2 : H;
  const scale = (signed ? H / 2 - 4 : H - 4) / max;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-[120px] w-full" aria-hidden>
      {signed && <line x1={0} x2={W} y1={zero} y2={zero} stroke="#B3B3B3" strokeWidth={1} />}
      {data.map((d, i) => {
        const h = Math.max(Math.abs(d.value) * scale, d.value === 0 ? 0 : 2);
        const y = d.value >= 0 ? zero - h : zero;
        return (
          <rect key={i} x={i * (bw + gap) + (d.current ? 1 : 0)} y={y + (d.current ? 1 : 0)} width={Math.max(bw - (d.current ? 2 : 0), 1)} height={Math.max(h - (d.current ? 2 : 0), 1)} rx={Math.min(3, bw / 2)}
            fill={d.current ? 'none' : ink} stroke={d.current ? ink : 'none'} strokeWidth={d.current ? 2 : 0} />
        );
      })}
      {!signed && <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke={dark ? '#444444' : '#D9D9D9'} strokeWidth={1} />}
    </svg>
  );
}

function ShareView({ ds }: { ds: ChartDataset }) {
  const ui = useAnalyticsUi();
  const ref = React.useRef<HTMLDivElement>(null);
  const [dark, setDark] = React.useState(false);
  const [busy, setBusy] = React.useState<null | 'share' | 'copy' | 'save'>(null);
  const filename = exportFileName(ds, ui.range, 'png');
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  const act = async (kind: 'share' | 'copy' | 'save') => {
    if (!ref.current || busy) return;
    setBusy(kind);
    try {
      if (kind === 'share') await sharePng(ref.current, filename, ds.title, dark);
      else if (kind === 'copy') { const r = await copyPng(ref.current, filename, dark); toast.success(r === 'copied' ? 'Image copiée' : 'Image enregistrée'); }
      else { await savePng(ref.current, filename, dark); toast.success('Image enregistrée'); }
    } catch {
      toast.error("L'image n'a pas pu être créée.");
    } finally {
      setBusy(null);
    }
  };

  const fg = dark ? 'text-[#F5F5F5]' : 'text-[#1E1E1E]';
  const mut = dark ? 'text-[#CDCDCD]' : 'text-[#5A5A5A]';
  return (
    <FullScreen
      title="Partager"
      onClose={ui.close}
      dock={
        <>
          <BigButton onClick={() => void act('share')} loading={busy === 'share'}>Partager l'image</BigButton>
          <div className="grid grid-cols-2 gap-2.5">
            <BigButton variant="soft" onClick={() => void act('copy')} loading={busy === 'copy'}>Copier</BigButton>
            <BigButton variant="soft" onClick={() => void act('save')} loading={busy === 'save'}>Enregistrer</BigButton>
          </div>
        </>
      }
    >
      <div className="px-5 pt-4">
        <div ref={ref} className={cn('rounded-lg border p-5', dark ? 'border-[#444444] bg-[#1E1E1E]' : 'border-[#D9D9D9] bg-white')}>
          <div className="flex items-baseline justify-between gap-3">
            <span className={cn('text-[18px] font-bold', fg)}>Bonzini Labs</span>
            <span className={cn('text-[15px]', mut)}>{today}</span>
          </div>
          <div className={cn('mt-4 text-[16px]', mut)}>{ds.title} · {periodLabel(ui.range)}</div>
          <div className={cn('mt-1 break-words text-[34px] font-bold leading-tight tabular-nums tracking-[-0.02em]', fg)}>
            {ds.figure.value}
            {ds.figure.unit && <span className={cn('ml-1.5 text-[20px] font-semibold tracking-normal', mut)}>{ds.figure.unit}</span>}
          </div>
          {ds.bars && ds.bars.length > 0 ? (
            <div className="mt-5">
              <ShareBars data={ds.bars} dark={dark} />
              {ds.barEdges && (
                <div className={cn('mt-2 flex justify-between text-[15px]', mut)}>
                  <span>{ds.barEdges[0]}</span>
                  <span>{ds.barEdges[1]}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4">
              {ds.rows.slice(0, 5).map((r, i) => (
                <div key={i} className={cn('flex justify-between gap-3 border-b py-2 text-[15px] last:border-b-0', dark ? 'border-[#444444]' : 'border-[#EEEEEE]')}>
                  <span className={cn('min-w-0 truncate', mut)}>{String(r[ds.columns[0]?.key] ?? '')}</span>
                  <span className={cn('shrink-0 font-semibold tabular-nums', fg)}>{fmtCell(r[ds.columns[ds.columns.length - 1]?.key])}</span>
                </div>
              ))}
            </div>
          )}
          {(ds.figure.delta || ds.figure.note) && (
            <div className={cn('mt-4 flex flex-wrap items-center gap-2.5 border-t pt-4 text-[16px]', dark ? 'border-[#444444]' : 'border-[#D9D9D9]', dark ? 'text-[#E3E3E3]' : 'text-[#303030]')}>
              {ds.figure.delta && <Tag tone={ds.figure.delta.tone}>{ds.figure.delta.label}</Tag>}
              {ds.figure.delta ? ds.figure.note ?? '' : ds.figure.note}
            </div>
          )}
        </div>
        <BoxSegmented
          className="mt-4"
          ariaLabel="Fond"
          options={[{ value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]}
          value={dark ? 'dark' : 'light'}
          onChange={(v) => setDark(v === 'dark')}
        />
      </div>
    </FullScreen>
  );
}

function fmtCell(v: unknown): string {
  if (typeof v === 'number') return int(v);
  return String(v ?? '');
}

/* ── Voir en tableau ──────────────────────────────────────────────────── */
function TableView({ ds }: { ds: ChartDataset }) {
  const ui = useAnalyticsUi();
  return (
    <FullScreen title={ds.title} onClose={ui.close}>
      <div className={cn('px-5 pb-2 pt-4 text-[16px]', TEXT.muted)}>{periodLabel(ui.range)}</div>
      <div className="overflow-x-auto px-5 pb-8">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className={cn('border-b', SURFACE.divider)}>
              {ds.columns.map((c, i) => (
                <th key={c.key} className={cn('py-2.5 font-semibold', TEXT.muted, i === 0 ? 'pr-3 text-left' : 'whitespace-nowrap pl-3 text-right')}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ds.rows.map((r, k) => (
              <tr key={k} className={cn('border-b last:border-b-0', SURFACE.divider)}>
                {ds.columns.map((c, i) => (
                  <td key={c.key} className={cn('py-3 tabular-nums', i === 0 ? cn('pr-3 font-medium', TEXT.strong) : cn('whitespace-nowrap pl-3 text-right font-semibold', TEXT.strong))}>{fmtCell(r[c.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {ds.rows.length === 0 && <p className={cn('py-10 text-center text-[16px]', TEXT.muted)}>Rien sur la période.</p>}
      </div>
    </FullScreen>
  );
}

