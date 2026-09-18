// ============================================================
// APP CLIENT — HistoryPage (activité du compte) · refonte « Direction A ».
// Opérations groupées par jour (crédit vert / débit neutre), filtres
// Tous/Crédits/Débits, bouton Relevé (PDF). Logique 100% PRÉSERVÉE :
// isDebitOperation (tous types), filtre, groupement, libellés, relevé.
// ============================================================
import { useState } from 'react';
import { QueryError } from '@/components/ui/QueryError';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { dateLocale } from '@/lib/dateLocale';
import { ArrowDownLeft, ArrowUpRight, Filter, FileDown, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/layout/MobileLayout';
import {
  useMyWalletOperations,
  fetchMyLedgerInRange,
  fetchMyLastLedgerEntryBefore,
  WalletOperation,
} from '@/hooks/useWallet';
import { useMyProfile } from '@/hooks/useProfile';
import { formatNumber } from '@/lib/formatters';
import { SURFACE, TEXT, SOFT_PILL } from '@/mobile/designKit';
import {
  generateStatementForRange,
  buildMovementFromWalletOp,
  shouldIncludeWalletOp,
} from '@/lib/generateClientStatement';
import { StatementPeriodSheet } from '@/components/statement/StatementPeriodSheet';
import { statementQueryRange, type StatementRange } from '@/lib/statementPeriod';

type FilterType = 'all' | 'credits' | 'debits';

const GREEN = '#2E7D52';

const HistoryPage = () => {
  const { t } = useTranslation('client');
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const { data: operations, isLoading, isError, refetch } = useMyWalletOperations();
  const { data: profile } = useMyProfile();

  // ── Crédit / débit (tous types) — LOGIQUE PRÉSERVÉE ───────────
  const isDebitOperation = (op: WalletOperation): boolean => {
    const ty = op.operation_type.toUpperCase();
    if (ty === 'DEPOSIT' || ty === 'DEPOSIT_VALIDATED' || ty === 'ADMIN_CREDIT' || ty === 'PAYMENT_CANCELLED_REFUNDED') return false;
    if (ty === 'PAYMENT' || ty === 'PAYMENT_EXECUTED' || ty === 'PAYMENT_RESERVED' || ty === 'ADMIN_DEBIT' || ty === 'DEPOSIT_REFUSED') return true;
    if (op.balance_after < op.balance_before) return true;
    if (op.balance_after > op.balance_before) return false;
    return op.amount_xaf < 0;
  };

  const q = search.trim().toLowerCase();
  const filteredOperations = (operations || [])
    .filter((op) => !q || (op.description || '').toLowerCase().includes(q))
    .filter((op) => {
      if (filter === 'all') return true;
      const isDebit = isDebitOperation(op);
      if (filter === 'credits') return !isDebit;
      if (filter === 'debits') return isDebit;
      return true;
    });

  const groupedOperations = filteredOperations.reduce((groups, op) => {
    const date = format(new Date(op.created_at), 'yyyy-MM-dd');
    if (!groups[date]) groups[date] = [];
    groups[date].push(op);
    return groups;
  }, {} as Record<string, WalletOperation[]>);

  const getOperationLabel = (op: WalletOperation): string => {
    const opType = op.operation_type.toUpperCase();
    switch (opType) {
      case 'DEPOSIT': case 'DEPOSIT_VALIDATED': return t('history.operationLabels.deposit');
      case 'DEPOSIT_REFUSED': return t('history.operationLabels.depositRefused');
      case 'PAYMENT': case 'PAYMENT_EXECUTED': return t('history.operationLabels.payment');
      case 'PAYMENT_RESERVED': return t('history.operationLabels.paymentReserved');
      case 'PAYMENT_CANCELLED_REFUNDED': return t('history.operationLabels.refund');
      case 'ADMIN_CREDIT': return t('history.operationLabels.adminCredit');
      case 'ADMIN_DEBIT': return t('history.operationLabels.adminDebit');
      case 'ADJUSTMENT': {
        const isDebit = isDebitOperation(op);
        return isDebit ? t('history.operationLabels.adjustmentDebit') : t('history.operationLabels.adjustmentCredit');
      }
      default: return t('history.operationLabels.operation');
    }
  };

  // Relevé PDF sur une période : la feuille choisit la période, on lit TOUTES
  // les écritures de cette période (la liste à l'écran, elle, reste à 100),
  // et le solde d'ouverture vient de la dernière écriture avant la période
  // si elle est vide.
  const handleDownloadStatement = async (range: StatementRange) => {
    setIsGenerating(true);
    try {
      const query = statementQueryRange(range);
      const entries = await fetchMyLedgerInRange(query);
      const movements = entries
        .filter((op) => shouldIncludeWalletOp(op))
        .map((op) => buildMovementFromWalletOp(op));
      if (query === null && movements.length === 0) {
        toast.error(t('history.noMovements'));
        return false;
      }
      const lastBefore = query && movements.length === 0
        ? await fetchMyLastLedgerEntryBefore(query.from)
        : null;
      const clientName = profile ? `${profile.first_name} ${profile.last_name}` : 'Client';

      await generateStatementForRange({
        client: { name: clientName, phone: profile?.phone, email: profile?.email },
        range: query,
        movements,
        lastBalanceBefore: lastBefore?.balance_after ?? null,
      });
      return true;
    } catch (err) {
      console.error('Error generating statement:', err);
      toast.error(t('history.statementError'));
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  const FILTERS: { value: FilterType; label: string }[] = [
    { value: 'all', label: t('history.filterAll') },
    { value: 'credits', label: t('history.filterCredits') },
    { value: 'debits', label: t('history.filterDebits') },
  ];

  return (
    <MobileLayout>
      <div className={cn('min-h-[100dvh] space-y-5 px-4 pb-6 pt-6', SURFACE.canvas)}>
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 px-1">
          <div>
            <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>{t('history.title')}</h1>
            <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>{t('history.subtitle')}</p>
          </div>
          <button
            onClick={() => setStatementOpen(true)}
            disabled={isGenerating || isLoading}
            className={cn('flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-[13px] font-bold transition active:scale-95 disabled:opacity-50', SOFT_PILL)}
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {t('history.statement')}
          </button>
        </div>

        {/* Recherche */}
        <label className={cn('flex items-center gap-2.5 rounded-full px-4 py-3 focus-within:ring-2 focus-within:ring-[#8B5CF6]/60', SURFACE.card, SURFACE.shadow)}>
          <Search className={cn('h-[18px] w-[18px] shrink-0', TEXT.muted)} />
          {/* input nu volontaire 16px (anti auto-zoom iOS) */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('history.search', { defaultValue: 'Rechercher une opération…' })}
            className={cn('min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#9B98AD]', TEXT.strong)}
          />
        </label>

        {/* Filtres */}
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'shrink-0 min-h-10 rounded-full px-3.5 text-[13px] font-bold transition-colors',
                filter === f.value ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted),
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Liste groupée */}
        {isLoading ? (
          <div className="space-y-2.5 pt-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn('h-16 animate-pulse rounded-[18px]', SURFACE.card, SURFACE.shadow)} />
            ))}
          </div>
        ) : isError ? (
          <QueryError what={t('history.loadWhat')} onRetry={() => { void refetch(); }} />
        ) : Object.entries(groupedOperations).length > 0 ? (
          Object.entries(groupedOperations).map(([date, ops]) => (
            <section key={date} className="animate-slide-up">
              <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>
                {format(new Date(date), 'EEEE d MMMM', { locale: dateLocale() })}
              </h2>
              <div className="space-y-2.5">
                {ops.map((op) => {
                  const isDebit = isDebitOperation(op);
                  return (
                    <div key={op.id} className={cn('flex items-center gap-3 rounded-[18px] p-3.5', SURFACE.card, SURFACE.shadow)}>
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                        style={{ background: isDebit ? 'rgba(0,0,0,0.05)' : `${GREEN}1F` }}
                      >
                        {isDebit ? (
                          <ArrowUpRight className={cn('h-5 w-5', TEXT.muted)} />
                        ) : (
                          <ArrowDownLeft className="h-5 w-5" style={{ color: GREEN }} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn('break-words text-[14px] font-bold leading-snug', TEXT.strong)}>{getOperationLabel(op)}</p>
                        {op.description && <p className={cn('mt-0.5 break-words text-[12px] leading-snug', TEXT.muted)}>{op.description}</p>}
                      </div>
                      <div className={cn('shrink-0 text-right text-[14px] font-black tabular-nums', isDebit && TEXT.strong)} style={isDebit ? undefined : { color: GREEN }}>
                        {isDebit ? '−' : '+'} {formatNumber(Math.abs(op.amount_xaf))}
                        <div className={cn('text-[10px] font-semibold', TEXT.muted)}>XAF</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className={cn('mt-2 rounded-[24px] p-10 text-center', SURFACE.card, SURFACE.shadow)}>
            <div className={cn('mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full', SURFACE.holder)}>
              <Filter className="h-7 w-7" />
            </div>
            <p className={cn('text-[14px]', TEXT.muted)}>{t('history.noOperations')}</p>
          </div>
        )}
      </div>

      {/* Relevé de compte — choix de la période */}
      <StatementPeriodSheet
        open={statementOpen}
        onClose={() => setStatementOpen(false)}
        onGenerate={handleDownloadStatement}
        isGenerating={isGenerating}
      />
    </MobileLayout>
  );
};

export default HistoryPage;
