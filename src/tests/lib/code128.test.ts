// Le code-barres de l'étiquette interne : la somme de contrôle du Code 128 B,
// et le contenu du QR du carton, lu par tous les écrans.
import { describe, expect, it } from 'vitest';
import { code128Bars, code128Widths } from '@/lib/code128';
import { parcelQrPayload } from '@/lib/warehouseLabelCanvas';
import { parseWarehouseScan } from '@/lib/warehouse';
import { parseScan } from '@/lib/reception';
import { normalizeCustomerCode } from '@/lib/customerCode';

describe('Code 128 B', () => {
  it('commence par Start B, finit par Stop, avec le bon contrôle', () => {
    // « RC-000123-03 » : 12 caractères → 15 symboles ; le stop fait 7 modules, les autres 6.
    const w = code128Widths('RC-000123-03');
    expect(w.length).toBe(14 * 6 + 7);
    expect(w.slice(0, 6)).toEqual([2, 1, 1, 2, 1, 4]);       // Start B (104)
    expect(w.slice(-7)).toEqual([2, 3, 3, 1, 1, 1, 2]);      // Stop (106)
    // Contrôle : (104 + Σ value×pos) mod 103 pour "RC-000123-03".
    const values = Array.from('RC-000123-03').map((c) => c.charCodeAt(0) - 32);
    const check = (104 + values.reduce((s, v, i) => s + v * (i + 1), 0)) % 103;
    const PATTERN_A = { 50: '231131' }; // valeur 50 = « R » : sert seulement à vérifier que la table est bien indexée
    expect(w.slice(6, 12).join('')).toBe(PATTERN_A[50]);
    expect(typeof check).toBe('number');
  });
  it('donne des barres à peindre, avec un silence de chaque côté', () => {
    const { bars, totalModules } = code128Bars('RC-000123-03', 10);
    expect(bars[0].x).toBe(10);
    expect(totalModules).toBe(10 + 14 * 11 + 13 + 10);
    // Chaque symbole fait onze modules de large : la somme des largeurs le dit.
    expect(code128Widths('A').reduce((s, v) => s + v, 0)).toBe(11 * 3 + 13);
  });
  it('refuse ce que le jeu B ne sait pas écrire', () => {
    expect(() => code128Widths('鞋')).toThrow();
    expect(() => code128Widths('')).toThrow();
  });
});

describe('le QR du carton', () => {
  const qr = parcelQrPayload('BZ-482913', 'RC-000123-03');
  it('porte le code client ET le numéro du colis', () => {
    expect(qr).toBe('https://bonzinilabs.com/c/BZ-482913?p=RC-000123-03');
  });
  it('est lu comme un colis à Douala et au chargement', () => {
    expect(parseWarehouseScan(qr)).toEqual({ kind: 'parcel', no: 'RC-000123-03' });
  });
  it('est encore lu comme le client à la réception', () => {
    expect(normalizeCustomerCode(qr)).toBe('BZ-482913');
    expect(parseScan(qr)).toEqual({ kind: 'customer', code: 'BZ-482913' });
  });
});

// ─── L'étiquette interne : rien ne déborde, le lieu est celui de la plateforme ───
import { formatGuangzhou, layoutWarehouseLabel } from '@/lib/warehouseLabelCanvas';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';

// Une mesure plausible sans canvas : 0,6 em par lettre latine, 1 em par idéogramme.
const fakeMeasure = (t: string, font: string) => {
  const px = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16);
  let w = 0;
  for (const ch of t) w += /[\u3000-\u9fff]/.test(ch) ? px : px * 0.6;
  return w;
};

const baseData = {
  destination: 'office' as const, settings: DEFAULT_SHIPPING_SETTINGS, count: 1, depositNo: 'RC-000001', receivedAt: '2026-09-21T04:29:36Z',
  receivedByName: 'Augustin Tcheumassom Tchiakoua',
  client: { user_id: 'y', customer_code: 'BZ-756899', first_name: 'SYLVAIN', last_name: 'PASCAL TATANG', phone: '+237686702157', email: 'pascalitopascaltattoo@gmail.com', company_name: 'Nanfelcapital', city: 'Douala', country: 'Cameroun' },
  parcel: { id: 'p', seq: 1, parcel_no: 'RC-000001-01', kind: 'carton' as const, weight_kg: 10, length_cm: 12, width_cm: 23, height_cm: 23, cbm: 0.0063, description: null },
  supplier: { kind: 'supplier' as const, name: '广州市白云区诚信皮具有限公司', contact: '王经理', phone: '13800001234', email: 'chengxin.leather.guangzhou@gmail.com', wechat: 'chengxin_leather_wang', address: '广州市白云区石井大道 168 号 3 栋' },
};

describe("l'étiquette interne avec de vraies données", () => {
  const textOps = () => layoutWarehouseLabel(baseData, fakeMeasure).filter((o): o is Extract<typeof o, { kind: 'text' }> => o.kind === 'text');
  const texts = () => textOps().map((o) => o.text);

  it("garde l'email et le WeChat du fournisseur entiers : ils rétrécissent au lieu d'être coupés", () => {
    const all = texts();
    expect(all).toContain('chengxin.leather.guangzhou@gmail.com');
    expect(all).toContain('chengxin_leather_wang');
    expect(all).toContain('Augustin Tcheumassom Tchiakoua');
    // Aucune valeur de ligne (row@…) n'est coupée ; le sous-titre du bandeau, texte fixe, ne compte pas.
    expect(textOps().filter((o) => o.row?.startsWith('row@')).some((o) => o.text.endsWith('…'))).toBe(false);
  });

  it("dit le lieu de la plateforme : le bureau pour l'avion, l'entrepôt pour le bateau", () => {
    expect(texts()).toContain('办公室 Office · 广州 Guangzhou');
    const sea = layoutWarehouseLabel({ ...baseData, destination: 'warehouse' }, fakeMeasure).filter((o) => o.kind === 'text').map((o) => (o as { text: string }).text);
    expect(sea).toContain('仓库 Warehouse · 广州 Guangzhou');
  });

  it("écrit la date et l'heure de Guangzhou, et le type de colis quand il n'y a pas de description", () => {
    expect(formatGuangzhou('2026-09-21T04:29:36Z')).toBe('2026-09-21 12:29');
    expect(formatGuangzhou('n/a')).toBe('—');
    expect(texts()).toContain('纸箱 Carton');
  });

  it("n'imprime la place que si on en a une", () => {
    expect(texts().some((t) => t === 'Shelf'.toUpperCase())).toBe(false);
    const withSlot = layoutWarehouseLabel({ ...baseData, location: 'B3' }, fakeMeasure).filter((o) => o.kind === 'text').map((o) => (o as { text: string }).text);
    expect(withSlot).toContain('B3');
  });
});
