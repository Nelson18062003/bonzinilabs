/** Desktop admin — Cargo · le dossier d'un conteneur en pleine page (/m/cargo/:id). */
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { CargoDetail } from '@/components/cargo/CargoDetail';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/desktop/designKit';

export function DesktopCargoDossier() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { shipmentId } = useParams<{ shipmentId: string }>();
  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  if (!shipmentId) return <Navigate to="/m/cargo" replace />;
  return (
    <div className="mx-auto max-w-[1180px]">
      <button type="button" onClick={() => navigate('/m/cargo')} className={cn('mb-3 inline-flex items-center gap-1 text-[12px] font-semibold', TEXT.muted)}>
        <ArrowLeft className="h-3.5 w-3.5" /> Ma flotte
      </button>
      <div className={cn('overflow-hidden rounded-[22px]', SURFACE.card, SURFACE.shadow)}>
        <CargoDetail shipmentId={shipmentId} />
      </div>
    </div>
  );
}
