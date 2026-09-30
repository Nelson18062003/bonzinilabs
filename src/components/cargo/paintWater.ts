import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * Le fond de carte livre un océan gris (positron : rgb(194,200,202) ; dark :
 * rgb(27,27,29)). Sur une carte maritime c'est presque tout l'écran, et c'est
 * ce qui rendait la carte éteinte. On repeint l'eau après le chargement du
 * style, plutôt que d'adopter un fond bariolé qui écraserait les marqueurs.
 * (Carte Cargo et carte des routes.)
 */
export function paintWater(map: MapLibreMap, water: string) {
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
