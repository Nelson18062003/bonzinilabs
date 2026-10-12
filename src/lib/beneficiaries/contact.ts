// ============================================================
// Les coordonnées d'un bénéficiaire, saisies avec leur FORMAT (12/10/2026).
//
// Retour de la direction : « pour un identifiant Alipay, tu ne dois pas
// prendre n'importe quel code ; un téléphone se formate avec l'indicatif du
// pays ; pareil pour l'email ». Le partenaire en Chine paie d'après ce qui
// est écrit : un compte mal saisi est un paiement qui n'arrive pas.
//
// Ce qui est un « compte » :
//   · Alipay : un numéro de téléphone (le plus souvent chinois, +86 1xx…) ou
//     une adresse email — c'est ce qu'on tape dans Alipay pour payer ;
//   · WeChat : l'ID WeChat (6 à 20 caractères, commence par une lettre :
//     lettres, chiffres, « _ » et « - ») ou le numéro de téléphone.
// Le QR code peut remplacer le compte (on scanne au lieu de taper).
//
// Formats stockés :
//   · téléphone → international lisible : « +86 138 0219 4471 » (le
//     partenaire le lit tel quel ; libphonenumber le relit sans ambiguïté) ;
//   · email → en minuscules, sans espaces ;
//   · ID WeChat → tel quel, sans espaces.
// ============================================================
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { formatNational, isPhoneComplete, type PhoneValue } from '@/components/form/PhoneNumberInput';
import { EMAIL_SHAPE } from '@/lib/people';
import type { BeneficiaryMode, IdentifierType } from './spec';

export type AccountKind = 'phone' | 'email' | 'id';

/** Ce qu'on peut donner comme compte, par méthode — le premier est proposé d'office. */
export const ACCOUNT_KINDS: Record<'alipay' | 'wechat', AccountKind[]> = {
  alipay: ['phone', 'email'],
  wechat: ['id', 'phone'],
};

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  phone: 'Téléphone',
  email: 'Email',
  id: 'ID WeChat',
};

/** Les bénéficiaires de paiements vers la Chine ont, le plus souvent, un numéro chinois. */
export const DEFAULT_BENEFICIARY_COUNTRY: CountryCode = 'CN';

export const emptyPhone = (country: CountryCode = DEFAULT_BENEFICIARY_COUNTRY): PhoneValue => ({ country, national: '' });

/** Ce que l'opérateur a saisi pour un nouveau bénéficiaire. */
export interface BeneficiaryDraft {
  name: string;
  /** Alipay / WeChat : la nature du compte. */
  accountKind: AccountKind;
  /** Le compte quand c'est un téléphone. */
  accountPhone: PhoneValue;
  /** Le compte quand c'est un email ou un ID WeChat. */
  accountText: string;
  /** Téléphone de contact (obligatoire pour le cash « quelqu'un d'autre »). */
  phone: PhoneValue;
  /** Email de contact. */
  email: string;
  bank: string;
  account: string;
  bankExtra: string;
  /** Cash : le client vient retirer lui-même. */
  isClient: boolean;
}

export function emptyDraft(mode: BeneficiaryMode | null): BeneficiaryDraft {
  return {
    name: '',
    accountKind: mode === 'wechat' ? 'id' : 'phone',
    accountPhone: emptyPhone(),
    accountText: '',
    phone: emptyPhone(),
    email: '',
    bank: '',
    account: '',
    bankExtra: '',
    isClient: false,
  };
}

// ── Lecture d'une saisie ─────────────────────────────────────────────

