/**
 * Opérations v2 (maquettes validées : maquettes-v2/index.html écran 7,
 * 02-operations/01, 02 et 10). Façon Wave : un grand titre, la loupe et
 * « … » ; le segment Paiements / Dépôts ; une rangée de puces ; puis la
 * liste groupée par jour — rond du moyen, client, fournisseur ou moyen,
 * montant et tag.
 *
 * Ce qui est rare est dans « … » : filtres et tri, lots de paiements,
 * export des paiements en cours (PDF), justificatifs, nouvelles opérations.
 * La recherche est serveur (référence, client, fournisseur) ; l'état des
 * filtres survit à l'ouverture d'une fiche (opsMemory).
 *
 * L'URL est l'onglet : /m/payments et /m/deposits ; /m/ops ouvre Paiements.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpRight, FileDown, Layers, MoreHorizontal, Paperclip, Search, SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useDepositStats } from '@/hooks/useAdminDeposits';
import { usePaginatedAdminDeposits } from '@/hooks/usePaginatedDeposits';
import { usePaginatedAdminPayments } from '@/hooks/usePaginatedPayments';
import { usePaymentBatches } from '@/hooks/usePaymentBatches';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { exportPendingPaymentsPDF } from '@/lib/exportPendingPaymentsPDF';
import {
  ActionSheet, BoxSegmented, Chip, DayLabel, EmptyLine, ItemList, ItemRow, MethodCircle, RoundButton, SearchBox, TabTop,
  toMethodKey, useSheet, type SheetAction,
} from '@/mobile/designKit';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import type { DepositWithProfile } from '@/types/deposit';
import { OpsFiltersSheet } from './OpsFiltersSheet';
import { DepositRound } from './parts';
import {
  DEFAULT_FILTERS, activeFilterCount, depositFilters, opsMemory, paymentFilters,
  type DepChip, type OpsFilterState, type OpsTab, type PayChip,
} from './opsFilters';
import { depositMethodName, depositTag, fullName, groupByDay, n0, paymentTag, shortWhen, yuan } from './opsLabels';
import { useBatchProgress, useOpsPaymentCounts } from './opsQueries';

export type { OpsTab } from './opsFilters';

export function MobileOperationsScreen({ tab: tabProp }: { tab?: OpsTab }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const canPayments = hasPermission('canViewPayments');
  const canDeposits = hasPermission('canViewDeposits');
  const tab: OpsTab = tabProp ?? (canPayments ? 'payments' : 'deposits');

  const [payChip, setPayChipState] = useState<PayChip>(opsMemory.payChip);
  const [depChip, setDepChipState] = useState<DepChip>(opsMemory.depChip);
  const [filters, setFiltersState] = useState<OpsFilterState>(opsMemory.filters);
  const [search, setSearchState] = useState(opsMemory.search);
  const [searchOpen, setSearchOpen] = useState(!!opsMemory.search);
  const debounced = useDebouncedValue(search);
  const more = useSheet();
  const filterSheet = useSheet();
  const [exporting, setExporting] = useState(false);

  const setPayChip = (c: PayChip) => { opsMemory.payChip = c; setPayChipState(c); if (filters.payExtra) setFilters({ ...filters, payExtra: null }); };
  const setDepChip = (c: DepChip) => { opsMemory.depChip = c; setDepChipState(c); if (filters.depExtra) setFilters({ ...filters, depExtra: null }); };
  const setFilters = (f: OpsFilterState) => { opsMemory.filters = f; setFiltersState(f); };
  const setSearch = (s: string) => { opsMemory.search = s; setSearchState(s); };

  const go = (t: OpsTab) => navigate(t === 'deposits' ? '/m/deposits' : '/m/payments', { replace: true });

  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const count = await exportPendingPaymentsPDF();
      if (count === 0) toast.error('Aucun paiement en cours à exporter');
      else toast.success(`Export de ${count} paiement${count > 1 ? 's' : ''} téléchargé`);
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  const nFilters = activeFilterCount(filters, tab);
  const actions: SheetAction[] = [
    { label: 'Filtres et tri', hint: nFilters > 0 ? `${nFilters} actif${nFilters > 1 ? 's' : ''}` : undefined, icon: SlidersHorizontal, onClick: filterSheet.show },
    { label: 'Lots de paiements', hint: <BatchHint />, icon: Layers, onClick: () => navigate('/m/payments/batches'), hidden: !canPayments },
    { label: exporting ? 'Export en cours…' : 'Exporter les en cours (PDF)', icon: FileDown, onClick: () => { void exportPdf(); }, hidden: !canPayments },
    { label: 'Justificatifs', icon: Paperclip, onClick: () => navigate('/m/more/proofs') },
    { label: 'Nouveau paiement', icon: ArrowUpRight, onClick: () => navigate('/m/payments/new'), hidden: !hasPermission('canProcessPayments') },
    { label: 'Nouveau dépôt', icon: ArrowDownToLine, onClick: () => navigate('/m/deposits/new'), hidden: !hasPermission('canProcessDeposits') },
  ];

  const segments = [
    ...(canPayments ? [{ value: 'payments' as const, label: 'Paiements' }] : []),
    ...(canDeposits ? [{ value: 'deposits' as const, label: 'Dépôts' }] : []),
  ];

  return (
    <div className="flex min-h-full flex-col">
      <TabTop
        title="Opérations"
        right={
          <>
            <RoundButton icon={searchOpen ? X : Search} ariaLabel={searchOpen ? 'Fermer la recherche' : 'Rechercher'} onClick={() => { if (searchOpen) setSearch(''); setSearchOpen(!searchOpen); }} />
            <RoundButton icon={MoreHorizontal} ariaLabel="Plus d'actions" dot={nFilters > 0} onClick={more.show} />
          </>
        }
      />

      {searchOpen && (
        <div className="px-5 pb-1 pt-1">
          <SearchBox value={search} onChange={setSearch} autoFocus placeholder={tab === 'payments' ? 'Client, fournisseur, référence' : 'Client, téléphone, référence'} />
        </div>
      )}

      {segments.length > 1 && (
        <div className="px-5 pt-2">
          <BoxSegmented<OpsTab> ariaLabel="Liste" value={tab} onChange={go} options={segments} />
        </div>
      )}

      {segments.length === 0 ? (
        <EmptyLine>Vous n'avez pas accès aux opérations.</EmptyLine>
      ) : tab === 'payments' ? (
        <PaymentsList chip={payChip} onChip={setPayChip} filters={filters} search={debounced} onReset={() => { setFilters({ ...DEFAULT_FILTERS }); setSearch(''); }} />
      ) : (
        <DepositsList chip={depChip} onChip={setDepChip} filters={filters} search={debounced} onReset={() => { setFilters({ ...DEFAULT_FILTERS }); setSearch(''); }} />
      )}

      <ActionSheet open={more.open} onClose={more.hide} actions={actions} />
      <OpsFiltersSheet open={filterSheet.open} onClose={filterSheet.hide} tab={tab} value={filters} onApply={setFilters} />
    </div>
  );
}

/** « 2 en cours » sous « Lots de paiements » — lu seulement à l'ouverture du menu. */
function BatchHint() {
  const { data: batches } = usePaymentBatches();
  const ids = useMemo(() => (batches ?? []).slice(0, 50).map((b) => b.id), [batches]);
  const { data: progress } = useBatchProgress(ids);
  if (!batches || !progress) return null;
  const open = ids.filter((id) => { const p = progress.get(id); return p && p.closed < p.total; }).length;
  return open > 0 ? <>{open} en cours</> : null;
}

