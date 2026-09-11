/** Couches activables de la carte Cargo. */
export interface MapLayers { routes: boolean; ports: boolean; labels: boolean }
export const DEFAULT_LAYERS: MapLayers = { routes: true, ports: true, labels: true };
