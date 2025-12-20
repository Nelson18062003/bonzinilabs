import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Plus, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PaymentsPage = () => {
  const navigate = useNavigate();

  // TODO: Implement payments table and useMyPayments hook when ready
  const payments: any[] = [];

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
        {payments.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Send className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Aucun paiement pour le moment</p>
            <p className="text-sm text-muted-foreground mt-2">
              La fonctionnalité paiements sera bientôt disponible
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default PaymentsPage;