// La table statut → libellé d'un colis est unique (parcelStage) : la fiche
// client, le dépôt, le dossier Cargo et le panneau desktop la partagent.
// Elle suit le trigger SQL `parcels_follow_shipment` : chargé → en mer →
// arrivé → livré, avec le numéro de la boîte.
import { describe, expect, it } from 'vitest';
import { depositStage, parcelStage, type Parcel } from '@/lib/reception';

const base: Parcel = {
  id: 'p1', seq: 1, parcel_no: 'RC-000123-01', kind: 'carton', weight_kg: 8.4, length_cm: 60, width_cm: 40, height_cm: 40, cbm: 0.096,
  description: 'Chaussures', courier_waybill: null, photo_path: 'x.jpg', status: 'received', shipment_id: null, container_number: null, created_at: '2026-09-20T08:00:00Z',
};

describe('parcelStage', () => {
  it("un colis reçu, complet, attend à l'entrepôt", () => {
    expect(parcelStage(base)).toEqual({ tone: 'success', label: "À l'entrepôt", inBox: false });
  });
  it('un colis sans poids ou sans photo est incomplet', () => {
    expect(parcelStage({ ...base, weight_kg: null }).label).toBe('Incomplet');
    expect(parcelStage({ ...base, photo_path: null }).tone).toBe('pending');
  });
  it('suit la boîte : chargé, en mer, arrivé, livré — avec son numéro', () => {
    const inBox = { ...base, shipment_id: 'ct1', container_number: 'MSKU 482913-7' };
    expect(parcelStage({ ...inBox, status: 'loaded' })).toEqual({ tone: 'info', label: 'Chargé · MSKU 482913-7', inBox: true });
    expect(parcelStage({ ...inBox, status: 'shipped' }).label).toBe('En mer · MSKU 482913-7');
    expect(parcelStage({ ...inBox, status: 'arrived' })).toMatchObject({ tone: 'pending', label: 'Arrivé · MSKU 482913-7' });
    expect(parcelStage({ ...inBox, status: 'delivered' })).toMatchObject({ tone: 'success', label: 'Livré · MSKU 482913-7' });
  });
  it("une boîte sans numéro connu s'appelle « boîte »", () => {
    expect(parcelStage({ ...base, status: 'loaded', shipment_id: 'ct1' }).label).toBe('Chargé · boîte');
  });
});

describe('depositStage', () => {
  const inBox = { ...base, status: 'shipped' as const, shipment_id: 'ct1', container_number: 'MSKU 482913-7' };
  it("tout à l'entrepôt", () => {
    expect(depositStage([base, { ...base, id: 'p2' }])).toEqual({ tone: 'success', label: "À l'entrepôt" });
  });
  it('en partie chargé : le compte', () => {
    expect(depositStage([base, inBox, { ...inBox, id: 'p3' }])).toEqual({ tone: 'info', label: '2/3 chargés' });
  });
  it("tout dans la boîte : l'état de la boîte", () => {
    expect(depositStage([inBox, { ...inBox, id: 'p2' }])).toEqual({ tone: 'info', label: 'En mer · MSKU 482913-7' });
  });
  it('un dépôt vide', () => {
    expect(depositStage([])).toEqual({ tone: 'neutral', label: 'Vide' });
  });
});
