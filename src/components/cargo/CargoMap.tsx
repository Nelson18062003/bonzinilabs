/**
 * Carte des navires — Leaflet, fond CARTO neutre (clair/sombre).
 *
 * Langage visuel : tout est neutre (encre, gris) ; la sélection prend
 * l'accent. Trois couches : la tournée en pointillé, les ports en points,
 * les navires en pastille — pleine si la position est récente, creuse si le
 * navire est hors couverture AIS (plein océan).
 */
import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from 'next-themes';
import { PORTS, WAX1_ROUTE, fmtDayTime, fmtLatLng, liveVesselUrl, positionAge } from '@/lib/cargo/model';
import type { LatLng } from '@/lib/cargo/model';
import type { VesselOnMap } from '@/lib/cargo/vessels';

function shipIcon(stale: boolean, selected: boolean) {
  return L.divIcon({
    className: '',
    html: `<span class="cargo-ship${stale ? ' is-stale' : ''}${selected ? ' is-selected' : ''}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

function FlyTo({ target, zoom }: { target: LatLng | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), zoom), { duration: 0.7 });
  }, [map, target, zoom]);
  return null;
}

function FitOnce({ points, maxZoom }: { points: LatLng[]; maxZoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom });
    // Cadrage initial seulement : ensuite l'utilisateur pilote la carte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

export function CargoMap({
  vessels,
  selectedImo,
  onSelectVessel,
  className,
  compact = false,
  focus,
}: {
  vessels: VesselOnMap[];
  selectedImo: string | null;
  onSelectVessel?: (imo: string) => void;
  className?: string;
  /** Mode dossier : pas d'étiquettes de navires, cadrage serré sur le navire. */
  compact?: boolean;
  /** Point à cadrer en priorité (mode dossier). */
  focus?: LatLng | null;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const style = dark ? 'dark' : 'light';

  const fitPoints = useMemo<LatLng[]>(() => {
    if (compact && focus) return [focus];
    return [...vessels.map((v) => [v.position.latitude, v.position.longitude] as LatLng), PORTS.CNNSA.pos, PORTS.CMKBI.pos];
  }, [vessels, compact, focus]);
  const target = useMemo<LatLng | null>(() => {
    if (compact) return focus ?? null;
    const v = vessels.find((x) => x.position.vessel_imo === selectedImo);
    return v ? [v.position.latitude, v.position.longitude] : null;
  }, [vessels, selectedImo, compact, focus]);

  return (
    <div className={className}>
      <MapContainer
        center={focus ?? [0, 60]}
        zoom={compact ? 4 : 3}
        minZoom={2}
        worldCopyJump
        scrollWheelZoom={!compact}
        dragging
        zoomControl={!compact}
        className="h-full w-full"
        attributionControl={false}
      >
        <TileLayer url={`https://{s}.basemaps.cartocdn.com/${style}_nolabels/{z}/{x}/{y}{r}.png`} subdomains="abcd" />
        <Polyline positions={WAX1_ROUTE} pathOptions={{ color: dark ? '#8a8a8a' : '#9a9a9a', weight: 1.5, dashArray: '1 5', opacity: 0.9 }} />
        {Object.entries(PORTS).map(([code, p]) => (
          <CircleMarker
            key={code}
            center={p.pos}
            radius={3.5}
            pathOptions={{ color: dark ? '#1c1c1c' : '#ffffff', weight: 1.5, fillColor: dark ? '#bdbdbd' : '#6b6b6b', fillOpacity: 1 }}
          >
            {!compact && (
              <Tooltip direction={code === 'CMKBI' ? 'bottom' : 'top'} offset={[0, code === 'CMKBI' ? 4 : -4]} permanent className="cargo-port-label">
                {p.name}
              </Tooltip>
            )}
          </CircleMarker>
        ))}
        {vessels.map((v) => {
          const imo = v.position.vessel_imo;
          const live = liveVesselUrl(imo);
          return (
            <Marker
              key={imo}
              position={[v.position.latitude, v.position.longitude]}
              icon={shipIcon(v.stale, imo === selectedImo)}
              eventHandlers={{ click: () => onSelectVessel?.(imo) }}
            >
              {!compact && (
                <Tooltip direction="right" offset={[9, 0]} permanent className="cargo-ship-label">
                  {v.position.vessel_name ?? imo}
                </Tooltip>
              )}
              <Popup>
                <div className="cargo-popup">
                  <strong>{v.position.vessel_name ?? imo}</strong>
                  <div>
                    {v.shipments.length} conteneur{v.shipments.length > 1 ? 's' : ''} : {v.shipments.map((s) => s.client_label).join(', ')}
                  </div>
                  <div>
                    {fmtLatLng(v.position.latitude, v.position.longitude)} · {fmtDayTime(new Date(v.position.reported_at))} ({positionAge(v.position)})
                  </div>
                  {v.stale && <div>Hors couverture AIS (plein océan) — dernière position connue.</div>}
                  {live && (
                    <a href={live} target="_blank" rel="noopener noreferrer">
                      Position en direct ↗
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
        <TileLayer url={`https://{s}.basemaps.cartocdn.com/${style}_only_labels/{z}/{x}/{y}{r}.png`} subdomains="abcd" pane="shadowPane" />
        <FitOnce points={fitPoints} maxZoom={compact ? 4 : 5} />
        <FlyTo target={target} zoom={compact ? 4 : 5} />
      </MapContainer>
    </div>
  );
}
