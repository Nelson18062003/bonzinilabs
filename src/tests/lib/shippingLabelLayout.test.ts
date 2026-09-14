import { describe, it, expect } from 'vitest';
import { fitText, wrapText, layoutLabel, LABEL_H, LABEL_W, type Measure, type Op } from '@/lib/shippingLabelCanvas';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';

// Une mesure « pire cas » : police système large — 0,62 em par lettre latine,
// 1 em par idéogramme. Si le plan tient avec ça, il tient avec DM Sans.
const measure: Measure = (text, font) => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 12);
  let w = 0;
  for (const ch of Array.from(text)) w += /[\u3000-\u9fff\uf900-\ufaff]/.test(ch) ? size : ch === ' ' ? size * 0.3 : size * 0.62;
  return w;
};

const base = {
  code: 'BZ-482913',
  clientName: 'Aïcha Mbarga',
  clientPhone: '+237 677 12 34 56',
  clientEmail: 'aicha@mbarga-import.cm',
  companyName: 'Mbarga Import SARL',
  clientCity: 'Douala',
  clientCountry: 'Cameroun',
  destination: 'warehouse' as const,
  settings: DEFAULT_SHIPPING_SETTINGS,
};

const texts = (ops: Op[]) => ops.filter((o): o is Extract<Op, { kind: 'text' }> => o.kind === 'text');
// Les filets fins entre deux lignes (les traits épais de section peuvent en toucher un).
const hairs = (ops: Op[]) => ops.filter((o): o is Extract<Op, { kind: 'line' }> => o.kind === 'line' && o.x1 !== o.x2 && o.width === 1);

describe('fitText / wrapText', () => {
  const font = '700 10px x';
  it('laisse un texte qui tient, coupe avec … sinon', () => {
    expect(fitText('abc', 100, font, measure)).toBe('abc');
    const cut = fitText('un-email-tres-long@exemple-de-domaine.com', 60, font, measure);
    expect(cut.endsWith('…')).toBe(true);
    expect(measure(cut, font)).toBeLessThanOrEqual(60);
  });
  it('coupe par mots en latin, par caractères en chinois', () => {
    const lines = wrapText('Unit 18, Building K, Baiyun Lake Logistics Park', 120, font, measure);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(measure(l, font)).toBeLessThanOrEqual(120);
    const zh = wrapText('广东省广州市白云区窖心街白云湖物流园', 60, font, measure);
    expect(zh.length).toBe(3);
    expect(zh.join('')).toBe('广东省广州市白云区窖心街白云湖物流园');
  });
  it('respecte le nombre de lignes maximum, avec … sur la dernière', () => {
    const lines = wrapText('a b c d e f g h i j k l m n o p', 30, font, measure, 2);
    expect(lines.length).toBe(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });
});

describe('layoutLabel — rien ne se chevauche, rien ne déborde', () => {
  const cases = [
    ['normal', base],
    ['air cargo', { ...base, destination: 'office' as const }],
    ['tout très long', {
      ...base,
      clientName: 'Marie-Antoinette Ngo Bassong Epouse Tchoungui Mbappe Fotso',
      clientEmail: 'marie-antoinette.ngo-bassong@import-export-cameroun-douala-bonaberi.com',
      companyName: 'Établissements Ngo Bassong Import Export et Fils SARL Douala',
      clientPhone: '+237 6 77 12 34 56 / +237 6 99 88 77 66',
      supplier: { name: 'Yiwu Hengda International Trading Company Limited', phone: '+86 137 0000 0000 / +86 136 1111 2222', email: 'sales-department@hengda-international-trading.cn', address: '浙江省义乌市福田街道国际商贸城三区三楼 12345 号 商铺 A-B-C' },
      settings: {
        ...DEFAULT_SHIPPING_SETTINGS,
        warehouse: { ...DEFAULT_SHIPPING_SETTINGS.warehouse, addressZh: '广东省广州市白云区窖心街白云湖物流园 K栋 18档 另一个很长的地址补充说明文字用于测试换行', addressEn: 'Unit 18, Building K, Baiyun Lake Logistics Park, Jiaoxin Street, Baiyun District, Guangzhou, Guangdong Province, People’s Republic of China, 510000' },
      },
    }],
  ] as const;

  for (const [name, data] of cases) {
    it(`${name} : chaque texte tient dans sa largeur et dans la feuille`, () => {
      const ops = layoutLabel(data, measure);
      for (const t of texts(ops)) {
        expect(measure(t.text, t.font), `« ${t.text} »`).toBeLessThanOrEqual(t.maxWidth + 0.01);
        expect(t.y).toBeGreaterThan(0);
        expect(t.y).toBeLessThan(LABEL_H);
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.x).toBeLessThanOrEqual(LABEL_W);
      }
    });
    it(`${name} : les lignes se suivent sans se croiser, et la dernière tient dans la feuille`, () => {
      const ys = hairs(layoutLabel(data, measure)).map((l) => l.y1);
      const sorted = [...ys].sort((a, b) => a - b);
      // Deux filets ne peuvent pas être à moins de 12 px l'un de l'autre :
      // en dessous, la ligne entre eux ne peut pas contenir un texte de 9 px.
      for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1], `filets ${sorted[i - 1]} → ${sorted[i]}`).toBeGreaterThanOrEqual(12);
      expect(sorted[sorted.length - 1]).toBeLessThanOrEqual(LABEL_H - 14);
    });
  }

  it('le code client est écrit en entier, jamais coupé', () => {
    const ops = layoutLabel(base, measure);
    const code = texts(ops).filter((t) => t.text === 'BZ-482913');
    expect(code.length).toBe(2); // en gros à côté du QR, et en pied
  });

  it('l’étiquette porte le mode d’envoi', () => {
    expect(texts(layoutLabel(base, measure)).some((t) => t.text === '海运 · SEA CARGO')).toBe(true);
    expect(texts(layoutLabel({ ...base, destination: 'office' }, measure)).some((t) => t.text === '空运 · AIR CARGO')).toBe(true);
  });
});
