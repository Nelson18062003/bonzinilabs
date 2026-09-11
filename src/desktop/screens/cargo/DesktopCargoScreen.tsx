/**
 * Desktop admin — Bonzini Cargo, étape 1 : la carte et la liste.
 *
 * Deux colonnes : la carte des navires à gauche (elle prend la place), la
 * liste des dossiers à droite. Cliquer un dossier recentre la carte sur son
 * navire ; cliquer un navire surligne ses dossiers.
 */
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipments, useCargoVesselPositions, useRequestCargoSync } from '@/hooks/useCargo';
import { CargoMap } from '@/components/cargo/CargoMap';
import { groupVessels } from '@/lib/cargo/vessels';
import { CargoShipmentCard } from '@/components/cargo/CargoShipmentCard';
import { CargoKpis } from '@/components/cargo/CargoKpis';
import { SOFT_PILL, SURFACE, TEXT, relShort } from '@/desktop/designKit';
import { cn } from '@/lib/utils';

export function DesktopCargoScreen() {
  const { hasPermission } = useAdminAuth();
  const shipments = useCargoShipments();
  const positions = useCargoVesselPositions();
  const sync = useRequestCargoSync();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useMemo(() => shipments.data ?? [], [shipments.data]);
  const vessels = useMemo(() => groupVessels(list, positions.data ?? []), [list, positions.data]);
  const selected = list.find((s) => s.id === selectedId) ?? null;
  const selectedImo = selected?.vessel_imo ?? null;
  const lastSync = list.map((s) => s.last_synced_at).filter(Boolean).sort().pop() ?? null;

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Bonzini Cargo</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>Où sont les conteneurs de nos clients, et quand ils arrivent.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn('text-[12px]', TEXT.muted)}>
            {lastSync ? `Jalons armateur mis à jour il y a ${relShort(lastSync)}` : 'Jalons armateur : jamais synchronisés'}
          </span>
          <button
            type="button"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className={cn('flex h-9 items-center gap-2 px-3.5 text-[13px] font-semibold disabled:opacity-60', SOFT_PILL)}
          >
            <RefreshCw className={cn('h-4 w-4', sync.isPending && 'animate-spin')} /> Rafraîchir
          </button>
        </div>
      </header>

      <CargoKpis shipments={list} className="grid-cols-4" />

      <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-6">
        <section className={cn('sticky top-[84px] self-start overflow-hidden rounded-xl', SURFACE.card, SURFACE.shadow)}>
          <CargoMap
            vessels={vessels}
            selectedImo={selectedImo}
            onSelectVessel={(imo) => {
              const first = list.find((s) => s.vessel_imo === imo);
              if (first) setSelectedId(first.id);
            }}
            className="h-[600px]"
          />
          <p className={cn('border-t border-black/[0.06] px-4 py-2.5 text-[12px] dark:border-white/[0.06]', TEXT.muted)}>
            Pastille pleine : position AIS récente. Pastille creuse : dernière position connue (le navire est en plein
            océan, hors couverture). Pointillés : la tournée habituelle Nansha → Singapour → cap de Bonne-Espérance →
            Abidjan → Lekki → Kribi.
          </p>
        </section>

        <aside className="space-y-3">
          {shipments.isLoading && <div className={cn('rounded-xl p-6 text-center text-[13px]', SURFACE.card, TEXT.muted)}>Chargement…</div>}
          {shipments.error && (
            <div className={cn('rounded-xl p-6 text-center text-[13px] text-destructive', SURFACE.card)}>
              Impossible de charger les dossiers : {(shipments.error as Error).message}
            </div>
          )}
          {!shipments.isLoading && list.length === 0 && (
            <div className={cn('rounded-xl p-6 text-center text-[13px]', SURFACE.card, TEXT.muted)}>Aucun conteneur suivi pour l'instant.</div>
          )}
          {list.map((s) => (
            <CargoShipmentCard
              key={s.id}
              shipment={s}
              selected={selectedImo != null && s.vessel_imo === selectedImo}
              onSelect={() => setSelectedId(s.id)}
            />
          ))}
        </aside>
      </div>
    </div>
  );
}
