import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge, getStatusType } from '@/components/common/StatusBadge';
import { useMyDeposits, DEPOSIT_STATUS_LABELS, DEPOSIT_METHOD_LABELS } from '@/hooks/useDeposits';
import { formatXAF, formatRMB, getPaymentStatusLabel } from '@/lib/formatters';
import { paymentMethodsInfo } from '@/data/staticData';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowDownLeft, ArrowUpRight, Filter } from 'lucide-react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type FilterType = 'all' | 'deposits' | 'payments';

const HistoryPage = () => {
  const [filter, setFilter] = useState<FilterType>('all');
  const { data: deposits, isLoading } = useMyDeposits();

  // For now, only deposits are implemented. Payments will come from a separate hook when ready.
  const allTransactions = [
    ...(deposits || []).map(d => ({
      ...d,
      type: 'deposit' as const,
      displayAmount: d.amount_xaf,
      date: new Date(d.created_at),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const filteredTransactions = allTransactions.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'deposits') return t.type === 'deposit';
    if (filter === 'payments') return false; // No payments yet
    return true;
  });

  // Group by date
  const groupedTransactions = filteredTransactions.reduce((groups, transaction) => {
    const date = format(transaction.date, 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, typeof filteredTransactions>);

  return (
    <MobileLayout>
      <PageHeader 
        title="Historique" 
        subtitle="Toutes vos opérations"
      />
      
      {/* Filters */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto">
        {[
          { value: 'all', label: 'Tout' },
          { value: 'deposits', label: 'Dépôts' },
          { value: 'payments', label: 'Paiements' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as FilterType)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              filter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
          >
            {f.label}
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
        ) : Object.entries(groupedTransactions).length > 0 ? (
          Object.entries(groupedTransactions).map(([date, transactions]) => (
            <div key={date} className="animate-slide-up">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {format(new Date(date), 'EEEE d MMMM', { locale: fr })}
              </h3>
              
              <div className="space-y-2">
                {transactions.map((transaction) => {
                  const isDeposit = transaction.type === 'deposit';
                  
                  if (isDeposit) {
                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border/30"
                      >
                        <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                          <ArrowDownLeft className="w-5 h-5 text-success" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {DEPOSIT_METHOD_LABELS[transaction.method] || 'Dépôt'}
                          </p>
                          <StatusBadge 
                            status={getStatusType(transaction.status)} 
                            label={DEPOSIT_STATUS_LABELS[transaction.status] || transaction.status} 
                            className="mt-1"
                          />
                        </div>
                        
                        <div className="text-right">
                          <p className="font-semibold text-success">
                            +{formatXAF(transaction.amount_xaf)}
                          </p>
                          <p className="text-xs text-muted-foreground">XAF</p>
                        </div>
                      </div>
                    );
                  }
                  
                  return null;
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Filter className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Aucune opération trouvée</p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default HistoryPage;