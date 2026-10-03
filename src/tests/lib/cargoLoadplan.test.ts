// ============================================================
// Plan de chargement — le calcul qui dit si ça rentre.
//
// Ces règles se voient à l'écran en 3D, donc une erreur est visible ; mais
// elle est visible APRÈS coup, et un plan faux ferait dire « il reste de la
// place » alors que le conteneur est plein. On les fige donc ici.
// ============================================================
import { describe, it, expect } from 'vitest';
import { buildLoadPlan, containerDims, lotColor, MAX_DISTINCT_LOTS } from '@/lib/cargo/loadplan';
import type { CargoPackage } from '@/lib/cargo/model';

function pkg(over: Partial<CargoPackage> & { id: string }): CargoPackage {
  return {
    shipment_id: 's', label: 'Lot', kind: 'CARTON', qty: 1,
    length_cm: 100, width_cm: 100, height_cm: 100, weight_kg: 10,
    stackable: true, supplier: null, note: null, position: 0, created_by: null,
    created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
    ...over,
  } as unknown as CargoPackage;
}

describe('CHARGEMENT — les dimensions du conteneur', () => {
  it('connaît le 20 pieds, le 40 pieds et le 40 High Cube', () => {
    expect(containerDims('22G1').label).toBe("20' Dry");
    expect(containerDims('42G1').label).toBe("40' Dry");
    expect(containerDims('45G1').label).toBe("40' High Cube");
  });

  it('retombe sur le 40 High Cube quand le type est inconnu ou absent', () => {
    expect(containerDims(null).label).toBe("40' High Cube");
    expect(containerDims('ZZZZ').label).toBe("40' High Cube");
  });

  it('le High Cube est bien plus haut que le 40 pieds ordinaire', () => {
    expect(containerDims('45G1').height).toBeGreaterThan(containerDims('42G1').height);
  });
});

describe('CHARGEMENT — le rangement', () => {
  it('aligne les colis le long du conteneur avant d’ouvrir une nouvelle rangée', () => {
    // 4 colis de 200 cm dans 1203 cm : les 4 tiennent sur une seule rangée.
    const plan = buildLoadPlan('45G1', [pkg({ id: 'a', qty: 4, length_cm: 200, width_cm: 100, height_cm: 100 })]);
    expect(plan.boxes).toHaveLength(4);
    expect(plan.boxes.map((b) => b.x)).toEqual([0, 200, 400, 600]);
    expect(new Set(plan.boxes.map((b) => b.z)).size).toBe(1);
  });

  it('passe à la rangée suivante quand la longueur est épuisée', () => {
    const plan = buildLoadPlan('45G1', [pkg({ id: 'a', qty: 8, length_cm: 600, width_cm: 100, height_cm: 100 })]);
    // 2 par rangée (1200 sur 1203), donc 4 rangées… mais la largeur n'en tient
    // que 2 (2 × 100 sur 235), donc ça monte d'un étage.
    expect(plan.boxes.every((b) => b.x === 0 || b.x === 600)).toBe(true);
    expect(plan.layers).toBeGreaterThan(1);
  });

  it('empile quand la surface est pleine, et compte les étages', () => {
    const plan = buildLoadPlan('45G1', [pkg({ id: 'a', qty: 30, length_cm: 600, width_cm: 117, height_cm: 100 })]);
    expect(plan.layers).toBeGreaterThan(1);
    expect(new Set(plan.boxes.map((b) => b.y)).size).toBe(plan.layers);
  });

  it('ne dépasse jamais les parois ni le toit', () => {
    const d = containerDims('45G1');
    const plan = buildLoadPlan('45G1', [pkg({ id: 'a', qty: 400, length_cm: 60, width_cm: 40, height_cm: 40 })]);
    for (const b of plan.boxes) {
      expect(b.x + b.l).toBeLessThanOrEqual(d.length + 0.01);
      expect(b.z + b.w).toBeLessThanOrEqual(d.width + 0.01);
      expect(b.y + b.h).toBeLessThanOrEqual(d.height + 0.01);
    }
  });

  it('signale ce qui ne rentre pas plutôt que de le faire disparaître', () => {
    const plan = buildLoadPlan('45G1', [pkg({ id: 'a', qty: 1, length_cm: 1400, width_cm: 100, height_cm: 100 })]);
    expect(plan.boxes).toHaveLength(0);
    expect(plan.leftOut[0].why).toMatch(/plus grand/);
  });

  it('signale le débordement quand le conteneur est plein', () => {
    const plan = buildLoadPlan('22G1', [pkg({ id: 'a', qty: 10000, length_cm: 100, width_cm: 100, height_cm: 100 })]);
    expect(plan.leftOut.length).toBeGreaterThan(0);
    expect(plan.leftOut[0].why).toMatch(/plein/);
  });

  it('met les colis non gerbables au-dessus, jamais sous les autres', () => {
    const plan = buildLoadPlan('45G1', [
      pkg({ id: 'fragile', qty: 2, position: 0, stackable: false, length_cm: 600, width_cm: 117, height_cm: 100 }),
      pkg({ id: 'solide', qty: 2, position: 1, stackable: true, length_cm: 600, width_cm: 117, height_cm: 100 }),
    ]);
    const yFragile = Math.min(...plan.boxes.filter((b) => b.packageId === 'fragile').map((b) => b.y));
    const ySolide = Math.min(...plan.boxes.filter((b) => b.packageId === 'solide').map((b) => b.y));
    expect(yFragile).toBeGreaterThan(ySolide);
  });

  it('est déterministe : deux appels donnent exactement le même plan', () => {
    const lots = [pkg({ id: 'a', qty: 12, position: 0 }), pkg({ id: 'b', qty: 7, position: 1, length_cm: 80 })];
    expect(JSON.stringify(buildLoadPlan('45G1', lots))).toBe(JSON.stringify(buildLoadPlan('45G1', lots)));
  });
});

