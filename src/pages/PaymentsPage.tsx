import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Plus, Send, CreditCard, Wallet, Building2, Banknote, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMyPayments } from '@/hooks/usePayments';
import { formatXAF, formatCurrencyRMB } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; color: string }> = {
  created: { label: 'Créé', color: 'bg-blue-500' },
  waiting_beneficiary_info: { label: 'En attente', color: 'bg-yellow-500' },
  ready_for_payment: { label: 'Prêt', color: 'bg-purple-500' },
  processing: { label: 'En cours', color: 'bg-orange-500' },
  completed: { label: 'Effectué', color: 'bg-green-500' },
  rejected: { label: 'Refusé', color: 'bg-red-500' },
};

const methodIcons: Record<string, React.ElementType> = {
  alipay: CreditCard,
  wechat: Wallet,
  bank_transfer: Building2,
  cash: Banknote,
};

const PaymentsPage = () => {
  const navigate = useNavigate();
  const { data: payments, isLoading } = useMyPayments();

  return (
    <MobileLayout>
      <PageHeader 
        title="Mes Paiements" 
        subtitle="Envois vers la Chine"
        rightElement={
          <button
            onClick={() => navigate('/payments/new')}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-purple"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />
      
      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : payments && payments.length > 0 ? (
          payments.map((payment) => {
            const MethodIcon = methodIcons[payment.method] || CreditCard;
            const status = statusConfig[payment.status];
            return (
              <div
                key={payment.id}
                onClick={() => navigate(`/payments/${payment.id}`)}
                className="bg-card rounded-xl p-4 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <MethodIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{payment.reference}</span>
                      <Badge className={`${status?.color} text-white text-xs`}>
                        {status?.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(payment.created_at), 'dd MMM yyyy', { locale: fr })}
                      </span>
                      <span className="font-semibold">{formatXAF(payment.amount_xaf)} XAF</span>
                    </div>
                    <div className="text-xs text-primary mt-0.5">
                      → {formatCurrencyRMB(payment.amount_rmb)}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Send className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Aucun paiement pour le moment</p>
            <button
              onClick={() => navigate('/payments/new')}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium"
            >
              Nouveau paiement
            </button>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default PaymentsPage;