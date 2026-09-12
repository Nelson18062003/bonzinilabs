/**
 * Carte Cargo — MapLibre GL (vecteur) sur les tuiles OpenFreeMap
 * (OpenStreetMap, sans clé), styles positron (clair) et dark (sombre).
 *
 * Grammaire (docs/cargo/module-app/02-carte-flexport.md §2) :
 *   un point = un navire, badge = nos conteneurs à bord ; plein = position
 *   récente, creux = hors couverture ; trait plein = parcouru, pointillé =
 *   restant ; ports = points étiquetés avec compteur d'arrivées.
 * Deux modes : `full` (page Carte : cartes navire/port, couches, globe) et
 * `mini` (dossier : un navire, cadrage serré, pas d'étiquettes).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { AttributionControl, Layer, Marker, NavigationControl, Popup, Source } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from 'next-themes';
import { PORTS, WAX1_ROUTE, bestEta, fmtDay, fmtDayTime, fmtLatLng, liveVesselUrl, positionAge, statusMeta } from '@/lib/cargo/model';
import type { CargoShipment, CargoVesselPosition, LatLng } from '@/lib/cargo/model';
import { groupVessels } from '@/lib/cargo/vessels';
import type { VesselOnMap } from '@/lib/cargo/vessels';
import { LIVE_STATUS_LABEL, nearestPort, portCounts, vesselLiveStatus, vesselTrack } from '@/lib/cargo/geo';
import { DEFAULT_LAYERS } from '@/lib/cargo/layers';
import type { MapLayers } from '@/lib/cargo/layers';
import { ALERT, ALERT_ORDER, alertTally, mapInk, worstAlert } from '@/lib/cargo/palette';
import type { AlertLevel } from '@/lib/cargo/palette';
export type { MapLayers };

const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';
const toLngLat = (p: LatLng): [number, number] => [p[1], p[0]];

/**
 * Le fond de carte livre un océan gris (positron : rgb(194,200,202) ; dark :
 * rgb(27,27,29)). Sur une carte maritime c'est presque tout l'écran, et c'est
 * ce qui rendait la carte éteinte. On repeint l'eau après le chargement du
 * style, plutôt que d'adopter un fond bariolé qui écraserait les marqueurs.
 */
function paintWater(map: MapLibreMap, water: string) {
  for (const layer of map.getStyle()?.layers ?? []) {
    if (layer.type !== 'fill') continue;
    if (!/water|ocean|sea/i.test(layer.id)) continue;
    try {
      map.setPaintProperty(layer.id, 'fill-color', water);
    } catch {
      // Une couche absente d'un style à l'autre ne doit pas casser la carte.
    }
  }
}

function line(coords: LatLng[], props: Record<string, unknown>): GeoJSON.Feature<LineString> {
  return { type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords.map(toLngLat) } };
}

function boundsOf(points: LatLng[]): [[number, number], [number, number]] {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const [lat, lng] of points) { minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng); }
  if (points.length === 1) { minLat -= 6; maxLat += 6; minLng -= 8; maxLng += 8; }
  return [[minLng, minLat], [maxLng, maxLat]];
}

function VesselCard({ v, onOpenShipment }: { v: VesselOnMap; onOpenShipment?: (id: string) => void }) {
  const imo = v.position.vessel_imo;
  const status = vesselLiveStatus(v.position);
  const next = nearestPort([v.position.latitude, v.position.longitude]);
  const live = liveVesselUrl(imo);
  return (
    <div className="cargo-popup">
      <strong>{v.position.vessel_name ?? imo}</strong>
      <div className="cargo-popup__status">
        <i className={`cargo-dot is-${status}`} /> {LIVE_STATUS_LABEL[status]}
        {v.position.speed_kn != null && status !== 'stale' ? ` · ${v.position.speed_kn} nd` : ''}
        {v.position.course_deg != null && status !== 'stale' ? ` · cap ${Math.round(Number(v.position.course_deg))}°` : ''}
      </div>
      <div>{fmtLatLng(v.position.latitude, v.position.longitude)} · {fmtDayTime(new Date(v.position.reported_at))} ({positionAge(v.position)})</div>
      {status === 'stale' && <div className="cargo-popup__muted">Plein océan, hors couverture AIS : dernière position connue.</div>}
      <div>{v.position.destination === 'CIABJ' ? 'Prochain arrêt : Abidjan' : `Port le plus proche : ${next.name} (${Math.round(next.km)} km)`}</div>
      <div className="cargo-popup__k">{v.shipments.length} conteneur{v.shipments.length > 1 ? 's' : ''} à bord</div>
      {v.shipments.map((s) => (
        <button key={s.id} type="button" className="cargo-popup__row" onClick={() => onOpenShipment?.(s.id)}>
          <span>{s.client_label} · <code>{s.container_number}</code></span>
          <span>{statusMeta(s.status).label} · {s.pod_name} {fmtDay(bestEta(s).date)}</span>
        </button>
      ))}
      {live && <a href={live} target="_blank" rel="noopener noreferrer">Position en direct ↗</a>}
    </div>
  );
}

