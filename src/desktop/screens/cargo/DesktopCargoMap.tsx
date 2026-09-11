/** Desktop admin — Cargo · Carte : tous les navires porteurs de conteneurs suivis. */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipments, useCargoVesselPositions } from '@/hooks/useCargo';
import { CargoMap } from '@/components/cargo/CargoMap';
import { groupVessels } from '@/lib/cargo/vessels';
import { fmtDayTime, positionAge } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT, Card, CardHeader, Chip } from '@/desktop/designKit';

export function DesktopCargoMap() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { data: shipments } = useCargoShipments();
  const { data: positions } = useCargoVesselPositions();
  const [selected, setSelected] = useState<string | null>(null);
  const vessels = useMemo(() => groupVessels(shipments ?? [], positions ?? []), [shipments, positions]);
  const onboard = vessels.reduce((n, v) => n + v.shipments.length, 0);
  const current = vessels.find((v) => v.position.vessel_imo === selected) ?? null;

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <button type="button" onClick={() => navigate('/m/cargo')} className={cn('mb-2 inline-flex items-center gap-1 text-[12px] font-semibold', TEXT.muted)}>
            <ArrowLeft className="h-3.5 w-3.5" /> Ma flotte
          </button>
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Carte</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>{vessels.length} navire{vessels.length > 1 ? 's' : ''} · {onboard} conteneur{onboard > 1 ? 's' : ''} à bord</p>
        </div>
      </header>
      <section className="mt-4 flex flex-wrap items-center gap-1.5">
        <Chip label="Tous les navires" active={!selected} onClick={() => setSelected(null)} />
        {vessels.map((v) => (
          <Chip key={v.position.vessel_imo} label={v.position.vessel_name ?? v.position.vessel_imo} count={v.shipments.length} active={selected === v.position.vessel_imo} onClick={() => setSelected(v.position.vessel_imo)} />
        ))}
      </section>
      <Card className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <CardHeader
          title={current ? current.position.vessel_name ?? current.position.vessel_imo : 'Navires en mer'}
          meta={current ? `${current.stale ? 'dernière position' : 'position'} ${positionAge(current.position)} · ${fmtDayTime(new Date(current.position.reported_at))}` : 'positions AIS · tournée Nansha → Kribi en pointillé'}
        />
        <CargoMap vessels={vessels} selectedImo={selected} onSelectVessel={setSelected} className="h-[calc(100vh-300px)] min-h-[460px]" />
        <div className={cn('flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-black/[0.06] px-5 py-2.5 text-[12px] dark:border-white/[0.06]', TEXT.muted)}>
          <span className="inline-flex items-center gap-1.5"><i className="cargo-ship inline-block" /> position récente</span>
          <span className="inline-flex items-center gap-1.5"><i className="cargo-ship is-stale inline-block" /> hors couverture AIS (dernière position connue)</span>
          <span>Le suivi jalon par jalon est dans le dossier de chaque conteneur.</span>
          {current && (
            <button type="button" onClick={() => navigate(`/m/cargo/${current.shipments[0].id}`)} className={cn('ml-auto font-semibold underline-offset-2 hover:underline', TEXT.body)}>
              Ouvrir {current.shipments.length > 1 ? 'le premier dossier' : 'le dossier'} →
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