describe('CHARGEMENT — les compteurs', () => {
  it('calcule le volume occupé et la part du conteneur', () => {
    // 1 colis de 1 m³ dans un 40 HC de 76,3 m³.
    const plan = buildLoadPlan('45G1', [pkg({ id: 'a', qty: 1, length_cm: 100, width_cm: 100, height_cm: 100 })]);
    expect(plan.usedVolumeM3).toBeCloseTo(1, 3);
    expect(plan.containerVolumeM3).toBeCloseTo(76.35, 1);
    expect(plan.fill).toBeCloseTo(1 / 76.35, 3);
  });

  it('additionne le poids colis par colis, pas lot par lot', () => {
    const plan = buildLoadPlan('45G1', [pkg({ id: 'a', qty: 5, weight_kg: 20, length_cm: 100, width_cm: 100, height_cm: 100 })]);
    expect(plan.totalWeightKg).toBe(100);
  });

  it('laisse la charge dépasser 100 % — c’est une alerte, pas une barre pleine', () => {
    // Un 20 pieds n'accepte que 20 colis d'un mètre cube ; à 1,5 t pièce on
    // dépasse les 28,2 t admissibles bien avant d'avoir rempli le volume.
    const plan = buildLoadPlan('22G1', [pkg({ id: 'a', qty: 20, weight_kg: 1500, length_cm: 100, width_cm: 100, height_cm: 100 })]);
    expect(plan.weightFill).toBeGreaterThan(1);
  });

  it('donne la hauteur réellement atteinte, pour savoir si on paie du vide', () => {
    const plan = buildLoadPlan('45G1', [pkg({ id: 'a', qty: 2, length_cm: 1200, width_cm: 235, height_cm: 100 })]);
    expect(plan.stackHeight).toBe(200);
    expect(plan.stackHeight).toBeLessThan(containerDims('45G1').height);
  });

  it('un conteneur vide ne divise par rien', () => {
    const plan = buildLoadPlan('45G1', []);
    expect(plan.boxes).toHaveLength(0);
    expect(plan.layers).toBe(0);
    expect(plan.fill).toBe(0);
    expect(Number.isFinite(plan.weightFill)).toBe(true);
  });
});

describe('CHARGEMENT — les teintes des lots', () => {
  it('donne une teinte propre aux huit premiers lots', () => {
    const vues = new Set(Array.from({ length: MAX_DISTINCT_LOTS }, (_, i) => lotColor(i, false)));
    expect(vues.size).toBe(MAX_DISTINCT_LOTS);
  });

  it('regroupe les suivants sous une teinte neutre plutôt que d’en inventer', () => {
    expect(lotColor(MAX_DISTINCT_LOTS, false)).toBe(lotColor(MAX_DISTINCT_LOTS + 5, false));
  });

  it('a un jeu distinct en mode sombre', () => {
    expect(lotColor(0, true)).not.toBe(lotColor(0, false));
  });
});