/* ── Paiements ─────────────────────────────────────────────────────────── */

function PaymentsList({ chip, onChip, filters, search, onReset }: { chip: PayChip; onChip: (c: PayChip) => void; filters: OpsFilterState; search: string; onReset: () => void }) {
  const navigate = useNavigate();
  const { data: counts } = useOpsPaymentCounts();
  const params = useMemo(() => paymentFilters(chip, filters, search), [chip, filters, search]);
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = usePaginatedAdminPayments(params);
  const rows = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const groups = useMemo(() => (filters.sort.startsWith('amount') ? [{ label: '', rows }] : groupByDay(rows, (r) => r.created_at)), [rows, filters.sort]);
  const more = useCallback(() => { void fetchNextPage(); }, [fetchNextPage]);
  const narrowed = !!filters.payExtra || activeFilterCount(filters, 'payments') > 0 || !!search;

  return (
    <PullToRefresh onRefresh={refetch} className="flex-1 pb-6">
      <div className="scrollbar-hide flex gap-2 overflow-x-auto px-5 pb-1 pt-3.5">
        <Chip label="À payer" count={counts?.toPay} active={!filters.payExtra && chip === 'to_pay'} onClick={() => onChip('to_pay')} />
        <Chip label="En cours" count={counts?.inProgress} active={!filters.payExtra && chip === 'in_progress'} onClick={() => onChip('in_progress')} />
        <Chip label="Payés" active={!filters.payExtra && chip === 'paid'} onClick={() => onChip('paid')} />
        <Chip label="Tous" active={!filters.payExtra && chip === 'all'} onClick={() => onChip('all')} />
      </div>
      {filters.payExtra && (
        <div className="px-5 pt-2">
          <Chip label={filters.payExtra === 'waiting_beneficiary_info' ? 'Sans fournisseur' : filters.payExtra === 'rejected' ? 'Refusés' : 'Annulés'} count={filters.payExtra === 'waiting_beneficiary_info' ? counts?.noSupplier : undefined} active onClick={() => onChip(chip)} />
        </div>
      )}

      {isLoading ? (
        <div className="px-5 pt-3"><SkeletonListScreen count={4} /></div>
      ) : isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>La liste n'a pas pu être chargée.</EmptyLine>
      ) : rows.length === 0 ? (
        <EmptyLine action={narrowed ? { label: 'Réinitialiser', onClick: onReset } : undefined}>
          {narrowed ? 'Aucun paiement trouvé.' : chip === 'to_pay' ? 'Rien à payer pour l’instant.' : 'Aucun paiement.'}
        </EmptyLine>
      ) : (
        <>
          {groups.map((g, gi) => (
            <section key={`${g.label}-${gi}`}>
              {g.label && <DayLabel>{g.label}</DayLabel>}
              <ItemList>
                {g.rows.map((p) => {
                  const cash = p.method === 'cash';
                  const supplier = cash ? 'Retrait au bureau' : p.beneficiary_name || (p.status === 'waiting_beneficiary_info' ? 'Sans fournisseur' : '—');
                  return (
                    <ItemRow
                      key={p.id}
                      leading={<MethodCircle method={toMethodKey(p.method)} />}
                      title={fullName(p.profiles)}
                      subtitle={supplier}
                      amount={yuan(p.amount_rmb)}
                      tag={paymentTag(p.status)}
                      onClick={() => navigate(`/m/payments/${p.id}`)}
                    />
                  );
                })}
              </ItemList>
            </section>
          ))}
          <InfiniteScrollTrigger onLoadMore={more} hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} />
        </>
      )}
    </PullToRefresh>
  );
}

