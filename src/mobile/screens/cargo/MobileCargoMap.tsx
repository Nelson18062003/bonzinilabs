/**
 * Mobile admin — la carte des navires, plein écran (refonte v2, maquette
 * 10/31). La carte prend tout ce qui reste sous l'en-tête ; les puces
 * Tous · Sous 7 j · En Asie flottent dessus, la loupe filtre par client,
 * conteneur ou navire. Toucher un navire ouvre sa feuille : son état, ses
 * conteneurs avec l'armateur et le tag qui compte (retard, télex, fret).
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipments, useCargoVesselPositions } from '@/hooks/useCargo';
import { CargoMap } from '@/components/cargo/CargoMap';
import { groupVessels } from '@/lib/cargo/vessels';
import { LIVE_STATUS_LABEL, vesselLiveStatus } from '@/lib/cargo/geo';
import { agoSentence } from '@/lib/cargo/plain';
import type { CargoShipment, CargoVesselPosition } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { BottomSheet, ItemList, ItemRow, RoundButton, ScreenTop, SearchBox, SURFACE, TEXT, Tag } from '@/mobile/designKit';
import { CarrierCircle } from '@/mobile/components/cargo/v2';
import { boxNo, inBucket, shipmentLine, shipmentTag } from './fleet';

type Filter = 'all' | 'soon' | 'asia';
/** Encore en Asie : à l'est de l'océan Indien (longitude > 60°). */
const inAsia = (p: CargoVesselPosition) => Number(p.longitude) > 60;

export function MobileCargoMap() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: shipments } = useCargoShipments();
  const { data: positions } = useCargoVesselPositions();
  // « Voir sur la carte » depuis un dossier arrive avec ?vessel=<IMO> : la feuille du navire s'ouvre d'elle-même.
  const [selected, setSelected] = useState<string | null>(params.get('vessel'));
  const [filter, setFilter] = useState<Filter>('all');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const rows = useMemo(() => (shipments ?? []).filter((s) => s.status !== 'DELIVERED'), [shipments]);
  const all = useMemo(() => groupVessels(rows, positions ?? []), [rows, positions]);

  const q = query.trim().toLowerCase();
  const match = (s: CargoShipment, p: CargoVesselPosition) => !q || `${s.client_label} ${s.container_number} ${s.bl_number ?? ''} ${p.vessel_name ?? ''}`.toLowerCase().includes(q);
  const keep = (f: Filter) => all
    .map((v) => ({ ...v, shipments: v.shipments.filter((s) => match(s, v.position) && (f !== 'soon' || inBucket(s, 'soon'))) }))
    .filter((v) => v.shipments.length > 0 && (f !== 'asia' || inAsia(v.position)));
  const shown = keep(filter);
  const count = (f: Filter) => keep(f).reduce((n, v) => n + v.shipments.length, 0);
  const shownRows = shown.flatMap((v) => v.shipments);
  const shownPositions = shown.map((v) => v.position);
  const vessel = all.find((v) => v.position.vessel_imo === selected) ?? null;

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  const chips: Array<{ value: Filter; label: string }> = [{ value: 'all', label: 'Tous' }, { value: 'soon', label: 'Sous 7 j' }, { value: 'asia', label: 'En Asie' }];
  const vStatus = vessel ? vesselLiveStatus(vessel.position) : null;

  return (
    <div className={cn('admin-theme flex h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop
        title="Carte"
        backTo="/m/cargo"
        right={<RoundButton icon={searching ? X : Search} ariaLabel={searching ? 'Fermer la recherche' : 'Rechercher'} onClick={() => { setSearching((v) => !v); setQuery(''); }} />}
      />
        <div className="space-y-2 px-5 py-3">
          {searching && <div><SearchBox value={query} onChange={setQuery} placeholder="Client, conteneur, navire" autoFocus /></div>}
          <div className="flex gap-2 overflow-x-auto">
            {chips.map((c) => {
              const on = c.value === filter;
              return (
                <button key={c.value} type="button" onClick={() => setFilter(c.value)} aria-pressed={on}
                  className={cn('h-11 shrink-0 rounded-lg border px-4 text-[16px] font-semibold tabular-nums', on ? 'border-[#2C2C2C] bg-[#2C2C2C] text-white dark:border-[#E3E3E3] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : 'border-[#D9D9D9] bg-white text-[#1E1E1E] dark:border-[#444444] dark:bg-[#2C2C2C] dark:text-[#F5F5F5]')}>
                  {c.label} {count(c.value)}
                </button>
              );
            })}
          </div>
        </div>
      <div className="relative min-h-0 flex-1">
        <CargoMap
          shipments={shownRows}
          positions={shownPositions}
          layers={{ routes: true, ports: true, labels: false }}
          selectedVesselImo={selected}
          onSelectVessel={setSelected}
          onOpenShipment={(id) => navigate(`/m/cargo/${id}`)}
          fitNonce={1}
          className="absolute inset-0 h-full"
        />
      </div>

      <BottomSheet open={!!vessel} onClose={() => setSelected(null)} title={vessel?.position.vessel_name ?? vessel?.position.vessel_imo}>
        {vessel && vStatus && (
          <div>
            <div className="-mt-1 mb-2 flex items-center justify-between gap-3">
              <p className={cn('min-w-0 text-[15px]', TEXT.muted)}>
                {[`relevé ${agoSentence(vessel.position.reported_at)}`, vessel.position.speed_kn != null ? `${vessel.position.speed_kn} nœuds` : null, `${vessel.shipments.length} conteneur${vessel.shipments.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
              </p>
              <Tag tone={vStatus === 'stale' ? 'neutral' : vStatus === 'underway' ? 'info' : 'pending'}>{LIVE_STATUS_LABEL[vStatus]}</Tag>
            </div>
            <ItemList className="-mx-5">
              {vessel.shipments.map((s) => (
                <ItemRow
                  key={s.id}
                  leading={<CarrierCircle carrier={s.carrier} />}
                  title={boxNo(s.container_number)}
                  subtitle={shipmentLine(s)}
                  tag={shipmentTag(s)}
                  onClick={() => navigate(`/m/cargo/${s.id}`)}
                />
              ))}
            </ItemList>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
