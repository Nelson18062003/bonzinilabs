// ============================================================
// LA FICHE MOBILE MONEY — les données et les textes, tirés de la même source
// que l'app (src/data/depositMethodsData.ts) pour que la fiche remise au client
// dise toujours les mêmes numéros, noms et codes que l'écran de dépôt.
//
// Deux façons de payer, présentées SÉPARÉMENT, chacune sur sa page :
//   · la FLOTTE (Float) : transfert de flotte vers notre compte — il faut
//     notre NUMÉRO et le nom du TITULAIRE ;
//   · le RETRAIT (Withdrawal) : notre code à composer — il faut le CODE, où
//     seul MONTANT change.
// Bilingue : nos clients sont francophones ET anglophones ; chaque texte a
// sa version française (d'abord) et anglaise (juste dessous).
// Deux mises en page : portrait et paysage.
// Le document est émis par la société (NORTON GAUSS BONZINI SARL) : aucun
// site, aucune marque d'app, aucun plafond, aucune étape de menu inventée.
// ============================================================
import { mtnMerchantInfo, mtnMoneyAccount, omMerchantInfo, orangeMoneyAccount } from '@/data/depositMethodsData';

export type MobileMoneyOperatorKey = 'orange' | 'mtn';
export type GuideOrientation = 'portrait' | 'landscape';

/** Un texte dans les deux langues de nos clients. */
export interface Bi { fr: string; en: string }

export interface MobileMoneyOperator {
  key: MobileMoneyOperatorKey;
  name: string;
  /** Le type de notre compte côté Flotte, tel que l'opérateur le nomme (UV chez Orange, Float chez MTN). */
  account: Bi;
  /** Le nom du titulaire, celui qui s'affiche sur le téléphone du client avant validation. */
  holder: string;
  /** Le numéro, groupé pour la lecture : « 696 10 38 64 ». */
  number: string;
  /** Le numéro international : « +237 696 10 38 64 ». */
  numberIntl: string;
  /** Le code du Retrait, avec MONTANT à remplacer. */
  merchantCode: string;
}

export interface MobileMoneyGuideData {
  operators: MobileMoneyOperator[];
}

/** « 6 96 10 38 64 » → « 696 10 38 64 » ; un numéro étranger reste tel quel. */
export function groupPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('237') ? digits.slice(3) : digits;
  if (local.length !== 9) return raw.trim();
  return `${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
}

export function intlPhone(raw: string): string {
  return `+237 ${groupPhone(raw)}`;
}

export function mobileMoneyGuideData(): MobileMoneyGuideData {
  return {
    operators: [
      {
        key: 'orange', name: 'Orange Money', account: { fr: 'Compte UV', en: 'UV account' }, holder: orangeMoneyAccount.accountName,
        number: groupPhone(orangeMoneyAccount.phone), numberIntl: intlPhone(orangeMoneyAccount.phone), merchantCode: omMerchantInfo.merchantCode,
      },
      {
        key: 'mtn', name: 'MTN Mobile Money', account: { fr: 'Compte Float', en: 'Float account' }, holder: mtnMoneyAccount.accountName,
        number: groupPhone(mtnMoneyAccount.phone), numberIntl: intlPhone(mtnMoneyAccount.phone), merchantCode: mtnMerchantInfo.merchantCode,
      },
    ],
  };
}

/**
 * Tout le texte de la fiche, à un seul endroit, en français et en anglais :
 * une idée par page, des phrases courtes. Le test de la fiche compte les mots
 * de chaque langue et interdit les mentions qui n'ont rien à y faire.
 */
export const MOBILE_MONEY_GUIDE_COPY = {
  docTitle: { fr: 'Coordonnées Mobile Money', en: 'Mobile Money details' },
  titleTop: { fr: 'Coordonnées', en: 'Details' },
  titleBottom: 'Mobile Money',
  page: { fr: 'Page', en: 'Page' },
  way: {
    flotte: { fr: 'Flotte', en: 'Float' },
    retrait: { fr: 'Retrait', en: 'Withdrawal' },
    preuve: { fr: 'Preuve', en: 'Proof' },
  },
  cover: {
    kicker: { fr: 'Pour vos dépôts', en: 'For your deposits' },
    lead: { fr: 'Deux façons de nous payer.', en: 'Two ways to pay us.' },
    flotte: { fr: 'Transfert vers notre numéro.', en: 'Transfer to our number.' },
    retrait: { fr: 'Notre code, avec le montant.', en: 'Our code, with the amount.' },
    or: { fr: 'ou', en: 'or' },
    choose: { fr: 'Choisissez une seule façon.', en: 'Choose only one way.' },
    preuve: { fr: 'Puis la preuve', en: 'Then proof of payment' },
    operators: { fr: 'Opérateurs acceptés', en: 'Accepted operators' },
  },
  flotte: {
    eyebrow: { fr: 'Façon 1 sur 2', en: 'Option 1 of 2' },
    word: { fr: 'Flotte', en: 'Float' },
    sentence: { fr: 'Depuis votre puce commerciale.', en: 'From your business SIM.' },
    needs: { fr: 'Numéro + Titulaire', en: 'Number + Account holder' },
    number: { fr: 'Numéro', en: 'Number' },
    holder: { fr: 'Titulaire', en: 'Account holder' },
    check: { fr: 'Nom différent ? Ne validez pas.', en: 'Different name? Do not confirm.' },
  },
  retrait: {
    eyebrow: { fr: 'Façon 2 sur 2', en: 'Option 2 of 2' },
    word: { fr: 'Retrait', en: 'Withdrawal' },
    sentence: { fr: 'Depuis votre compte Mobile Money.', en: 'From your Mobile Money account.' },
    needs: { fr: 'Code + Montant', en: 'Code + Amount' },
    code: { fr: 'Code', en: 'Code' },
    example: '50000',
    legend: { fr: 'La somme, en chiffres, sans espace.', en: 'The amount, in figures, no spaces or commas.' },
  },
  preuve: {
    eyebrow: { fr: 'Dans les deux cas', en: 'In both cases' },
    word: { fr: 'La preuve', en: 'Proof of payment' },
    sentence: { fr: 'Envoyez la capture juste après le paiement.', en: 'Send us the screenshot right after paying.' },
    needs: { fr: '4 éléments', en: '4 items' },
    shot: { fr: 'Votre capture', en: 'Your screenshot' },
    items: [
      { fr: 'Date et heure', en: 'Date and time' },
      { fr: 'Identifiant de transaction', en: 'Transaction ID' },
      { fr: 'Intitulé du compte', en: 'Account name' },
      { fr: 'Montant', en: 'Amount' },
    ],
    clear: { fr: 'Capture complète, nette, lisible.', en: 'Complete, sharp, readable screenshot.' },
    thanks: { fr: 'Merci pour votre confiance.', en: 'Thank you for your trust.' },
  },
} as const;

/** Tous les textes d'une langue, à plat, pour compter les mots. */
export function mobileMoneyGuideWords(lang: 'fr' | 'en'): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.fr === 'string' && typeof o.en === 'string') { out.push(...String(o[lang]).split(/\s+/).filter(Boolean)); return; }
      Object.values(o).forEach(walk);
    }
  };
  walk(MOBILE_MONEY_GUIDE_COPY);
  return out;
}

export const MOBILE_MONEY_GUIDE_FILENAME: Record<GuideOrientation, string> = {
  portrait: 'coordonnees-mobile-money-portrait.pdf',
  landscape: 'coordonnees-mobile-money-paysage.pdf',
};
