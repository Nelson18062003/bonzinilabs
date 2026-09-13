/**
 * Mobile admin — la carte des navires, plein écran.
 *
 * Plus de carte-dans-une-carte sous un en-tête : la carte prend tout ce qui
 * reste sous la barre, la légende vit dedans, et le tap sur un navire ouvre
 * une feuille basse avec ses conteneurs. La liste synchronisée du desktop
 * n'a pas sa place sur 390 px : c'est la feuille qui la remplace.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipments, useCargoVesselPositions } from '@/hooks/useCargo';
import { CargoMap } from '@/components/cargo/CargoMap';
import { groupVessels } from '@/lib/cargo/vessels';
import { LIVE_STATUS_LABEL, vesselLiveStatus } from '@/lib/cargo/geo';
import { ALERT, alertLevel, type AlertLevel } from '@/lib/cargo/palette';
import { agoSentence, arrivalSentence } from '@/lib/cargo/plain';
import { cn } from '@/lib/utils';
import { TEXT, BottomSheet, ListRow, StatusPill, type Tone } from '@/mobile/designKit';

const TONE_OF: Record<AlertLevel, Tone> = { late: 'danger', watch: 'pending', ok: 'success', done: 'neutral' };

export function MobileCargoMap() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { data: shipments } = useCargoShipments();
  const { data: positions } = useCargoVesselPositions();
  const [selected, setSelected] = useState<string | null>(null);
  const rows = useMemo(() => (shipments ?? []).filter((s) => s.status !== 'DELIVERED'), [shipments]);
  const vessels = useMemo(() => groupVessels(rows, positions ?? []), [rows, positions]);
  const vessel = useMemo(() => vessels.find((v) => v.position.vessel_imo === selected) ?? null, [vessels, selected]);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  return (
    <div className="admin-theme flex h-[100dvh] flex-col bg-white dark:bg-[#1E1E1E]">
      <MobileHeader
        title="Carte"
        subtitle={`${vessels.length} navire${vessels.length > 1 ? 's' : ''} · ${rows.length} conteneur${rows.length > 1 ? 's' : ''}`}
        showBack
        backTo="/m/cargo"
      />
      <div className="relative min-h-0 flex-1">
        <CargoMap
          shipments={rows}
          positions={positions ?? []}
          layers={{ routes: true, ports: true, labels: false }}
          selectedVesselImo={selected}
          onSelectVessel={setSelected}
          onOpenShipment={(id) => navigate(`/m/cargo/${id}`)}
          fitNonce={1}
          className="absolute inset-0 h-full"
        />
      </div>

      <BottomSheet open={!!vessel} onClose={() => setSelected(null)} title={vessel?.position.vessel_name ?? vessel?.position.vessel_imo}>
        {vessel && (
          <div>
            <p className={cn('-mt-2 mb-3 text-[16px] leading-relaxed', TEXT.muted)}>
              {LIVE_STATUS_LABEL[vesselLiveStatus(vessel.position)]}, position relevée {agoSentence(vessel.position.reported_at)}
              {vessel.position.speed_kn != null && `, ${vessel.position.speed_kn} nœuds`}.
            </p>
            <div className="-mx-2">
              {vessel.shipments.map((s) => {
                const level = alertLevel(s);
                return (
                  <ListRow
                    key={s.id}
                    className="px-2"
                    title={s.client_label}
                    subtitle={arrivalSentence(s)}
                    trailing={<StatusPill tone={TONE_OF[level]} label={ALERT[level].label} />}
                    onClick={() => navigate(`/m/cargo/${s.id}`)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
