import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { mockBeneficiaries, paymentMethodsInfo } from '@/data/mockData';
import { Plus, User, ChevronRight } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BeneficiariesPage = () => {
  const navigate = useNavigate();

  const getMethodInfo = (method: string) => paymentMethodsInfo.find(m => m.method === method);

  return (
    <MobileLayout>
      <PageHeader 
        title="Bénéficiaires" 
        subtitle="Vos destinataires en Chine"
        showBack
        rightElement={
          <button
            onClick={() => navigate('/beneficiaries/new')}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-purple"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />
      
      <div className="px-4 py-4 space-y-3">
        {mockBeneficiaries.map((beneficiary, index) => {
          const methodInfo = getMethodInfo(beneficiary.paymentMethod);
          const IconComponent = methodInfo ? (Icons as any)[methodInfo.icon] : Icons.User;
          
          return (
            <div
              key={beneficiary.id}
              className="card-elevated p-4 cursor-pointer hover:border-primary/30 transition-all animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{beneficiary.name}</p>
                  {beneficiary.chineseName && (
                    <p className="text-sm text-muted-foreground">{beneficiary.chineseName}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <IconComponent className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{methodInfo?.label}</span>
                  </div>
                </div>
                
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          );
        })}
        
        {mockBeneficiaries.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">Aucun bénéficiaire</p>
            <button
              onClick={() => navigate('/beneficiaries/new')}
              className="btn-primary-gradient"
            >
              Ajouter un bénéficiaire
            </button>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default BeneficiariesPage;
