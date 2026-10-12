// Les documents cargo du client (12/10/2026) : le bon de réception et devis
// (« si on a mis les prix, tu les affiches ; sinon non »), le relevé des colis
// (« quels sont tous mes colis chez vous ? ») et la facture à l'arrivée.
import { describe, expect, it } from 'vitest';
import { blankQuoteFromDeposit, receptionDocData, receptionPhotoPaths } from '@/lib/receptionDoc';
import { buildClientStatement, statementStage } from '@/lib/clientStatement';
import { invoiceAcquitted, invoiceReadiness, parcelsAllArrived, type Quote, type QuoteLine } from '@/lib/cargoQuote';
import type { Deposit, Parcel } from '@/lib/reception';
import type { PdfPhoto } from '@/lib/pdf/pdfPhotos';

const client = { user_id: 'u1', customer_code: 'BZ-482913', first_name: 'Aïcha', last_name: 'Mbarga', phone: null, email: null, company_name: null, city: 'Douala', country: 'Cameroun' };

const parcel = (seq: number, over: Partial<Parcel> = {}): Parcel => ({
  id: `p${seq}`, seq, parcel_no: `RC-000122-${String(seq).padStart(2, '0')}`, kind: 'carton', weight_kg: 8.4, length_cm: 60, width_cm: 40, height_cm: 40, cbm: 0.096,
  description: 'Chaussures', courier_waybill: null, photo_path: null, photos: [], status: 'received', created_at: '2026-09-20T06:00:00Z', ...over,
});

const deposit = (over: Partial<Deposit> = {}): Deposit => ({
  id: 'dep2', deposit_no: 'RC-000122', client, location: 'warehouse', brought_by: 'client', representative_name: null, representative_phone: null,
  status: 'closed', received_by: 'r1', received_by_name: 'Kevin', opened_at: '2026-09-20T06:00:00Z', closed_at: '2026-09-20T06:30:00Z',
  parcel_count: 2, total_weight_kg: 16.8, total_cbm: 0.192, notes: null,
  parcels: [parcel(1), parcel(2)], ...over,
});

const line = (p: Parcel, over: Partial<QuoteLine> = {}): QuoteLine => ({
  id: `l${p.seq}`, seq: p.seq, kind: 'parcel', label: '', basis: 'per_cbm', quantity: p.cbm, unit_price_xaf: 180000, amount_xaf: 17280,
  parcel_id: p.id, parcel_no: p.parcel_no, parcel_seq: p.seq, kind_of_parcel: p.kind, description: p.description, weight_kg: p.weight_kg, cbm: p.cbm, ...over,
});

const quote = (lines: QuoteLine[], over: Partial<Quote> = {}): Quote => ({
  id: 'q1', quote_no: 'DV-000031', deposit_id: 'dep2', status: 'sent', currency: 'XAF', total_xaf: lines.reduce((s, l) => s + l.amount_xaf, 0), amount_paid_xaf: 0,
  notes: null, sent_at: '2026-09-21T00:00:00Z', created_at: '2026-09-21T00:00:00Z', updated_at: '2026-09-21T00:00:00Z',
  deposit_no: 'RC-000122', location: 'warehouse', opened_at: '2026-09-20T06:00:00Z', closed_at: null, client, lines, payments: [], ...over,
});

const photo = (src: string): PdfPhoto => ({ src, width: 640, height: 480 });

