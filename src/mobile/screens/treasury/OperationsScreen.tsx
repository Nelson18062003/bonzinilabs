/**
 * Opérations — maquettes 07-tresorerie/03 (liste) et 04 (filtres).
 *
 * Toutes / Achats / Ventes / Annulées avec leurs compteurs, la recherche
 * (nom, compte, référence, note, montant), la période partagée et les
 * filtres de l'ancien mobile (fournisseur, acheteur, canal, compte CNY,
 * tri, période perso). Les totaux ne comptent jamais une annulée. La liste
 * se déroule sans fin, groupée par jour ; chaque ligne ouvre son reçu.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useCounterparties, useTreasuryAccounts, useTreasuryOperations, type OperationRow } from '@/hooks/useTreasury';
import { matchesQuery, totalsOf, viewOperation, type OperationView } from '@/desktop/screens/treasury/operationView';
import { fmtNum } from '@/desktop/screens/treasury/treasuryFormat';
import type { OperationFilter } from '@/desktop/screens/treasury/treasuryNav';
import { cn } from '@/lib/utils';
import { type PresetId } from '@/lib/analytics/dateRange';
import {
  BigButton, BottomSheet, BoxSegmented, Chip, DayLabel, EmptyLine, ItemList, ScreenTop, SearchBox, SURFACE, TEXT, useSheet,
} from '@/mobile/designKit';
import { OpRow, PeriodChip, PeriodSheet, PickList, TotalsStrip, TreasuryGate, type PickOption } from './parts';
import { fmtUsdt, groupByDay, hm, setPeriodPreset, tp, usePeriod } from './treasuryMobile';

type Sort = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
const SORTS: Record<Sort, string> = {
  date_desc: 'Date, récent d’abord',
  date_asc: 'Date, ancien d’abord',
  amount_desc: 'Montant, plus grand',
  amount_asc: 'Montant, plus petit',
};
const CHANNELS: Record<string, string> = { bank_transfer: 'Virement', mobile_money: 'Mobile Money', cash: 'Cash', other: 'Autre' };
const PAGE = 40;

interface Extra {
  supplierId: string;
  buyerId: string;
  channel: string;
  /** '' tous · 'none' sans compte · id */
  cny: string;
  sort: Sort;
}
const NO_EXTRA: Extra = { supplierId: '', buyerId: '', channel: '', cny: '', sort: 'date_desc' };

export function OperationsScreen({ kind }: { kind?: 'purchase' | 'sale' }) {
  return (
    <TreasuryGate>
      <OperationsBody kind={kind} />
    </TreasuryGate>
  );
}

/** Les anciennes adresses mobiles (`/purchases`, `/sales`) : la même liste, filtrée. */
export function PurchasesScreen() {
  return <OperationsScreen kind="purchase" />;
}
export function SalesScreen() {
  return <OperationsScreen kind="sale" />;
}

