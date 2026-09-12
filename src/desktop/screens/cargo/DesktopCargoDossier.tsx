/** Desktop admin — Cargo · le dossier complet (/m/cargo/:id/:tab). */
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { CargoDossier } from '@/components/cargo/CargoDossier';
import { DEFAULT_TAB, dossierPath, isDossierTab } from '@/lib/cargo/dossierNav';
import { cn } from '@/lib/utils';
import { TEXT } from '@/desktop/designKit';

export function DesktopCargoDossier() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { shipmentId, tab } = useParams<{ shipmentId: string; tab?: string }>();

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  if (!shipmentId) return <Navigate to="/m/cargo" replace />;
  if (tab && !isDossierTab(tab)) return <Navigate to={dossierPath(shipmentId)} replace />;

  return (
    <div className="mx-auto max-w-[1240px]">
      <button
        type="button"
        onClick={() => navigate('/m/cargo')}
        className={cn('mb-2 inline-flex items-center gap-1 text-[12px] font-semibold', TEXT.muted, 'hover:text-foreground')}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Ma flotte
      </button>
      <CargoDossier
        shipmentId={shipmentId}
        tab={isDossierTab(tab) ? tab : DEFAULT_TAB}
        onTabChange={(t) => navigate(dossierPath(shipmentId, t))}
        onRemoved={() => navigate('/m/cargo')}
      />
    </div>
  );
}
