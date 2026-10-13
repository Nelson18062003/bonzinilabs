import { describe, it, expect } from 'vitest';
import { defaultPackTarget, fitsInPackage, openPackagesByRoom, waitingCount, packRefusal, packRefusalLabel, packableGroups, packableParcels, packageClientGroups, planPacking, sealCheck, type AirPackageParcel, type PackableParcel } from '@/lib/airPackage';
import type { Deposit, Parcel, ReceptionClient } from '@/lib/reception';

const client = (id: string, code: string): ReceptionClient => ({ user_id: id, customer_code: code, first_name: 'A', last_name: code, phone: null, email: null, company_name: null, city: null, country: null } as ReceptionClient);
const A = client('u1', 'BZ-100001');
const B = client('u2', 'BZ-100002');

let n = 0;
const parcel = (o: Partial<Parcel> = {}): Parcel => ({
  id: `p${++n}`, seq: n, parcel_no: `RC-000100-${String(n).padStart(2, '0')}`, kind: 'carton', weight_kg: 5, length_cm: null, width_cm: null, height_cm: null, cbm: null,
  description: null, courier_waybill: null, photo_path: null, status: 'received', created_at: '2026-10-12T08:00:00Z', ...o,
});
const deposit = (o: Partial<Deposit> & { parcels: Parcel[] }): Deposit => ({
  id: `d${++n}`, deposit_no: `RC-0001${n}`, client: A, location: 'office', brought_by: 'client', representative_name: null, representative_phone: null,
  status: 'closed', received_by: 'r1', received_by_name: null, opened_at: '2026-10-12T08:00:00Z', closed_at: null, parcel_count: o.parcels.length, total_weight_kg: 0, total_cbm: 0, notes: null, ...o,
});

describe('Paquets avion — les colis du bureau à emballer', () => {
  it('mêmes règles que air_package_add_parcel : bureau, client, pesé, libre', () => {
    const ready = parcel({ parcel_no: 'RC-000200-01' });
    const noWeight = parcel({ weight_kg: null });
    const zero = parcel({ weight_kg: 0 });
    const packed = parcel({ air_package_id: 'k1', package_no: 'PQ-000001' });
    const loaded = parcel({ air_shipment_id: 'a1', status: 'loaded' });
    const checked = parcel({ checked_in_at: '2026-10-12T09:00:00Z' });
    const out = packableParcels([
      deposit({ parcels: [ready, noWeight, zero, packed, loaded, checked] }),
      deposit({ client: null, parcels: [parcel({ parcel_no: 'RC-000300-01' })] }),
      deposit({ location: 'warehouse', parcels: [parcel()] }),
      deposit({ status: 'cancelled', parcels: [parcel()] }),
    ]);
    expect(out.ready.map((x) => x.parcel.id)).toEqual([ready.id]);
    expect(out.blocked.map((x) => x.reason).sort()).toEqual(['no_client', 'no_weight', 'no_weight']);
    // Déjà dans un paquet : ni prêt, ni à corriger.
    expect([...out.ready, ...out.blocked].some((x) => x.parcel.id === packed.id)).toBe(false);
  });

  it('un colis de plus de 32 kg ne tiendra dans aucun paquet : à corriger, pas « à emballer »', () => {
    const out = packableParcels([deposit({ parcels: [parcel({ weight_kg: 32 }), parcel({ weight_kg: 32.4 })] })]);
    expect(out.ready.map((x) => x.parcel.weight_kg)).toEqual([32]);
    expect(out.blocked.map((x) => x.reason)).toEqual(['too_heavy']);
  });

  it('les clients déjà dans le paquet passent en tête, puis par code', () => {
    const items = packableParcels([
      deposit({ client: B, parcels: [parcel({ weight_kg: 3 }), parcel({ weight_kg: 4.5 })] }),
      deposit({ client: A, parcels: [parcel({ weight_kg: 2 })] }),
    ]).ready;
    expect(packableGroups(items).map((g) => g.client?.customer_code)).toEqual(['BZ-100001', 'BZ-100002']);
    const first = packableGroups(items, new Set(['u2']));
    expect(first.map((g) => [g.client?.customer_code, g.inPackage, g.kg])).toEqual([['BZ-100002', true, 7.5], ['BZ-100001', false, 2]]);
  });

  it('regroupe les colis d’un paquet par client, dans l’ordre du serveur', () => {
    const pp = (id: string, c: ReceptionClient | null, kg: number) => ({ id, weight_kg: kg, client: c } as AirPackageParcel);
    const groups = packageClientGroups([pp('1', A, 8), pp('2', B, 4), pp('3', A, 2.5), pp('4', null, 1)]);
    expect(groups.map((g) => [g.key, g.parcels.length, g.kg])).toEqual([['u1', 2, 10.5], ['u2', 1, 4], ['—', 1, 1]]);
    expect(packageClientGroups(null)).toEqual([]);
  });
});