describe('le bon de réception et devis', () => {
  it('sans devis : un devis à blanc, une ligne par colis, AUCUN prix', () => {
    const d = deposit();
    const data = receptionDocData(d, null);
    expect(data.priced).toBe(false);
    expect(data.hasQuote).toBe(false);
    expect(data.q.lines).toHaveLength(2);
    expect(data.q.lines.every((l) => l.amount_xaf === 0 && l.unit_price_xaf == null)).toBe(true);
    expect(data.q.total_xaf).toBe(0);
    expect(data.q.deposit_no).toBe('RC-000122');
  });

  it('un devis créé mais sans montant compte comme « pas de prix »', () => {
    const d = deposit();
    const data = receptionDocData(d, quote(d.parcels.map((p) => line(p, { amount_xaf: 0, unit_price_xaf: 0 }))));
    expect(data.hasQuote).toBe(true);
    expect(data.priced).toBe(false);
  });

  it('avec un devis chiffré : ses lignes, et un colis ajouté depuis s’imprime « à chiffrer »', () => {
    const d = deposit({ parcels: [parcel(1), parcel(2), parcel(3)] });
    const q = quote([line(d.parcels[0]), line(d.parcels[1]), { ...line(d.parcels[0]), id: 'fee', kind: 'fee', label: 'Emballage', parcel_id: null, amount_xaf: 5000 }]);
    const data = receptionDocData(d, q);
    expect(data.priced).toBe(true);
    // Les colis d'abord (le nouveau à la suite), les frais ensuite.
    expect(data.q.lines.map((l) => l.kind)).toEqual(['parcel', 'parcel', 'parcel', 'fee']);
    expect(data.extras?.get('p3')?.unpriced).toBe(true);
    expect(data.extras?.get('p1')?.unpriced).toBe(false);
    // Le total reste celui du devis : on n'invente pas de prix.
    expect(data.q.total_xaf).toBe(17280 * 2 + 5000);
  });

  it('les photos : la couverture en vignette, quatre au plus en annexe, le compte réel', () => {
    const paths = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'];
    const d = deposit({ parcels: [parcel(1, { photo_path: 'a.jpg', photos: paths.map((path, position) => ({ id: path, path, position, created_at: '' })) }), parcel(2)] });
    expect(receptionPhotoPaths(d)).toEqual(['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']);
    const loaded = new Map([['a.jpg', photo('A')], ['c.jpg', photo('C')]]);
    const x = receptionDocData(d, null, loaded).extras!;
    expect(x.get('p1')?.cover?.src).toBe('A');
    expect(x.get('p1')?.photos.map((p) => p.src)).toEqual(['A', 'C']);
    expect(x.get('p1')?.photoCount).toBe(5);
    expect(x.get('p2')?.cover).toBeNull();
    expect(x.get('p2')?.photoCount).toBe(0);
  });

  it('l’état à la réception suit chaque colis (sans réserve : rien)', () => {
    const d = deposit({ parcels: [parcel(1, { reception_condition: 'damaged', reception_condition_note: '  coin écrasé ' }), parcel(2)] });
    const x = receptionDocData(d, null).extras!;
    expect(x.get('p1')).toMatchObject({ condition: 'damaged', conditionNote: 'coin écrasé' });
    expect(x.get('p2')).toMatchObject({ condition: null, conditionNote: null });
  });

  it('le devis seul (dépôt pas chargé) : le devis tel quel, sans vignettes ni état', () => {
    const d = deposit();
    const data = receptionDocData(null, quote(d.parcels.map((p) => line(p))));
    expect(data.extras).toBeNull();
    expect(data.priced).toBe(true);
  });

  it('les conteneurs du devis à blanc viennent des colis', () => {
    const d = deposit({ parcels: [parcel(1, { shipment_id: 's1', container_number: 'MSKU 482913-7', status: 'loaded' }), parcel(2)] });
    expect(blankQuoteFromDeposit(d).containers?.map((c) => c.container_number)).toEqual(['MSKU 482913-7']);
  });
});

