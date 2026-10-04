/**
 * La carte du voyage d'UN conteneur — celle de la fiche.
 *
 * L'ancienne mini-carte cadrait la dernière position AIS (vieille de 22
 * jours, au large de la Namibie) sans étiquette ni repère : on voyait un
 * bout de golfe de Guinée et on ne comprenait rien. Celle-ci dit tout de
 * suite trois choses :
 *   · d'où il est parti, par où il est passé, où il va (escales étiquetées,
 *     avec leurs dates) ;
 *   · où est le navire, de quand date la position et d'où elle vient ;
 *   · ce qu'il reste à faire (trait plein = parcouru, pointillé = restant).
 * Cadrage par défaut sur la DERNIÈRE ÉTAPE (là où se joue la suite) ; un
 * bouton montre tout le voyage.
 *
 * MapLibre sur tuiles OpenFreeMap (sans clé), comme la carte de la flotte.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { AttributionControl, Layer, Marker, NavigationControl, Source } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import type { FeatureCollection, LineString } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Ship } from 'lucide-react';
import { useTheme } from 'next-themes';
import { paintWater } from './paintWater';
import { PORTS, WAX1_ROUTE, isStalePosition, positionAge } from '@/lib/cargo/model';
import type { CargoShipment, CargoVesselPosition, LatLng } from '@/lib/cargo/model';
import { nearestRouteIndex } from '@/lib/cargo/geo';
import { mapInk } from '@/lib/cargo/palette';
import { callDateLine, callPos, callStates, voyageCalls, type CallState } from '@/lib/cargo/voyage';
import { cn } from '@/lib/utils';

const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';
const toLngLat = (p: LatLng): [number, number] => [p[1], p[0]];
const line = (coords: LatLng[], kind: string): GeoJSON.Feature<LineString> => ({ type: 'Feature', properties: { kind }, geometry: { type: 'LineString', coordinates: coords.map(toLngLat) } });

function boundsOf(points: LatLng[], pad: number): [[number, number], [number, number]] {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const [lat, lng] of points) { minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng); }
  return [[minLng - pad, minLat - pad], [maxLng + pad, maxLat + pad]];
}

const DOT: Record<CallState, string> = {
  done: 'bg-foreground',
  here: 'bg-emerald-500',
  next: 'bg-violet-600',
  later: 'bg-white ring-2 ring-foreground/40',
  after: 'bg-muted-foreground/40',
};

export function VoyageMap({ shipment: s, position, className }: { shipment: CargoShipment; position: CargoVesselPosition | null; className?: string }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const C = mapInk(dark);
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [frame, setFrame] = useState<'leg' | 'all'>('leg');

  const calls = useMemo(() => voyageCalls(s), [s]);
  const states = useMemo(() => callStates(calls), [calls]);
  const placed = useMemo(
    () => calls.map((c, i) => ({ c, state: states[i], pos: callPos(c) })).filter((x) => x.pos) as { c: (typeof calls)[number]; state: CallState; pos: LatLng }[],
    [calls, states],
  );

  // La route : la tournée WAX1 coupée au port de départ et au port d'arrivée du dossier.
  const route = useMemo(() => {
    const from = s.pol_unlocode && PORTS[s.pol_unlocode] ? nearestRouteIndex(PORTS[s.pol_unlocode].pos) : 0;
    const to = s.pod_unlocode && PORTS[s.pod_unlocode] ? nearestRouteIndex(PORTS[s.pod_unlocode].pos) : WAX1_ROUTE.length - 1;
    return WAX1_ROUTE.slice(Math.min(from, to), Math.max(from, to) + 1);
  }, [s.pol_unlocode, s.pod_unlocode]);

  // Mémorisé sur les coordonnées : un nouveau tableau à chaque rendu relancerait le cadrage (la carte « sauterait »).
  const lat = position?.latitude;
  const lon = position?.longitude;
  const vessel = useMemo<LatLng | null>(() => (lat != null && lon != null ? [lat, lon] : null), [lat, lon]);
  const stale = position ? isStalePosition(position) : true;

  const tracks = useMemo<FeatureCollection<LineString>>(() => {
    if (!vessel) return { type: 'FeatureCollection', features: [line(route, 'remaining')] };
    const i = nearestRouteIndex(vessel, route);
    return { type: 'FeatureCollection', features: [line([...route.slice(0, i + 1), vessel], 'sailed'), line([vessel, ...route.slice(i + 1)], 'remaining')] };
  }, [route, vessel]);

  // Dernière étape : le dernier port quitté, le navire, la prochaine escale.
  const legPoints = useMemo<LatLng[]>(() => {
    const lastDone = [...placed].reverse().find((p) => p.state === 'done');
    const next = placed.find((p) => p.state === 'here' || p.state === 'next');
    const pts = [lastDone?.pos, vessel, next?.pos].filter(Boolean) as LatLng[];
    return pts.length >= 2 ? pts : route;
  }, [placed, vessel, route]);

  const frameBounds = useCallback(
    (f: 'leg' | 'all') => boundsOf(f === 'leg' ? legPoints : [...route, ...(vessel ? [vessel] : [])], f === 'leg' ? 1.2 : 2),
    [legPoints, route, vessel],
  );
  const PADDING = { top: 56, bottom: 44, left: 44, right: 240 };
  // Le cadrage ne dépend pas du chargement du fond de carte : la première vue
  // est calculée d'emblée (initialViewState.bounds), les suivantes à la demande.
  useEffect(() => {
    mapRef.current?.fitBounds(frameBounds(frame), { padding: PADDING, maxZoom: 7, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, frameBounds]);
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !loaded) return;
    paintWater(map, C.water);
    const again = () => paintWater(map, C.water);
    map.on('styledata', again);
    return () => { map.off('styledata', again); };
  }, [loaded, C.water]);

  return (
    <div className={cn('relative overflow-hidden rounded-[12px] ring-1 ring-black/[0.06] dark:ring-white/[0.08]', className)}>
      <Map
        ref={mapRef}
        mapStyle={dark ? STYLE_DARK : STYLE_LIGHT}
        initialViewState={{ bounds: frameBounds('leg'), fitBoundsOptions: { padding: PADDING, maxZoom: 7 } }}
        minZoom={1.5}
        dragRotate={false}
        touchPitch={false}
        cooperativeGestures
        attributionControl={false}
        onLoad={() => setLoaded(true)}
        style={{ width: '100%', height: '100%' }}
      >
        <AttributionControl compact position="bottom-right" />
        <NavigationControl position="bottom-left" showCompass={false} />
        <Source id="voyage" type="geojson" data={tracks}>
          <Layer id="voyage-sailed" type="line" filter={['==', ['get', 'kind'], 'sailed']} layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': C.route, 'line-width': 3 }} />
          <Layer id="voyage-remaining" type="line" filter={['==', ['get', 'kind'], 'remaining']} paint={{ 'line-color': C.route, 'line-width': 2.2, 'line-dasharray': [2, 2.5], 'line-opacity': 0.75 }} />
        </Source>

        {placed.map(({ c, state, pos }) => (
          <Marker key={c.id} longitude={pos[1]} latitude={pos[0]} anchor="left" offset={[-6, 0]}>
            <div className={cn('flex items-center gap-1.5', state === 'after' && 'opacity-60')}>
              <span className={cn('h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-black', DOT[state])} />
              <span className="whitespace-nowrap rounded-md bg-white/95 px-1.5 py-0.5 text-[11px] font-bold leading-4 text-neutral-900 ring-1 ring-black/10 dark:bg-neutral-900/90 dark:text-neutral-100 dark:ring-white/15">
                {c.name}
                {callDateLine(c, state) && <span className="ml-1 font-medium text-neutral-500 dark:text-neutral-400">{callDateLine(c, state)}</span>}
              </span>
            </div>
          </Marker>
        ))}

        {vessel && position && (
          <Marker longitude={vessel[1]} latitude={vessel[0]} anchor="bottom" offset={[0, 16]} style={{ zIndex: 5 }}>
            <div className="flex flex-col-reverse items-center">
              <span className={cn('relative flex h-8 w-8 items-center justify-center rounded-full ring-[3px] ring-white dark:ring-black', stale ? 'bg-neutral-400' : 'bg-violet-600')}>
                {!stale && <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/40" />}
                <Ship className="relative h-4 w-4 text-white" style={position.course_deg != null ? { transform: `rotate(${Number(position.course_deg) - 90}deg)` } : undefined} />
              </span>
              <span className="mb-1 whitespace-nowrap rounded-md bg-neutral-900/90 px-1.5 py-0.5 text-[10.5px] font-semibold text-white dark:bg-white/90 dark:text-neutral-900">
                {position.vessel_name ?? 'Navire'} · {positionAge(position)}{position.source === 'manual' ? ' · relevé à la main' : ''}
              </span>
            </div>
          </Marker>
        )}
      </Map>

      <div className="absolute left-3 top-3 inline-flex rounded-md bg-white/95 p-0.5 ring-1 ring-black/10 dark:bg-neutral-900/90 dark:ring-white/15">
        {(['leg', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFrame(f)}
            className={cn('h-7 rounded-[5px] px-2.5 text-[11.5px] font-semibold max-lg:h-9 max-lg:text-[13px]', frame === f ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-300')}
          >
            {f === 'leg' ? 'Dernière étape' : 'Tout le voyage'}
          </button>
        ))}
      </div>
      {!vessel && (
        <div className="absolute inset-x-3 bottom-3 rounded-md bg-white/95 px-3 py-2 text-[12px] font-medium text-neutral-700 ring-1 ring-black/10 dark:bg-neutral-900/90 dark:text-neutral-200">
          Pas de position du navire : renseigne-la avec « Mettre à jour la position ».
        </div>
      )}
    </div>
  );
}
