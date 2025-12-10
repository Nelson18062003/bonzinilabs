import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge, getStatusType } from '@/components/common/StatusBadge';
import { 
  mockDeposits, 
  mockPayments, 
  formatXAF, 
  formatRMB,
  getDepositStatusLabel, 
  getPaymentStatusLabel,
  depositMethodsInfo,
  paymentMethodsInfo,
  mockBeneficiaries
} from '@/data/mockData';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowDownLeft, ArrowUpRight, Filter } from 'lucide-react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterType = 'all' | 'deposits' | 'payments';

const HistoryPage = () => {
  const [filter, setFilter] = useState<FilterType>('all');

  const getBeneficiary = (id: string) => mockBeneficiaries.find(b => b.id === id);

  // Combine and sort all transactions
  const allTransactions = [
    ...mockDeposits.map(d => ({
      ...d,
      type: 'deposit' as const,
      displayAmount: d.amountXAF,
    })),
    ...mockPayments.map(p => ({
      ...p,
      type: 'payment' as const,
      displayAmount: p.amountXAF,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredTransactions = allTransactions.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'deposits') return t.type === 'deposit';
    return t.type === 'payment';
  });

  // Group by date
  const groupedTransactions = filteredTransactions.reduce((groups, transaction) => {
    const date = format(transaction.createdAt, 'yyyy-MM-dd');
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
        {Object.entries(groupedTransactions).map(([date, transactions]) => (
          <div key={date} className="animate-slide-up">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              {format(new Date(date), 'EEEE d MMMM', { locale: fr })}
            </h3>
            
            <div className="space-y-2">
              {transactions.map((transaction) => {
                const isDeposit = transaction.type === 'deposit';
                
                if (isDeposit) {
                  const deposit = transaction as typeof mockDeposits[0] & { type: 'deposit' };
                  const methodInfo = depositMethodsInfo.find(m => m.method === deposit.method);
                  const IconComponent = methodInfo ? (Icons as any)[methodInfo.icon] : Icons.Banknote;
                  
                  return (
                    <div
                      key={deposit.id}
                      className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border/30"
                    >
                      <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                        <ArrowDownLeft className="w-5 h-5 text-success" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {methodInfo?.label || 'Dépôt'}
                        </p>
                        <StatusBadge 
                          status={getStatusType(deposit.status)} 
                          label={getDepositStatusLabel(deposit.status)} 
                          className="mt-1"
                        />
                      </div>
                      
                      <div className="text-right">
                        <p className="font-semibold text-success">
                          +{formatXAF(deposit.amountXAF)}
                        </p>
                        <p className="text-xs text-muted-foreground">XAF</p>
                      </div>
                    </div>
                  );
                } else {
                  const payment = transaction as typeof mockPayments[0] & { type: 'payment' };
                  const beneficiary = getBeneficiary(payment.beneficiaryId);
                  const methodInfo = paymentMethodsInfo.find(m => m.method === payment.method);
                  
                  return (
                    <div
                      key={payment.id}
                      className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border/30"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ArrowUpRight className="w-5 h-5 text-primary" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {beneficiary?.name || 'Paiement'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {methodInfo?.label} • ¥{formatRMB(payment.amountRMB)}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-semibold text-foreground">
                          -{formatXAF(payment.amountXAF)}
                        </p>
                        <StatusBadge 
                          status={getStatusType(payment.status)} 
                          label={getPaymentStatusLabel(payment.status)} 
                          className="mt-1"
                        />
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        ))}
        
        {filteredTransactions.length === 0 && (
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
