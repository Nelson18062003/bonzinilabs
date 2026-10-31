// ============================================================
// Mobile admin — Cargo › Avion : les expéditions aériennes (refonte v2,
// maquette 10/37). Les puces par état, « N paquets sans vol · Mettre sur
// un vol » (ShipSheet), puis une ligne par LTA : le vol, la date qui
// compte, l'état — ou « N non soldés » si Douala va devoir attendre un
// paiement. « + » en haut : nouvelle expédition.
// ============================================================
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Package, Plane, Plus } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAirShipments } from '@/hooks/useAirShipments';
import { useAirPackages } from '@/hooks/useAirPackages';
import { isAssignable } from '@/lib/airPackage';
import { airStatusMeta, awbLabel, type AirShipment, type AirStatus } from '@/lib/airShipment';
import { cn } from '@/lib/utils';
import { EmptyLine, IconCircle, ItemList, ItemRow, RoundButton, ScreenLoader, ScreenTop, SURFACE, TEXT, type Tone } from '@/mobile/designKit';
import { ChipRow, RowButton } from '@/mobile/components/cargo/v2';
import { ShipSheet } from '@/mobile/components/cargo/ShipSheet';

type Filter = 'open' | AirStatus | 'all';
const day = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : null);

function dateLine(a: AirShipment): string {
  switch (a.status) {
    case 'PLANNED': return a.etd ? `part le ${day(a.etd)}` : 'départ à préciser';
    case 'DEPARTED': return `parti le ${day(a.departed_at)}${a.eta ? ` · arrive le ${day(a.eta)}` : ''}`;
    case 'ARRIVED': return `arrivé à Douala le ${day(a.arrived_at)}`;
    default: return `tout remis${a.delivered_at ? ` le ${day(a.delivered_at)}` : ''}`;
  }
}

function airTag(a: AirShipment): { tone: Tone; label: string } {
  if (a.unpaid_count > 0 && a.status !== 'PLANNED') return { tone: 'pending', label: `${a.unpaid_count} non soldé${a.unpaid_count > 1 ? 's' : ''}` };
  const st = airStatusMeta(a.status);
  return { tone: st.tone, label: st.short };
}

export function MobileCargoAir() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data, isLoading } = useAirShipments();
  const bureau = useAirPackages('bureau');
  const [filter, setFilter] = useState<Filter>('open');
  const [shipOpen, setShipOpen] = useState(false);

  const all = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => filter === 'all' ? all : filter === 'open' ? all.filter((a) => a.status !== 'DELIVERED') : all.filter((a) => a.status === filter), [all, filter]);
  const n = (f: Filter) => (f === 'all' ? all.length : f === 'open' ? all.filter((a) => a.status !== 'DELIVERED').length : all.filter((a) => a.status === f).length);
  const loose = (bureau.data ?? []).filter(isAssignable).length;

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  const canManage = hasPermission('canManageCargo');

  return (
    <div className={cn('flex min-h-[100dvh] flex-col pb-6', SURFACE.canvas)}>
      <ScreenTop title="Avion" backTo="/m/cargo" right={canManage ? <RoundButton icon={Plus} ariaLabel="Nouvelle expédition" onClick={() => navigate('/m/cargo/avion/nouveau')} /> : undefined} />
      <ChipRow className="pt-4" value={filter} onChange={setFilter} options={[
        { value: 'open', label: 'En cours', count: n('open') },
        { value: 'PLANNED', label: 'Préparation', count: n('PLANNED') },
        { value: 'DEPARTED', label: 'En vol', count: n('DEPARTED') },
        { value: 'ARRIVED', label: 'Arrivés', count: n('ARRIVED') },
        { value: 'all', label: 'Tous', count: n('all') },
      ]} />

      {loose > 0 && (
        <div className="px-5 pt-4">
          <div className="flex items-center gap-3 rounded-lg border border-[#D9D9D9] px-4 py-3.5 dark:border-[#444444]">
            <Package className={cn('h-6 w-6 shrink-0', TEXT.strong)} aria-hidden />
            <span className={cn('min-w-0 flex-1 truncate text-[17px] font-semibold', TEXT.strong)}>{loose} paquet{loose > 1 ? 's' : ''} sans vol</span>
            <RowButton link onClick={() => setShipOpen(true)}>Mettre sur un vol</RowButton>
          </div>
        </div>
      )}

      {isLoading ? <ScreenLoader /> : rows.length === 0 ? (
        <EmptyLine action={canManage && filter === 'all' ? { label: 'Nouvelle expédition', onClick: () => navigate('/m/cargo/avion/nouveau') } : filter !== 'all' ? { label: 'Tout voir', onClick: () => setFilter('all') } : undefined}>
          {filter === 'all' ? 'Aucune expédition.' : 'Rien dans cet état.'}
        </EmptyLine>
      ) : (
        <ItemList className="pt-2">
          {rows.map((a) => (
            <ItemRow
              key={a.id}
              leading={<IconCircle icon={Plane} />}
              title={<span className="tabular-nums">{awbLabel(a)}</span>}
              subtitle={[a.flight_no || a.airline, dateLine(a)].filter(Boolean).join(' · ')}
              tag={airTag(a)}
              onClick={() => navigate(`/m/cargo/avion/${a.id}`)}
            />
          ))}
        </ItemList>
      )}

      <ShipSheet open={shipOpen} onClose={() => setShipOpen(false)} />
    </div>
  );
}
