import { describe, it, expect } from 'vitest';
import { fitsInPackage, packableGroups, packableParcels, packageClientGroups, sealCheck, type AirPackageParcel } from '@/lib/airPackage';
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