describe('le relevé des colis d’un client', () => {
  it('où est un colis : remis, à Douala, en route, à Guangzhou', () => {
    expect(statementStage(parcel(1, { delivered_at: '2026-10-01T00:00:00Z' }))).toBe('delivered');
    expect(statementStage(parcel(1, { status: 'arrived' }))).toBe('douala');
    expect(statementStage(parcel(1, { checked_in_at: '2026-10-01T00:00:00Z', status: 'shipped' }))).toBe('douala');
    expect(statementStage(parcel(1, { shipment_id: 's1', status: 'loaded' }))).toBe('transit');
    expect(statementStage(parcel(1, { air_shipment_id: 'a1' }))).toBe('transit');
    expect(statementStage(parcel(1))).toBe('guangzhou');
  });

  it('range tout ce qu’on détient, groupe le transit par conteneur, compte les colis remis sans les lister', () => {
    const d1 = deposit({ parcels: [parcel(1), parcel(2, { shipment_id: 's1', container_number: 'MSKU 1', status: 'shipped' })],
      quote_total_xaf: 100000, quote_paid_xaf: 40000, quote_no: 'DV-1', containers: [{ ref: 'MSKU 1', etd: '2026-09-28', eta: '2026-11-04' }] });
    const d2 = deposit({ id: 'dep3', deposit_no: 'RC-000098', opened_at: '2026-09-02T00:00:00Z',
      parcels: [parcel(1, { id: 'q1', status: 'arrived', checked_in_at: '2026-10-08T00:00:00Z' }), parcel(2, { id: 'q2', delivered_at: '2026-10-09T00:00:00Z', status: 'delivered' })],
      quote_total_xaf: 30000, quote_paid_xaf: 30000, invoice_no: 'FA-1' });
    const d3 = deposit({ id: 'dep4', deposit_no: 'RC-000130', parcels: [parcel(1, { id: 'r1' })] });
    const gone = deposit({ id: 'dep5', deposit_no: 'RC-000131', status: 'cancelled', parcels: [parcel(1, { id: 'x1' })] });
    const s = buildClientStatement([d1, d2, d3, gone]);
    expect(s.guangzhou.map((x) => x.parcel.id)).toEqual(['p1', 'r1']);
    expect(s.transit).toHaveLength(1);
    expect(s.transit[0]).toMatchObject({ mode: 'sea', ref: 'MSKU 1', info: { eta: '2026-11-04' } });
    expect(s.douala.map((x) => x.parcel.id)).toEqual(['q1']);
    expect(s.deliveredCount).toBe(1);
    expect(s.held.parcels).toBe(4);
    // Ce qui reste à payer : le dépôt à moitié payé ; le soldé n'y est pas ; celui sans prix est signalé.
    expect(s.dues.map((x) => [x.deposit_no, x.balance, x.unpriced])).toEqual([['RC-000122', 60000, false], ['RC-000130', 0, true]]);
    expect(s.dueTotal).toBe(60000);
  });

  it('un vol et un conteneur sont deux groupes, le plus proche de l’arrivée d’abord', () => {
    const d = deposit({ parcels: [
      parcel(1, { shipment_id: 's1', container_number: 'MSKU 1', status: 'shipped' }),
      parcel(2, { air_shipment_id: 'a1', awb_number: '07112345675', status: 'shipped' }),
    ], containers: [{ ref: 'MSKU 1', etd: null, eta: '2026-11-04' }], flights: [{ ref: '07112345675', etd: null, eta: '2026-10-14' }] });
    const s = buildClientStatement([d]);
    expect(s.transit.map((g) => g.mode)).toEqual(['air', 'sea']);
  });
});

describe('la facture à l’arrivée', () => {
  const d = deposit();
  const lines = d.parcels.map((p) => line(p));
  it('tous les colis à Douala (arrivés, pointés ou remis) : le service est rendu', () => {
    expect(parcelsAllArrived([{ status: 'arrived' }, { status: 'shipped', checked_in_at: 'x' }, { status: 'delivered' }])).toBe(true);
    expect(parcelsAllArrived([{ status: 'arrived' }, { status: 'shipped' }])).toBe(false);
    expect(parcelsAllArrived([])).toBe(false);
  });

  it('pas encore payé, colis en route : pas de facture, et on dit pourquoi', () => {
    const r = invoiceReadiness(quote(lines), [{ status: 'shipped' }, { status: 'arrived' }]);
    expect(r.ready).toBe(false);
    expect(r.reason).toMatch(/arrivée des colis à Douala/);
  });

  it('pas encore payé, colis arrivés : la facture s’établit (à régler)', () => {
    const r = invoiceReadiness(quote(lines), [{ status: 'arrived' }, { status: 'arrived' }]);
    expect(r).toEqual({ ready: true, acquitted: false, reason: null });
  });

  it('tout payé : la facture sort acquittée, même colis en route', () => {
    const q = quote(lines, { amount_paid_xaf: 34560, payments: undefined });
    expect(invoiceReadiness(q, [{ status: 'shipped' }])).toEqual({ ready: true, acquitted: true, reason: null });
  });

  it('un colis à mesurer bloque la facture', () => {
    const q = quote([line(d.parcels[0]), line(d.parcels[1], { quantity: null, amount_xaf: 0 })]);
    expect(invoiceReadiness(q, [{ status: 'arrived' }, { status: 'arrived' }]).reason).toMatch(/à peser ou mesurer/);
  });

  it('acquittée = établie ET soldée ; établie et due ne l’est pas', () => {
    expect(invoiceAcquitted(quote(lines, { invoice_no: 'FA-1', amount_paid_xaf: 34560, payments: undefined }))).toBe(true);
    expect(invoiceAcquitted(quote(lines, { invoice_no: 'FA-1', amount_paid_xaf: 10000, payments: undefined }))).toBe(false);
    expect(invoiceAcquitted(quote(lines, { invoice_no: null, amount_paid_xaf: 34560, payments: undefined }))).toBe(false);
  });

  it('déjà facturée : rien à établir', () => {
    expect(invoiceReadiness(quote(lines, { invoice_no: 'FA-1' }), [{ status: 'arrived' }]).ready).toBe(false);
  });
});
