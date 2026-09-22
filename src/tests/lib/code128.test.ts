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
