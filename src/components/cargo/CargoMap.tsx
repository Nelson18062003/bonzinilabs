/**
 * Carte Cargo — Leaflet, fond CARTO neutre (clair/sombre).
 *
 * Grammaire (docs/cargo/module-app/02-carte-flexport.md §2) :
 *   un point = un navire, badge = nos conteneurs à bord ; plein = position
 *   récente, creux = hors couverture ; trait plein = parcouru, pointillé =
 *   restant ; ports = points étiquetés avec compteur d'arrivées.
 * Deux modes : `full` (page Carte, cartes navire/port cliquables, couches)
 * et `mini` (dossier : un navire, pas d'étiquettes, cadrage serré).
 */
import { useEffect, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from 'next-themes';
import { PORTS, WAX1_ROUTE, bestEta, fmtDay, fmtDayTime, fmtLatLng, liveVesselUrl, positionAge, statusMeta } from '@/lib/cargo/model';
import type { CargoShipment, CargoVesselPosition, LatLng } from '@/lib/cargo/model';
import { groupVessels } from '@/lib/cargo/vessels';
import type { VesselOnMap } from '@/lib/cargo/vessels';
import { LIVE_STATUS_LABEL, nearestPort, portCounts, vesselLiveStatus, vesselTrack } from '@/lib/cargo/geo';

import { DEFAULT_LAYERS } from '@/lib/cargo/layers';
import type { MapLayers } from '@/lib/cargo/layers';
export type { MapLayers };

function shipIcon(v: VesselOnMap, selected: boolean, hovered: boolean, mini: boolean) {
  const status = vesselLiveStatus(v.position);
  const cls = ['cargo-ship', `is-${status}`, selected ? 'is-selected' : '', hovered ? 'is-hover' : ''].filter(Boolean).join(' ');
  const badge = !mini && v.shipments.length > 0 ? `<b>${v.shipments.length}</b>` : '';
  return L.divIcon({ className: '', html: `<span class="${cls}">${badge}</span>`, iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -12] });
}

