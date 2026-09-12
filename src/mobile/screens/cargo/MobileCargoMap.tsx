/** Mobile admin — la carte des navires, puis la liste synchronisée. */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipments, useCargoVesselPositions } from '@/hooks/useCargo';
import { CargoMap } from '@/components/cargo/CargoMap';
import { groupVessels } from '@/lib/cargo/vessels';
import { LIVE_STATUS_LABEL, vesselLiveStatus } from '@/lib/cargo/geo';
import { bestEta, fmtDay, positionAge } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT, Card } from '@/mobile/designKit';

export function MobileCargoMap() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { data: shipments } = useCargoShipments();
  const { data: positions } = useCargoVesselPositions();
  const [selected, setSelected] = useState<string | null>(null);
  const rows = useMemo(() => (shipments ?? []).filter((s) => s.status !== 'DELIVERED'), [shipments]);
  const vessels = useMemo(() => groupVessels(rows, positions ?? []), [rows, positions]);
  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  return (
    <div className="min-h-screen pb-24">
      <MobileHeader title="Carte" subtitle={`${vessels.length} navire${vessels.length > 1 ? 's' : ''} · ${rows.length} conteneurs`} showBack backTo="/m/cargo" />
      <div className="space-y-3 px-4 pt-3">
        <Card className="isolate overflow-hidden p-0">
          <CargoMap
            shipments={rows}
            positions={positions ?? []}
            layers={{ routes: true, ports: true, labels: false }}
            selectedVesselImo={selected}
            onSelectVessel={setSelected}
            onOpenShipment={(id) => navigate(`/m/cargo/${id}`)}
            fitNonce={1}
            className="h-[420px]"
          />
        </Card>
        {vessels.map((v) => {
          const st = vesselLiveStatus(v.position);
          return (
            <Card key={v.position.vessel_imo} className="p-3.5">
              <button type="button" onClick={() => setSelected(v.position.vessel_imo)} className="flex w-full items-center gap-2.5 text-left">
                <i className={`cargo-dot is-${st}`} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[14px] font-bold', TEXT.strong)}>{v.position.vessel_name ?? v.position.vessel_imo}</span>
                  <span className={cn('block text-[12px]', TEXT.muted)}>{LIVE_STATUS_LABEL[st]} · {positionAge(v.position)}</span>
                </span>
              </button>
              <div className="mt-2 divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {v.shipments.map((s) => (
                  <button key={s.id} type="button" onClick={() => navigate(`/m/cargo/${s.id}`)} className="flex w-full items-center justify-between py-2 text-left text-[13px]">
                    <span className={TEXT.strong}>{s.client_label} · <span className="font-mono">{s.container_number}</span></span>
                    <span className={TEXT.muted}>{s.pod_name} · {fmtDay(bestEta(s).date)}</span>
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
