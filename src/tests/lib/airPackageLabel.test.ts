// L'étiquette d'un paquet avion : le plan pur (sans canvas). Le numéro en
// grand, le poids sur 32 kg, les clients et les colis — autant qu'il en
// tient, « +N » pour le reste —, l'expédition une fois affecté, et rien qui
// sorte de l'étiquette.
import { describe, expect, it } from 'vitest';
import type { Op } from '@/lib/shippingLabelCanvas';
import { PLABEL_H, PLABEL_W, expeditionLine, fitCodes, layoutPackageLabel, packageLabelData, type PackageLabelData } from '@/lib/airPackageLabelCanvas';
import type { AirPackage } from '@/lib/airPackage';

// Une mesure plausible sans canvas : 0,6 em par lettre latine, 1 em par idéogramme.
const fakeMeasure = (t: string, font: string) => {
  const px = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16);
  let w = 0;
  for (const ch of t) w += /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? px : px * 0.6;
  return w;
};

const rc = (n: number) => `RC-${String(100 + Math.floor(n / 3)).padStart(6, '0')}-${String((n % 3) + 1).padStart(2, '0')}`;
const base: PackageLabelData = {
  packageNo: 'PQ-000123',
  grossWeightKg: 31.5,
  maxWeightKg: 32,
  netWeightKg: 30.8,
  parcelCount: 12,
  clientCount: 3,
  clientCodes: ['BZ-482913', 'BZ-100045', 'BZ-756899'],
  parcelNos: Array.from({ length: 12 }, (_, i) => rc(i)),
  sealedAt: '2026-10-05T04:29:36Z',
  dims: [60, 40, 40],
  expedition: null,
};

type TextOp = Extract<Op, { kind: 'text' }>;
const textOps = (d: PackageLabelData) => layoutPackageLabel(d, fakeMeasure).filter((o): o is TextOp => o.kind === 'text');
const texts = (d: PackageLabelData) => textOps(d).map((o) => o.text);

describe("l'étiquette du paquet avion", () => {
  it('porte « PAQUET AVION », le numéro en grand et le poids pesé sur 32 kg', () => {
    const all = texts(base);
    expect(all).toContain('PAQUET AVION');
    const no = textOps(base).find((o) => o.row === 'no');
    expect(no?.text).toBe('PQ-000123');
    expect(Number(/(\d+(?:\.\d+)?)px/.exec(no!.font)?.[1])).toBeGreaterThanOrEqual(80);
    expect(all).toContain('31,5 kg');
    expect(all).toContain('/ 32 kg');
    expect(all).toContain('60 × 40 × 40 cm');
    expect(all).toContain('2026-10-05 12:29'); // heure de Guangzhou
  });

  it('liste les clients et tous les colis quand ils tiennent', () => {
    const all = texts(base);
    expect(all.some((t) => t.includes('BZ-482913') && t.includes('BZ-756899'))).toBe(true);
    for (const no of base.parcelNos) expect(all).toContain(no);
    expect(all.some((t) => /^\+\d+$/.test(t))).toBe(false);
  });

  it('au-delà de la place, montre autant de colis que possible puis « +N » — le compte est juste', () => {
    const many = { ...base, parcelNos: Array.from({ length: 90 }, (_, i) => rc(i)), parcelCount: 90 };
    const rcCells = textOps(many).filter((o) => o.row?.startsWith('rc-'));
    const more = rcCells[rcCells.length - 1];
    expect(more.text).toMatch(/^\+\d+$/);
    expect(rcCells.length - 1 + Number(more.text.slice(1))).toBe(90);
    expect(rcCells.length).toBeGreaterThanOrEqual(32);
  });

  it('les codes clients tiennent sur deux lignes, « +N » pour le reste, jamais coupés', () => {
    const codes = Array.from({ length: 30 }, (_, i) => `BZ-${String(400000 + i)}`);
    const font = '800 16px sans-serif';
    const lines = fitCodes(codes, 548, font, fakeMeasure, 2);
    expect(lines.length).toBeLessThanOrEqual(2);
    const joined = lines.join('  ·  ');
    const shown = codes.filter((c) => joined.includes(c)).length;
    expect(joined).toMatch(new RegExp(`\\+${codes.length - shown}$`));
    for (const l of lines) { expect(fakeMeasure(l, font)).toBeLessThanOrEqual(548); expect(l.startsWith('·')).toBe(false); }
    expect(fitCodes([], 548, font, fakeMeasure, 2)).toEqual(['—']);
  });

  it("dit l'expédition une fois le paquet affecté : la LTA si elle est connue, sinon le vol et la date", () => {
    expect(texts(base).some((t) => t.includes('待分配'))).toBe(true);
    const real = { ...base, expedition: { awb: '07112345675', flightNo: 'ET 607', etd: '2026-10-08' } };
    expect(texts(real)).toContain('LTA 071-12345675 · ET 607 · 2026-10-08');
    expect(expeditionLine({ awb: 'PROV-0001', flightNo: 'ET 607', etd: '2026-10-08' })).toBe('ET 607 · 2026-10-08');
    expect(expeditionLine(null)).toBeNull();
  });

  it("rien ne sort de l'étiquette, et le code-barres est là", () => {
    const ops = layoutPackageLabel({ ...base, parcelNos: Array.from({ length: 60 }, (_, i) => rc(i)), clientCodes: Array.from({ length: 25 }, (_, i) => `BZ-${500000 + i}`) }, fakeMeasure);
    for (const o of ops) {
      if (o.kind === 'text') {
        expect(o.y, o.text).toBeGreaterThan(0);
        expect(o.y, o.text).toBeLessThan(PLABEL_H);
        const w = fakeMeasure(o.text, o.font);
        const left = o.align === 'left' ? o.x : o.align === 'right' ? o.x - w : o.x - w / 2;
        expect(left, o.text).toBeGreaterThanOrEqual(0);
        expect(left + w, o.text).toBeLessThanOrEqual(PLABEL_W);
      } else if (o.kind === 'rect') {
        expect(o.x + o.w).toBeLessThanOrEqual(PLABEL_W);
        expect(o.y + o.h).toBeLessThanOrEqual(PLABEL_H);
      }
    }
    // Les barres du Code 128 : plus de vingt rectangles d'encre sous la grille.
    expect(ops.filter((o) => o.kind === 'rect' && o.color === '#111111').length).toBeGreaterThan(20);
    expect(ops.filter((o) => o.kind === 'qr')).toHaveLength(1);
  });
});

