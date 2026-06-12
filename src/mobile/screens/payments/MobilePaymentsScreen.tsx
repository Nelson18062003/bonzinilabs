// ============================================================
// MODULE PAIEMENTS — MobilePaymentsScreen
// Présentation migrée sur le design kit (Ofspace/Mola) :
//   canvas doux · cartes à ombre douce · PaymentMethodLogo (vrais logos) ·
//   Amount · StatusPill toné (paymentStatusTone) · SlaDot · chips kit.
// Logique 100% préservée : stats, recherche debouncée, filtres
// (méthode/période/tri), chips statut, infinite scroll, SLA,
// export PDF batch (colonnes LEGACY/EXTENDED + signature QR).
// ============================================================
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePaginatedAdminPayments, usePaymentStats, type PaymentFilters } from '@/hooks/usePaginatedPayments';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  TO_PROCESS_STATUSES,
} from '@/types/payment';
import type { PaymentStatus } from '@/types/payment';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  type Tone,
  paymentStatusTone,
  StatusPill,
  TextInput,
  Holder,
  Amount,
  Card,
} from '@/mobile/designKit';
import {
  Plus, Search, Paperclip, SlidersHorizontal, X, Calendar, CreditCard,
  FileDown, Loader2,
} from 'lucide-react';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { BatchPaymentsPDF } from '@/lib/pdf/templates/BatchPaymentsPDF';
import type { BatchPaymentEntry } from '@/lib/pdf/templates/BatchPaymentsPDF';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { signStored } from '@/lib/signedUrls';
import { toast } from 'sonner';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { formatCurrencyRMB, formatRelativeDate } from '@/lib/formatters';
import { getPaymentSlaLevel, type SlaLevel } from '@/lib/paymentSla';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';

// ── Configuration des filtres ───────────────────────────────

type FilterKey = PaymentStatus | 'all' | 'to_process';

const METHOD_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Toutes méthodes' },
  ...Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => ({ key, label })),
];

const SORT_OPTIONS: { key: string; label: string; field: 'created_at' | 'amount_rmb'; ascending: boolean }[] = [
  { key: 'newest', label: 'Plus récent', field: 'created_at', ascending: false },
  { key: 'oldest', label: 'Plus ancien', field: 'created_at', ascending: true },
  { key: 'amount_desc', label: 'Montant ↓', field: 'amount_rmb', ascending: false },
  { key: 'amount_asc', label: 'Montant ↑', field: 'amount_rmb', ascending: true },
];

// Map méthode DB → logo (PaymentMethodLogo n'accepte que 4 clés).
function logoMethod(method: string): 'alipay' | 'wechat' | 'bank_transfer' | 'cash' {
  if (method === 'alipay' || method === 'wechat' || method === 'cash') return method;
  return 'bank_transfer';
}

// ── Point SLA (calqué sur deposits V2) ───────────────────────
function SlaDot({ level }: { level: SlaLevel }) {
  const color = level === 'fresh' ? '#34d399' : level === 'aging' ? '#F3A745' : '#ef4444';
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: 6,
        height: 6,
        background: color,
        animation: level === 'overdue' ? 'sla-pulse 1.5s infinite' : undefined,
      }}
      title={level === 'fresh' ? '< 4h' : level === 'aging' ? '4-12h' : '> 12h'}
    />
  );
}

// KPI rapides → tone unifié (la couleur porte le statut).
const KPI_TILES: { label: string; key: FilterKey; tone: Tone; figure: string; ring: string }[] = [
  { label: 'À traiter', key: 'to_process', tone: 'pending', figure: 'text-[#9A6B12] dark:text-[#E7C083]', ring: 'ring-[#E7C083]' },
  { label: 'En cours', key: 'processing', tone: 'info', figure: 'text-[#5B4CC4] dark:text-[#B5AAF0]', ring: 'ring-[#C9C2F0] dark:ring-[#4A4660]' },
  { label: 'Terminés', key: 'completed', tone: 'success', figure: 'text-[#2E7D52] dark:text-[#7FCBA0]', ring: 'ring-[#7FCBA0]' },
];

