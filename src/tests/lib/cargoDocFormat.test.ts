import { describe, expect, it } from 'vitest';
import {
  CJK, NBSP, clampLines, cnPhone, commonRate, contactLine, countLabel, docDateTime, docDay, estimateWidth, fontFor, kg, m3, money, num, pdfSafe, rateUnit, splitZh, wrapText, xaf,
} from '@/lib/pdf/cargoDocFormat';

const strip = (s: string) => s.replace(/[\s\n]/g, '');
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

describe('CJK — le chinois, et seulement lui', () => {
  it('reconnaît les idéogrammes (unifiés, extension A, compatibilité)', () => {
    expect(CJK.test('广州')).toBe(true);
    expect(CJK.test('㐀')).toBe(true);
    expect(CJK.test('豈')).toBe(true);
  });
  it('ne prend ni le coréen, ni les émojis, ni la zone privée (plage corrompue par NFC)', () => {
    expect(CJK.test('한국')).toBe(false);
    expect(CJK.test('🌸')).toBe(false);
    expect(CJK.test('')).toBe(false);
    expect(fontFor('Chaussures 🌸')).toBe('DM Sans');
    expect(fontFor('广州鞋业 Guangzhou')).toBe('Noto Sans SC');
  });
});

describe('wrapText', () => {
  it('laisse le latin court tel quel', () => {
    expect(wrapText('Chaussures, 40 paires', 180, 9.5)).toBe('Chaussures, 40 paires');
    expect(wrapText(null, 100, 9)).toBe('');
  });
  it('coupe le chinois sans perdre un caractère, sans couper un mot latin', () => {
    const s = '广东省广州市白云区石门街道云溪颂花园中心售楼部正对面铁皮仓库 Bonzini Trading Cargo';
    const out = wrapText(s, 120, 8.5);
    expect(out.split('\n').length).toBeGreaterThan(1);
    expect(strip(out)).toBe(strip(s));
    expect(out).toContain('Bonzini');
    for (const line of out.split('\n')) expect([...line.replace(/[^一-鿿]/g, '')].length).toBeLessThanOrEqual(Math.ceil(120 / 8.5));
  });
  it('garde les sauts de ligne existants', () => {
    expect(wrapText('广州市广园西路219号\n客麦隆大厦二楼 259', 400, 8.5)).toBe('广州市广园西路219号\n客麦隆大厦二楼 259');
  });
  it('ne coupe jamais sur une espace insécable (un nombre et son unité)', () => {
    const s = `广州 B/L${NBSP}MAEU${NBSP}2261${NBSP}8834 广州`;
    const out = wrapText(s, 60, 10);
    expect(out).toContain(`B/L${NBSP}MAEU${NBSP}2261${NBSP}8834`.slice(0, 8));
    expect(strip(out)).toBe(strip(s));
  });
  it('coupe en tronçons un mot latin plus large que la colonne (référence de virement)', () => {
    const ref = 'VIR20260921118ABCDEFGHIJKLMNOPQRSTUV';
    const out = wrapText(ref, 60, 8.5);
    expect(out.split('\n').length).toBeGreaterThan(1);
    expect(strip(out)).toBe(ref);
  });
  it('ne sépare jamais les deux moitiés d’un émoji ni d’un idéogramme astral, quelle que soit la largeur', () => {
    const s = '𠀀𠀁𠀂𠀃 广州 🌸ABC';
    for (let w = 1; w <= 200; w += 7) {
      const out = wrapText(s, w, 10);
      expect(LONE_SURROGATE.test(out)).toBe(false);
      expect(strip(out)).toBe(strip(s));
    }
  });
});

