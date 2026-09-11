/** Mobile admin — Bonzini Cargo : la même carte et les mêmes fiches, empilées. */
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipments, useCargoVesselPositions, useRequestCargoSync } from '@/hooks/useCargo';
import { CargoMap } from '@/components/cargo/CargoMap';
import { groupVessels } from '@/lib/cargo/vessels';
import { CargoShipmentCard } from '@/components/cargo/CargoShipmentCard';
import { CargoKpis } from '@/components/cargo/CargoKpis';
import { SURFACE, TEXT } from '@/desktop/designKit';
import { cn } from '@/lib/utils';

export function MobileCargoScreen() {
  const { hasPermission } = useAdminAuth();
  const shipments = useCargoShipments();
  const positions = useCargoVesselPositions();
  const sync = useRequestCargoSync();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useMemo(() => shipments.data ?? [], [shipments.data]);
  const vessels = useMemo(() => groupVessels(list, positions.data ?? []), [list, positions.data]);
  const selectedImo = list.find((s) => s.id === selectedId)?.vessel_imo ?? null;

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  return (
    <div className="min-h-screen pb-24">
      <MobileHeader
        title="Bonzini Cargo"
        subtitle="Où sont les conteneurs"
        showBack
        backTo="/m/more"
        rightElement={
          <button
            type="button"
            aria-label="Rafraîchir"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className={cn('flex h-9 w-9 items-center justify-center rounded-full', SURFACE.holder)}
          >
            <RefreshCw className={cn('h-4 w-4', sync.isPending && 'animate-spin')} />
          </button>
        }
      />
      <div className="space-y-4 px-4 pt-3">
        <CargoKpis shipments={list} className="grid-cols-2" />
        <div className={cn('overflow-hidden rounded-xl', SURFACE.card, SURFACE.shadow)}>
          <CargoMap
            vessels={vessels}
            selectedImo={selectedImo}
            onSelectVessel={(imo) => {
              const first = list.find((s) => s.vessel_imo === imo);
              if (first) setSelectedId(first.id);
            }}
            className="h-[320px]"
          />
        </div>
        {shipments.isLoading && <p className={cn('text-center text-[13px]', TEXT.muted)}>Chargement…</p>}
        {list.map((s) => (
          <CargoShipmentCard
            key={s.id}
            shipment={s}
            selected={selectedImo != null && s.vessel_imo === selectedImo}
            onSelect={() => setSelectedId(s.id)}
          />
        ))}
      </div>
    </div>
  );
}
