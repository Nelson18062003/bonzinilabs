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