describe('wrapText — cas durs', () => {
  it('un tronçon de mot trop long occupe sa propre ligne, jamais plus large que la colonne', () => {
    const out = wrapText('OPQRSTUVWXYZ0123456789MMMMWWWW départ', 140, 8.5);
    for (const line of out.split('\n')) expect(estimateWidth(line, 8.5)).toBeLessThanOrEqual(140 + 0.01);
    expect(strip(out)).toBe(strip('OPQRSTUVWXYZ0123456789MMMMWWWW départ'));
  });
  it('la ponctuation chinoise fermante ne commence jamais une ligne', () => {
    const s = '鞋子鞋子鞋子鞋子鞋子，衣服衣服衣服。';
    for (let w = 20; w <= 200; w += 5) {
      const out = wrapText(s, w, 10);
      for (const line of out.split('\n').slice(1)) expect(/^[，。、]/.test(line)).toBe(false);
      expect(strip(out)).toBe(strip(s));
    }
  });
  it('ne laisse jamais de marque interne dans le texte', () => {
    expect(wrapText('ABCDEFGHIJKLMNOPQRSTUVWXYZ，', 40, 10)).not.toContain('\u0000');
  });
});

describe('clampLines', () => {
  it('garde un texte court tel quel', () => {
    expect(clampLines('Fragile, haut', 300, 9, 3)).toBe('Fragile, haut');
  });
  it('coupe au-delà de maxLines, avec « … »', () => {
    const long = Array.from({ length: 60 }, (_, i) => `mot${i}`).join(' ');
    const out = clampLines(long, 200, 9, 2);
    expect(out.endsWith('…')).toBe(true);
    expect(out.split('\n').length).toBeLessThanOrEqual(2);
    expect(out.length).toBeLessThan(long.length);
  });
});

describe('pdfSafe — seulement ce que les polices savent dessiner', () => {
  it('garde le français, le chinois, les signes de la police', () => {
    const s = 'Été — « Œuvre » · 1 234,5 € · 广州，鞋业 · RC-000122 × 3 ’';
    expect(pdfSafe(s)).toBe(s);
  });
  it('ramène les accents du pinyin, traduit les flèches, ôte les émojis', () => {
    expect(pdfSafe('Guǎngzhōu')).toBe('Guangzhou');
    expect(pdfSafe('Nansha → Kribi')).toBe('Nansha -> Kribi');
    expect(pdfSafe('Chaussures 👟 neuves')).toBe('Chaussures  neuves');
  });
});

describe('splitZh', () => {
  it('sépare le latin (en gras) et le chinois (ligne grise)', () => {
    expect(splitZh('广州鞋业有限公司 Guangzhou Shoes Co.')).toEqual({ main: 'Guangzhou Shoes Co.', zh: '广州鞋业有限公司' });
    expect(splitZh('Yiwu Bags')).toEqual({ main: 'Yiwu Bags', zh: '' });
    expect(splitZh('义乌箱包厂')).toEqual({ main: '义乌箱包厂', zh: '' });
  });
});

describe('nombres', () => {
  it('groupe avec une insécable en français, une virgule en anglais', () => {
    expect(num(1234567, 'fr')).toBe(`1${NBSP}234${NBSP}567`);
    expect(num(1234567, 'en')).toBe('1,234,567');
    expect(money(-10000, 'fr')).toBe(`-10${NBSP}000`);
    expect(xaf(219840, 'en')).toBe(`219,840${NBSP}XAF`);
  });
  it('n’imprime jamais « -0 »', () => {
    expect(num(-0.0001, 'fr', 2)).toBe('0');
  });
  it('poids et volume à la précision de la base, zéros inutiles retirés', () => {
    expect(kg(8.4, 'fr')).toBe('8,4');
    expect(kg(12.35, 'en')).toBe('12.35');
    expect(kg(84, 'fr')).toBe('84');
    expect(m3(0.096, 'fr')).toBe('0,096');
    expect(m3(0.0864, 'fr')).toBe('0,0864');
    expect(m3(2.14, 'fr')).toBe('2,14');
    expect(m3(3, 'en')).toBe('3.00');
    expect(m3(null, 'fr')).toBe('—');
  });
});