// ── Composant principal ──────────────────────────────────────

export function MobilePaymentsScreen() {
  const { t } = useTranslation('common');
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [sortKey, setSortKey] = useState('newest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const { data: stats } = usePaymentStats();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);

  const sortOption = SORT_OPTIONS.find(o => o.key === sortKey) || SORT_OPTIONS[0];

  // ── Build filter params ─────────────────────────────────────

  const filterParams = useMemo<PaymentFilters | undefined>(() => {
    const params: PaymentFilters = {};

    if (statusFilter === 'to_process') {
      params.statuses = TO_PROCESS_STATUSES as string[];
    } else if (statusFilter !== 'all') {
      params.status = statusFilter;
    }

    if (methodFilter !== 'all') {
      params.method = methodFilter;
    }

    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    params.sortField = sortOption.field;
    params.sortAscending = sortOption.ascending;

    const hasFilters = params.status || params.statuses || params.method || params.dateFrom || params.dateTo;
    const isDefaultSort = sortOption.key === 'newest';

    if (!hasFilters && isDefaultSort) return undefined;
    return params;
  }, [statusFilter, methodFilter, dateFrom, dateTo, sortOption]);

  const {
    data,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePaginatedAdminPayments(filterParams);

  const handleLoadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  const allPayments = useMemo(
    () => data?.pages.flatMap((page) => page.data) || [],
    [data],
  );

  // Client-side search over loaded items
  const filteredPayments = useMemo(() => {
    if (!debouncedSearch) return allPayments;
    const search = debouncedSearch.toLowerCase();
    return allPayments.filter((payment) => {
      const clientName = `${payment.profiles?.first_name || ''} ${payment.profiles?.last_name || ''}`.toLowerCase();
      return (
        clientName.includes(search) ||
        payment.reference?.toLowerCase().includes(search) ||
        payment.profiles?.phone?.includes(search)
      );
    });
  }, [allPayments, debouncedSearch]);

  // ── Computed values ─────────────────────────────────────────

  const counts = useMemo(() => {
    if (stats) {
      return {
        toProcess: stats.toProcess,
        inProgress: stats.inProgress,
        completed: stats.completed,
        total: stats.total,
      };
    }
    return { toProcess: 0, inProgress: 0, completed: 0, total: 0 };
  }, [stats]);

  const kpiValue: Record<FilterKey, number> = {
    to_process: counts.toProcess,
    processing: counts.inProgress,
    completed: counts.completed,
  } as Record<FilterKey, number>;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (methodFilter !== 'all') count++;
    if (dateFrom || dateTo) count++;
    if (sortKey !== 'newest') count++;
    return count;
  }, [methodFilter, dateFrom, dateTo, sortKey]);

  const clearAdvancedFilters = useCallback(() => {
    setMethodFilter('all');
    setDateFrom('');
    setDateTo('');
    setSortKey('newest');
  }, []);

  const handleExportBatch = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // Columns added by the 20260421* migrations. If they haven't been
      // applied to the remote DB yet, PostgREST returns an error complaining
      // about the unknown column. Detect that and retry with the legacy
      // column set so the export keeps working while the migration catches up.
      const LEGACY_COLUMNS =
        'id, reference, amount_rmb, method, created_at, beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_bank_name, beneficiary_bank_account, beneficiary_qr_code_url, beneficiary_notes';
      const EXTENDED_COLUMNS = `${LEGACY_COLUMNS}, beneficiary_bank_extra, beneficiary_identifier`;

      type PaymentRow = {
        id: string;
        reference: string;
        amount_rmb: number;
        method: string;
        created_at: string | null;
        beneficiary_name: string | null;
        beneficiary_phone: string | null;
        beneficiary_email: string | null;
        beneficiary_bank_name: string | null;
        beneficiary_bank_account: string | null;
        beneficiary_qr_code_url: string | null;
        beneficiary_notes: string | null;
        beneficiary_bank_extra?: string | null;
        beneficiary_identifier?: string | null;
      };

      const runSelect = async (columns: string) =>
        supabaseAdmin
          .from('payments')
          .select(columns)
          .eq('status', 'processing')
          .neq('method', 'cash');

      let payments: PaymentRow[] | null = null;
      {
        const res = await runSelect(EXTENDED_COLUMNS);
        if (res.error) {
          const missingColumn =
            res.error.code === '42703' ||
            /column .* does not exist/i.test(res.error.message || '');
          if (!missingColumn) throw res.error;
          const fallback = await runSelect(LEGACY_COLUMNS);
          if (fallback.error) throw fallback.error;
          payments = fallback.data as unknown as PaymentRow[];
        } else {
          payments = res.data as unknown as PaymentRow[];
        }
      }

      if (!payments || payments.length === 0) {
        toast.error(t('noPaymentsToExport', { defaultValue: 'Aucun paiement en cours à exporter' }));
        return;
      }

      // Generate signed URLs for QR codes
      const entries: BatchPaymentEntry[] = await Promise.all(
        payments.map(async (p) => {
          // Heals raw paths AND values stored as signed/public URLs.
          const qrUrl = await signStored(supabaseAdmin.storage, p.beneficiary_qr_code_url);
          return {
            id: p.id,
            reference: p.reference,
            amount_rmb: p.amount_rmb,
            method: p.method,
            created_at: p.created_at,
            beneficiary_name: p.beneficiary_name,
            beneficiary_phone: p.beneficiary_phone,
            beneficiary_email: p.beneficiary_email,
            beneficiary_bank_name: p.beneficiary_bank_name,
            beneficiary_bank_account: p.beneficiary_bank_account,
            beneficiary_bank_extra: p.beneficiary_bank_extra ?? null,
            beneficiary_qr_code_url: qrUrl,
            beneficiary_notes: p.beneficiary_notes,
            beneficiary_identifier: p.beneficiary_identifier ?? null,
          };
        }),
      );

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      await downloadPDF(
        <BatchPaymentsPDF payments={entries} generatedAt={new Date()} />,
        `Bonzini_Payments_Pending_${dateStr}.pdf`,
      );
      toast.success(t('exportDownloaded', { defaultValue: `Export de ${entries.length} paiement(s) téléchargé`, count: entries.length }));
    } catch (error) {
      console.error('Error exporting batch payments:', error);
      toast.error(t('exportError', { defaultValue: "Erreur lors de l'export" }));
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  const hasActiveFilters = activeFilterCount > 0;

  // ── Render ────────────────────────────────────────────────

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <style>{`@keyframes sla-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className={cn(
          'sticky top-0 z-40 flex shrink-0 items-center justify-between px-5 pt-[env(safe-area-inset-top)]',
          SURFACE.canvas,
        )}
      >
        <div className="flex h-14 w-full items-center justify-between">
          <h1 className={cn('text-[20px] font-extrabold', TEXT.strong)}>
            {t('payments', { defaultValue: 'Paiements' })}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBatch}
              disabled={isExporting}
              aria-label="Exporter"
              className={cn(
                'flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-bold transition active:scale-95 disabled:opacity-50',
                SOFT_PILL,
              )}
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Exporter
            </button>
            <button
              onClick={() => navigate('/m/payments/new')}
              aria-label="Nouveau paiement"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8B5CF6] text-white shadow-[0_6px_16px_-4px_rgba(139,92,246,0.55)] transition active:scale-95"
            >
              <Plus className="h-5 w-5" strokeWidth={2.6} />
            </button>
          </div>
        </div>
      </header>

      <PullToRefresh
        onRefresh={refetch}
        className="flex-1 space-y-3 overflow-y-auto px-5 pb-28 pt-1"
      >
        {/* ── KPIs compacts (tap = filtre statut) ───────────── */}
        <div className="flex gap-2.5">
          {KPI_TILES.map((k) => {
            const active = statusFilter === k.key;
            return (
              <button
                key={k.key}
                onClick={() => setStatusFilter(active ? 'all' : k.key)}
                className={cn(
                  'flex-1 rounded-[18px] py-3 text-center transition active:scale-[0.98]',
                  SURFACE.card,
                  SURFACE.shadow,
                  active && cn('ring-2', k.ring),
                )}
              >
                <div className={cn('text-[22px] font-extrabold leading-none tabular-nums', k.figure)}>
                  {kpiValue[k.key] ?? 0}
                </div>
                <div className={cn('mt-1.5 text-[9px] font-bold uppercase tracking-wider', TEXT.muted)}>
                  {k.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Bandeau « aujourd'hui » (si activité) ─────────── */}
        {stats && stats.today_completed > 0 && (
          <Card className="flex items-center justify-between py-3">
            <div>
              <div className={cn('text-[12px] font-medium', TEXT.muted)}>Réglés aujourd'hui</div>
              <div className={cn('mt-0.5 text-[12px]', TEXT.muted)}>{formatCurrencyRMB(stats.today_amount_rmb)}</div>
            </div>
            <Amount value={stats.today_completed} size="md" />
          </Card>
        )}

        {/* ── Export batch (PDF) ───────────────────────────── */}
        <button
          onClick={handleExportBatch}
          disabled={isExporting}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-semibold transition active:scale-[0.98] disabled:opacity-50',
            SOFT_PILL,
          )}
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Exporter paiements en cours (PDF)
        </button>

        {/* ── Recherche + bouton filtres ─────────────────────── */}
        <div className="flex gap-2.5">
          <div className="relative flex-1">
            <Search className={cn('pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
            <TextInput
              placeholder={t('searchNamePhoneRef', { defaultValue: 'Nom, téléphone ou référence...' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Effacer"
                className={cn('absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1', TEXT.muted)}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Filtres avancés"
            className={cn(
              'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition active:scale-95',
              SURFACE.card,
              SURFACE.shadow,
              (showFilters || hasActiveFilters) && 'ring-2 ring-[#C9C2F0] dark:ring-[#4A4660]',
            )}
          >
            <SlidersHorizontal className={cn('h-[18px] w-[18px]', showFilters || hasActiveFilters ? 'text-[#6B5BD2] dark:text-[#A99BF0]' : TEXT.muted)} />
            {hasActiveFilters && (
              <span className="absolute right-2 top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#6B5BD2] px-1 text-[9px] font-extrabold text-white dark:bg-[#A99BF0] dark:text-[#1B1A24]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Panneau filtres avancés ────────────────────────── */}
        {showFilters && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={cn('text-[13px] font-bold', TEXT.strong)}>Filtres avancés</h3>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAdvancedFilters}
                  className="text-[12px] font-semibold text-[#6B5BD2] dark:text-[#A99BF0]"
                >
                  Réinitialiser
                </button>
              )}
            </div>

            {/* Filtre méthode */}
            <div>
              <div className={cn('mb-2 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Méthode</div>
              <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                {METHOD_FILTERS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMethodFilter(m.key)}
                    className={cn(
                      'whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors',
                      methodFilter === m.key ? PRIMARY_PILL : SOFT_PILL,
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tri */}
            <div>
              <div className={cn('mb-2 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Tri</div>
              <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSortKey(opt.key)}
                    className={cn(
                      'whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors',
                      sortKey === opt.key ? PRIMARY_PILL : SOFT_PILL,
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Période */}
            <div>
              <div className={cn('mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
                <Calendar className="h-3 w-3" />
                Période
              </div>
              <div className="flex items-center gap-2">
                <TextInput
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="flex-1"
                />
                <span className={cn('text-[13px]', TEXT.muted)}>→</span>
                <TextInput
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="flex-1"
                />
                {(dateFrom || dateTo) && (
                  <Holder icon={X} size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }} />
                )}
              </div>
            </div>
          </Card>
        )}

        {/* ── Chips statut ───────────────────────────────────── */}
        <div className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5">
          {[
            { k: 'all' as FilterKey, l: 'Tous', c: counts.total },
            { k: 'to_process' as FilterKey, l: 'À traiter', c: counts.toProcess },
            { k: 'processing' as FilterKey, l: 'En cours', c: counts.inProgress },
            { k: 'completed' as FilterKey, l: 'Terminés', c: counts.completed },
            { k: 'rejected' as FilterKey, l: 'Rejetés', c: null },
          ].map((ch) => {
            const active = statusFilter === ch.k;
            return (
              <button
                key={ch.k}
                onClick={() => setStatusFilter(ch.k)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors',
                  active ? PRIMARY_PILL : SOFT_PILL,
                )}
              >
                {ch.l}
                {ch.c != null && ch.c > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-px text-[9px] font-extrabold tabular-nums',
                      active ? 'bg-white/20 text-white dark:bg-black/15 dark:text-[#1B1A24]' : 'bg-black/[0.06] dark:bg-white/10',
                    )}
                  >
                    {ch.c}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Liste paiements ────────────────────────────────── */}
        {isLoading ? (
          <SkeletonListScreen count={4} />
        ) : filteredPayments.length > 0 ? (
          <div className="space-y-2.5">
            {filteredPayments.map((payment) => {
              const clientName = payment.profiles
                ? `${payment.profiles.first_name} ${payment.profiles.last_name}`
                : 'Client inconnu';
              const proofCount = payment.proof_count || 0;
              const slaLevel = getPaymentSlaLevel(payment.created_at, payment.status);
              const statusLabel = PAYMENT_STATUS_LABELS[payment.status as PaymentStatus] || payment.status;
              const methodLabel = PAYMENT_METHOD_LABELS[payment.method] || payment.method;

              return (
                <button
                  key={payment.id}
                  onClick={() => navigate(`/m/payments/${payment.id}`)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-[22px] p-4 text-left transition-transform active:scale-[0.98]',
                    SURFACE.card,
                    SURFACE.shadow,
                  )}
                >
                  <PaymentMethodLogo method={logoMethod(payment.method)} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('truncate text-[14px] font-semibold', TEXT.strong)}>
                        {clientName}
                      </span>
                      {proofCount > 0 && (
                        <span className={cn('inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold', TEXT.muted)}>
                          <Paperclip className="h-3 w-3" />
                          {proofCount}
                        </span>
                      )}
                    </div>
                    <div className={cn('mt-0.5 truncate text-[12px]', TEXT.muted)}>
                      {payment.reference} · {methodLabel}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Amount value={formatCurrencyRMB(payment.amount_rmb)} size="md" />
                    <div className="mt-1 flex items-center justify-end gap-1.5">
                      {slaLevel && <SlaDot level={slaLevel} />}
                      <StatusPill tone={paymentStatusTone(payment.status)} label={statusLabel} />
                    </div>
                    <div className={cn('mt-1 text-[10px]', TEXT.muted)}>
                      {formatRelativeDate(payment.created_at)}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Infinite scroll — uniquement si pas de recherche en cours */}
            {!debouncedSearch && (
              <InfiniteScrollTrigger
                onLoadMore={handleLoadMore}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Holder icon={CreditCard} size="lg" />
            <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>
              {t('noPaymentFound', { defaultValue: 'Aucun paiement trouvé' })}
            </p>
            <p className={cn('mt-1 text-[12px]', TEXT.muted)}>
              {statusFilter !== 'all' || activeFilterCount > 0
                ? 'Essayez de modifier vos filtres'
                : 'Les paiements apparaîtront ici'}
            </p>
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
