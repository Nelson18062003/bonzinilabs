import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FLYER_TEXT, buildFlyerData, flyerBrackets, flyerCaption, flyerDate, flyerFileName, flyerTime, smallPaymentTitle } from '@/lib/rateFlyer';
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
    expect(d.time).toBe('11h00');
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

  it('donne le texte du jour à coller dans WhatsApp, signé BONZINI', () => {
    const text = flyerCaption(buildFlyerData(rate, prod, 'gabon', day)).replace(/\u00a0/g, ' ');
    expect(text).toBe([
      'Taux du jour · Gabon → Chine · jeudi 24 septembre 2026 · 11h00',
      'Pour 1 000 000 XAF, votre fournisseur reçoit :',
      '• Alipay, WeChat Pay, Virement : 10 692 ¥',
      '• Cash : 10 593 ¥',
      '',
      'Paiement de moins de 400 000 XAF :',
      '• Alipay, WeChat Pay, Virement : 10 478 ¥',
      '• Cash : 10 381 ¥',
      '',
      'BONZINI',
    ].join('\n'));
  });

  it('prend le jour de Douala et nomme le fichier par pays', () => {
    expect(flyerDate(new Date('2026-09-24T23:30:00Z'))).toBe('Vendredi 25 septembre 2026');
    expect(flyerFileName('gabon', 'png', day)).toBe('taux_du_jour_gabon_2026-09-24.png');
    // L'heure de Douala, sur 24 h : minuit et demi, pas « 24h30 ».
    expect(flyerTime(new Date('2026-09-24T23:30:00Z'))).toBe('00h30');
    expect(flyerTime(new Date('2026-09-24T07:05:00Z'))).toBe('08h05');
  });

  it('imprime BONZINI et le drapeau chinois, sans site, ni WhatsApp, ni raison sociale', () => {
    const src = ['src/mobile/components/rates/RateFlyer.tsx', 'src/lib/rateFlyer.ts'].map((f) => readFileSync(f, 'utf8')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    for (const forbidden of [/bonzinilabs\.com/i, /bonzini-logo/i, /WhatsApp/, /CONTACT_PHONE/, /Guangzhou/, /LEGAL_NAME/, /NORTON/, /confirmé au moment/]) expect(src, String(forbidden)).not.toMatch(forbidden);
    expect(src).toContain('FLYER_BRAND');
    expect(src).toContain("flagUrl('CN')");
  });
});

describe('le flyer en anglais', () => {
  it('traduit les tranches et le bloc rouge, avec des virgules pour les milliers', () => {
    const three = flyerBrackets(prod.map((a) => (a.key === 't2' ? { ...a, percentage: -1 } : a)), 'en');
    expect(three.map((b) => b.label)).toEqual(['1,000,000 XAF and above', 'From 400,000 to 999,999 XAF', 'Under 400,000 XAF']);
    expect(three.slice(1).map((b) => smallPaymentTitle(b, 'en'))).toEqual(['Payment of 400,000 to 999,999 XAF', 'Payment under 400,000 XAF']);
    expect(flyerBrackets(prod.map((a) => (a.key === 't1' ? { ...a, percentage: 0 } : a)), 'en').map((b) => b.label)).toEqual(['All amounts']);
  });

  it('donne le jour, l’heure, le pays et les modes en anglais — mêmes chiffres qu’en français', () => {
    const fr = buildFlyerData(rate, prod, 'rca', day, 'fr');
    const en = buildFlyerData(rate, prod, 'rca', day, 'en');
    expect(en.lang).toBe('en');
    expect(en.date).toBe('Thursday 24 September 2026');
    expect(en.time).toBe('11:00');
    expect(en.country.label).toBe('Central African Rep.');
    expect(en.groups.map((g) => g.label)).toEqual(['Alipay · WeChat Pay · Bank transfer', 'Cash']);
    expect(en.groups.map((g) => g.rates)).toEqual(fr.groups.map((g) => g.rates));
    expect(flyerDate(day, 'en')).toBe('Thursday 24 September 2026');
    expect(flyerTime(day, 'en')).toBe('11:00');
    expect(flyerFileName('rca', 'png', day, 'en')).toBe('todays_rate_rca_2026-09-24.png');
  });

  it('donne le texte du jour en anglais, signé BONZINI', () => {
    expect(flyerCaption(buildFlyerData(rate, prod, 'cameroun', day, 'en'))).toBe([
      "Today's rate · Cameroon → China · Thursday 24 September 2026 · 11:00",
      'For 1,000,000 XAF, your supplier receives:',
      '• Alipay, WeChat Pay, Bank transfer: 10,800 ¥',
      '• Cash: 10,700 ¥',
      '',
      'Payment under 400,000 XAF:',
      '• Alipay, WeChat Pay, Bank transfer: 10,584 ¥',
      '• Cash: 10,486 ¥',
      '',
      'BONZINI',
    ].join('\n'));
  });

  it('a les mêmes mots, dans les deux langues, que le flyer serveur de Mola et Telegram', () => {
    const edge = readFileSync('supabase/functions/generate-flyer/index.ts', 'utf8');
    const words: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === 'string') words.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(FLYER_TEXT);
    for (const w of words) expect(edge, w).toContain(w.replace(/\u00a0/g, '\\u00a0'));
    expect(edge).toContain('const FLYER_BRAND = "BONZINI"');
    expect(edge).toContain('flagDataUrl("CN")');
    for (const gone of [/NORTON/, /Taux valables/, /LEGAL_NAME/]) expect(edge).not.toMatch(gone);
  });

  it('dessine avec la police livrée avec l’app, jamais celle de Google Fonts', () => {
    const flyer = readFileSync('src/mobile/components/rates/RateFlyer.tsx', 'utf8');
    const fonts = readFileSync('src/lib/flyerFonts.ts', 'utf8');
    const exporter = readFileSync('src/lib/exportFlyer.ts', 'utf8');
    expect(flyer).toContain('fontFamily: FLYER_FONT_STACK');
    expect(fonts).toContain('@fontsource/dm-sans/files/');
    expect(fonts).not.toMatch(/googleapis|gstatic/);
    expect(exporter).toContain('fontEmbedCSS');
    expect(exporter).toContain('loadFlyerFonts()');
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