/**
 * La légende — obligatoire, pas décorative. La palette de statut descend sous
 * 3:1 sur l'eau claire ; la règle est alors de redire l'état en toutes lettres.
 * C'est ici qu'on le fait, avec le compte de conteneurs dans chaque état.
 */
function MapLegend({ tally }: { tally: Record<AlertLevel, number> }) {
  const shown = ALERT_ORDER.filter((k) => tally[k] > 0);
  if (shown.length === 0) return null;
  return (
    <div className="cargo-legend">
      {shown.map((k) => (
        <span key={k} className="cargo-legend__item">
          <i className="cargo-legend__dot" style={{ background: ALERT[k].hex }} aria-hidden />
          {ALERT[k].label}
          <b>{tally[k]}</b>
        </span>
      ))}
    </div>
  );
}

export function CargoMap({
  shipments,
  positions,
  mode = 'full',
  layers = DEFAULT_LAYERS,
  globe = false,
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
  globe?: boolean;
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
  const mini = mode === 'mini';
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [openPort, setOpenPort] = useState<string | null>(null);

  const vessels = useMemo(() => groupVessels(shipments, positions), [shipments, positions]);
  const counts = useMemo(() => portCounts(shipments), [shipments]);

  const routeGeo = useMemo<FeatureCollection<LineString>>(() => ({ type: 'FeatureCollection', features: [line(WAX1_ROUTE, {})] }), []);
  const tracksGeo = useMemo<FeatureCollection<LineString>>(() => ({
    type: 'FeatureCollection',
    features: vessels.flatMap((v) => {
      const imo = v.position.vessel_imo;
      const sel = imo === selectedVesselImo || imo === hoveredVesselImo ? 1 : 0;
      const t = vesselTrack([v.position.latitude, v.position.longitude], v.shipments[0]?.pod_unlocode);
      return [line(t.sailed, { imo, kind: 'sailed', sel }), line(t.remaining, { imo, kind: 'remaining', sel })];
    }),
  }), [vessels, selectedVesselImo, hoveredVesselImo]);

  const fitPoints = useMemo<LatLng[]>(() => {
    const pts = vessels.map((v) => [v.position.latitude, v.position.longitude] as LatLng);
    if (mini) return pts;
    const used = new Set(shipments.flatMap((s) => [s.pol_unlocode, s.pod_unlocode]).filter(Boolean) as string[]);
    for (const code of used) if (PORTS[code]) pts.push(PORTS[code].pos);
    return pts.length ? pts : [PORTS.CNNSA.pos, PORTS.CMKBI.pos];
  }, [vessels, shipments, mini]);

  const fit = useCallback(() => {
    const map = mapRef.current;
    if (!map || fitPoints.length === 0) return;
    map.fitBounds(boundsOf(fitPoints), { padding: mini ? 24 : 48, maxZoom: mini ? 4 : 5, duration: 600 });
  }, [fitPoints, mini]);

  useEffect(() => { if (loaded) fit(); }, [loaded, fitNonce, fit]);
  useEffect(() => { window.setTimeout(() => mapRef.current?.resize(), 60); }, [resizeNonce]);
  useEffect(() => {
    if (mini || !loaded) return;
    const v = vessels.find((x) => x.position.vessel_imo === selectedVesselImo);
    // La carte navire s'ouvre au-dessus du point : on laisse de la place en haut.
    if (v) mapRef.current?.flyTo({ center: [v.position.longitude, v.position.latitude], zoom: Math.max(mapRef.current.getZoom(), 4.5), padding: { top: 260, bottom: 0, left: 0, right: 0 }, duration: 700 });
  }, [selectedVesselImo, vessels, mini, loaded]);

  const C = mapInk(dark);
  const selectedVessel = vessels.find((v) => v.position.vessel_imo === selectedVesselImo) ?? null;
  const tally = useMemo(() => alertTally(shipments), [shipments]);

  // L'eau est repeinte à chaque chargement de style — donc aussi au basculement
  // clair/sombre, qui recharge le style et perdrait la peinture sans cela.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !loaded) return;
    paintWater(map, C.water);
    const again = () => paintWater(map, C.water);
    map.on('styledata', again);
    return () => { map.off('styledata', again); };
  }, [loaded, C.water]);

  return (
    <div className={['cargo-map-wrap', className].filter(Boolean).join(' ')}>
      <Map
        ref={mapRef}
        mapStyle={dark ? STYLE_DARK : STYLE_LIGHT}
        projection={globe ? 'globe' : 'mercator'}
        initialViewState={{ longitude: 60, latitude: 5, zoom: 2.2 }}
        minZoom={1.5}
        scrollZoom={!mini}
        dragRotate={false}
        touchPitch={false}
        attributionControl={false}
        onLoad={() => setLoaded(true)}
        onClick={() => { if (!mini) { onSelectVessel?.(null); setOpenPort(null); } }}
        style={{ width: '100%', height: '100%' }}
      >
        <AttributionControl compact position="bottom-right" />
        {!mini && <NavigationControl position="top-left" showCompass={false} />}

        {layers.routes && (
          <Source id="wax1" type="geojson" data={routeGeo}>
            <Layer id="wax1-line" type="line" paint={{ 'line-color': C.routeFaint, 'line-width': 1.2, 'line-dasharray': [1, 4], 'line-opacity': 0.9 }} />
          </Source>
        )}
        {layers.routes && (
          <Source id="tracks" type="geojson" data={tracksGeo}>
            {/* Parcouru : trait plein et teinté. Restant : même teinte, pâlie et pointillée.
                Une seule teinte pour la route, pour ne pas rivaliser avec les statuts. */}
            <Layer id="track-sailed" type="line" filter={['==', ['get', 'kind'], 'sailed']} layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': C.route, 'line-width': ['case', ['==', ['get', 'sel'], 1], 3.2, 2], 'line-opacity': ['case', ['==', ['get', 'sel'], 1], 1, 0.85] }} />
            <Layer id="track-remaining" type="line" filter={['==', ['get', 'kind'], 'remaining']}
              paint={{ 'line-color': C.routeFaint, 'line-width': ['case', ['==', ['get', 'sel'], 1], 2.4, 1.6], 'line-dasharray': [3, 4], 'line-opacity': ['case', ['==', ['get', 'sel'], 1], 1, 0.7] }} />
          </Source>
        )}

        {layers.ports && Object.entries(PORTS).map(([code, p]) => {
          const n = counts[code]?.arriving.length ?? 0;
          return (
            <Marker key={code} longitude={p.pos[1]} latitude={p.pos[0]} anchor="center" onClick={(e) => { e.originalEvent.stopPropagation(); if (!mini) setOpenPort(code); }}>
              <span className={`cargo-port${n > 0 ? ' has-arrivals' : ''}`}>
                {layers.labels && !mini && <span className="cargo-port__label">{n > 0 ? `${p.name} · ${n}` : p.name}</span>}
              </span>
            </Marker>
          );
        })}

        {vessels.map((v) => {
          const imo = v.position.vessel_imo;
          const status = vesselLiveStatus(v.position);
          // La teinte dit l'état du pire conteneur à bord ; l'anneau la détache
          // de la mer et de la route ; l'étiquette la redit en toutes lettres.
          const alert = worstAlert(v.shipments);
          const cls = ['cargo-ship', `is-${status}`, `alert-${alert}`, imo === selectedVesselImo ? 'is-selected' : '', imo === hoveredVesselImo ? 'is-hover' : ''].filter(Boolean).join(' ');
          return (
            <Marker key={imo} longitude={v.position.longitude} latitude={v.position.latitude} anchor="center" style={{ zIndex: imo === selectedVesselImo ? 10 : ALERT[alert].rank + 2 }}
              onClick={(e) => { e.originalEvent.stopPropagation(); onSelectVessel?.(imo); }}>
              <span
                className={cls}
                style={{ ['--alert' as string]: ALERT[alert].hex, ['--ring' as string]: C.ring }}
                title={`${v.position.vessel_name ?? imo} — ${ALERT[alert].label}`}
              >
                {!mini && v.shipments.length > 0 && <b>{v.shipments.length}</b>}
                {layers.labels && !mini && (
                  <span className="cargo-ship__label">
                    {v.position.vessel_name ?? imo}
                    <em>{ALERT[alert].label}</em>
                  </span>
                )}
              </span>
            </Marker>
          );
        })}

        {!mini && selectedVessel && (
          <Popup longitude={selectedVessel.position.longitude} latitude={selectedVessel.position.latitude} anchor="bottom" offset={16} maxWidth="340px" closeButton onClose={() => onSelectVessel?.(null)}>
            <VesselCard v={selectedVessel} onOpenShipment={onOpenShipment} />
          </Popup>
        )}
        {!mini && openPort && PORTS[openPort] && (
          <Popup longitude={PORTS[openPort].pos[1]} latitude={PORTS[openPort].pos[0]} anchor="bottom" offset={10} maxWidth="320px" closeButton onClose={() => setOpenPort(null)}>
            <div className="cargo-popup">
              <strong>{PORTS[openPort].name}</strong>
              {counts[openPort].arriving.length === 0 && counts[openPort].departing.length === 0 && <div>Aucun de nos conteneurs n'y arrive ni n'en part.</div>}
              {counts[openPort].arriving.length > 0 && (
                <div>
                  <div className="cargo-popup__k">Arrivées prévues</div>
                  {counts[openPort].arriving.map((s) => (
                    <button key={s.id} type="button" className="cargo-popup__row" onClick={() => onOpenShipment?.(s.id)}>
                      <span>{s.client_label} · <code>{s.container_number}</code></span>
                      <span>{fmtDay(bestEta(s).date)}</span>
                    </button>
                  ))}
                </div>
              )}
              {counts[openPort].departing.length > 0 && <div className="cargo-popup__k">{counts[openPort].departing.length} départ{counts[openPort].departing.length > 1 ? 's' : ''} de ce port</div>}
            </div>
          </Popup>
        )}
      </Map>
      {!mini && <MapLegend tally={tally} />}
    </div>
  );
}
