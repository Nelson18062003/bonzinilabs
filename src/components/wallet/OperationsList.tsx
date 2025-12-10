import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { WalletOperation } from '@/types';
import { formatXAF } from '@/data/mockData';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface OperationsListProps {
  operations: WalletOperation[];
}

export const OperationsList = ({ operations }: OperationsListProps) => {
  return (
    <div className="space-y-2 animate-slide-up" style={{ animationDelay: '200ms' }}>
      <div className="flex items-center justify-between px-1 mb-3">
        <h3 className="text-sm font-semibold text-foreground">Dernières opérations</h3>
        <button className="text-xs font-medium text-primary hover:underline">
          Voir tout
        </button>
      </div>
      
      <div className="space-y-2">
        {operations.slice(0, 5).map((op, index) => (
          <div
            key={op.id}
            className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border/30 hover:border-border transition-colors"
            style={{ animationDelay: `${(index + 3) * 50}ms` }}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              op.type === 'CREDIT' 
                ? 'bg-success/10 text-success' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              {op.type === 'CREDIT' ? (
                <ArrowDownLeft className="w-5 h-5" />
              ) : (
                <ArrowUpRight className="w-5 h-5" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{op.description}</p>
              <p className="text-xs text-muted-foreground">
                {format(op.createdAt, 'dd MMM, HH:mm', { locale: fr })}
              </p>
            </div>
            
            <div className="text-right">
              <p className={`font-semibold ${
                op.type === 'CREDIT' ? 'text-success' : 'text-foreground'
              }`}>
                {op.type === 'CREDIT' ? '+' : '-'} {formatXAF(op.amountXAF)}
              </p>
              <p className="text-xs text-muted-foreground">XAF</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