/* ── Plan mixte : le vrai conteneur MIEU3611115 (3 véhicules + 11 lignes d'effets au volume) ── */
const MIEU = (): CargoPackage[] => {
  const veh = (id: string, label: string, L: number, W: number, H: number, cbm: number, position: number) =>
    pkg({ id, label, kind: 'VEHICLE', length_cm: L, width_cm: W, height_cm: H, cbm, position, weight_kg: null, stackable: false });
  const vol = (id: string, label: string, qty: number, cbm: number, position: number) =>
    pkg({ id, label, qty, cbm, position, length_cm: null, width_cm: null, height_cm: null, weight_kg: null });
  return [
    veh('yaris', 'Toyota Yaris', 375, 169.5, 154.5, 9.82, 1),
    veh('rav4', 'Toyota RAV4', 457, 184.5, 171.5, 14.081, 2),
    veh('haval', 'Haval H6', 464.9, 185.2, 171, 14.723, 3),
    vol('verres', 'Verres', 13, 4, 4), vol('clim', 'Climatiseur', 1, 0.25, 5), vol('chaises', 'Chaises', 5, 0.345, 6),
    vol('pieces', 'Pièces', 1, 0.245, 7), vol('lavelinge', 'Machine à laver', 1, 1.56, 8), vol('meuble', 'Meuble', 1, 2.5, 9),
    vol('etendoirs', 'Étendoirs', 50, 0.9, 10), vol('vetements', 'Vêtements', 1, 5.98, 11), vol('toles', 'Tôles', 7, 3.2, 12),
    vol('chaussures', 'Chaussures', 1, 0.94, 13), vol('hauts', 'Hauts', 1, 0.015, 14),
  ];
};

describe('CHARGEMENT — plan mixte (véhicules + volumes déclarés)', () => {
  it('loge les trois voitures : deux à plat, la troisième inclinée sur le capot de la voisine', () => {
    const plan = buildLoadPlan('45G1', MIEU());
    expect(plan.mode).toBe('mixed');
    expect(plan.vehicles.map((v) => v.packageId)).toEqual(['yaris', 'rav4', 'haval']);
    expect(plan.vehicles[0].angle).toBe(0);
    expect(plan.vehicles[1].angle).toBe(0);
    expect(plan.vehicles[2].angle).toBeGreaterThan(5);
    expect(plan.vehicles[2].angle).toBeLessThan(30);
    expect(plan.leftOut.filter((o) => o.label.startsWith('Haval'))).toHaveLength(0);
  });

  it('les effets remplissent la place restante, sans rien laisser dehors', () => {
    const plan = buildLoadPlan('45G1', MIEU());
    expect(plan.leftOut).toEqual([]);
    const lots = new Set(plan.boxes.map((b) => b.packageId));
    expect(lots.size).toBe(11);
    expect(plan.boxes.every((b) => b.estimated)).toBe(true);
    // Rien ne sort de la caisse.
    for (const b of plan.boxes) {
      expect(b.x + b.l).toBeLessThanOrEqual(plan.dims.length + 0.01);
      expect(b.y + b.h).toBeLessThanOrEqual(plan.dims.height + 0.01);
      expect(b.z + b.w).toBeLessThanOrEqual(plan.dims.width + 0.01);
    }
  });

  it('compte le volume déclaré de la packing list (58,56 m³ ≈ 77 % d’un 40 HC)', () => {
    const plan = buildLoadPlan('45G1', MIEU());
    expect(plan.usedVolumeM3).toBeCloseTo(58.559, 2);
    expect(plan.fill).toBeGreaterThan(0.75);
    expect(plan.fill).toBeLessThan(0.8);
  });

  it('reste dessinable : peu de blocs une fois les cubes fusionnés', () => {
    const plan = buildLoadPlan('45G1', MIEU());
    expect(plan.boxes.length).toBeLessThan(260);
  });

  it('un véhicule trop grand est dit, pas dessiné', () => {
    const plan = buildLoadPlan('22G1', [pkg({ id: 'bus', label: 'Bus', kind: 'VEHICLE', length_cm: 900, width_cm: 230, height_cm: 250 })]);
    expect(plan.vehicles).toHaveLength(0);
    expect(plan.leftOut[0].why).toMatch(/plus grand/);
  });

  it('reste déterministe', () => {
    expect(JSON.stringify(buildLoadPlan('45G1', MIEU()))).toBe(JSON.stringify(buildLoadPlan('45G1', MIEU())));
  });
});
