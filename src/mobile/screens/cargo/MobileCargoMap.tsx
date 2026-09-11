/** Mobile admin — la carte des navires. */
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipments, useCargoVesselPositions } from '@/hooks/useCargo';
import { CargoMap } from '@/components/cargo/CargoMap';
import { groupVessels } from '@/lib/cargo/vessels';
import { positionAge } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT, Card, Row } from '@/mobile/designKit';

export function MobileCargoMap() {
  const { hasPermission } = useAdminAuth();
  const { data: shipments } = useCargoShipments();
  const { data: positions } = useCargoVesselPositions();
  const [selected, setSelected] = useState<string | null>(null);
  const vessels = useMemo(() => groupVessels(shipments ?? [], positions ?? []), [shipments, positions]);
  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  return (
    <div className="min-h-screen pb-24">
      <MobileHeader title="Carte" subtitle={`${vessels.length} navire${vessels.length > 1 ? 's' : ''}`} showBack backTo="/m/cargo" />
      <div className="space-y-3 px-4 pt-3">
        <Card className="overflow-hidden p-0">
          <CargoMap vessels={vessels} selectedImo={selected} onSelectVessel={setSelected} className="h-[380px]" />
        </Card>
        <Card className="p-3.5">
          {vessels.map((v) => (
            <Row
              key={v.position.vessel_imo}
              label={<button type="button" onClick={() => setSelected(v.position.vessel_imo)} className={cn('text-left', TEXT.strong)}>{v.position.vessel_name ?? v.position.vessel_imo}</button>}
              value={<span className={TEXT.muted}>{v.shipments.length} boîte{v.shipments.length > 1 ? 's' : ''} · {positionAge(v.position)}</span>}
            />
          ))}
        </Card>
      </div>
    </div>
  );
}