function OperationsBody({ kind }: { kind?: 'purchase' | 'sale' }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const typeParam = params.get('type');
  const filter: OperationFilter = typeParam === 'purchase' || typeParam === 'sale' || typeParam === 'voided' ? typeParam : kind ?? 'all';
  const [q, setQ] = useState(params.get('q') ?? '');
  const [extra, setExtra] = useState<Extra>(NO_EXTRA);
  const filters = useSheet();
  const periodSheet = useSheet();
  const period = usePeriod();
  const ops = useTreasuryOperations(period.fromIso, period.toIso);
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => (ops.data ?? []).map((op) => ({ op, v: viewOperation(op) })), [ops.data]);
  const counts = {
    all: rows.length,
    purchase: rows.filter((r) => r.v.kind === 'purchase').length,
    sale: rows.filter((r) => r.v.kind === 'sale').length,
    voided: rows.filter((r) => r.v.voided).length,
  };
  const match = (r: { op: OperationRow; v: OperationView }, e: Extra) => {
    if (filter === 'voided' ? !r.v.voided : filter !== 'all' && r.v.kind !== filter) return false;
    if (e.supplierId && !(r.op.kind === 'purchase' && r.op.supplier_id === e.supplierId)) return false;
    if (e.buyerId && !(r.op.kind === 'sale' && r.op.buyer_id === e.buyerId)) return false;
    if (e.channel && !(r.op.kind === 'purchase' && r.op.channel === e.channel)) return false;
    if (e.cny && !(r.op.kind === 'sale' && (e.cny === 'none' ? !r.op.cny_account_id : r.op.cny_account_id === e.cny))) return false;
    return matchesQuery(r.v, q.trim());
  };
  const sortRows = (list: OperationView[], s: Sort) => {
    const out = [...list];
    if (s === 'date_asc') out.sort((a, b) => a.at.localeCompare(b.at));
    else if (s === 'amount_desc') out.sort((a, b) => b.usdt - a.usdt);
    else if (s === 'amount_asc') out.sort((a, b) => a.usdt - b.usdt);
    return out;
  };
  const shown = sortRows(rows.filter((r) => match(r, extra)).map((r) => r.v), extra.sort);
  const active = shown.filter((v) => !v.voided);
  const extraCount = (extra.supplierId ? 1 : 0) + (extra.buyerId ? 1 : 0) + (extra.channel ? 1 : 0) + (extra.cny ? 1 : 0) + (extra.sort !== 'date_desc' ? 1 : 0);

  useEffect(() => setLimit(PAGE), [filter, q, extra, period.fromIso]);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && setLimit((n) => n + PAGE), { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [shown.length]);

  const setFilter = (f: OperationFilter) => {
    const next = new URLSearchParams(params);
    if (f === 'all') next.delete('type');
    else next.set('type', f);
    setParams(next, { replace: true });
  };
  const byDate = extra.sort === 'date_desc' || extra.sort === 'date_asc';
  const page = shown.slice(0, limit);

  return (
    <div className="flex min-h-full flex-col pb-6">
      <ScreenTop title="Opérations" backTo={tp.root} />
      <div className="space-y-3 px-5 pt-4">
        <BoxSegmented
          ariaLabel="Type d’opération"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Toutes', count: counts.all },
            { value: 'purchase', label: 'Achats', count: counts.purchase },
            { value: 'sale', label: 'Ventes', count: counts.sale },
            { value: 'voided', label: 'Annulées', count: counts.voided },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Nom, compte, référence, montant" />
        <div className="flex gap-2">
          <PeriodChip onClick={periodSheet.show} />
          <Chip icon={SlidersHorizontal} label="Filtres" count={extraCount} active={extraCount > 0} onClick={filters.show} />
        </div>
        {!ops.isLoading && !ops.isError && shown.length > 0 && <TotalsStrip items={summary(filter, active, counts.voided)} />}
      </div>

      {ops.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void ops.refetch() }}>La liste n’a pas pu être chargée.</EmptyLine>
      ) : ops.isLoading ? (
        <EmptyLine>Chargement…</EmptyLine>
      ) : shown.length === 0 ? (
        <EmptyLine action={q || extraCount ? { label: 'Effacer les filtres', onClick: () => { setQ(''); setExtra(NO_EXTRA); } } : undefined}>
          {q || extraCount ? 'Aucune opération ne correspond.' : 'Aucune opération sur cette période.'}
        </EmptyLine>
      ) : byDate ? (
        groupByDay(page, (v) => v.at).map((g) => (
          <div key={g.key}>
            <DayLabel>{g.label}</DayLabel>
            <ItemList>
              {g.items.map((o) => <Row key={`${o.kind}-${o.id}`} o={o} onOpen={() => navigate(tp.operation(o.kind, o.id))} />)}
            </ItemList>
          </div>
        ))
      ) : (
        <ItemList className="pt-2">
          {page.map((o) => <Row key={`${o.kind}-${o.id}`} o={o} onOpen={() => navigate(tp.operation(o.kind, o.id))} />)}
        </ItemList>
      )}
      {shown.length > limit && <div ref={sentinel} className="h-10" />}

      <PeriodSheet open={periodSheet.open} onClose={periodSheet.hide} />
      <FiltersSheet
        open={filters.open}
        onClose={filters.hide}
        filter={filter}
        value={extra}
        onApply={setExtra}
        countFor={(e) => rows.filter((r) => match(r, e)).length}
      />
    </div>
  );
}

