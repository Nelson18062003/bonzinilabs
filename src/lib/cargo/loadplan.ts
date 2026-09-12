/**
 * Plan de chargement — où se pose chaque colis dans la boîte.
 *
 * But : répondre en un regard à « est-ce que ça rentre ? », « il reste combien
 * de place ? » et « qu'est-ce qu'il y a en dessous ? ». C'est ce que la vue 3D
 * dessine ; ici on ne fait que le calcul, sans rien afficher.
 *
 * ⚠ Ce n'est PAS un plan d'arrimage. Un vrai plan tient compte du centre de
 * gravité, de la répartition des masses sur l'essieu, du calage et des
 * incompatibilités de marchandises. Celui-ci range des boîtes dans une boîte,
 * pour se représenter le remplissage et repérer une erreur de cubage. Le
 * chargement réel reste la responsabilité de l'entrepôt.
 *
 * Le rangement est DÉTERMINISTE : même dossier, même vue pour tout le monde.
 * Aucun aléatoire, aucune heuristique dépendant de l'heure.
 *
 * Méthode : rangement par étagères (« shelf packing »), en trois niveaux.
 *   1. on remplit une RANGÉE le long du conteneur (axe X, la longueur) ;
 *   2. les rangées se posent côte à côte sur la largeur (axe Z) → un ÉTAGE ;
 *   3. les étages s'empilent sur la hauteur (axe Y).
 * C'est exactement la façon dont un entrepôt empote à la main, donc le dessin
 * ressemble à ce que l'ops verra en ouvrant les portes.
 */
import type { CargoPackage } from '@/lib/cargo/model';

/** Dimensions INTÉRIEURES utiles, en centimètres. */
export interface BoxDims { length: number; width: number; height: number }

/**
 * Dimensions intérieures par type ISO. Valeurs constructeur usuelles, en cm.
 * Un conteneur inconnu est traité comme un 40' High Cube, le plus courant sur
 * le corridor Chine → Cameroun.
 */
export const CONTAINER_DIMS: Record<string, BoxDims & { label: string; maxPayloadKg: number }> = {
  '22G1': { label: "20' Dry", length: 589.8, width: 235.2, height: 239.3, maxPayloadKg: 28200 },
  '42G1': { label: "40' Dry", length: 1203.2, width: 235.2, height: 239.3, maxPayloadKg: 26700 },
  '45G1': { label: "40' High Cube", length: 1203.2, width: 235.2, height: 269.8, maxPayloadKg: 26460 },
  L5G1: { label: "45' High Cube", length: 1355.6, width: 235.2, height: 269.8, maxPayloadKg: 25600 },
};

export const DEFAULT_ISO = '45G1';

export function containerDims(iso: string | null | undefined) {
  return CONTAINER_DIMS[(iso ?? '').toUpperCase()] ?? CONTAINER_DIMS[DEFAULT_ISO];
}

/** Un colis posé : coin avant-bas-gauche + dimensions, en cm, repère conteneur. */
export interface PlacedBox {
  id: string;
  packageId: string;
  label: string;
  /** Rang du lot dans la liste — sert à donner sa teinte au colis. */
  lot: number;
  x: number; y: number; z: number;
  l: number; w: number; h: number;
  /** L'étage auquel il appartient, pour la révélation couche par couche. */
  layer: number;
  weightKg: number | null;
}

export interface LoadPlan {
  dims: BoxDims;
  isoLabel: string;
  boxes: PlacedBox[];
  /** Colis qui ne rentrent pas — on ne les dessine pas, on les dit. */
  leftOut: { label: string; qty: number; why: string }[];
  layers: number;
  usedVolumeM3: number;
  containerVolumeM3: number;
  /** Part du volume intérieur occupée, 0 → 1. */
  fill: number;
  totalWeightKg: number;
  maxPayloadKg: number;
  /** Part de la charge utile consommée, 0 → 1. Peut dépasser 1 : c'est une alerte. */
  weightFill: number;
  /** Hauteur réellement atteinte, en cm — utile quand on paie du volume. */
  stackHeight: number;
}

const m3 = (l: number, w: number, h: number) => (l * w * h) / 1_000_000;

/**
 * Range les lots dans le conteneur.
 *
 * Les lots sont pris dans l'ordre de saisie (`position`), pas triés par taille :
 * un opérateur qui saisit sa packing list dans l'ordre retrouve son chargement
 * dans le même ordre. Les colis non gerbables sont posés en dernier, donc
 * toujours au-dessus — c'est la seule réorganisation qu'on s'autorise, et elle
 * correspond à la consigne réelle « fragile sur le dessus ».
 */
