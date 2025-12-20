import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Plus, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BeneficiariesPage = () => {
  const navigate = useNavigate();

  // TODO: Implement beneficiaries table and useBeneficiaries hook when ready
  const beneficiaries: any[] = [];

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
        {beneficiaries.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">Aucun bénéficiaire</p>
            <p className="text-sm text-muted-foreground">
              La fonctionnalité bénéficiaires sera bientôt disponible
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default BeneficiariesPage;