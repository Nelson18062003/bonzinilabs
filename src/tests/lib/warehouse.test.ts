// Ce que l'entrepôt de Douala décide sans la base : lire un scan, dire où en
// est un colis, et ce qui bloque une remise.
import { describe, expect, it } from 'vitest';
import { checkinSummary, groupParcelsByClient, isPending, parseWarehouseScan, quoteWord, releaseBlockers, releaseWord, transportLabel, warehouseStage, type ClientQuoteSummary, type WarehouseParcel } from '@/lib/warehouse';
import { xaf } from '@/lib/cargoQuote';

const parcel = (o: Partial<WarehouseParcel> = {}): WarehouseParcel => ({
  id: 'p1', seq: 1, parcel_no: 'RC-000123-01', kind: 'carton', weight_kg: 8.4, length_cm: 60, width_cm: 40, height_cm: 40, cbm: 0.096,
  description: null, courier_waybill: null, photo_path: null, status: 'arrived', created_at: '2026-09-21T00:00:00Z',
  deposit_id: 'dep1', deposit_no: 'RC-000123', client: null,
  checked_in_at: null, warehouse_location: null, condition: null, condition_note: null, delivered_at: null, release_id: null,
  ...o,
});

describe('parseWarehouseScan', () => {
  it('reconnaît le code client sous toutes ses formes', () => {
    expect(parseWarehouseScan('BZ-482913')).toEqual({ kind: 'customer', code: 'BZ-482913' });
    expect(parseWarehouseScan('https://bonzinilabs.com/c/BZ-482913')).toEqual({ kind: 'customer', code: 'BZ-482913' });
    expect(parseWarehouseScan('bz 482913')).toEqual({ kind: 'customer', code: 'BZ-482913' });
    expect(parseWarehouseScan('482913')).toEqual({ kind: 'customer', code: 'BZ-482913' });
  });
  it('reconnaît un numéro de colis, tapé ou lu sur l’étiquette', () => {
    expect(parseWarehouseScan('RC-000123-01')).toEqual({ kind: 'parcel', no: 'RC-000123-01' });
    expect(parseWarehouseScan('rc 000123 01')).toEqual({ kind: 'parcel', no: 'RC-000123-01' });
    expect(parseWarehouseScan('RC-000123-03 (3/10)')).toEqual({ kind: 'parcel', no: 'RC-000123-03' });
  });
  it('ne devine rien avec un texte inconnu', () => {
    expect(parseWarehouseScan('bonjour')).toBeNull();
    expect(parseWarehouseScan('')).toBeNull();
  });
});

describe('warehouseStage', () => {
  it('suit le colis de la Chine à la remise', () => {
    expect(warehouseStage(parcel({ status: 'loaded' })).label).toBe('En Chine');
    expect(warehouseStage(parcel({ status: 'shipped' })).label).toBe('En route');
    expect(warehouseStage(parcel()).label).toBe('À pointer');
    expect(warehouseStage(parcel({ checked_in_at: 'x', condition: 'ok' })).label).toBe('Pointé');
    expect(warehouseStage(parcel({ checked_in_at: 'x', condition: 'damaged' })).label).toBe('Pointé · abîmé');
    expect(warehouseStage(parcel({ condition: 'missing' }))).toMatchObject({ tone: 'danger', label: 'Manquant' });
    expect(warehouseStage(parcel({ delivered_at: 'x', release_no: 'BR-000007' })).label).toBe('Remis · BR-000007');
  });
  it('dit par quoi le colis voyage', () => {
    expect(transportLabel(parcel({ air_shipment_id: 'a', awb_number: '07112345675' }))).toBe('LTA 07112345675');
    expect(transportLabel(parcel({ shipment_id: 's', container_number: 'MSKU 482913-7' }))).toBe('MSKU 482913-7');
  });
});