const PHONE_LIKE = /^[+(]?[\d\s().-]{6,}$/;

/** Une saisie collée : email, téléphone, ou autre chose (un ID). */
export function detectAccountKind(raw: string): AccountKind {
  const v = raw.trim();
  if (v.includes('@')) return 'email';
  if (PHONE_LIKE.test(v) && v.replace(/\D/g, '').length >= 6) return 'phone';
  return 'id';
}

/**
 * Un numéro collé (« +86 138 0219 4471 », « 0086 13802194471 »,
 * « 13802194471 ») → la valeur du champ téléphone, pays compris quand le
 * numéro le dit. Sans indicatif, on garde le pays déjà choisi.
 */
export function phoneFromText(raw: string, country: CountryCode = DEFAULT_BENEFICIARY_COUNTRY): PhoneValue {
  const v = raw.trim().replace(/^00/, '+');
  try {
    const parsed = parsePhoneNumberFromString(v, country);
    if (parsed?.country) return { country: parsed.country, national: formatNational(parsed.nationalNumber, parsed.country) };
  } catch {
    /* saisie illisible : on garde les chiffres */
  }
  return { country, national: formatNational(v, country) };
}

/** Le téléphone tel qu'on le range : « +86 138 0219 4471 », ou null s'il est incomplet. */
export function storedPhone(value: PhoneValue): string | null {
  if (!isPhoneComplete(value)) return null;
  try {
    return parsePhoneNumberFromString(value.national.replace(/\D/g, ''), value.country)?.formatInternational() ?? null;
  } catch {
    return null;
  }
}

/**
 * Un compte Alipay / WeChat est TOUJOURS un mobile. En Chine : 11 chiffres,
 * « 1 » puis 3 à 9 (le contrôle générique accepterait « 138 0219 » comme un
 * fixe). Ailleurs, la règle du pays.
 */
export function isAccountPhoneValid(value: PhoneValue): boolean {
  const digits = value.national.replace(/\D/g, '');
  if (value.country === 'CN') return /^1[3-9]\d{9}$/.test(digits);
  return isPhoneComplete(value);
}

export const normalizeEmail = (v: string) => v.trim().replace(/\s+/g, '').toLowerCase();

export function isEmail(v: string): boolean {
  const e = normalizeEmail(v);
  return e.length > 0 && e.length <= 120 && EMAIL_SHAPE.test(e);
}

/** Les règles de WeChat : 6 à 20 caractères, une lettre d'abord, puis lettres, chiffres, « _ » ou « - ». */
export const WECHAT_ID = /^[A-Za-z][A-Za-z0-9_-]{5,19}$/;

export function wechatIdError(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\+?[\d\s-]+$/.test(v)) return 'Un numéro ? Choisissez « Téléphone ».';
  if (v.includes('@')) return 'Une adresse email n’est pas un ID WeChat.';
  if (/\s/.test(v)) return 'Un ID WeChat n’a pas d’espace.';
  if (v.length < 6 || v.length > 20) return 'Un ID WeChat compte de 6 à 20 caractères.';
  if (!/^[A-Za-z]/.test(v)) return 'Un ID WeChat commence par une lettre.';
  if (!WECHAT_ID.test(v)) return 'Lettres, chiffres, « _ » et « - » seulement.';
  return null;
}

// ── Contrôle et mise en forme ────────────────────────────────────────

export type DraftField = 'name' | 'account' | 'phone' | 'email' | 'bank' | 'bankAccount';
export type DraftErrors = Partial<Record<DraftField, string>>;

const phoneTyped = (p: PhoneValue) => p.national.replace(/\D/g, '').length > 0;

/**
 * Ce qui manque ou ne va pas. Vide = on peut payer. `hasQr` : un QR code
 * collé remplace le compte pour Alipay / WeChat.
 */
