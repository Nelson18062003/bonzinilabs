// Les documents cargo (devis, reçu, facture) sortent dans UNE langue, au choix :
// montants, dates et noms de fichier en français OU en anglais, jamais un
// mélange ; la langue choisie est retenue sur l'appareil.
import { afterEach, describe, expect, it } from 'vitest';
import { formatDateIn, formatXafIn } from '@/lib/pdf/helpers';
import { invoiceFileName, quoteFileName, readCargoDocLang, receiptFileName, storeCargoDocLang } from '@/lib/cargoQuotePdf';
import type { Quote, QuotePayment } from '@/lib/cargoQuote';

const LANG_KEY = 'bonzini-cargo-doc-lang';

const quote = (over: Partial<Quote> = {}): Quote => ({
  id: 'q1',
  quote_no: 'BZ-DV-0042',
  deposit_id: 'dep1',
  status: 'sent',
  currency: 'XAF',
  total_xaf: 54600,
  amount_paid_xaf: 0,
  notes: null,
  sent_at: null,
  created_at: '2026-10-02T10:00:00Z',
  updated_at: '2026-10-02T10:00:00Z',
  deposit_no: 'BZ-RC-0007',
  location: 'office',
  opened_at: '2026-10-02T10:00:00Z',
  closed_at: null,
  client: {
    user_id: 'u1',
    customer_code: 'BZ123',
    first_name: 'Awa',
    last_name: 'Ndiaye',
    phone: null,
    email: null,
    company_name: null,
    city: null,
    country: null,
  },
  lines: [],
  ...over,
});

const payment: QuotePayment = {
  id: 'p1',
  receipt_no: 'BZ-RE-0009',
  amount_xaf: 20000,
  method: 'cash',
  place: 'douala',
  paid_at: '2026-10-02T10:00:00Z',
  reference: null,
  proof_path: null,
  note: null,
  received_by: null,
  created_at: '2026-10-02T10:00:00Z',
  cancelled_at: null,
  cancel_reason: null,
};

describe('formatXafIn — un montant dans la langue du document', () => {
  it('français : espaces ordinaires entre les milliers', () => {
    expect(formatXafIn(1234567, 'fr')).toBe('1 234 567 XAF');
    expect(formatXafIn(1234567, 'fr')).not.toMatch(/[\u00a0\u202f]/);
  });
  it('anglais : virgules entre les milliers', () => {
    expect(formatXafIn(1234567, 'en')).toBe('1,234,567 XAF');
  });
  it('petits montants : pas de séparateur', () => {
    expect(formatXafIn(999, 'fr')).toBe('999 XAF');
    expect(formatXafIn(999, 'en')).toBe('999 XAF');
  });
  it('négatifs : le signe devant, le groupement intact', () => {
    expect(formatXafIn(-2500, 'fr')).toBe('-2 500 XAF');
    expect(formatXafIn(-1234567, 'en')).toBe('-1,234,567 XAF');
  });
  it('arrondi à l\'unité', () => {
    expect(formatXafIn(12500.4, 'fr')).toBe('12 500 XAF');
    expect(formatXafIn(12500.6, 'en')).toBe('12,501 XAF');
  });
  it('absent (null / undefined) : zéro', () => {
    expect(formatXafIn(null, 'fr')).toBe('0 XAF');
    expect(formatXafIn(undefined, 'en')).toBe('0 XAF');
  });
});

describe('formatDateIn — une date dans la langue du document', () => {
  // Midi UTC le 15 : le même jour et le même mois quel que soit le fuseau.
  const iso = '2026-10-15T12:00:00Z';
  it('français : « octobre » et « à »', () => {
    const s = formatDateIn(iso, 'fr');
    expect(s).toContain('octobre');
    expect(s).toContain(' à ');
    expect(s).toContain('2026');
    expect(s).not.toContain('October');
    expect(s).not.toContain(' at ');
  });
  it('anglais : « October » et « at »', () => {
    const s = formatDateIn(iso, 'en');
    expect(s).toContain('October');
    expect(s).toContain(' at ');
    expect(s).toContain('2026');
    expect(s).not.toContain('octobre');
    expect(s).not.toContain(' à ');
  });
  it('accepte une Date comme une chaîne ISO', () => {
    expect(formatDateIn(new Date(iso), 'en')).toBe(formatDateIn(iso, 'en'));
    expect(formatDateIn(new Date(iso), 'fr')).toBe(formatDateIn(iso, 'fr'));
  });
});

describe('noms de fichier — dans la langue du document', () => {
  it('devis / quote', () => {
    expect(quoteFileName(quote(), 'fr')).toBe('bonzini-devis-BZ-DV-0042-BZ123.pdf');
    expect(quoteFileName(quote(), 'en')).toBe('bonzini-quote-BZ-DV-0042-BZ123.pdf');
  });
  it('français par défaut', () => {
    expect(quoteFileName(quote())).toBe('bonzini-devis-BZ-DV-0042-BZ123.pdf');
    expect(receiptFileName(quote(), payment)).toBe('bonzini-recu-BZ-RE-0009-BZ123.pdf');
    expect(invoiceFileName(quote({ invoice_no: 'BZ-FA-0003' }))).toBe('bonzini-facture-BZ-FA-0003-BZ123.pdf');
  });
  it('reçu / receipt', () => {
    expect(receiptFileName(quote(), payment, 'fr')).toBe('bonzini-recu-BZ-RE-0009-BZ123.pdf');
    expect(receiptFileName(quote(), payment, 'en')).toBe('bonzini-receipt-BZ-RE-0009-BZ123.pdf');
  });
  it('facture / invoice : le numéro de facture, sinon celui du devis', () => {
    expect(invoiceFileName(quote({ invoice_no: 'BZ-FA-0003' }), 'fr')).toBe('bonzini-facture-BZ-FA-0003-BZ123.pdf');
    expect(invoiceFileName(quote({ invoice_no: 'BZ-FA-0003' }), 'en')).toBe('bonzini-invoice-BZ-FA-0003-BZ123.pdf');
    expect(invoiceFileName(quote({ invoice_no: null }), 'fr')).toBe('bonzini-facture-BZ-DV-0042-BZ123.pdf');
    expect(invoiceFileName(quote({ invoice_no: null }), 'en')).toBe('bonzini-invoice-BZ-DV-0042-BZ123.pdf');
  });
  it('sans client : le numéro du dépôt', () => {
    expect(quoteFileName(quote({ client: null }), 'fr')).toBe('bonzini-devis-BZ-DV-0042-BZ-RC-0007.pdf');
    expect(quoteFileName(quote({ client: null }), 'en')).toBe('bonzini-quote-BZ-DV-0042-BZ-RC-0007.pdf');
  });
});

describe('readCargoDocLang / storeCargoDocLang — la langue retenue sur l\'appareil', () => {
  afterEach(() => localStorage.removeItem(LANG_KEY));

  it('rien de retenu : français', () => {
    localStorage.removeItem(LANG_KEY);
    expect(readCargoDocLang()).toBe('fr');
  });
  it('aller-retour : anglais puis français', () => {
    storeCargoDocLang('en');
    expect(localStorage.getItem(LANG_KEY)).toBe('en');
    expect(readCargoDocLang()).toBe('en');
    storeCargoDocLang('fr');
    expect(readCargoDocLang()).toBe('fr');
  });
  it('valeur inconnue en stockage : français', () => {
    localStorage.setItem(LANG_KEY, 'de');
    expect(readCargoDocLang()).toBe('fr');
    localStorage.setItem(LANG_KEY, '');
    expect(readCargoDocLang()).toBe('fr');
  });
});
