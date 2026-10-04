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
  /** Bloc dessiné d'après le VOLUME déclaré (cotes inconnues) : la forme n'est pas celle des colis. */
  estimated?: boolean;
}

/**
 * Un véhicule posé : sa silhouette (caisse basse + habitacle) dans un repère
 * qui part de l'ARRIÈRE-BAS-GAUCHE du véhicule, l'axe local s allant vers
 * l'avant. Posé à plat (angle 0) ou incliné, l'avant levé.
 *   monde = pivot + s·u + t·n,  u = (facing·cos θ, sin θ),  n = (−facing·sin θ, cos θ)
 */
export interface PlacedVehicle {
  id: string;
  packageId: string;
  label: string;
  /** Rang du lot (teinte). */
  lot: number;
  /** Coin arrière-bas, en cm : x le long du conteneur, y la hauteur, z la largeur. */
  px: number; py: number; z: number;
  length: number; width: number; height: number;
  /** Inclinaison en degrés (0 = à plat), l'avant levé. */
  angle: number;
  /** +1 : l'avant regarde le fond du conteneur (x croissant) ; −1 : vers l'avant (x décroissant). */
  facing: 1 | -1;
  /** Les deux volumes de la silhouette, en coordonnées locales (s le long du véhicule, t la hauteur). */
  parts: { s0: number; s1: number; t1: number }[];
  weightKg: number | null;
}

export interface LoadPlan {
  /** `shelf` : cartons de cotes connues, rangés par étagères. `mixed` : véhicules + volumes déclarés. */
  mode: 'shelf' | 'mixed';
  vehicles: PlacedVehicle[];
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
function buildShelfPlan(iso: string | null | undefined, packages: CargoPackage[]): LoadPlan {
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
    mode: 'shelf',
    vehicles: [],
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

/* ── Plan MIXTE : véhicules + volumes déclarés ──────────────────────────────
 *
 * Un groupage réel (MIEU3611115) mêle des VÉHICULES et des colis dont la
 * packing list ne donne que le volume (« vêtements, 1 colis, 5,98 CBM »).
 * Le rangement par étagères ne sait pas faire : trois voitures bout à bout
 * font 13 m pour 12 m de conteneur, et la troisième « ne tenait pas ».
 *
 * 1. VÉHICULES — une silhouette, pas une boîte : caisse basse sur toute la
 *    longueur (52 % de la hauteur) et habitacle (de 8 % à 72 % de la
 *    longueur en partant de l'arrière, toute la hauteur). On les pose à plat
 *    contre la paroi côté spectateur (on les voit en premier), du fond vers
 *    les portes, capot vers le suivant. Quand
 *    le suivant ne tient plus à plat, on le cherche INCLINÉ, l'avant levé
 *    au-dessus du capot du précédent — ce que fait un entrepôt pour loger
 *    trois voitures dans un 40 pieds. Collision testée en vue de côté
 *    (rectangles orientés, axes séparateurs).
 * 2. LE RESTE — la place libre est découpée en cubes de 15 cm ; chaque lot
 *    en occupe autant que son volume déclaré : d'abord le long de la paroi
 *    opposée aux véhicules, du fond vers les portes, du sol vers le plafond,
 *    puis par-dessus les véhicules. On ne connaît pas la forme des colis : on dessine
 *    un VOLUME, marqué « estimé ».
 */

const CELL = 15; // cm
const CELL_M3 = (CELL * CELL * CELL) / 1_000_000;
const VEHICLE_GAP = 5;
const BODY_RATIO = 0.52;
const CABIN = { s0: 0.08, s1: 0.72 };

type Pt = [number, number];

function vehicleParts(L: number, H: number): PlacedVehicle['parts'] {
  return [
    { s0: 0, s1: L, t1: BODY_RATIO * H },
    { s0: CABIN.s0 * L, s1: CABIN.s1 * L, t1: H },
  ];
}

function axes(angleDeg: number, facing: 1 | -1) {
  const a = (angleDeg * Math.PI) / 180;
  return { ux: facing * Math.cos(a), uy: Math.sin(a), nx: -facing * Math.sin(a), ny: Math.cos(a) };
}

/** Les rectangles (vue de côté) d'un véhicule posé, en coordonnées conteneur. */
function sidePolys(v: Pick<PlacedVehicle, 'px' | 'py' | 'angle' | 'facing' | 'parts'>): Pt[][] {
  const { ux, uy, nx, ny } = axes(v.angle, v.facing);
  return v.parts.map(({ s0, s1, t1 }) =>
    ([[s0, 0], [s1, 0], [s1, t1], [s0, t1]] as Pt[]).map(([sv, tv]) => [v.px + sv * ux + tv * nx, v.py + sv * uy + tv * ny] as Pt),
  );
}

/** Deux polygones convexes se chevauchent-ils ? (théorème des axes séparateurs) */
function overlaps(A: Pt[], B: Pt[]): boolean {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i += 1) {
      const [x1, y1] = P[i];
      const [x2, y2] = P[(i + 1) % P.length];
      const ax = -(y2 - y1);
      const ay = x2 - x1;
      const pa = A.map(([x, y]) => ax * x + ay * y);
      const pb = B.map(([x, y]) => ax * x + ay * y);
      if (Math.max(...pa) <= Math.min(...pb) + 1e-6 || Math.max(...pb) <= Math.min(...pa) + 1e-6) return false;
    }
  }
  return true;
}