describe('remise : ce qui bloque', () => {
  const quote = (o: Partial<ClientQuoteSummary>): ClientQuoteSummary => ({ id: 'q', quote_no: 'DV-000031', deposit_id: 'dep1', deposit_no: 'RC-000123', status: 'sent', total_xaf: 219840, amount_paid_xaf: 0, balance_xaf: 219840, invoice_no: null, ...o });
  it('un devis non soldé bloque, un devis soldé libère', () => {
    expect(releaseBlockers([parcel()], [quote({})])).toHaveLength(1);
    expect(releaseBlockers([parcel()], [quote({ amount_paid_xaf: 219840, balance_xaf: 0, status: 'paid' })])).toHaveLength(0);
  });
  it('un dépôt sans devis bloque aussi (sans prix)', () => {
    const b = releaseBlockers([parcel()], []);
    expect(b).toHaveLength(1);
    expect(b[0].total_xaf).toBe(0);
  });
  it('seuls les dépôts des colis choisis comptent', () => {
    expect(releaseBlockers([parcel({ deposit_id: 'dep2', deposit_no: 'RC-000124' })], [quote({}), quote({ id: 'q2', deposit_id: 'dep2', amount_paid_xaf: 100, total_xaf: 100, balance_xaf: 0 })])).toHaveLength(0);
  });
  it('le mot du devis, pour l’agent', () => {
    expect(quoteWord({ quote_total_xaf: 0, quote_paid_xaf: 0, invoice_no: null })).toEqual({ text: 'Sans prix', ok: false });
    expect(quoteWord({ quote_total_xaf: 100, quote_paid_xaf: 40, invoice_no: null })).toEqual({ text: `Reste ${xaf(60)}`, ok: false });
    expect(quoteWord({ quote_total_xaf: 100, quote_paid_xaf: 100, invoice_no: 'FA-000012' })).toEqual({ text: 'Facturé', ok: true });
  });
});

describe('le pointage, écran par écran', () => {
  it('fait le bilan : vus, abîmés, manquants, jamais vus', () => {
    const s = checkinSummary([
      parcel({ checked_in_at: 'x', condition: 'ok' }),
      parcel({ checked_in_at: 'x', condition: 'damaged' }),
      parcel({ condition: 'missing' }),
      parcel({ delivered_at: 'x', checked_in_at: 'x' }),
      parcel(),
    ]);
    expect(s).toMatchObject({ total: 5, ok: 1, damaged: 1, missing: 1, delivered: 1, pending: 1, seen: 3, done: false });
    expect(checkinSummary([]).done).toBe(true);
  });
  it('sait ce qui reste à pointer', () => {
    expect(isPending(parcel())).toBe(true);
    expect(isPending(parcel({ checked_in_at: 'x' }))).toBe(false);
    expect(isPending(parcel({ condition: 'missing' }))).toBe(false);
    expect(isPending(parcel({ delivered_at: 'x' }))).toBe(false);
  });
  it('groupe les colis par client, sans perdre l’ordre', () => {
    const c1 = { user_id: 'u1', customer_code: 'BZ-1', first_name: 'A', last_name: 'B', phone: null, email: null, company_name: null, city: null, country: null };
    const g = groupParcelsByClient([parcel({ id: 'a', client: c1 }), parcel({ id: 'b', client: null }), parcel({ id: 'c', client: c1 })]);
    expect(g.map((x) => x.parcels.map((p) => p.id))).toEqual([['a', 'c'], ['b']]);
  });
});

describe('la phrase du bas de l’écran « ses colis »', () => {
  const quote = (o: Partial<ClientQuoteSummary>): ClientQuoteSummary => ({ id: 'q', quote_no: 'DV-000031', deposit_id: 'dep1', deposit_no: 'RC-000123', status: 'sent', total_xaf: 219840, amount_paid_xaf: 0, balance_xaf: 219840, invoice_no: null, ...o });
  it('rien de choisi, le reste à payer, ou prêts à partir', () => {
    expect(releaseWord(0, [])).toMatchObject({ tone: 'warn' });
    expect(releaseWord(2, [quote({})])).toEqual({ tone: 'warn', text: `Reste à payer ${xaf(219840)} avant la remise` });
    expect(releaseWord(2, [quote({ total_xaf: 0, balance_xaf: 0 })])).toMatchObject({ tone: 'bad', text: expect.stringContaining('Sans prix : RC-000123') });
    expect(releaseWord(3, [])).toEqual({ tone: 'good', text: '3 colis prêts à partir' });
  });
});

describe('le fournisseur du dépôt', () => {
  it('se lit en un objet, ou rien', async () => {
    const { depositSupplier, supplierLine } = await import('@/lib/reception');
    expect(depositSupplier({ supplier_name: null })).toBeNull();
    const s = depositSupplier({ supplier_kind: null, supplier_name: '广州鞋业', supplier_contact: 'Li Wei', supplier_phone: '138', supplier_email: null, supplier_wechat: null, supplier_address: null });
    expect(s).toMatchObject({ kind: 'supplier', name: '广州鞋业', contact: 'Li Wei', phone: '138' });
    expect(supplierLine(s)).toBe('广州鞋业 · Li Wei · 138');
    expect(supplierLine(null)).toBe('');
  });
});
