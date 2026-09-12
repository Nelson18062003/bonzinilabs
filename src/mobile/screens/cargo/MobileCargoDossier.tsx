/** Mobile admin — le dossier complet d'un conteneur, onglets compris. */
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { CargoDossier } from '@/components/cargo/CargoDossier';
import { DEFAULT_TAB, dossierPath, isDossierTab } from '@/lib/cargo/dossierNav';

export function MobileCargoDossier() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { shipmentId, tab } = useParams<{ shipmentId: string; tab?: string }>();

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  if (!shipmentId) return <Navigate to="/m/cargo" replace />;
  if (tab && !isDossierTab(tab)) return <Navigate to={dossierPath(shipmentId)} replace />;

  return (
    <div className="min-h-screen pb-24">
      <MobileHeader title="Dossier conteneur" showBack backTo="/m/cargo" />
      <div className="px-4 pt-3">
        <CargoDossier
          shipmentId={shipmentId}
          tab={isDossierTab(tab) ? tab : DEFAULT_TAB}
          onTabChange={(t) => navigate(dossierPath(shipmentId, t))}
          onRemoved={() => navigate('/m/cargo')}
          sticky={false}
        />
      </div>
    </div>
  );
}
