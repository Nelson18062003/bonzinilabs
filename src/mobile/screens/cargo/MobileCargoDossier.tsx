/** Mobile admin — le dossier d'un conteneur, en pleine page. */
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { CargoDetail } from '@/components/cargo/CargoDetail';

export function MobileCargoDossier() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { shipmentId } = useParams<{ shipmentId: string }>();
  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  if (!shipmentId) return <Navigate to="/m/cargo" replace />;
  return (
    <div className="min-h-screen pb-24">
      <MobileHeader title="Dossier conteneur" showBack backTo="/m/cargo" />
      <div className="px-4 pt-3">
        <div className="overflow-hidden rounded-[22px] bg-card ring-1 ring-black/[0.06] dark:ring-white/[0.06]">
          <CargoDetail shipmentId={shipmentId} onClose={() => navigate("/m/cargo")} />
        </div>
      </div>
    </div>
  );
}
