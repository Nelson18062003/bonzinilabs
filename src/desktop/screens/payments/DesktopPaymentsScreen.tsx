/**
 * Desktop admin — Paiements workbench (archetype surface A, instancié §4).
 *
 * Le bénéficiaire entre dans la table (vrais logos de méthode), les deux
 * jambes d'argent (¥ + XAF) et le taux (étiquette « perso ») aussi ; un bucket
 * dédié « Info manquante » isole le travail bloqué du travail à traiter.
 * Recherche serveur (référence, bénéficiaire, client), tri, pagination
 * numérotée, actions rapides au survol conformes à la RPC (« Traiter »
 * uniquement depuis ready_for_payment).
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Paperclip, CreditCard, FileDown, Loader2, Layers, Play } from 'lucide-react';
import { toast } from 'sonner';
import { usePagedAdminPayments, usePaymentStats, type PaymentFilters } from '@/hooks/usePaginatedPayments';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, TO_PROCESS_STATUSES, type PaymentStatus, type PaymentMethod } from '@/types/payment';
import { exportPendingPaymentsPDF } from '@/lib/exportPendingPaymentsPDF';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { logoMethod } from '@/lib/paymentsList';
import { formatCurrencyRMB } from '@/lib/formatters';
import { getPaymentSlaLevel } from '@/lib/paymentSla';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  paymentStatusTone,
  StatusPill,
  Card,
  Amount,
  Holder,
  ScreenLoader,
  Age,
  Chip,
  DropChip,
  SearchField,
  CardHeader,
  Th,
  Td,
  PaginationBar,
  RefChip,
  VIOLET_PILL,
  EMERALD_PILL,
} from '@/desktop/designKit';
import { DesktopPaymentPanel } from './DesktopPaymentPanel';

type Bucket = 'queue' | 'blocked' | 'processing' | 'all';
type SortField = 'created_at' | 'amount_rmb';

const METHOD_OPTIONS = [
  { value: 'all', label: 'Toutes' },
  { value: 'alipay', label: 'Alipay' },
  { value: 'wechat', label: 'WeChat' },
  { value: 'bank_transfer', label: 'Virement' },
  { value: 'cash', label: 'Cash' },
] as const;

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: 'completed', label: 'Effectués' },
  { value: 'rejected', label: 'Refusés' },
  { value: 'created', label: 'Créés' },
] as const;

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Toutes' },
  { value: '7', label: '7 jours' },
  { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' },
] as const;

export function DesktopPaymentsScreen() {
  const navigate = useNavigate();
  const { paymentId } = useParams<{ paymentId: string }>();
  const compact = !!paymentId;

  const [bucket, setBucket] = useState<Bucket>('queue');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]['value']>('all');
  const [methodFilter, setMethodFilter] = useState<(typeof METHOD_OPTIONS)[number]['value']>('all');
  const [periodDays, setPeriodDays] = useState<(typeof PERIOD_OPTIONS)[number]['value']>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortAscending, setSortAscending] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const debouncedSearch = useDebouncedValue(searchQuery);
  const { data: stats } = usePaymentStats();

  const effectiveAscending = sortAscending ?? (bucket === 'queue' && sortField === 'created_at');

  const filters = useMemo<PaymentFilters>(() => {
    const f: PaymentFilters = { sortField, sortAscending: effectiveAscending };
    if (bucket === 'queue') f.statuses = TO_PROCESS_STATUSES as string[];
    else if (bucket === 'blocked') f.status = 'waiting_beneficiary_info';
    else if (bucket === 'processing') f.status = 'processing';
    else if (statusFilter !== 'all') f.status = statusFilter;
    if (methodFilter !== 'all') f.method = methodFilter;
    if (periodDays !== 'all') {
      const from = new Date();
      from.setDate(from.getDate() - Number(periodDays));
      f.dateFrom = from.toISOString();
    }
    if (debouncedSearch.trim()) f.search = debouncedSearch;
    return f;
  }, [bucket, statusFilter, methodFilter, periodDays, debouncedSearch, sortField, effectiveAscending]);

  useEffect(() => {
    setPage(1);
  }, [bucket, statusFilter, methodFilter, periodDays, debouncedSearch, sortField, effectiveAscending]);

  const { data, isLoading } = usePagedAdminPayments(filters, page);
  const payments = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const rangeLabel = total === 0 ? '0' : `${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + payments.length}`;

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAscending(!effectiveAscending);
    else {
      setSortField(field);
      setSortAscending(false);
    }
  };
  const sortedMark = (field: SortField) => (sortField === field ? (effectiveAscending ? 'asc' : 'desc') : null);

  const handleExportBatch = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const count = await exportPendingPaymentsPDF();
      if (count === 0) toast.error('Aucun paiement en cours à exporter');
      else toast.success(`Export de ${count} paiement(s) téléchargé`);
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  const counts = {
    toProcess: stats?.toProcess ?? 0,
    inProgress: stats?.inProgress ?? 0,
    total: stats?.total ?? 0,
  };

  return (
    <div className={cn('flex flex-col', compact ? 'h-[calc(100vh-120px)] min-h-[560px]' : 'min-h-[calc(100vh-120px)]')}>
      {/* ── En-tête de page ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Paiements</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>
            {counts.total} paiement{counts.total > 1 ? 's' : ''} ·{' '}
            <span className="font-bold text-[#B47A17] dark:text-[#E7C083]">{counts.toProcess} à traiter</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportBatch}
            disabled={isExporting}
            className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold disabled:opacity-50', SOFT_PILL)}
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Exporter (PDF)
          </button>
          <button
            type="button"
            onClick={() => navigate('/m/payments/batch/new')}
            className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', SOFT_PILL)}
          >
            <Layers className="h-4 w-4" /> Paiement groupé
          </button>
          <button
            type="button"
            onClick={() => navigate('/m/payments/new')}
            className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}
          >
            <Plus className="h-4 w-4" /> Nouveau paiement
          </button>
        </div>
      </header>

      {/* ── Barre d'outils — UNE ligne ──────────────────────────────────── */}
      <section className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Chip label="À traiter" count={counts.toProcess} active={bucket === 'queue'} onClick={() => setBucket('queue')} />
          <Chip label="Info manquante" active={bucket === 'blocked'} onClick={() => setBucket('blocked')} />
          <Chip label="En cours" count={counts.inProgress || null} active={bucket === 'processing'} onClick={() => setBucket('processing')} />
          <Chip label="Tous" count={counts.total} active={bucket === 'all'} onClick={() => setBucket('all')} />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={compact ? 'Rechercher…' : 'Client, bénéficiaire ou référence…'}
            className={compact ? 'w-[190px]' : 'w-[280px]'}
          />
          {bucket === 'all' && <DropChip label="Statut" value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} />}
          <DropChip label="Méthode" value={methodFilter} options={METHOD_OPTIONS} onChange={setMethodFilter} />
          <DropChip label="Période" value={periodDays} options={PERIOD_OPTIONS} onChange={setPeriodDays} />
        </div>
      </section>

      {/* ── Table + panneau ─────────────────────────────────────────────── */}
      <div className="mt-4 flex min-h-0 flex-1 items-stretch gap-5">
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <CardHeader
            title={
              bucket === 'queue'
                ? "File d'attente"
                : bucket === 'blocked'
                  ? 'Bloqués — infos bénéficiaire manquantes'
                  : bucket === 'processing'
                    ? 'En cours de traitement'
                    : 'Tous les paiements'
            }
            meta={
              sortField === 'created_at'
                ? effectiveAscending
                  ? 'Triés du plus ancien au plus récent'
                  : 'Triés du plus récent au plus ancien'
                : `Triés par montant ¥ ${effectiveAscending ? 'croissant' : 'décroissant'}`
            }
          />
          {isLoading ? (
            <ScreenLoader />
          ) : payments.length > 0 ? (
            <>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full text-left">
                  <thead className={cn('sticky top-0 z-10', SURFACE.card)}>
                    <tr>
                      {!compact && <Th first>Référence</Th>}
                      <Th first={compact}>Client</Th>
                      <Th>Bénéficiaire</Th>
                      <Th align="right" sortable sorted={sortedMark('amount_rmb')} onSort={() => toggleSort('amount_rmb')}>
                        Montant
                      </Th>
                      {!compact && <Th align="right">Taux</Th>}
                      {!compact && (
                        <Th sortable sorted={sortedMark('created_at')} onSort={() => toggleSort('created_at')}>
                          Créé
                        </Th>
                      )}
                      <Th last={compact}>Statut</Th>
                      {!compact && <Th last className="w-[130px]" />}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => {
                      const clientName = payment.profiles
                        ? `${payment.profiles.first_name} ${payment.profiles.last_name}`
                        : 'Client inconnu';
                      const slaLevel = getPaymentSlaLevel(payment.created_at, payment.status);
                      const identifier = (payment as { beneficiary_identifier?: string | null }).beneficiary_identifier;
                      const benefName =
                        payment.method === 'cash'
                          ? `${clientName}${(payment as { cash_beneficiary_type?: string | null }).cash_beneficiary_type === 'other' ? ' (tiers)' : ' (le client)'}`
                          : payment.beneficiary_name || null;
                      const benefMeta =
                        payment.method === 'cash'
                          ? 'Retrait cash'
                          : payment.beneficiary_bank_name
                            ? `${payment.beneficiary_bank_name}${payment.beneficiary_bank_account ? ` · ${payment.beneficiary_bank_account.slice(-8)}` : ''}`
                            : identifier
                              ? `${PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]} · ${identifier}`
                              : payment.beneficiary_qr_code_url
                                ? `${PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]} · QR enregistré`
                                : null;
                      const missingBenef = !benefName && payment.method !== 'cash';
                      const rateInt = payment.exchange_rate
                        ? payment.exchange_rate < 1
                          ? Math.round(payment.exchange_rate * 1_000_000)
                          : Math.round(payment.exchange_rate)
                        : 0;
                      const proofCount = (payment as { proof_count?: number }).proof_count || 0;
                      const open = () => navigate(`/m/payments/${payment.id}`);
                      const quick =
                        payment.status === 'ready_for_payment'
                          ? { label: 'Traiter', action: 'start', cls: VIOLET_PILL, icon: true }
                          : payment.status === 'processing'
                            ? { label: 'Valider', action: 'complete', cls: EMERALD_PILL, icon: false }
                            : null;
                      return (
                        <tr
                          key={payment.id}
                          onClick={open}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              open();
                            }
                          }}
                          className={cn(
                            'group cursor-pointer outline-none transition',
                            paymentId === payment.id
                              ? 'bg-[#EDEAFA]/70 dark:bg-white/[0.06]'
                              : 'hover:bg-[#EDEAFA]/40 focus-visible:bg-[#EDEAFA]/60 dark:hover:bg-white/[0.04] dark:focus-visible:bg-white/[0.06]',
                          )}
                        >
                          {!compact && (
                            <Td first>
                              <span className="inline-flex items-center gap-1.5">
                                <RefChip>{payment.reference}</RefChip>
                                {proofCount > 0 && (
                                  <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold', TEXT.muted)}>
                                    <Paperclip className="h-3 w-3" />
                                    {proofCount}
                                  </span>
                                )}
                              </span>
                            </Td>
                          )}
                          <Td first={compact}>
                            <span className={cn('text-[13px] font-semibold', TEXT.strong, compact && 'inline-block max-w-[118px] truncate align-middle')}>
                              {clientName}
                            </span>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2">
                              <PaymentMethodLogo method={logoMethod(payment.method)} size={26} />
                              <div className="leading-[16px]">
                                <div className={cn('truncate text-[12.5px] font-semibold', compact ? 'max-w-[150px]' : 'max-w-[190px]', benefName ? TEXT.strong : TEXT.muted)}>
                                  {benefName ?? '—'}
                                </div>
                                <div
                                  className={cn(
                                    'truncate text-[11px]',
                                    compact ? 'max-w-[150px]' : 'max-w-[190px]',
                                    missingBenef ? 'font-semibold text-[#C0504D] dark:text-[#E79A9A]' : TEXT.muted,
                                  )}
                                >
                                  {missingBenef ? 'Infos bénéficiaire manquantes' : benefMeta ?? PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]}
                                </div>
                              </div>
                            </div>
                          </Td>
                          <Td align="right">
                            <div className="leading-[17px]">
                              <Amount value={formatCurrencyRMB(payment.amount_rmb)} size="md" className="!text-[15px]" />
                              {!compact && (
                                <div className={cn('text-[11px] tabular-nums', TEXT.muted)}>
                                  {Math.round(payment.amount_xaf).toLocaleString('fr-FR')} XAF
                                </div>
                              )}
                            </div>
                          </Td>
                          {!compact && (
                            <Td align="right">
                              <span className={cn('inline-flex items-center gap-1 text-[12px] tabular-nums', TEXT.muted)}>
                                {rateInt ? rateInt.toLocaleString('fr-FR') : '—'}
                                {payment.rate_is_custom && (
                                  <span className="rounded-full bg-[#EAE7FA] px-1.5 py-px text-[9px] font-extrabold uppercase text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]">
                                    perso
                                  </span>
                                )}
                              </span>
                            </Td>
                          )}
                          {!compact && (
                            <Td>
                              <Age date={payment.created_at} level={slaLevel} />
                            </Td>
                          )}
                          <Td last={compact}>
                            <StatusPill
                              tone={paymentStatusTone(payment.status)}
                              label={PAYMENT_STATUS_LABELS[payment.status as PaymentStatus] || payment.status}
                            />
                          </Td>
                          {!compact && (
                            <Td last align="right">
                              {quick ? (
                                <span
                                  className="inline-flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/m/payments/${payment.id}?action=${quick.action}`)}
                                    className={cn('inline-flex items-center gap-1 px-3 py-1.5 text-[12px]', quick.cls)}
                                  >
                                    {quick.icon && <Play className="h-3 w-3" />}
                                    {quick.label}
                                  </button>
                                </span>
                              ) : (
                                <span className="inline-flex h-8 items-center opacity-0" aria-hidden>
                                  ·
                                </span>
                              )}
                            </Td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationBar page={page} pages={pages} rangeLabel={rangeLabel} total={String(total)} onPage={setPage} />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              <Holder icon={CreditCard} size="lg" />
              <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>Aucun paiement trouvé</p>
              <p className={cn('mt-1 text-[12px]', TEXT.muted)}>
                {bucket !== 'queue' || methodFilter !== 'all' || periodDays !== 'all' || debouncedSearch
                  ? 'Essayez de modifier vos filtres'
                  : 'La file est vide — tout est traité'}
              </p>
            </div>
          )}
        </Card>

        {paymentId && <DesktopPaymentPanel key={paymentId} paymentId={paymentId} />}
      </div>
    </div>
  );
}
