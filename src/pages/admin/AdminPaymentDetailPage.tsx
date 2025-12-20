import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  CreditCard,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AdminLayout } from '@/components/admin/AdminLayout';

export function AdminPaymentDetailPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();

  // Placeholder - payments table doesn't exist yet
  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/payments')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">
            Détail du paiement
          </h1>
        </div>

        <Card>
          <CardContent className="p-8 text-center">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Fonctionnalité à venir
            </h2>
            <p className="text-muted-foreground mb-4">
              La gestion des paiements sera disponible prochainement.
            </p>
            <Button onClick={() => navigate('/admin/payments')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux paiements
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}