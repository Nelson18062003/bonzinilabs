import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildFlyerData, flyerBrackets, flyerCaption, flyerDate, flyerFileName, smallPaymentTitle } from '@/lib/rateFlyer';
import { teamPaymentFromCny, teamPaymentRate } from '@/lib/countryRates';
import type { DailyRate, RateAdjustment } from '@/types/rates';

// Production du 24/09/2026 : 10 700 cash, 10 800 le reste ; pays −1 % ; t1 −2 %, t2 et t3 0 %.
const rate: DailyRate = { id: 'r', rate_cash: 10700, rate_alipay: 10800, rate_wechat: 10800, rate_virement: 10800, effective_at: '2026-09-24T06:02:56Z', created_at: '', created_by: null, is_active: true };
const adj = (type: 'country' | 'tier', key: string, percentage: number, is_reference = false): RateAdjustment =>
  ({ id: key, type, key, label: key, percentage, is_reference, sort_order: 0, updated_at: '', updated_by: null });
const prod: RateAdjustment[] = [
  adj('country', 'cameroun', 0, true), adj('country', 'gabon', -1), adj('country', 'guinee', -1),
  adj('tier', 't3', 0, true), adj('tier', 't2', 0), adj('tier', 't1', -2),
];
const day = new Date('2026-09-24T10:00:00Z');

describe('le flyer Taux du jour', () => {
  it('fusionne les tranches au même pourcentage : « 400 000 XAF et plus » et « Moins de 400 000 XAF »', () => {
    expect(flyerBrackets(prod).map((b) => [b.label.replace(/\u00a0/g, ' '), b.pct])).toEqual([['400 000 XAF et plus', 0], ['Moins de 400 000 XAF', -2]]);
    const flat = prod.map((a) => (a.key === 't1' ? { ...a, percentage: 0 } : a));
    expect(flyerBrackets(flat).map((b) => b.label)).toEqual(['Tous montants']);
    const three = prod.map((a) => (a.key === 't2' ? { ...a, percentage: -1 } : a));
    expect(flyerBrackets(three).map((b) => b.label.replace(/\u00a0/g, ' '))).toEqual(['1 000 000 XAF et plus', 'De 400 000 à 999 999 XAF', 'Moins de 400 000 XAF']);
  });

  it('titre le bloc rouge en bon français', () => {
    const three = flyerBrackets(prod.map((a) => (a.key === 't2' ? { ...a, percentage: -1 } : a)));
    expect(three.slice(1).map((b) => smallPaymentTitle(b).replace(/\u00a0/g, ' '))).toEqual(['Paiement de 400 000 à 999 999 XAF', 'Paiement de moins de 400 000 XAF']);
  });

  it('imprime les taux de production du 24/09 : Cameroun 10 800 / 10 700, petits paiements 10 584 / 10 486', () => {
    const d = buildFlyerData(rate, prod, 'cameroun', day);
    expect(d.country).toEqual({ key: 'cameroun', label: 'Cameroun', iso: 'CM' });
    expect(d.date).toBe('Jeudi 24 septembre 2026');
    expect(d.groups).toEqual([
      { keys: ['alipay', 'wechat', 'virement'], label: 'Alipay · WeChat Pay · Virement', rates: [10800, 10584] },
      { keys: ['cash'], label: 'Cash', rates: [10700, 10486] },
    ]);
  });

  it('dérive chaque pays : Gabon 10 692 / 10 593, petits paiements 10 478 / 10 381', () => {
    const d = buildFlyerData(rate, prod, 'gabon', day);
    expect(d.groups.map((g) => g.rates)).toEqual([[10692, 10478], [10593, 10381]]);
    expect(buildFlyerData(rate, prod, 'guinee', day).country.label).toBe('Guinée Équatoriale');
    expect(buildFlyerData(rate, prod, 'inconnu', day).country.key).toBe('cameroun');
  });

  it('sépare les modes le jour où leurs taux diffèrent (13/05)', () => {
    const d = buildFlyerData({ ...rate, rate_cash: 11350, rate_alipay: 11400, rate_wechat: 11400, rate_virement: 11450 }, prod, 'cameroun', day);
    expect(d.groups.map((g) => g.label)).toEqual(['Alipay · WeChat Pay', 'Virement', 'Cash']);
  });

  it('donne le texte du jour à coller dans WhatsApp, signé NORTON GAUSS BONZINI SARL', () => {
    const text = flyerCaption(buildFlyerData(rate, prod, 'gabon', day)).replace(/\u00a0/g, ' ');
    expect(text).toBe([
      'Taux du jour · Gabon · jeudi 24 septembre 2026',
      'Pour 1 000 000 XAF, votre fournisseur reçoit :',
      '• Alipay, WeChat Pay, Virement : 10 692 ¥',
      '• Cash : 10 593 ¥',
      '',
      'Paiement de moins de 400 000 XAF :',
      '• Alipay, WeChat Pay, Virement : 10 478 ¥',
      '• Cash : 10 381 ¥',
      '',
      'Taux valables ce jour, confirmés au moment du paiement.',
      'NORTON GAUSS BONZINI SARL',
    ].join('\n'));
  });

  it('prend le jour de Douala et nomme le fichier par pays', () => {
    expect(flyerDate(new Date('2026-09-24T23:30:00Z'))).toBe('Vendredi 25 septembre 2026');
    expect(flyerFileName('gabon', 'png', day)).toBe('taux_du_jour_gabon_2026-09-24.png');
  });

  it("n'imprime ni « Bonzini » seul, ni site, ni WhatsApp", () => {
    const src = ['src/mobile/components/rates/RateFlyer.tsx', 'src/lib/rateFlyer.ts'].map((f) => readFileSync(f, 'utf8')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    for (const forbidden of [/bonzinilabs\.com/i, /bonzini-logo/i, /WhatsApp/, /CONTACT_PHONE/, /Guangzhou/, />Bonzini</]) expect(src, String(forbidden)).not.toMatch(forbidden);
    expect(src).toContain('LEGAL_NAME');
  });
});

describe("le taux des paiements saisis par l'équipe", () => {
  it('applique le pays ET la tranche du montant, comme le flyer', () => {
    expect(teamPaymentRate(10800, 'gabon', prod, 300_000)).toBe(10478);
    expect(teamPaymentRate(10800, 'gabon', prod, 400_000)).toBe(10692);
    expect(teamPaymentRate(10800, 'cameroun', prod, 250_000)).toBe(10584);
    expect(teamPaymentRate(10800, 'cameroun', prod, 5_000_000)).toBe(10800);
    // Montant pas encore saisi : le taux du flyer.
    expect(teamPaymentRate(10800, 'gabon', prod, 0)).toBe(10692);
    // Client hors des 6 pays ou sans pays : Cameroun.
    expect(teamPaymentRate(10800, null, prod, 300_000)).toBe(10584);
  });

  it('en ¥, trouve la bonne tranche, et la plus favorable juste sous la borne', () => {
    expect(teamPaymentFromCny(10800, 'gabon', prod, 3000)).toEqual({ rate: 10478, xaf: 286314 });
    expect(teamPaymentFromCny(10800, 'gabon', prod, 10000)).toEqual({ rate: 10692, xaf: 935279 });
    // 4 200 ¥ : 400 841 XAF au petit taux (≥ 400 000), 392 817 au grand (< 400 000) → le grand.
    expect(teamPaymentFromCny(10800, 'gabon', prod, 4200).rate).toBe(10692);
  });
});
