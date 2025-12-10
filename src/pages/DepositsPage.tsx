import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge, getStatusType } from '@/components/common/StatusBadge';
import { mockDeposits, formatXAF, getDepositStatusLabel, depositMethodsInfo } from '@/data/mockData';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';

const DepositsPage = () => {
  const navigate = useNavigate();

  const getMethodInfo = (method: string) => {
    return depositMethodsInfo.find(m => m.method === method);
  };

  return (
    <MobileLayout>
      <PageHeader 
        title="Mes Dépôts" 
        subtitle="Historique et suivi"
        rightElement={
          <button
            onClick={() => navigate('/deposits/new')}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-purple"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />
      
      <div className="px-4 py-4 space-y-3">
        {mockDeposits.map((deposit, index) => {
          const methodInfo = getMethodInfo(deposit.method);
          const IconComponent = methodInfo ? (Icons as any)[methodInfo.icon] : Icons.Banknote;
          
          return (
            <div
              key={deposit.id}
              onClick={() => navigate(`/deposits/${deposit.id}`)}
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
                        {methodInfo?.label || deposit.method}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(deposit.createdAt, 'dd MMM yyyy, HH:mm', { locale: fr })}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <StatusBadge 
                      status={getStatusType(deposit.status)} 
                      label={getDepositStatusLabel(deposit.status)} 
                    />
                    <p className="font-bold text-foreground">
                      {formatXAF(deposit.amountXAF)} <span className="text-muted-foreground font-normal text-sm">XAF</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {mockDeposits.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Icons.Inbox className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Aucun dépôt pour le moment</p>
            <button
              onClick={() => navigate('/deposits/new')}
              className="mt-4 btn-primary-gradient"
            >
              Faire un dépôt
            </button>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default DepositsPage;