function Row({ o, onOpen }: { o: OperationView; onOpen: () => void }) {
  const accounts = o.kind === 'purchase' && o.accounts.includes(' · ') ? `${o.accounts.split(' · ').length} comptes` : o.accounts === '—' ? 'Sans compte' : o.accounts;
  return <OpRow op={o} subtitle={`${accounts} · ${hm(o.at)}`} onClick={onOpen} />;
}

function summary(filter: OperationFilter, active: OperationView[], voided: number) {
  const buys = totalsOf(active.filter((o) => o.kind === 'purchase'));
  const sells = totalsOf(active.filter((o) => o.kind === 'sale'));
  if (filter === 'purchase')
    return [
      { label: 'Achetés', value: fmtUsdt(buys.usdt) },
      { label: 'Payés · XAF', value: fmtNum(buys.counter, 0) },
      { label: 'Taux moyen', value: buys.avgRate ? fmtNum(buys.avgRate, 2) : '—' },
    ];
  if (filter === 'sale')
    return [
      { label: 'Vendus', value: fmtUsdt(sells.usdt) },
      { label: 'Reçus · CNY', value: fmtNum(sells.counter, 2) },
      { label: 'Taux moyen', value: sells.avgRate ? fmtNum(sells.avgRate, 4) : '—' },
    ];
  if (filter === 'voided') return [{ label: 'Annulées · hors totaux', value: voided }];
  return [
    { label: 'Achetés', value: fmtUsdt(buys.usdt) },
    { label: 'Vendus', value: fmtUsdt(sells.usdt) },
    { label: 'Annulées', value: voided },
  ];
}

/* ── La feuille « Filtres » (maquette 04) ─────────────────────────────── */
type View = 'main' | 'supplier' | 'buyer' | 'channel' | 'cny' | 'sort';

