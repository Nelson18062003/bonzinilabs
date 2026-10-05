// Le manifeste : en avion, une colonne PAQUET quand les colis voyagent en paquets
// de 32 kg ; le manifeste maritime n'en a pas ; la LTA provisoire (PROV-…) ne
// s'imprime jamais, ni dans le document ni dans le nom du fichier. Les colonnes
// ne se chevauchent pas (« M3 » et « DEVIS » s'imprimaient l'un sur l'autre) et
// rien ne sort hors du jeu WinAnsi d'Helvetica (« → » devenait « !' »).
import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { buildAirManifestPdf, buildSeaManifestPdf, MANIFEST_COL_GAP, manifestColumns, manifestFileName } from '@/lib/airManifestPdf';
import type { AirParcel, AirShipment } from '@/lib/airShipment';
import type { AirPackage } from '@/lib/airPackage';
import type { CargoShipment } from '@/lib/cargo/model';

const client = { user_id: 'u1', customer_code: 'BZ-100045', first_name: 'Awa', last_name: 'Ndiaye', phone: null, email: null, company_name: null, city: null, country: null };

const parcel = (o: Partial<AirParcel>): AirParcel => ({
  id: 'p', seq: 1, parcel_no: 'RC-000121-01', kind: 'carton', weight_kg: 8.4, length_cm: 60, width_cm: 40, height_cm: 40, cbm: 0.096,
  description: 'Chaussures', courier_waybill: null, photo_path: null, status: 'loaded', created_at: '2026-09-21T00:00:00Z',
  deposit_id: 'dep', deposit_no: 'RC-000121', client, quote_total_xaf: 1000, quote_paid_xaf: 1000, ...o,
});

const pkg = { id: 'k1', package_no: 'PQ-000123', status: 'handed_over', gross_weight_kg: 31.5, net_weight_kg: 30 } as AirPackage;

const air = (o: Partial<AirShipment> = {}): AirShipment => ({
  id: 'a1', awb_number: '07112345675', airline: 'Ethiopian', flight_no: 'ET 607', origin: 'Guangzhou (CAN)', destination: 'Douala (DLA)',
  status: 'PLANNED', etd: '2026-10-12', eta: '2026-10-13', departed_at: null, arrived_at: null, delivered_at: null, freight_usd: null,
  notes: null, created_at: '', updated_at: '', parcel_count: 2, total_weight_kg: 16.8, total_cbm: 0.192, client_count: 1, unpaid_count: 0,
  parcels: [parcel({ id: 'a', air_package_id: 'k1', package_no: 'PQ-000123' }), parcel({ id: 'b', parcel_no: 'RC-000121-02', seq: 2 })],
  packages: [pkg],
  ...o,
});

/** Le texte brut du PDF (jsPDF n'y compresse pas les flux). */
const text = (pdf: { output: (t: 'arraybuffer') => ArrayBuffer }) => new TextDecoder('latin1').decode(pdf.output('arraybuffer'));

describe('manifeste avion', () => {
  it('ajoute la colonne PAQUET et le paquet de chaque colis', () => {
    const out = text(buildAirManifestPdf(air()));
    expect(out).toContain('(PAQUET)');
    expect(out).toContain('(PQ-000123)');
    expect(out).toContain('(PAQUETS)');
    expect(out).toContain('071-12345675');
  });
  it('sans paquet, pas de colonne PAQUET', () => {
    const out = text(buildAirManifestPdf(air({ packages: [], parcels: [parcel({ id: 'a' })] })));
    expect(out).not.toContain('(PAQUET)');
    expect(out).not.toContain('(PAQUETS)');
  });
  it('n’imprime jamais une LTA provisoire', () => {
    const a = air({ awb_number: 'PROV-AB12CD', awb_provisional: true });
    const out = text(buildAirManifestPdf(a));
    expect(out).not.toContain('PROV-');
    expect(out).toContain('venir');
    expect(manifestFileName(a)).toBe('bonzini-manifeste-lta-a-venir-2026-10-12.pdf');
    expect(manifestFileName(air())).toBe('bonzini-manifeste-07112345675.pdf');
  });
});

describe('manifeste maritime', () => {
  it('reste sans colonne PAQUET', () => {
    const s = { container_number: 'MIEU 361111 5', container_iso: '40HC', bl_number: 'BL1', vessel_name: 'MSC X', voyage: '12W', pod_name: 'Douala', eta_promised: null, notes: null } as unknown as CargoShipment;
    const out = text(buildSeaManifestPdf(s, [parcel({ id: 'a', package_no: 'PQ-000123' })]));
    expect(out).not.toContain('(PAQUET)');
    expect(out).not.toContain('(PQ-000123)');
    expect(out).toContain('(CONTENU)');
  });
});

describe('les colonnes du tableau', () => {
  const spans = (pk: boolean) => {
    const c = manifestColumns(pk);
    return [c.n, c.k, c.c, c.d, c.w, c.dim, c.cbm, c.pay].filter((x): x is [number, number] => !!x);
  };
  it.each([true, false])('se suivent sans se chevaucher, dans les marges de la page A4 (PAQUET : %s)', (pk) => {
    const s = spans(pk);
    expect(s).toHaveLength(pk ? 8 : 7);
    expect(s[0][0]).toBeGreaterThanOrEqual(14);
    expect(s[s.length - 1][1]).toBeLessThanOrEqual(210 - 14 + 1e-9);
    s.forEach(([a, b], i) => {
      expect(b).toBeGreaterThan(a);
      if (i > 0) expect(a - s[i - 1][1]).toBeGreaterThanOrEqual(MANIFEST_COL_GAP - 1e-9);
    });
  });
  it('chaque valeur longue tient dans sa colonne (Helvetica 8,5)', () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    pdf.setFontSize(8.5);
    const tw = (t: string, bold = false) => { pdf.setFont('helvetica', bold ? 'bold' : 'normal'); return pdf.getTextWidth(t); };
    const width = ([a, b]: [number, number]) => b - a;
    for (const pk of [true, false]) {
      const c = manifestColumns(pk);
      expect(tw('RC-000122-01', true) + 2).toBeLessThanOrEqual(width(c.n));
      if (pk) expect(tw('PQ-000041')).toBeLessThanOrEqual(width(c.k!));
      expect(tw('123,4 kg')).toBeLessThanOrEqual(width(c.w));
      expect(tw('120 × 100 × 100 cm')).toBeLessThanOrEqual(width(c.dim));
      expect(tw('0,096 m3')).toBeLessThanOrEqual(width(c.cbm));
      expect(tw('reste 1 157 300 XAF')).toBeLessThanOrEqual(width(c.pay));
      expect(width(c.c)).toBeGreaterThanOrEqual(20);
      expect(width(c.d)).toBeGreaterThanOrEqual(20);
    }
  });
  it('imprime un long reste en entier, la flèche en « > » et rien hors WinAnsi', () => {
    const out = text(buildAirManifestPdf(air({ parcels: [parcel({ id: 'a', description: 'Chaussures 鞋子', quote_total_xaf: 1157300, quote_paid_xaf: 0 })] })));
    expect(out).toContain('(reste 1 157 300 XAF)');
    expect(out).toContain('Guangzhou > Douala)');
    expect(out).not.toContain('Guangzhou !');
    expect(out).toContain('(Chaussures ??)');
  });
});