describe('Paquets avion — 32 kg et pesée', () => {
  const pkg = { net_weight_kg: 27.9, max_weight_kg: 32 };

  it('un colis tient s’il ne dépasse pas 32 kg, au gramme près', () => {
    expect(fitsInPackage(pkg, 4.1)).toBe(true);
    expect(fitsInPackage(pkg, 4.2)).toBe(false);
    // 0,1 + 0,2 ne fait pas 0,30000000000000004 kg de trop.
    expect(fitsInPackage({ net_weight_kg: 31.7, max_weight_kg: 32 }, 0.3)).toBe(true);
  });

  it('contrôle la pesée comme air_package_seal', () => {
    const none = ['', '', ''] as const;
    expect(sealCheck('', none, pkg)).toMatchObject({ grossError: null, valid: false, input: null });
    expect(sealCheck('0', none, pkg).grossError).toBe('required');
    expect(sealCheck('32,5', none, pkg).grossError).toBe('over');
    expect(sealCheck('27', none, pkg).grossError).toBe('under');
    expect(sealCheck('27,5', none, pkg)).toMatchObject({ grossError: null, valid: true, input: { grossWeightKg: 27.5, lengthCm: null, widthCm: null, heightCm: null } });
    // Arrondi AVANT le contrôle : 32,004 kg part comme 32 kg.
    expect(sealCheck('32,004', none, pkg).input?.grossWeightKg).toBe(32);
    // La tolérance de 0,5 kg tout juste, sans erreur d'arrondi (8,3 − 0,5 = 7,800000000000001 en flottant).
    expect(sealCheck('7,8', none, { net_weight_kg: 8.3, max_weight_kg: 32 }).grossError).toBeNull();
    expect(sealCheck('0,6', none, { net_weight_kg: 1.1, max_weight_kg: 32 }).grossError).toBeNull();
    expect(sealCheck('7,79', none, { net_weight_kg: 8.3, max_weight_kg: 32 }).grossError).toBe('under');
  });

  it('dimensions facultatives, entre 0 et 400 cm, au millimètre', () => {
    expect(sealCheck('28', ['60', '40,25', '40'], { net_weight_kg: 27.9, max_weight_kg: 32 }).input).toMatchObject({ lengthCm: 60, widthCm: 40.3, heightCm: 40 });
    expect(sealCheck('28', ['401', '', ''], pkg).dimsError).toBe('invalid');
    // 0,04 cm s'arrondit à 0 : refusé ici plutôt que par le serveur.
    expect(sealCheck('28', ['0,04', '', ''], pkg).dimsError).toBe('invalid');
    expect(sealCheck('28', ['abc', '', ''], pkg).valid).toBe(false);
  });
});

describe('Paquets avion — pourquoi un colis n’entre pas', () => {
  it('donne la raison, dans l’ordre utile à l’écran', () => {
    const d = (o: Partial<Deposit> = {}) => deposit({ parcels: [], ...o });
    expect(packRefusal(parcel(), d())).toBeNull();
    expect(packRefusal(parcel(), d({ status: 'cancelled' }))).toBe('cancelled');
    expect(packRefusal(parcel(), d({ location: 'warehouse' }))).toBe('sea');
    expect(packRefusal(parcel({ air_package_id: 'k1', package_no: 'PQ-000045' }), d())).toBe('packed');
    expect(packRefusal(parcel({ shipment_id: 's1', status: 'loaded' }), d())).toBe('gone');
    expect(packRefusal(parcel(), d({ client: null }))).toBe('no_client');
    expect(packRefusal(parcel({ weight_kg: null }), d())).toBe('no_weight');
    expect(packRefusal(parcel({ weight_kg: 40 }), d())).toBe('too_heavy');
    expect(packRefusalLabel('packed', { package_no: 'PQ-000045' })).toBe('déjà dans PQ-000045');
    expect(packRefusalLabel('sea')).toMatch(/bateau/);
  });
});

