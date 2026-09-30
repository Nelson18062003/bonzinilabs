/**
 * La carte d'un trajet de l'Atlas (src/lib/logistics/atlas.ts) : le tronçon
 * principal en trait plein (mer, ou arc de grand cercle pour l'avion),
 * l'arrière-pays en pointillé, et les lieux étiquetés. Carte fixe, cadrée sur
 * le trajet : on la regarde, on ne s'y promène pas (elle ne vole pas le
 * défilement de la page sur un téléphone).
 * Même fond et même encre que la carte Cargo (OpenFreeMap, MAP_INK).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, Source } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import type { FeatureCollection, LineString } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { FOCUS_RING, TOGGLE_OFF, TOGGLE_ON } from '@/mobile/designKit';
import { mapInk } from '@/lib/cargo/palette';
import { paintWater } from '@/components/cargo/paintWater';
import { greatCircleArc, placeLabel, type LatLng, type RoutePlan } from '@/lib/logistics/atlas';

const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';
const toLngLat = (p: LatLng): [number, number] => [p[1], p[0]];
/** De la place pour les étiquettes des deux bouts (la Chine à droite, l'Afrique à gauche). */
const PADDING = { top: 28, bottom: 28, left: 48, right: 48 };

function boundsOf(points: LatLng[]): [[number, number], [number, number]] {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const [lat, lng] of points) { minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng); }
  return [[minLng, minLat], [maxLng, maxLat]];
}

export type MapFocus = 'all' | 'arrival';

/**
 * `focusLabels` : quand l'arrière-pays compte (N'Djamena, Bangui), deux
 * boutons passent du trajet entier au zoom sur l'arrivée — vu du monde, 1 800 km
 * de route au Cameroun tiennent en quelques pixels.
 */
export function RouteMap({ plan, lang, className, ariaLabel, focusLabels }: {
  plan: RoutePlan; lang: string; className?: string; ariaLabel: string; focusLabels?: Record<MapFocus, string>;
}) {
  const inlandKm = plan.legs.filter((l) => l.kind === 'road' || l.kind === 'rail').reduce((n, l) => n + l.km, 0);
  const canFocus = !!focusLabels && inlandKm >= 500;
  const [focus, setFocus] = useState<MapFocus>('all');
  const current: MapFocus = canFocus ? focus : 'all';
  return (
    <div>
      <div className="relative">
        <RouteCanvas plan={plan} lang={lang} className={className} ariaLabel={ariaLabel} focus={current} />
        {canFocus && (
          <div className="absolute left-3 top-3 flex gap-1" role="group">
            {(['all', 'arrival'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFocus(f)} aria-pressed={current === f}
                className={cn('h-9 rounded-full px-3 text-[14px] font-semibold shadow-sm', FOCUS_RING, current === f ? TOGGLE_ON : cn(TOGGLE_OFF, 'bg-white dark:bg-[#2C2C2C]'))}>
                {focusLabels![f]}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Sur une carte figée, l'attribution de MapLibre reste dépliée par-dessus le tracé : on la sort du cadre. */}
      <p className="px-4 pt-1.5 text-[14px] leading-[1.4] text-[#757575] dark:text-[#B3B3B3]">
        © <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="hover:underline">OpenFreeMap</a>
        {' · '}<a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer" className="hover:underline">OpenMapTiles</a>
        {' · '}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:underline">OpenStreetMap</a>
      </p>
    </div>
  );
}

function RouteCanvas({ plan, lang, className, ariaLabel, focus }: { plan: RoutePlan; lang: string; className?: string; ariaLabel: string; focus: MapFocus }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const C = mapInk(dark);
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);

  const { geo, all, inland, stops } = useMemo(() => {
    const features: GeoJSON.Feature<LineString>[] = [];
    const all: LatLng[] = [];
    const inland: LatLng[] = [plan.arrival.pos, plan.destination.pos];
    for (const leg of plan.legs) {
      if (!leg.path || leg.path.length < 2) continue;
      const coords = leg.kind === 'air' ? greatCircleArc(leg.path[0], leg.path[leg.path.length - 1]) : leg.path;
      all.push(...coords);
      if (leg.kind === 'road' || leg.kind === 'rail') inland.push(...coords);
      features.push({ type: 'Feature', properties: { main: leg.kind === 'sea' || leg.kind === 'air' ? 1 : 0 }, geometry: { type: 'LineString', coordinates: coords.map(toLngLat) } });
    }
    const geo: FeatureCollection<LineString> = { type: 'FeatureCollection', features };
    // Les lieux : départ, arrivée, relais (Ngaoundéré), destination — sans doublon.
    // Seuls le départ et la destination portent un nom : vus du monde, Kribi et
    // Yaoundé se chevaucheraient.
    const seen = new Set<string>();
    const stops = [plan.origin, plan.arrival, ...plan.legs.map((l) => l.to), plan.destination].filter((p) => {
      const k = `${p.pos[0].toFixed(2)},${p.pos[1].toFixed(2)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { geo, all, inland, stops };
  }, [plan]);

  const frame = focus === 'arrival' ? inland : all;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || frame.length === 0) return;
    map.fitBounds(boundsOf(frame), { padding: focus === 'arrival' ? { ...PADDING, top: 64 } : PADDING, maxZoom: 6, duration: 500 });
  }, [frame, focus, loaded]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !loaded) return;
    paintWater(map, C.water);
    const again = () => paintWater(map, C.water);
    map.on('styledata', again);
    return () => { map.off('styledata', again); };
  }, [loaded, C.water]);

  return (
    <div className={className} role="img" aria-label={ariaLabel}>
      <Map
        ref={mapRef}
        mapStyle={dark ? STYLE_DARK : STYLE_LIGHT}
        initialViewState={{ bounds: boundsOf(all.length ? all : [plan.origin.pos, plan.destination.pos]), fitBoundsOptions: { padding: PADDING } }}
        interactive={false}
        attributionControl={false}
        onLoad={() => setLoaded(true)}
        style={{ width: '100%', height: '100%' }}
      >
        <Source id="route" type="geojson" data={geo}>
          <Layer id="route-main" type="line" filter={['==', ['get', 'main'], 1]} layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': C.route, 'line-width': 2.6 }} />
          <Layer id="route-inland" type="line" filter={['==', ['get', 'main'], 0]} layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': C.route, 'line-width': 2.2, 'line-dasharray': [1.5, 1.5] }} />
        </Source>
        {stops.map((p, i) => (
          <Marker key={p.code} longitude={p.pos[1]} latitude={p.pos[0]} anchor="center">
            <span className="cargo-port has-arrivals">
              {/* Le départ est à l'est : son nom s'écrit à gauche du point, pour rester dans le cadre.
                  Zoomé sur l'arrivée, chaque étape porte son nom (sauf la Chine, hors cadre). */}
              {(focus === 'arrival' ? i > 0 : i === 0 || i === stops.length - 1) && (
                <span className="cargo-port__label" style={i === 0 ? { left: 'auto', right: 9 } : undefined}>{placeLabel(p, lang)}</span>
              )}
            </span>
          </Marker>
        ))}
      </Map>
    </div>
  );
}

export default RouteMap;
