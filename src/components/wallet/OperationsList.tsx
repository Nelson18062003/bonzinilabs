import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WalletOperation } from '@/hooks/useWallet';
import { formatXAF } from '@/lib/formatters';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface OperationsListProps {
  operations: WalletOperation[];
}

export const OperationsList = ({ operations }: OperationsListProps) => {
  const { t } = useTranslation('client');
  const getOperationType = (op: WalletOperation): 'CREDIT' | 'DEBIT' => {
    return op.operation_type === 'deposit' ? 'CREDIT' : 'DEBIT';
  };

  return (
    <div className="space-y-2 animate-slide-up" style={{ animationDelay: '200ms' }}>
      <div className="flex items-center justify-between px-1 mb-3">
        <h3 className="text-sm font-semibold text-foreground">{t('wallet.recentOperations')}</h3>
        <button className="text-xs font-medium text-primary hover:underline">
          {t('wallet.viewAll')}
        </button>
      </div>
      
      <div className="space-y-2">
        {operations.slice(0, 5).map((op, index) => {
          const type = getOperationType(op);
          const date = parseISO(op.created_at);
          
          return (
            <div
              key={op.id}
              className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border/30 hover:border-border transition-colors"
              style={{ animationDelay: `${(index + 3) * 50}ms` }}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                type === 'CREDIT' 
                  ? 'bg-success/10 text-success' 
                  : 'bg-destructive/10 text-destructive'
              }`}>
                {type === 'CREDIT' ? (
                  <ArrowDownLeft className="w-5 h-5" />
                ) : (
                  <ArrowUpRight className="w-5 h-5" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{op.description || t('wallet.operation')}</p>
                <p className="text-xs text-muted-foreground">
                  {format(date, 'dd MMM, HH:mm', { locale: fr })}
                </p>
              </div>
              
              <div className="text-right">
                <p className={`font-semibold ${
                  type === 'CREDIT' ? 'text-success' : 'text-foreground'
                }`}>
                  {type === 'CREDIT' ? '+' : '-'} {formatXAF(op.amount_xaf)}
                </p>
                <p className="text-xs text-muted-foreground">XAF</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