/** Cadrage, recadrage et redimensionnement pilotés par le parent (nonces). */
function Controller({ fitPoints, fitNonce, resizeNonce, maxZoom, flyTo }: { fitPoints: LatLng[]; fitNonce: number; resizeNonce: number; maxZoom: number; flyTo: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (fitPoints.length === 0) return;
    map.fitBounds(L.latLngBounds(fitPoints), { padding: [36, 36], maxZoom });
    // Recadre à la demande (nonce), jamais à chaque changement de données.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitNonce]);
  useEffect(() => { window.setTimeout(() => map.invalidateSize(), 60); }, [map, resizeNonce]);
  useEffect(() => { if (flyTo) map.flyTo(flyTo, Math.max(map.getZoom(), 5), { duration: 0.7 }); }, [map, flyTo]);
  return null;
}

export function CargoMap({
  shipments,
  positions,
  mode = 'full',
  layers = DEFAULT_LAYERS,
  selectedVesselImo = null,
  hoveredVesselImo = null,
  onSelectVessel,
  onOpenShipment,
  fitNonce = 0,
  resizeNonce = 0,
  className,
}: {
  shipments: CargoShipment[];
  positions: CargoVesselPosition[];
  mode?: 'full' | 'mini';
  layers?: MapLayers;
  selectedVesselImo?: string | null;
  hoveredVesselImo?: string | null;
  onSelectVessel?: (imo: string | null) => void;
  onOpenShipment?: (id: string) => void;
  fitNonce?: number;
  resizeNonce?: number;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const style = dark ? 'dark' : 'light';
  const mini = mode === 'mini';
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  const vessels = useMemo(() => groupVessels(shipments, positions), [shipments, positions]);
  const counts = useMemo(() => portCounts(shipments), [shipments]);
  const tracks = useMemo(() => vessels.map((v) => {
    const pod = v.shipments[0]?.pod_unlocode;
    return { imo: v.position.vessel_imo, ...vesselTrack([v.position.latitude, v.position.longitude], pod) };
  }), [vessels]);

  const fitPoints = useMemo<LatLng[]>(() => {
    const pts = vessels.map((v) => [v.position.latitude, v.position.longitude] as LatLng);
    if (mini) return pts;
    const used = new Set(shipments.flatMap((s) => [s.pol_unlocode, s.pod_unlocode]).filter(Boolean) as string[]);
    for (const code of used) if (PORTS[code]) pts.push(PORTS[code].pos);
    return pts.length ? pts : [PORTS.CNNSA.pos, PORTS.CMKBI.pos];
  }, [vessels, shipments, mini]);

  const flyTo = useMemo<LatLng | null>(() => {
    const v = vessels.find((x) => x.position.vessel_imo === selectedVesselImo);
    return v ? [v.position.latitude, v.position.longitude] : null;
  }, [vessels, selectedVesselImo]);

  useEffect(() => {
    if (mini) return;
    const m = selectedVesselImo ? markerRefs.current[selectedVesselImo] : null;
    if (m) window.setTimeout(() => m.openPopup(), 750);
  }, [selectedVesselImo, mini]);

  const ink = dark ? '#d9d9d9' : '#171717';
  const faint = dark ? '#6f6f6f' : '#b5b5b5';

  return (
    <div className={className}>
      <MapContainer
        center={[0, 60]}
        zoom={3}
        minZoom={2}
        worldCopyJump
        scrollWheelZoom={!mini}
        zoomControl={false}
        className="h-full w-full"
        attributionControl={false}
      >
        <TileLayer url={`https://{s}.basemaps.cartocdn.com/${style}_nolabels/{z}/{x}/{y}{r}.png`} subdomains="abcd" />

        {layers.routes && <Polyline positions={WAX1_ROUTE} pathOptions={{ color: faint, weight: 1.2, dashArray: '1 6', opacity: 0.9 }} />}
        {layers.routes && tracks.map((t) => {
          const sel = t.imo === selectedVesselImo || t.imo === hoveredVesselImo;
          return (
            <span key={t.imo}>
              <Polyline positions={t.sailed} pathOptions={{ color: ink, weight: sel ? 2.6 : 1.8, opacity: sel ? 1 : 0.75 }} />
              <Polyline positions={t.remaining} pathOptions={{ color: ink, weight: sel ? 2 : 1.4, dashArray: '4 6', opacity: sel ? 0.9 : 0.55 }} />
            </span>
          );
        })}

        {layers.ports && Object.entries(PORTS).map(([code, p]) => {
          const c = counts[code];
          const n = c ? c.arriving.length : 0;
          const label = n > 0 ? `${p.name} · ${n}` : p.name;
          return (
            <CircleMarker
              key={code}
              center={p.pos}
              radius={n > 0 ? 5 : 3.5}
              pathOptions={{ color: dark ? '#0f0f0f' : '#ffffff', weight: 1.5, fillColor: n > 0 ? ink : faint, fillOpacity: 1 }}
            >
              {layers.labels && !mini && (
                <Tooltip direction={code === 'CMKBI' ? 'bottom' : 'top'} offset={[0, code === 'CMKBI' ? 4 : -4]} permanent className="cargo-port-label">
                  {label}
                </Tooltip>
              )}
              {!mini && (
                <Popup>
                  <div className="cargo-popup">
                    <strong>{p.name}</strong>
                    {n === 0 && c.departing.length === 0 && <div>Aucun de nos conteneurs n'y arrive ni n'en part.</div>}
                    {n > 0 && (
                      <div>
                        <div className="cargo-popup__k">Arrivées prévues</div>
                        {c.arriving.map((s) => (
                          <button key={s.id} type="button" className="cargo-popup__row" onClick={() => onOpenShipment?.(s.id)}>
                            <span>{s.client_label} · <code>{s.container_number}</code></span>
                            <span>{fmtDay(bestEta(s).date)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {c.departing.length > 0 && <div className="cargo-popup__k">{c.departing.length} départ{c.departing.length > 1 ? 's' : ''} de ce port</div>}
                  </div>
                </Popup>
              )}
            </CircleMarker>
          );
        })}

        {vessels.map((v) => {
          const imo = v.position.vessel_imo;
          const here: LatLng = [v.position.latitude, v.position.longitude];
          const status = vesselLiveStatus(v.position);
          const next = nearestPort(here);
          const eta = v.shipments[0] ? bestEta(v.shipments[0]) : { date: null };
          const live = liveVesselUrl(imo);
          return (
            <Marker
              key={imo}
              ref={(m) => { markerRefs.current[imo] = m; }}
              position={here}
              icon={shipIcon(v, imo === selectedVesselImo, imo === hoveredVesselImo, mini)}
              eventHandlers={{ click: () => onSelectVessel?.(imo) }}
              zIndexOffset={imo === selectedVesselImo ? 1000 : 0}
            >
              {layers.labels && !mini && (
                <Tooltip direction="right" offset={[10, 0]} permanent className="cargo-ship-label">
                  {v.position.vessel_name ?? imo}
                </Tooltip>
              )}
              {!mini && (
                <Popup maxWidth={320} minWidth={260}>
                  <div className="cargo-popup">
                    <strong>{v.position.vessel_name ?? imo}</strong>
                    <div className="cargo-popup__status">
                      <i className={`cargo-dot is-${status}`} /> {LIVE_STATUS_LABEL[status]}
                      {v.position.speed_kn != null && status !== 'stale' ? ` · ${v.position.speed_kn} nd` : ''}
                      {v.position.course_deg != null && status !== 'stale' ? ` · cap ${Math.round(Number(v.position.course_deg))}°` : ''}
                    </div>
                    <div>{fmtLatLng(v.position.latitude, v.position.longitude)} · {fmtDayTime(new Date(v.position.reported_at))} ({positionAge(v.position)})</div>
                    {status === 'stale' && <div className="cargo-popup__muted">Plein océan, hors couverture AIS : dernière position connue.</div>}
                    <div>
                      {v.position.destination === 'CIABJ' ? 'Prochain arrêt : Abidjan' : `Port le plus proche : ${next.name} (${Math.round(next.km)} km)`}
                      {eta.date ? ` · Kribi/Douala ${fmtDay(eta.date)}` : ''}
                    </div>
                    <div className="cargo-popup__k">{v.shipments.length} conteneur{v.shipments.length > 1 ? 's' : ''} à bord</div>
                    {v.shipments.map((s) => {
                      const m = statusMeta(s.status);
                      return (
                        <button key={s.id} type="button" className="cargo-popup__row" onClick={() => onOpenShipment?.(s.id)}>
                          <span>{s.client_label} · <code>{s.container_number}</code></span>
                          <span>{m.label} · {fmtDay(bestEta(s).date)}</span>
                        </button>
                      );
                    })}
                    {live && <a href={live} target="_blank" rel="noopener noreferrer">Position en direct ↗</a>}
                  </div>
                </Popup>
              )}
            </Marker>
          );
        })}

        <TileLayer url={`https://{s}.basemaps.cartocdn.com/${style}_only_labels/{z}/{x}/{y}{r}.png`} subdomains="abcd" pane="shadowPane" />
        <Controller fitPoints={fitPoints} fitNonce={fitNonce} resizeNonce={resizeNonce} maxZoom={mini ? 4 : 5} flyTo={mini ? null : flyTo} />
      </MapContainer>
    </div>
  );
}