describe('les données de l’étiquette, depuis la fiche du paquet', () => {
  it('reprend codes clients (sans doublon), numéros de colis et expédition', () => {
    const client = (code: string) => ({ user_id: code, customer_code: code, first_name: 'A', last_name: 'B', phone: null, email: null, company_name: null, city: null, country: null });
    const parcel = (no: string, code: string) => ({ id: no, seq: 1, parcel_no: no, kind: 'carton', weight_kg: 2, cbm: null, description: null, status: 'stored', photo_path: null, checked_in_at: null, warehouse_location: null, condition: null, delivered_at: null, deposit_no: 'RC-000100', deposit_id: 'd', client: client(code) });
    const pkg = {
      id: 'k', package_no: 'PQ-000007', status: 'sealed', air_shipment_id: 'a', awb_number: 'PROV-0001', air_status: 'PLANNED', etd: '2026-10-08', flight_no: 'ET 607',
      max_weight_kg: 32, gross_weight_kg: 6.2, length_cm: null, width_cm: null, height_cm: null, notes: null, net_weight_kg: 6, parcel_count: 3, client_count: 2,
      checked_count: 0, missing_count: 0, sealed_at: '2026-10-05T04:00:00Z', handed_over_at: null, refused_at: null, refusal_reason: null, refused_air_shipment_id: null,
      received_at: null, opened_at: null, created_at: '', updated_at: '',
      parcels: [parcel('RC-000100-01', 'BZ-1'), parcel('RC-000100-02', 'BZ-1'), parcel('RC-000101-01', 'BZ-2')],
    } as unknown as AirPackage;
    const d = packageLabelData(pkg);
    expect(d.clientCodes).toEqual(['BZ-1', 'BZ-2']);
    expect(d.parcelNos).toEqual(['RC-000100-01', 'RC-000100-02', 'RC-000101-01']);
    expect(expeditionLine(d.expedition)).toBe('ET 607 · 2026-10-08');
    expect(packageLabelData({ ...pkg, air_shipment_id: null }).expedition).toBeNull();
  });
});
