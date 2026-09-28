// ============================================================
// LA COTATION DU SIMULATEUR — ses mots en français et en anglais (le chinois
// dessous ne change pas), ses nombres et sa date. Utilisé par l'image
// (RateQuoteCard) et par le texte à copier (RateQuoteSimulator).
// ============================================================
import type { FlyerLang } from '@/lib/rateFlyer';

/** Les mots de la cotation, par langue (le chinois, lui, ne change pas). */
export const QUOTE_TEXT = {
  fr: {
    tagline: 'PAIEMENTS VERS LA CHINE',
    badge: 'Cotation',
    youPay: 'Vous payez',
    supplierGets: 'Votre fournisseur reçoit',
    rate: 'Taux appliqué',
    valid: 'Cotation valable aujourd’hui, au taux du jour.',
    methods: { alipay: 'Alipay', wechat: 'WeChat Pay', virement: 'Virement bancaire', cash: 'Cash' },
    days: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  },
  en: {
    tagline: 'PAYMENTS TO CHINA',
    badge: 'Quote',
    youPay: 'You pay',
    supplierGets: 'Your supplier receives',
    rate: 'Rate applied',
    valid: 'Quote valid today, at today’s rate.',
    methods: { alipay: 'Alipay', wechat: 'WeChat Pay', virement: 'Bank transfer', cash: 'Cash' },
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
} as const;

/** « 1 000 000 » en français (espace insécable), « 1,000,000 » en anglais. */
export function quoteNumber(n: number, lang: FlyerLang = 'fr'): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'en' ? ',' : '\u00a0');
}

/** « Lundi 31 août 2026 » / « Monday 31 August 2026 ». */
export function quoteDate(now: Date, lang: FlyerLang = 'fr'): string {
  const t = QUOTE_TEXT[lang];
  const day = t.days[now.getDay()];
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${now.getDate()} ${t.months[now.getMonth()]} ${now.getFullYear()}`;
}