const zOverlap = (a: { z: number; width: number }, b: { z: number; width: number }) => a.z < b.z + b.width && b.z < a.z + a.width;

/** Volume d'un lot, en m³ : le volume déclaré s'il existe, sinon les cotes × quantité. */
export function lotVolumeM3(p: Pick<CargoPackage, 'cbm' | 'qty' | 'length_cm' | 'width_cm' | 'height_cm' | 'kind'>): number {
  if (p.length_cm != null && p.width_cm != null && p.height_cm != null) {
    const unit = m3(Number(p.length_cm), Number(p.width_cm), Number(p.height_cm));
    // Un véhicule déclaré au volume de la packing list : on garde ce chiffre (c'est celui de la douane).
    if (p.cbm != null && p.kind === 'VEHICLE') return Number(p.cbm);
    return unit * p.qty;
  }
  return p.cbm != null ? Number(p.cbm) : 0;
}

export function isVehicle(p: Pick<CargoPackage, 'kind'>): boolean {
  return p.kind === 'VEHICLE';
}

function buildMixedPlan(iso: string | null | undefined, packages: CargoPackage[]): LoadPlan {
  const spec = containerDims(iso);
  const dims: BoxDims = { length: spec.length, width: spec.width, height: spec.height };
  const leftOut: LoadPlan['leftOut'] = [];
  const ordered = [...packages].sort((a, b) => (a.position !== b.position ? a.position - b.position : a.created_at.localeCompare(b.created_at)));
  const lotIndex = new Map(ordered.map((p, i) => [p.id, i]));
  const inside = (polys: Pt[][]) => polys.every((P) => P.every(([x, y]) => x >= -0.01 && x <= dims.length + 0.01 && y >= -0.01 && y <= dims.height + 0.01));

  // 1) Les véhicules.
  const vehicles: PlacedVehicle[] = [];
  let cursor = 0;
  for (const p of ordered.filter(isVehicle)) {
    if (p.length_cm == null || p.width_cm == null || p.height_cm == null) {
      leftOut.push({ label: p.label, qty: p.qty, why: 'véhicule sans dimensions' });
      continue;
    }
    const L = Number(p.length_cm);
    const W = Number(p.width_cm);
    const H = Number(p.height_cm);
    const parts = vehicleParts(L, H);
    for (let unit = 0; unit < p.qty; unit += 1) {
      const base = { id: `${p.id}-${unit}`, packageId: p.id, label: p.label, lot: lotIndex.get(p.id) ?? 0, z: Math.max(0, dims.width - W), length: L, width: W, height: H, parts, weightKg: p.weight_kg == null ? null : Number(p.weight_kg) };
      if (W > dims.width || H > dims.height || L > dims.length) {
        leftOut.push({ label: p.label, qty: 1, why: 'plus grand que le conteneur' });
        continue;
      }
      const clash = (cand: PlacedVehicle) => {
        const mine = sidePolys(cand);
        return vehicles.some((o) => zOverlap(cand, o) && sidePolys(o).some((Q) => mine.some((P) => overlaps(P, Q))));
      };
      // À plat d'abord, contre la paroi, capot vers le suivant.
      if (cursor + L <= dims.length + 0.01) {
        const flat: PlacedVehicle = { ...base, px: cursor, py: 0, angle: 0, facing: 1 };
        if (!clash(flat)) {
          vehicles.push(flat);
          cursor += L + VEHICLE_GAP;
          continue;
        }
      }
      // Sinon incliné, l'avant levé vers le véhicule précédent : le plus petit angle qui passe.
      let placed: PlacedVehicle | null = null;
      for (let a10 = 10; a10 <= 350 && !placed; a10 += 5) {
        for (let xr = dims.length; xr >= dims.length - 160; xr -= 2) {
          const cand: PlacedVehicle = { ...base, px: xr, py: 0, angle: a10 / 10, facing: -1 };
          if (inside(sidePolys(cand)) && !clash(cand)) { placed = cand; break; }
        }
      }
      if (placed) vehicles.push(placed);
      else leftOut.push({ label: p.label, qty: 1, why: 'ne tient pas, même incliné' });
    }
  }

  // 2) La place libre, en cubes de 15 cm.
  const nx = Math.floor(dims.length / CELL);
  const ny = Math.floor(dims.height / CELL);
  const nz = Math.floor(dims.width / CELL);
  const FREE = -1;
  const BLOCKED = -2;
  const grid = new Int16Array(nx * ny * nz).fill(FREE);
  const at = (ix: number, iy: number, iz: number) => (ix * ny + iy) * nz + iz;
  for (const v of vehicles) {
    const { ux, uy, nx: nnx, ny: nny } = axes(v.angle, v.facing);
    const izs = Math.max(0, Math.floor(v.z / CELL));
    const ize = Math.min(nz - 1, Math.ceil((v.z + v.width) / CELL) - 1);
    for (let ix = 0; ix < nx; ix += 1) {
      for (let iy = 0; iy < ny; iy += 1) {
        const dx = (ix + 0.5) * CELL - v.px;
        const dy = (iy + 0.5) * CELL - v.py;
        const sv = dx * ux + dy * uy;
        const tv = dx * nnx + dy * nny;
        // Un cube est pris dès qu'il touche la silhouette (marge d'un demi-cube).
        const hit = v.parts.some((pt) => sv >= pt.s0 - CELL / 2 && sv <= pt.s1 + CELL / 2 && tv >= -CELL / 2 && tv <= pt.t1 + CELL / 2);
        if (!hit) continue;
        for (let iz = izs; iz <= ize; iz += 1) grid[at(ix, iy, iz)] = BLOCKED;
      }
    }
  }

  // 3) Les lots sans véhicule. D'abord la bande libre le long de la paroi
  //    opposée aux véhicules, puis le reste (au-dessus, autour) ; dans chaque
  //    phase, du fond vers les portes (x), du sol au plafond (y), puis en
  //    largeur (z). Chaque lot forme ainsi un bloc lisible le long du mur.
  const total = nx * ny * nz;
  const vehicleZ = vehicles.length ? Math.min(...vehicles.map((v) => v.z)) : dims.width;
  const stripCells = Math.max(0, Math.floor(vehicleZ / CELL));
  const fillOrder: number[] = [];
  for (const [z0, z1] of [[0, stripCells], [stripCells, nz]] as const) {
    for (let ix = 0; ix < nx; ix += 1) for (let iy = 0; iy < ny; iy += 1) for (let iz = z0; iz < z1; iz += 1) fillOrder.push(at(ix, iy, iz));
  }
  let cursorCell = 0;
  const others = ordered.filter((p) => !isVehicle(p));
  for (const p of others) {
    const vol = lotVolumeM3(p);
    let need = Math.ceil(vol / CELL_M3 - 1e-9);
    const lot = lotIndex.get(p.id) ?? 0;
    while (need > 0 && cursorCell < total) {
      const c = fillOrder[cursorCell];
      if (grid[c] === FREE) { grid[c] = lot; need -= 1; }
      cursorCell += 1;
    }
    if (need > 0) leftOut.push({ label: p.label, qty: p.qty, why: `il manque la place pour ${(need * CELL_M3).toFixed(2).replace('.', ',')} m³` });
  }

  // 4) Des cubes aux blocs (fusion gloutonne), pour garder la scène légère.
  const boxes: PlacedBox[] = [];
  const seen = new Uint8Array(total);
  const byLot = new Map(ordered.map((p, i) => [i, p]));
  for (let ix = 0; ix < nx; ix += 1) {
    for (let iy = 0; iy < ny; iy += 1) {
      for (let iz = 0; iz < nz; iz += 1) {
        const k = grid[at(ix, iy, iz)];
        if (k < 0 || seen[at(ix, iy, iz)]) continue;
        const same = (a: number, b: number, c: number) => grid[at(a, b, c)] === k && !seen[at(a, b, c)];
        let dz = 1;
        while (iz + dz < nz && same(ix, iy, iz + dz)) dz += 1;
        let dy = 1;
        rows: while (iy + dy < ny) {
          for (let c = iz; c < iz + dz; c += 1) if (!same(ix, iy + dy, c)) break rows;
          dy += 1;
        }
        let dxx = 1;
        slabs: while (ix + dxx < nx) {
          for (let b = iy; b < iy + dy; b += 1) for (let c = iz; c < iz + dz; c += 1) if (!same(ix + dxx, b, c)) break slabs;
          dxx += 1;
        }
        for (let a = ix; a < ix + dxx; a += 1) for (let b = iy; b < iy + dy; b += 1) for (let c = iz; c < iz + dz; c += 1) seen[at(a, b, c)] = 1;
        const p = byLot.get(k)!;
        boxes.push({
          id: `${p.id}-${boxes.length}`, packageId: p.id, label: p.label, lot: k,
          x: ix * CELL, y: iy * CELL, z: iz * CELL, l: dxx * CELL, w: dz * CELL, h: dy * CELL,
          layer: Math.floor((iy * CELL) / 60), weightKg: null, estimated: true,
        });
      }
    }
  }

  const usedVolumeM3 = ordered.reduce((sum, p) => sum + lotVolumeM3(p), 0);
  const containerVolumeM3 = m3(dims.length, dims.width, dims.height);
  const totalWeightKg = ordered.reduce((sum, p) => sum + (p.weight_kg == null ? 0 : Number(p.weight_kg) * p.qty), 0);
  const topVehicle = vehicles.reduce((mx, v) => Math.max(mx, ...sidePolys(v).flat().map(([, y]) => y)), 0);
  const stackHeight = Math.max(topVehicle, boxes.reduce((mx, b) => Math.max(mx, b.y + b.h), 0));
  const layers = boxes.length ? Math.max(...boxes.map((b) => b.layer)) + 1 : 0;

  return {
    mode: 'mixed',
    vehicles,
    dims,
    isoLabel: spec.label,
    boxes,
    leftOut,
    layers,
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
 * Le plan d'un conteneur. Des cartons aux cotes connues : rangement par
 * étagères, colis par colis. Dès qu'il y a un véhicule ou un lot connu
 * seulement par son volume : plan mixte (silhouettes + volumes).
 */
export function buildLoadPlan(iso: string | null | undefined, packages: CargoPackage[]): LoadPlan {
  const mixed = packages.some((p) => isVehicle(p) || p.length_cm == null || p.width_cm == null || p.height_cm == null);
  return mixed ? buildMixedPlan(iso, packages) : buildShelfPlan(iso, packages);
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

/**
 * Teintes des VÉHICULES : des tons de carrosserie (argent, graphite, sable…),
 * à part des huit teintes de lots — sinon trois voitures prennent trois des
 * huit couleurs et les effets personnels finissent tous en gris.
 */
export const VEHICLE_HUES_LIGHT = ['#a7b0bb', '#5f6b7a', '#c2a67e', '#7e8f6a'];
export const VEHICLE_HUES_DARK = ['#8d97a3', '#4c5765', '#a98d66', '#6a7a58'];

/** La teinte de chaque lot, par identifiant : la même dans la 3D, le tableau et la légende. */
export function lotColorMap(packages: Pick<CargoPackage, 'id' | 'kind'>[], dark: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  let v = 0;
  let g = 0;
  for (const p of packages) {
    if (p.kind === 'VEHICLE') {
      const hues = dark ? VEHICLE_HUES_DARK : VEHICLE_HUES_LIGHT;
      out[p.id] = hues[v % hues.length];
      v += 1;
    } else {
      out[p.id] = lotColor(g, dark);
      g += 1;
    }
  }
  return out;
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