export function draftErrors(mode: BeneficiaryMode, d: BeneficiaryDraft, opts: { hasQr?: boolean } = {}): DraftErrors {
  const e: DraftErrors = {};
  const cashSelf = mode === 'cash' && d.isClient;
  if (!cashSelf && d.name.trim().length < 2) e.name = 'Indiquez le nom du bénéficiaire.';

  if (mode === 'alipay' || mode === 'wechat') {
    const label = mode === 'alipay' ? 'Alipay' : 'WeChat';
    if (d.accountKind === 'phone') {
      if (phoneTyped(d.accountPhone) && !isAccountPhoneValid(d.accountPhone))
        e.account = d.accountPhone.country === 'CN' ? 'Un mobile chinois compte 11 chiffres et commence par 1.' : 'Numéro incomplet ou invalide pour ce pays.';
      else if (!phoneTyped(d.accountPhone) && !opts.hasQr) e.account = `Indiquez le compte ${label} ou collez son QR code.`;
    } else if (d.accountKind === 'email') {
      if (d.accountText.trim() && !isEmail(d.accountText)) e.account = 'Adresse email invalide.';
      else if (!d.accountText.trim() && !opts.hasQr) e.account = `Indiquez le compte ${label} ou collez son QR code.`;
    } else {
      const err = wechatIdError(d.accountText);
      if (err) e.account = err;
      else if (!d.accountText.trim() && !opts.hasQr) e.account = `Indiquez le compte ${label} ou collez son QR code.`;
    }
  }

  if (mode === 'bank_transfer') {
    if (!d.bank.trim()) e.bank = 'Indiquez la banque.';
    const acc = d.account.replace(/[\s-]/g, '');
    if (!acc) e.bankAccount = 'Indiquez le numéro de compte.';
    else if (!/^[A-Za-z0-9]{6,34}$/.test(acc)) e.bankAccount = 'Numéro de compte invalide (6 à 34 chiffres ou lettres).';
  }

  if (!cashSelf) {
    if (phoneTyped(d.phone) && !isPhoneComplete(d.phone)) e.phone = 'Numéro incomplet ou invalide pour ce pays.';
    else if (mode === 'cash' && !phoneTyped(d.phone)) e.phone = 'Indiquez le téléphone de la personne qui retire.';
  }
  if (d.email.trim() && !isEmail(d.email)) e.email = 'Adresse email invalide.';
  return e;
}

export interface DraftPayload {
  name?: string;
  identifier?: string;
  identifier_type?: IdentifierType;
  phone?: string;
  email?: string;
  bank_name?: string;
  bank_account?: string;
  bank_extra?: string;
}

/** Les colonnes du bénéficiaire, mises en forme. Les champs vides n'y sont pas. */
export function draftPayload(mode: BeneficiaryMode, d: BeneficiaryDraft): DraftPayload {
  const out: DraftPayload = {};
  const cashSelf = mode === 'cash' && d.isClient;
  if (!cashSelf && d.name.trim()) out.name = d.name.trim().replace(/\s+/g, ' ');

  if (mode === 'alipay' || mode === 'wechat') {
    if (d.accountKind === 'phone') {
      const p = isAccountPhoneValid(d.accountPhone) ? storedPhone(d.accountPhone) : null;
      if (p) Object.assign(out, { identifier: p, identifier_type: 'phone' as const });
    } else if (d.accountKind === 'email') {
      if (isEmail(d.accountText)) Object.assign(out, { identifier: normalizeEmail(d.accountText), identifier_type: 'email' as const });
    } else if (d.accountText.trim() && !wechatIdError(d.accountText)) {
      Object.assign(out, { identifier: d.accountText.trim(), identifier_type: 'id' as const });
    }
  }
  if (mode === 'bank_transfer') {
    if (d.bank.trim()) out.bank_name = d.bank.trim().replace(/\s+/g, ' ');
    // Tel que saisi (les espaces aident à relire), sans espaces en trop.
    const acc = d.account.trim().replace(/\s+/g, ' ').toUpperCase();
    if (acc) out.bank_account = acc;
    if (d.bankExtra.trim()) out.bank_extra = d.bankExtra.trim().replace(/\s+/g, ' ');
  }
  if (!cashSelf) {
    const phone = storedPhone(d.phone);
    if (phone) out.phone = phone;
  }
  if (isEmail(d.email)) out.email = normalizeEmail(d.email);
  return out;
}