describe('Paquets avion — répartir en paquets de 32 kg', () => {
  const item = (c: ReceptionClient, kg: number): PackableParcel => ({ parcel: parcel({ weight_kg: kg }), deposit: deposit({ client: c, parcels: [] }) });
  const C = client('u3', 'BZ-100003');
  const kgs = (bins: ReturnType<typeof planPacking>) => bins.map((b) => Math.round(b.kg * 10) / 10);

  it('un seul paquet quand tout tient', () => {
    const bins = planPacking([item(A, 8), item(B, 10), item(A, 6)]);
    expect(bins).toHaveLength(1);
    expect(bins[0]).toMatchObject({ packageId: null, kg: 24 });
  });

  it('jamais plus de 32 kg, et le moins de paquets possible', () => {
    const bins = planPacking([item(A, 20), item(A, 15), item(B, 12), item(B, 10), item(C, 5)]);
    expect(bins.every((b) => b.kg <= 32)).toBe(true);
    expect(bins).toHaveLength(2); // 62 kg : deux paquets suffisent
    expect(bins.flatMap((b) => b.items)).toHaveLength(5);
  });

  it('garde les colis d’un client ensemble quand cela ne coûte pas de paquet', () => {
    const bins = planPacking([item(A, 10), item(B, 9), item(A, 8), item(B, 7)]);
    expect(bins).toHaveLength(2);
    for (const b of bins) expect(new Set(b.items.map((i) => i.deposit.client?.user_id)).size).toBe(1);
  });

  it('complète d’abord le paquet en cours, le reste part dans un nouveau', () => {
    const into = { id: 'k45', package_no: 'PQ-000045', net_weight_kg: 27.4, max_weight_kg: 32 };
    const bins = planPacking([item(A, 4), item(B, 9.2)], into);
    expect(bins[0]).toMatchObject({ packageId: 'k45', packageNo: 'PQ-000045' });
    expect(kgs(bins)).toEqual([31.4, 9.2]);
    // Rien ne tient : le paquet en cours reste affiché, vide de nouveaux colis.
    const none = planPacking([item(A, 9.2)], into);
    expect(none.map((b) => [b.packageId, b.items.length])).toEqual([['k45', 0], [null, 1]]);
  });

  it('le paquet en cours se remplit d’abord, même quand un client devrait être coupé', () => {
    const into = { id: 'k1', package_no: 'PQ-000001', net_weight_kg: 17, max_weight_kg: 32 };
    const bins = planPacking([item(A, 10), item(A, 10)], into);
    expect(bins.map((b) => [b.packageId, b.items.length, b.kg])).toEqual([['k1', 1, 27], [null, 1, 10]]);
  });

  it('au hasard : jamais plus de 32 kg, aucun colis perdu ni doublé', () => {
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let run = 0; run < 300; run += 1) {
      const its = Array.from({ length: 1 + Math.floor(rnd() * 14) }, () => item([A, B, C][Math.floor(rnd() * 3)], Math.round((0.5 + rnd() * 31) * 10) / 10));
      const into = rnd() < 0.5 ? { id: 'kx', package_no: 'PQ-000009', net_weight_kg: Math.round(rnd() * 300) / 10, max_weight_kg: 32 } : null;
      const bins = planPacking(its, into);
      expect(bins.every((b) => Math.round(b.kg * 1000) <= 32000)).toBe(true);
      const ids = bins.flatMap((b) => b.items.map((i) => i.parcel.id));
      expect(new Set(ids).size).toBe(its.length);
      expect(ids).toHaveLength(its.length);
      if (into) expect(bins[0].packageId).toBe('kx');
    }
  });
});

describe('Paquets avion — le paquet proposé d’office', () => {
  const pkg = (id: string, net: number, status: 'open' | 'sealed' = 'open') => ({ id, status, net_weight_kg: net, max_weight_kg: 32 });
  const items = (...kgs: number[]): PackableParcel[] => kgs.map((kg) => ({ parcel: parcel({ weight_kg: kg }), deposit: deposit({ parcels: [] }) }));

  it('les paquets en cours seulement, le plus de place d’abord', () => {
    const out = openPackagesByRoom([pkg('a', 20), pkg('b', 5), pkg('c', 0, 'sealed'), pkg('d', 31)]);
    expect(out.map((k) => k.id)).toEqual(['b', 'a', 'd']);
  });

  it('on finit le carton entamé : le paquet en cours qui a le plus de place, si un colis y tient', () => {
    expect(defaultPackTarget([pkg('a', 20), pkg('b', 5)], items(6, 30))?.id).toBe('b');
    // Seul le paquet le plus vide peut prendre le colis le plus léger : c'est lui.
    expect(defaultPackTarget([pkg('a', 28), pkg('b', 25)], items(6))?.id).toBe('b');
  });

  it('aucun colis ne tient, aucun paquet en cours, ou rien à emballer : un nouveau paquet', () => {
    expect(defaultPackTarget([pkg('a', 30), pkg('b', 29)], items(4, 5))).toBeNull();
    expect(defaultPackTarget([pkg('a', 0, 'sealed')], items(4))).toBeNull();
    expect(defaultPackTarget([pkg('a', 10)], [])).toBeNull();
  });

  it('au gramme près, comme le serveur : 31,9 + 0,1 tient', () => {
    expect(defaultPackTarget([pkg('a', 31.9)], items(0.1))?.id).toBe('a');
    expect(defaultPackTarget([pkg('a', 31.9)], items(0.101))).toBeNull();
  });
});

describe('Paquets avion — ce qui attend, pour les compteurs', () => {
  it('un dépôt en cours de saisie : ses colis attendent qu’il soit terminé (un colis emballé ne se corrige plus)', () => {
    const p = parcel({ weight_kg: 4 });
    expect(packRefusal(p, { status: 'open', location: 'office', client: A })).toBe('deposit_open');
    const out = packableParcels([deposit({ status: 'open', parcels: [p] })]);
    expect(out.ready).toEqual([]);
    expect(out.blocked.map((b) => b.reason)).toEqual(['deposit_open']);
  });

  it('les compteurs : prêts + à compléter ; un colis de plus de 32 kg part seul et ne compte pas', () => {
    const out = packableParcels([
      deposit({ parcels: [parcel({ weight_kg: 5 }), parcel({ weight_kg: 40 }), parcel({ weight_kg: null })] }),
      deposit({ client: null, parcels: [parcel({ weight_kg: 3 })] }),
    ]);
    expect(waitingCount(out)).toEqual({ ready: 1, toFix: 2, total: 3 });
  });
});