/* ── Dépôts ────────────────────────────────────────────────────────────── */

function DepositsList({ chip, onChip, filters, search, onReset }: { chip: DepChip; onChip: (c: DepChip) => void; filters: OpsFilterState; search: string; onReset: () => void }) {
  const navigate = useNavigate();
  const { data: stats } = useDepositStats();
  const params = useMemo(() => depositFilters(chip, filters, search), [chip, filters, search]);
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = usePaginatedAdminDeposits(params);
  const rows = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const groups = useMemo(() => (filters.sort.startsWith('amount') ? [{ label: '', rows }] : groupByDay(rows, (r) => r.created_at)), [rows, filters.sort]);
  const more = useCallback(() => { void fetchNextPage(); }, [fetchNextPage]);
  const narrowed = !!filters.depExtra || activeFilterCount(filters, 'deposits') > 0 || !!search;
  const toValidate = stats ? (stats.to_process ?? 0) + (stats.pending_correction ?? 0) : undefined;

  return (
    <PullToRefresh onRefresh={refetch} className="flex-1 pb-6">
      <div className="scrollbar-hide flex gap-2 overflow-x-auto px-5 pb-1 pt-3.5">
        <Chip label="À valider" count={toValidate} active={!filters.depExtra && chip === 'to_validate'} onClick={() => onChip('to_validate')} />
        <Chip label="Crédités" active={!filters.depExtra && chip === 'credited'} onClick={() => onChip('credited')} />
        <Chip label="Refusés" active={!filters.depExtra && chip === 'refused'} onClick={() => onChip('refused')} />
        <Chip label="Tous" active={!filters.depExtra && chip === 'all'} onClick={() => onChip('all')} />
      </div>
      {filters.depExtra && (
        <div className="px-5 pt-2">
          <Chip label={filters.depExtra === 'no_proof' ? 'Sans preuve' : 'Annulés'} active onClick={() => onChip(chip)} />
        </div>
      )}

      {isLoading ? (
        <div className="px-5 pt-3"><SkeletonListScreen count={4} /></div>
      ) : isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>La liste n'a pas pu être chargée.</EmptyLine>
      ) : rows.length === 0 ? (
        <EmptyLine action={narrowed ? { label: 'Réinitialiser', onClick: onReset } : undefined}>
          {narrowed ? 'Aucun dépôt trouvé.' : chip === 'to_validate' ? 'Aucun dépôt à valider.' : 'Aucun dépôt.'}
        </EmptyLine>
      ) : (
        <>
          {groups.map((g, gi) => (
            <section key={`${g.label}-${gi}`}>
              {g.label && <DayLabel>{g.label}</DayLabel>}
              <ItemList>
                {g.rows.map((d) => <DepositRow key={d.id} d={d} onOpen={() => navigate(`/m/deposits/${d.id}`)} />)}
              </ItemList>
            </section>
          ))}
          <InfiniteScrollTrigger onLoadMore={more} hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} />
        </>
      )}
    </PullToRefresh>
  );
}

function DepositRow({ d, onOpen }: { d: DepositWithProfile; onOpen: () => void }) {
  const open = ['proof_submitted', 'admin_review', 'pending_correction'].includes(d.status);
  const when = open && d.verified_at ? 'vu en banque' : shortWhen(d.created_at);
  return (
    <ItemRow
      leading={<DepositRound method={d.method} bankName={d.bank_name} />}
      title={fullName(d.profiles)}
      subtitle={`${depositMethodName(d.method, d.bank_name, d.agency_name)} · ${when}`}
      amount={`${n0(d.amount_xaf)} XAF`}
      tag={depositTag(d.status)}
      onClick={onOpen}
    />
  );
}
