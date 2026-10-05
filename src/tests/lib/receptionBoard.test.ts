// La console Réception : la recherche, les files, les verrous et les photos
// d'un colis. Les verrous sont le miroir de `reception_parcel_locked` (SQL,
// migration 20261002100000) : l'écran dit « non » avant que la base ne le dise.
import { describe, expect, it } from 'vitest';
import {
  depositInQueue, depositMatches, labelPosition, parcelInQueue, parcelLockReason, parcelPhotoPaths, isParcelWaiting,
  type Deposit, type Parcel,
} from '@/lib/reception';

const parcel = (over: Partial<Parcel> = {}): Parcel => ({
  id: 'p1', seq: 1, parcel_no: 'RC-000123-01', kind: 'carton', weight_kg: 8.4, length_cm: 60, width_cm: 40, height_cm: 40, cbm: 0.096,
  description: 'Chaussures de sport', courier_waybill: 'SF1234567890', photo_path: 'd/a.jpg', status: 'received', shipment_id: null,
  created_at: '2026-09-20T08:00:00Z', ...over,
});

const deposit = (over: Partial<Deposit> = {}): Deposit => ({
  id: 'd1', deposit_no: 'RC-000123', location: 'warehouse', brought_by: 'courier', representative_name: null, representative_phone: null,
  status: 'closed', received_by: 'u1', received_by_name: 'Tina Bonzini', opened_at: '2026-09-20T08:00:00Z', closed_at: '2026-09-20T08:30:00Z',
  parcel_count: 1, total_weight_kg: 8.4, total_cbm: 0.096, notes: null, supplier_name: '广州鞋业',
  client: { user_id: 'c1', customer_code: 'BZ-482913', first_name: 'Blaise Honoré', last_name: 'Tchimogne', phone: '+237 690 12 34 56', email: null, company_name: null, city: 'Douala', country: 'CM' },
  parcels: [parcel()], ...over,
});

describe('parcelPhotoPaths', () => {
  it('toutes les photos, couverture en tête, quel que soit l’ordre reçu', () => {
    const p = parcel({ photos: [
      { id: 'b', path: 'd/b.jpg', position: 1, created_at: '' },
      { id: 'a', path: 'd/a.jpg', position: 0, created_at: '' },
    ] });
    expect(parcelPhotoPaths(p)).toEqual(['d/a.jpg', 'd/b.jpg']);
  });
  it('une donnée d’avant les photos multiples garde sa couverture', () => {
    expect(parcelPhotoPaths(parcel({ photos: undefined }))).toEqual(['d/a.jpg']);
    expect(parcelPhotoPaths(parcel({ photos: [], photo_path: null }))).toEqual([]);
  });
});

describe('parcelLockReason — miroir de reception_parcel_locked', () => {
  it('un colis qui attend se modifie', () => {
    expect(parcelLockReason(parcel())).toBeNull();
  });
  it('chargé (conteneur ou avion), pointé ou remis : verrouillé', () => {
    expect(parcelLockReason(parcel({ shipment_id: 's1' }))).toMatch(/conteneur/);
    expect(parcelLockReason(parcel({ air_shipment_id: 'a1' }))).toMatch(/LTA/);
    expect(parcelLockReason(parcel({ checked_in_at: '2026-10-01T00:00:00Z' }))).toMatch(/Douala/);
    expect(parcelLockReason(parcel({ release_id: 'r1' }))).toMatch(/Remis/);
  });
  it('emballé dans un paquet avion : verrouillé tant qu\'il n\'en est pas retiré', () => {
    expect(parcelLockReason(parcel({ air_package_id: 'k1', package_no: 'PQ-000041' }))).toBe('Dans le paquet PQ-000041 : retirez-le d\'abord du paquet');
  });
});

describe('isParcelWaiting', () => {
  it('reçu ou rangé, sans boîte : il attend ici', () => {
    expect(isParcelWaiting(parcel())).toBe(true);
    expect(isParcelWaiting(parcel({ status: 'stored' }))).toBe(true);
    expect(isParcelWaiting(parcel({ air_shipment_id: 'a1', status: 'loaded' }))).toBe(false);
  });
});

describe('depositMatches — la recherche de la console', () => {
  const d = deposit();
  it('par numéro de dépôt ou de colis, code client, bordereau', () => {
    expect(depositMatches(d, 'rc-000123')).toBe(true);
    expect(depositMatches(d, 'RC-000123-01')).toBe(true);
    expect(depositMatches(d, 'BZ-482913')).toBe(true);
    expect(depositMatches(d, 'sf1234567890')).toBe(true);
  });
  it('par nom (sans accents, dans n’importe quel ordre), contenu, fournisseur, réceptionnaire', () => {
    expect(depositMatches(d, 'tchimogne blaise')).toBe(true);
    expect(depositMatches(d, 'honore')).toBe(true);
    expect(depositMatches(d, 'chaussures')).toBe(true);
    expect(depositMatches(d, '鞋业')).toBe(true);
    expect(depositMatches(d, 'tina')).toBe(true);
  });
  it('par téléphone, avec ou sans espaces', () => {
    expect(depositMatches(d, '690123456')).toBe(true);
    expect(depositMatches(d, '690 12 34 56')).toBe(true);
  });
  it('tous les mots doivent se retrouver', () => {
    expect(depositMatches(d, 'chaussures riz')).toBe(false);
    expect(depositMatches(d, '')).toBe(true);
  });
});

describe('les files', () => {
  it('à attribuer, en cours : par l’état du dépôt', () => {
    expect(depositInQueue(deposit({ client: null }), 'pending')).toBe(true);
    expect(depositInQueue(deposit(), 'pending')).toBe(false);
    expect(depositInQueue(deposit({ status: 'open' }), 'open')).toBe(true);
  });
  it('incomplets, sans photo, chargés : un dépôt y est dès qu’un de ses colis y est', () => {
    const d = deposit({ parcels: [parcel(), parcel({ id: 'p2', seq: 2, weight_kg: null, photo_path: null, photos: [] })] });
    expect(depositInQueue(d, 'incomplete')).toBe(true);
    expect(depositInQueue(d, 'nophoto')).toBe(true);
    expect(depositInQueue(d, 'loaded')).toBe(false);
    expect(parcelInQueue(d.parcels[0], d, 'incomplete')).toBe(false);
    expect(parcelInQueue(d.parcels[1], d, 'incomplete')).toBe(true);
  });
});

describe('labelPosition — « 3 / 10 » sur l’étiquette', () => {
  it('le rang dans le dépôt, même après une suppression (RC-…-04 est le 3e carton)', () => {
    const ps = [parcel({ id: 'a', seq: 1 }), parcel({ id: 'b', seq: 2 }), parcel({ id: 'd', seq: 4 })];
    expect(labelPosition(ps, 'd')).toBe(3);
    expect(labelPosition(ps, 'a')).toBe(1);
  });
});
