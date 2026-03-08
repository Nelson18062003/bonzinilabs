import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMyWallet, useMyWalletOperations, WalletOperation } from '@/hooks/useWallet';
import { useMyProfile } from '@/hooks/useProfile';
import { formatXAF } from '@/lib/formatters';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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
import {
  generateClientStatement,
  buildMovementFromWalletOp,
  fmtDateLong,
} from '@/lib/generateClientStatement';

type FilterType = 'all' | 'credits' | 'debits';

const HistoryPage = () => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const { data: wallet } = useMyWallet();
  const { data: operations, isLoading } = useMyWalletOperations();
  const { data: profile } = useMyProfile();

  // Helper to determine if an operation is a debit
  const isDebitOperation = (op: WalletOperation): boolean => {
    const t = op.operation_type.toUpperCase();
    if (t === 'DEPOSIT' || t === 'DEPOSIT_VALIDATED' || t === 'ADMIN_CREDIT' || t === 'PAYMENT_CANCELLED_REFUNDED') return false;
    if (t === 'PAYMENT' || t === 'PAYMENT_EXECUTED' || t === 'PAYMENT_RESERVED' || t === 'ADMIN_DEBIT' || t === 'DEPOSIT_REFUSED') return true;
    if (op.balance_after < op.balance_before) return true;
    if (op.balance_after > op.balance_before) return false;
    return op.amount_xaf < 0;
  };

  // Filter operations
  const filteredOperations = (operations || []).filter(op => {
    if (filter === 'all') return true;
    const isDebit = isDebitOperation(op);
    if (filter === 'credits') return !isDebit;
    if (filter === 'debits') return isDebit;
    return true;
  });

  // Group by date
  const groupedOperations = filteredOperations.reduce((groups, op) => {
    const date = format(new Date(op.created_at), 'yyyy-MM-dd');
    if (!groups[date]) groups[date] = [];
    groups[date].push(op);
    return groups;
  }, {} as Record<string, WalletOperation[]>);

  const getOperationIcon = (op: WalletOperation) => {
    const isDebit = isDebitOperation(op);
    const t = op.operation_type.toUpperCase();
    if (t === 'DEPOSIT' || t === 'DEPOSIT_VALIDATED' || t === 'PAYMENT_CANCELLED_REFUNDED' || t === 'ADMIN_CREDIT') {
      return <ArrowDownLeft className="w-5 h-5 text-success" />;
    }
    if (t === 'PAYMENT' || t === 'PAYMENT_EXECUTED' || t === 'PAYMENT_RESERVED' || t === 'ADMIN_DEBIT') {
      return <ArrowUpRight className="w-5 h-5 text-destructive" />;
    }
    return <RefreshCw className={`w-5 h-5 ${isDebit ? 'text-destructive' : 'text-success'}`} />;
  };

  const getOperationLabel = (op: WalletOperation): string => {
    const t = op.operation_type.toUpperCase();
    switch (t) {
      case 'DEPOSIT': case 'DEPOSIT_VALIDATED': return 'Dépôt';
      case 'DEPOSIT_REFUSED': return 'Dépôt refusé';
      case 'PAYMENT': case 'PAYMENT_EXECUTED': return 'Paiement';
      case 'PAYMENT_RESERVED': return 'Paiement réservé';
      case 'PAYMENT_CANCELLED_REFUNDED': return 'Remboursement';
      case 'ADMIN_CREDIT': return 'Crédit admin';
      case 'ADMIN_DEBIT': return 'Débit admin';
      case 'ADJUSTMENT': {
        const isDebit = isDebitOperation(op);
        return isDebit ? 'Ajustement Débit' : 'Ajustement Crédit';
      }
      default: return 'Opération';
    }
  };

  const handleDownloadStatement = async () => {
    if (!operations?.length) {
      toast.error('Aucun mouvement à exporter');
      return;
    }
    setIsGenerating(true);
    try {
      const sorted = [...operations].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const movements = sorted.map(op => buildMovementFromWalletOp(op));
      const clientName = profile ? `${profile.first_name} ${profile.last_name}` : 'Client';

      generateClientStatement({
        clientName,
        clientPhone: profile?.phone ?? undefined,
        movements,
        periodFrom: movements.length > 0 ? fmtDateLong(movements[0].date) : '—',
        periodTo: fmtDateLong(new Date().toISOString()),
        generatedAt: new Date().toLocaleString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
      });
    } catch (err) {
      console.error('Error generating statement:', err);
      toast.error('Erreur lors de la génération du relevé');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <MobileLayout>
      <PageHeader
        title="Historique"
        subtitle="Tous vos mouvements"
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
            Relevé
          </Button>
        }
      />

      {/* Filters */}
      <div className="pl-4 pr-0 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          { value: 'all',     label: 'Tout'    },
          { value: 'credits', label: 'Crédits' },
          { value: 'debits',  label: 'Débits'  },
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
        ) : Object.entries(groupedOperations).length > 0 ? (
          Object.entries(groupedOperations).map(([date, ops]) => (
            <div key={date} className="animate-slide-up">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {format(new Date(date), 'EEEE d MMMM', { locale: fr })}
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
            <p className="text-muted-foreground">Aucune opération trouvée</p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default HistoryPage;
