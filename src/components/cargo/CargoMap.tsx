/**
 * Carte des navires — Leaflet (fond CARTO, gratuit, clair/sombre).
 *
 * Trois couches : la tournée WAX1 en pointillé, les ports en petits ronds,
 * les navires en pastille orange (pleine = position récente, creuse = dernière
 * position connue, le navire est hors couverture). Sélectionner un dossier
 * dans la liste recentre la carte sur son navire.
 */
import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from 'next-themes';
import { PORTS, WAX1_ROUTE, fmtDayTime, liveVesselUrl } from '@/lib/cargo/model';
import type { LatLng } from '@/lib/cargo/model';
import type { VesselOnMap } from '@/lib/cargo/vessels';

function shipIcon(stale: boolean, selected: boolean) {
  return L.divIcon({
    className: '',
    html: `<span class="cargo-ship-marker${stale ? ' is-stale' : ''}${selected ? ' is-selected' : ''}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

function FlyTo({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 5), { duration: 0.8 });
  }, [map, target]);
  return null;
}

function FitOnce({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 5 });
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
}: {
  vessels: VesselOnMap[];
  selectedImo: string | null;
  onSelectVessel?: (imo: string) => void;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const tiles = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';
  const labels = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';

  const fitPoints = useMemo<LatLng[]>(
    () => [
      ...vessels.map((v) => [v.position.latitude, v.position.longitude] as LatLng),
      PORTS.CNNSA.pos,
      PORTS.CMKBI.pos,
    ],
    [vessels],
  );
  const target = useMemo<LatLng | null>(() => {
    const v = vessels.find((x) => x.position.vessel_imo === selectedImo);
    return v ? [v.position.latitude, v.position.longitude] : null;
  }, [vessels, selectedImo]);

  return (
    <div className={className}>
      <MapContainer
        center={[0, 60]}
        zoom={3}
        minZoom={2}
        worldCopyJump
        scrollWheelZoom
        className="h-full w-full"
        attributionControl={false}
      >
        <TileLayer url={tiles} subdomains="abcd" />
        <Polyline positions={WAX1_ROUTE} pathOptions={{ color: '#F59E0B', weight: 2, dashArray: '2 6', opacity: 0.9 }} />
        {Object.entries(PORTS).map(([code, p]) => (
          <CircleMarker
            key={code}
            center={p.pos}
            radius={5}
            pathOptions={{ color: dark ? '#0B141C' : '#ffffff', weight: 2, fillColor: '#F59E0B', fillOpacity: 1 }}
          >
            <Tooltip
              direction={code === 'CMKBI' ? 'bottom' : 'top'}
              offset={[0, code === 'CMKBI' ? 6 : -6]}
              permanent={code === 'CMKBI' || code === 'CNNSA' || code === 'CMDLA'}
            >
              {p.name}
            </Tooltip>
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
              <Tooltip direction="right" offset={[10, 0]} permanent className="cargo-ship-label">
                {v.shipments.map((s) => s.client_label).join(' + ')}
              </Tooltip>
              <Popup>
                <div className="cargo-popup">
                  <strong>{v.position.vessel_name ?? imo}</strong>
                  <div>
                    Transporte {v.shipments.map((s) => `${s.container_number} (${s.client_label})`).join(', ')}
                  </div>
                  <div>
                    {v.stale ? 'Dernière position connue' : 'Position'} : {fmtDayTime(new Date(v.position.reported_at))}
                    {v.position.speed_kn != null ? ` · ${v.position.speed_kn} nd` : ''}
                    {v.position.course_deg != null ? ` · cap ${Math.round(Number(v.position.course_deg))}°` : ''}
                  </div>
                  {v.stale && <div>Hors couverture AIS (plein océan) — normal, pas inquiétant.</div>}
                  {live && (
                    <a href={live} target="_blank" rel="noopener noreferrer">
                      Voir le navire en direct ↗
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
        <TileLayer url={labels} subdomains="abcd" pane="shadowPane" />
        <FitOnce points={fitPoints} />
        <FlyTo target={target} />
      </MapContainer>
    </div>
  );
}