describe('dates — le fuseau du lieu, jamais celui de l’appareil', () => {
  it('une date seule (colonne DATE) ne glisse pas d’un jour', () => {
    expect(docDay('2026-11-05', 'fr')).toBe('05/11/2026');
    expect(docDay('2026-11-05', 'en')).toBe(`5${NBSP}Nov${NBSP}2026`);
  });
  it('un instant se lit à Douala par défaut, à Guangzhou si demandé', () => {
    expect(docDay('2026-09-20T23:30:00Z', 'fr')).toBe('21/09/2026');
    expect(docDay('2026-09-20T23:30:00Z', 'fr', 'Asia/Shanghai')).toBe('21/09/2026');
    expect(docDay('2026-09-20T06:58:00Z', 'fr', 'Asia/Shanghai')).toBe('20/09/2026');
    expect(docDateTime('2026-09-20T06:58:00Z', 'fr', 'Asia/Shanghai')).toBe(`20/09/2026 à${NBSP}14:58`);
    expect(docDateTime('2026-09-20T06:58:00Z', 'en', 'Africa/Douala')).toBe(`20${NBSP}Sep${NBSP}2026 at${NBSP}07:58`);
  });
});

describe('téléphones chinois', () => {
  it('ajoute l’indicatif et regroupe', () => {
    expect(cnPhone('18667439286')).toBe(`(+86)${NBSP}186${NBSP}6743${NBSP}9286`);
    expect(cnPhone('+86 186 6743 9286')).toBe(`(+86)${NBSP}186${NBSP}6743${NBSP}9286`);
    expect(cnPhone('020-1234')).toBe('020-1234');
  });
  it('n’écrit qu’une fois un numéro répété (WeChat / WhatsApp)', () => {
    expect(contactLine({ recipient: 'Tina', phone: '18667439286', wechat: '18667439286', whatsapp: '+86 186 6743 9286' }))
      .toBe(`Tina · (+86)${NBSP}186${NBSP}6743${NBSP}9286 (WeChat / WhatsApp)`);
    expect(contactLine({ recipient: 'Tina', phone: '199 2746 3902', wechat: '138 2229 7518', whatsapp: '' }))
      .toBe(`Tina · (+86)${NBSP}199${NBSP}2746${NBSP}3902 · WeChat (+86)${NBSP}138${NBSP}2229${NBSP}7518`);
    expect(contactLine({ phone: '', wechat: 'tina gz' })).toBe(`WeChat tina${NBSP}gz`);
  });
});

describe('lignes de colis', () => {
  const m = (basis: 'per_kg' | 'per_cbm' | 'fixed', unit_price_xaf: number | null) => ({ basis, unit_price_xaf });
  it('rateUnit : l’unité commune, sinon null', () => {
    expect(rateUnit([m('per_cbm', 180000), m('fixed', null), m('per_cbm', 180000)])).toBe('m³');
    expect(rateUnit([m('per_kg', 6500)])).toBe('kg');
    expect(rateUnit([m('per_cbm', 180000), m('per_kg', 6500)])).toBeNull();
    expect(rateUnit([])).toBeNull();
  });
  it('commonRate : le même tarif partout, « Forfait » si tout est au forfait, sinon rien', () => {
    expect(commonRate([m('per_cbm', 180000), m('per_cbm', 180000)], 'fr', 'Forfait')).toBe(`180${NBSP}000`);
    expect(commonRate([m('fixed', null), m('fixed', null)], 'fr', 'Forfait')).toBe('Forfait');
    expect(commonRate([m('per_cbm', 180000), m('fixed', null)], 'fr', 'Forfait')).toBe('');
    expect(commonRate([m('per_cbm', 180000), m('per_cbm', 200000)], 'fr', 'Forfait')).toBe('');
    expect(commonRate([], 'fr', 'Forfait')).toBe('');
  });
  it('countLabel : le type commun, le singulier pour 1 seulement', () => {
    const fr = { carton: ['carton', 'cartons'], bag: ['sac', 'sacs'], other: ['colis', 'colis'] } as const;
    const en = { carton: ['carton', 'cartons'], other: ['parcel', 'parcels'] } as const;
    expect(countLabel(['carton', 'carton'], fr)).toBe(`2${NBSP}cartons`);
    expect(countLabel(['carton', 'bag'], fr)).toBe(`2${NBSP}colis`);
    expect(countLabel(['bag'], fr)).toBe(`1${NBSP}sac`);
    expect(countLabel([], en)).toBe(`0${NBSP}parcels`);
  });
});
