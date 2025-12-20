import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader';
import { AdminCard } from '@/components/admin/ui/AdminCard';

export function AdminPaymentsPage() {
  return (
    <AdminLayout>
      <AdminPageHeader 
        title="Paiements" 
        subtitle="Fonctionnalité à venir"
      />

      <AdminCard className="text-center py-12">
        <p className="text-muted-foreground">
          La gestion des paiements sera disponible prochainement.
        </p>
      </AdminCard>
    </AdminLayout>
  );
}