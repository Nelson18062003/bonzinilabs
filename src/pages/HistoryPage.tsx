import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMyWallet, useMyWalletOperations, WalletOperation } from '@/hooks/useWallet';
import { useMyProfile } from '@/hooks/useProfile';
import { formatXAF } from '@/lib/formatters';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Filter,
  FileDown,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  generateClientStatement,
  buildMovementFromWalletOp,
  shouldIncludeWalletOp,
  fmtDateLong,
} from '@/lib/generateClientStatement';

type FilterType = 'all' | 'credits' | 'debits';

const HistoryPage = () => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const { data: wallet } = useMyWallet();
  const { data: operations, isLoading } = useMyWalletOperations();
  const { data: profile } = useMyProfile();
  const { t, i18n } = useTranslation('history');
  const dateLocale = i18n.language?.startsWith('fr') ? fr : enUS;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _wallet = wallet;

  const isDebitOperation = (op: WalletOperation): boolean => {
    const type = op.operation_type.toUpperCase();
    if (type === 'DEPOSIT' || type === 'DEPOSIT_VALIDATED' || type === 'ADMIN_CREDIT' || type === 'PAYMENT_CANCELLED_REFUNDED') return false;
    if (type === 'PAYMENT' || type === 'PAYMENT_EXECUTED' || type === 'PAYMENT_RESERVED' || type === 'ADMIN_DEBIT' || type === 'DEPOSIT_REFUSED') return true;
    if (op.balance_after < op.balance_before) return true;
    if (op.balance_after > op.balance_before) return false;
    return op.amount_xaf < 0;
  };

  const filteredOperations = (operations || []).filter(op => {
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

  const getOperationIcon = (op: WalletOperation) => {
    const isDebit = isDebitOperation(op);
    const type = op.operation_type.toUpperCase();
    if (type === 'DEPOSIT' || type === 'DEPOSIT_VALIDATED' || type === 'PAYMENT_CANCELLED_REFUNDED' || type === 'ADMIN_CREDIT') {
      return <ArrowDownLeft className="w-5 h-5 text-success" />;
    }
    if (type === 'PAYMENT' || type === 'PAYMENT_EXECUTED' || type === 'PAYMENT_RESERVED' || type === 'ADMIN_DEBIT') {
      return <ArrowUpRight className="w-5 h-5 text-destructive" />;
    }
    return <RefreshCw className={`w-5 h-5 ${isDebit ? 'text-destructive' : 'text-success'}`} />;
  };

  const getOperationLabel = (op: WalletOperation): string => {
    const type = op.operation_type.toUpperCase();
    switch (type) {
      case 'DEPOSIT': case 'DEPOSIT_VALIDATED': return t('operation_type.deposit');
      case 'DEPOSIT_REFUSED': return t('operation_type.deposit_refused');
      case 'PAYMENT': case 'PAYMENT_EXECUTED': return t('operation_type.payment');
      case 'PAYMENT_RESERVED': return t('operation_type.payment_reserved');
      case 'PAYMENT_CANCELLED_REFUNDED': return t('operation_type.payment_refunded');
      case 'ADMIN_CREDIT': return t('operation_type.admin_credit');
      case 'ADMIN_DEBIT': return t('operation_type.admin_debit');
      case 'ADJUSTMENT': {
        const isDebit = isDebitOperation(op);
        return isDebit ? t('operation_type.adjustment_debit') : t('operation_type.adjustment_credit');
      }
      default: return t('operation_type.default');
    }
  };

  const handleDownloadStatement = async () => {
    if (!operations?.length) {
      toast.error(t('no_movements_to_export'));
      return;
    }
    setIsGenerating(true);
    try {
      const sorted = [...operations]
        .filter(op => shouldIncludeWalletOp(op))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const movements = sorted.map(op => buildMovementFromWalletOp(op));
      const clientName = profile ? `${profile.first_name} ${profile.last_name}` : 'Client';

      await generateClientStatement({
        clientName,
        clientPhone: profile?.phone ?? undefined,
        clientEmail: profile?.email ?? undefined,
        movements,
        periodFrom: movements.length > 0 ? fmtDateLong(movements[0].date) : '—',
        periodTo: fmtDateLong(new Date().toISOString()),
        generatedAt: new Date().toLocaleString(i18n.language || 'fr', {
          day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
      });
    } catch (err) {
      console.error('Error generating statement:', err);
      toast.error(t('statement_error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const filterItems: { value: FilterType; labelKey: string }[] = [
    { value: 'all', labelKey: 'filter.all' },
    { value: 'credits', labelKey: 'filter.credits' },
    { value: 'debits', labelKey: 'filter.debits' },
  ];

  return (
    <MobileLayout>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        rightElement={
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadStatement}
            disabled={isGenerating || isLoading}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            {t('download_statement')}
          </Button>
        }
      />

      {/* Filters */}
      <div className="pl-4 pr-0 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {filterItems.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              filter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      <div className="px-4 py-2 space-y-6">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : Object.entries(groupedOperations).length > 0 ? (
          Object.entries(groupedOperations).map(([date, ops]) => (
            <div key={date} className="animate-slide-up">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {format(new Date(date), 'EEEE d MMMM', { locale: dateLocale })}
              </h3>

              <div className="space-y-2">
                {ops.map((op) => {
                  const isDebit = isDebitOperation(op);
                  return (
                    <div
                      key={op.id}
                      className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border/30"
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        isDebit ? 'bg-destructive/10' : 'bg-success/10'
                      )}>
                        {getOperationIcon(op)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {getOperationLabel(op)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {op.description || 'N/A'}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className={cn(
                          'font-semibold',
                          isDebit ? 'text-destructive' : 'text-success'
                        )}>
                          {isDebit ? '-' : '+'}{formatXAF(Math.abs(op.amount_xaf))}
                        </p>
                        <p className="text-xs text-muted-foreground">XAF</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Filter className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{t('no_operations')}</p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default HistoryPage;