export function buildLoadPlan(iso: string | null | undefined, packages: CargoPackage[]): LoadPlan {
  const spec = containerDims(iso);
  const dims: BoxDims = { length: spec.length, width: spec.width, height: spec.height };
  const boxes: PlacedBox[] = [];
  const leftOut: LoadPlan['leftOut'] = [];

  const ordered = [...packages].sort((a, b) => {
    if (a.stackable !== b.stackable) return a.stackable ? -1 : 1;
    if (a.position !== b.position) return a.position - b.position;
    return a.created_at.localeCompare(b.created_at);
  });

  // Curseurs de rangement, en cm.
  let x = 0;          // avance le long de la longueur
  let z = 0;          // avance sur la largeur (rangée suivante)
  let y = 0;          // monte d'un étage
  let rowDepth = 0;   // largeur de la rangée en cours
  let layerHeight = 0; // hauteur de l'étage en cours
  let layer = 0;
  /** Le plus haut étage où un colis a VRAIMENT été posé — pas le curseur. */
  let topLayer = -1;
  let nonStackableStarted = false;

  const newRow = () => { z += rowDepth; x = 0; rowDepth = 0; };
  const newLayer = () => { y += layerHeight; z = 0; x = 0; rowDepth = 0; layerHeight = 0; layer += 1; };

  for (let lot = 0; lot < ordered.length; lot += 1) {
    const p = ordered[lot];

    // Les non gerbables ouvrent leur propre étage. Comme ils sont traités en
    // dernier, plus rien ne se pose au-dessus d'eux — ce que le simple fait de
    // les ranger à la fin ne garantissait PAS : ils se retrouvaient à côté des
    // autres sur le même étage, et l'étage suivant leur passait dessus.
    if (!p.stackable && !nonStackableStarted) {
      nonStackableStarted = true;
      if (boxes.length > 0) newLayer();
    }
    const l = Number(p.length_cm);
    const w = Number(p.width_cm);
    const h = Number(p.height_cm);
    const unitWeight = p.weight_kg == null ? null : Number(p.weight_kg);

    if (l > dims.length || w > dims.width || h > dims.height) {
      leftOut.push({ label: p.label, qty: p.qty, why: 'plus grand que le conteneur' });
      continue;
    }

    let placed = 0;
    for (let i = 0; i < p.qty; i += 1) {
      if (x + l > dims.length + 0.01) newRow();
      if (z + w > dims.width + 0.01) newLayer();
      if (y + h > dims.height + 0.01) break; // le conteneur est plein

      boxes.push({
        id: `${p.id}-${i}`, packageId: p.id, label: p.label, lot,
        x, y, z, l, w, h, layer, weightKg: unitWeight,
      });
      topLayer = Math.max(topLayer, layer);
      x += l;
      rowDepth = Math.max(rowDepth, w);
      layerHeight = Math.max(layerHeight, h);
      placed += 1;
    }

    if (placed < p.qty) {
      leftOut.push({ label: p.label, qty: p.qty - placed, why: 'le conteneur est plein' });
    }
  }

  const usedVolumeM3 = boxes.reduce((sum, b) => sum + m3(b.l, b.w, b.h), 0);
  const containerVolumeM3 = m3(dims.length, dims.width, dims.height);
  const totalWeightKg = boxes.reduce((sum, b) => sum + (b.weightKg ?? 0), 0);
  const stackHeight = boxes.reduce((max, b) => Math.max(max, b.y + b.h), 0);

  return {
    dims,
    isoLabel: spec.label,
    boxes,
    leftOut,
    layers: topLayer + 1,
    usedVolumeM3,
    containerVolumeM3,
    fill: containerVolumeM3 > 0 ? usedVolumeM3 / containerVolumeM3 : 0,
    totalWeightKg,
    maxPayloadKg: spec.maxPayloadKg,
    weightFill: spec.maxPayloadKg > 0 ? totalWeightKg / spec.maxPayloadKg : 0,
    stackHeight,
  };
}

/**
 * Teintes des lots. Ce sont des IDENTITÉS (quel lot), pas des magnitudes :
 * on prend donc l'ordre catégoriel du référentiel dataviz, sans jamais le
 * recycler — au-delà de huit lots, tout le reste partage la teinte « autres »,
 * parce qu'une neuvième teinte inventée ne serait plus distinguable.
 */
export const LOT_HUES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
export const LOT_HUES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
export const LOT_OTHER_LIGHT = '#8a8a8a';
export const LOT_OTHER_DARK = '#9a9a9a';

export function lotColor(lot: number, dark: boolean): string {
  const hues = dark ? LOT_HUES_DARK : LOT_HUES_LIGHT;
  if (lot >= hues.length) return dark ? LOT_OTHER_DARK : LOT_OTHER_LIGHT;
  return hues[lot];
}

/** Combien de lots portent une teinte propre ; au-delà, ils sont regroupés. */
export const MAX_DISTINCT_LOTS = LOT_HUES_LIGHT.length;

/** Un point de vue mémorisé sur le conteneur. */
export interface CameraPreset { name: string; label: string; yaw: number; pitch: number }

/**
 * Trois angles utiles, pas douze : le trois-quarts, le dessus, le bout.
 * `pitch` est la HAUTEUR DE CAMÉRA au-dessus de l'horizon : 0 = à hauteur de
 * quai, 90 = à la verticale au-dessus du conteneur.
 */
export const CAMERAS: CameraPreset[] = [
  { name: 'iso', label: 'Trois-quarts', yaw: -34, pitch: 20 },
  { name: 'top', label: 'Dessus', yaw: 0, pitch: 86 },
  { name: 'door', label: 'Portes', yaw: -88, pitch: 10 },
];
