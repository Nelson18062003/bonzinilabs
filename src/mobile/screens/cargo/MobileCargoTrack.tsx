/** Mobile admin — Suivre une référence : la même page, en une colonne. */
import { Navigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { DesktopCargoTrack } from '@/desktop/screens/cargo/DesktopCargoTrack';

export function MobileCargoTrack() {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  return (
    <div className="min-h-screen pb-24">
      <MobileHeader title="Suivre un conteneur" showBack backTo="/m/cargo" />
      <div className="cargo-track-mobile px-4 pt-3">
        <DesktopCargoTrack />
      </div>
    </div>
  );
}
