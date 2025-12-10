import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge, getStatusType } from '@/components/common/StatusBadge';
import { mockPayments, formatXAF, formatRMB, getPaymentStatusLabel, mockBeneficiaries, paymentMethodsInfo } from '@/data/mockData';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, ChevronRight, ArrowRightLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';

const PaymentsPage = () => {
  const navigate = useNavigate();

  const getBeneficiary = (id: string) => mockBeneficiaries.find(b => b.id === id);
  const getMethodInfo = (method: string) => paymentMethodsInfo.find(m => m.method === method);

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
        {mockPayments.map((payment, index) => {
          const beneficiary = getBeneficiary(payment.beneficiaryId);
          const methodInfo = getMethodInfo(payment.method);
          const IconComponent = methodInfo ? (Icons as any)[methodInfo.icon] : Icons.Send;
          
          return (
            <div
              key={payment.id}
              onClick={() => navigate(`/payments/${payment.id}`)}
              className="card-elevated p-4 cursor-pointer hover:border-primary/30 transition-all animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <IconComponent className="w-6 h-6 text-primary" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-foreground">
                        {beneficiary?.name || 'Bénéficiaire'}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {methodInfo?.label}
                        <span className="text-muted-foreground/50">•</span>
                        {format(payment.createdAt, 'dd MMM', { locale: fr })}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <StatusBadge 
                      status={getStatusType(payment.status)} 
                      label={getPaymentStatusLabel(payment.status)} 
                    />
                    <div className="text-right">
                      <p className="font-bold text-foreground">
                        ¥ {formatRMB(payment.amountRMB)}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                        <ArrowRightLeft className="w-3 h-3" />
                        {formatXAF(payment.amountXAF)} XAF
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {mockPayments.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Icons.Send className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Aucun paiement pour le moment</p>
            <button
              onClick={() => navigate('/payments/new')}
              className="mt-4 btn-primary-gradient"
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