function FiltersSheet({
  open, onClose, filter, value, onApply, countFor,
}: {
  open: boolean;
  onClose: () => void;
  filter: OperationFilter;
  value: Extra;
  onApply: (e: Extra) => void;
  countFor: (e: Extra) => number;
}) {
  const [draft, setDraft] = useState<Extra>(value);
  const [view, setView] = useState<View>('main');
  const period = usePeriod();
  const periodSheet = useSheet();
  const suppliers = useCounterparties('usdt_supplier', true);
  const buyers = useCounterparties('cny_buyer', true);
  const cnyAccounts = useTreasuryAccounts('CNY');
  useEffect(() => {
    if (open) {
      setDraft(value);
      setView('main');
    }
  }, [open, value]);

  const showPurchase = filter !== 'sale';
  const showSale = filter !== 'purchase';
  const name = (list: Array<{ id: string; display_name: string }> | undefined, id: string) => list?.find((c) => c.id === id)?.display_name ?? 'Tous';
  const n = countFor(draft);
  const noun = filter === 'purchase' ? (n > 1 ? 'achats' : 'achat') : filter === 'sale' ? (n > 1 ? 'ventes' : 'vente') : n > 1 ? 'opérations' : 'opération';

  const pick = <K extends keyof Extra>(k: K, v: Extra[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setView('main');
  };

  const sub = (title: string, options: PickOption<string>[], current: string, k: keyof Extra) => (
    <>
      <h3 className={cn('mb-2 text-[22px] font-semibold', TEXT.strong)}>{title}</h3>
      <PickList options={options} value={current} onPick={(v) => pick(k, v as never)} />
    </>
  );

  const QUICK: Array<{ preset: PresetId; label: string }> = [
    { preset: 'last_7_days', label: '7 j' },
    { preset: 'last_30_days', label: '30 j' },
    { preset: 'last_90_days', label: '90 j' },
    { preset: 'all_time', label: 'Tout' },
  ];

  return (
    <>
      <BottomSheet open={open && !periodSheet.open} onClose={onClose}>
        {view === 'supplier' ? (
          sub('Fournisseur', [{ value: '', label: 'Tous' }, ...(suppliers.data ?? []).map((c) => ({ value: c.id, label: c.display_name, hint: c.short_id }))], draft.supplierId, 'supplierId')
        ) : view === 'buyer' ? (
          sub('Acheteur', [{ value: '', label: 'Tous' }, ...(buyers.data ?? []).map((c) => ({ value: c.id, label: c.display_name, hint: c.short_id }))], draft.buyerId, 'buyerId')
        ) : view === 'channel' ? (
          sub('Canal', [{ value: '', label: 'Tous' }, ...Object.entries(CHANNELS).map(([k, l]) => ({ value: k, label: l }))], draft.channel, 'channel')
        ) : view === 'cny' ? (
          sub('Compte CNY', [{ value: '', label: 'Tous' }, { value: 'none', label: 'Sans compte CNY' }, ...(cnyAccounts.data ?? []).map((a) => ({ value: a.id, label: a.label }))], draft.cny, 'cny')
        ) : view === 'sort' ? (
          sub('Trier par', (Object.keys(SORTS) as Sort[]).map((k) => ({ value: k, label: SORTS[k] })), draft.sort, 'sort')
        ) : (
          <>
            <h3 className={cn('mb-2 text-[22px] font-semibold', TEXT.strong)}>Filtres</h3>
            <div>
              {showPurchase && <FilterRow label="Fournisseur" value={draft.supplierId ? name(suppliers.data, draft.supplierId) : 'Tous'} onClick={() => setView('supplier')} />}
              {showSale && <FilterRow label="Acheteur" value={draft.buyerId ? name(buyers.data, draft.buyerId) : 'Tous'} onClick={() => setView('buyer')} />}
              {showPurchase && <FilterRow label="Canal" value={draft.channel ? CHANNELS[draft.channel] : 'Tous'} onClick={() => setView('channel')} />}
              {showSale && (
                <FilterRow
                  label="Compte CNY"
                  value={draft.cny === 'none' ? 'Sans compte' : draft.cny ? cnyAccounts.data?.find((a) => a.id === draft.cny)?.label ?? '—' : 'Tous'}
                  onClick={() => setView('cny')}
                />
              )}
              <FilterRow label="Trier par" value={SORTS[draft.sort]} onClick={() => setView('sort')} />
            </div>
            <div className={cn('mt-5 text-[15px] font-semibold uppercase tracking-[0.06em]', TEXT.muted)}>Période</div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {QUICK.map((c) => (
                <Chip key={c.preset} label={c.label} active={period.preset === c.preset} onClick={() => setPeriodPreset(c.preset)} />
              ))}
              <Chip label={QUICK.some((c) => c.preset === period.preset) ? 'Perso' : period.label} active={!QUICK.some((c) => c.preset === period.preset)} onClick={periodSheet.show} />
            </div>
            <div className="mt-6 grid grid-cols-[1fr_1.6fr] gap-2.5">
              <BigButton variant="soft" onClick={() => setDraft(NO_EXTRA)}>Effacer</BigButton>
              <BigButton
                onClick={() => {
                  onApply(draft);
                  onClose();
                }}
              >
                Voir {n} {noun}
              </BigButton>
            </div>
          </>
        )}
      </BottomSheet>
      <PeriodSheet open={periodSheet.open} onClose={periodSheet.hide} />
    </>
  );
}

function FilterRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex min-h-[58px] w-full items-center justify-between gap-3 border-b text-left', SURFACE.divider)}>
      <span className={cn('text-[17px] font-semibold', TEXT.strong)}>{label}</span>
      <span className={cn('flex min-w-0 items-center gap-1.5 text-[16px]', TEXT.body)}>
        <span className="truncate">{value}</span>
        <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
      </span>
    </button>
  );
}
