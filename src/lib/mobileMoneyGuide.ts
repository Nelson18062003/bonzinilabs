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
// Le document est émis par la société (NORTON GAUSS BONZINI SARL) : aucun
// site, aucune marque d'app, aucun plafond, aucune étape de menu inventée.
// ============================================================
import { mtnMerchantInfo, mtnMoneyAccount, omMerchantInfo, orangeMoneyAccount } from '@/data/depositMethodsData';

export type MobileMoneyOperatorKey = 'orange' | 'mtn';

export interface MobileMoneyOperator {
  key: MobileMoneyOperatorKey;
  name: string;
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
        key: 'orange', name: 'Orange Money', holder: orangeMoneyAccount.accountName,
        number: groupPhone(orangeMoneyAccount.phone), numberIntl: intlPhone(orangeMoneyAccount.phone), merchantCode: omMerchantInfo.merchantCode,
      },
      {
        key: 'mtn', name: 'MTN Mobile Money', holder: mtnMoneyAccount.accountName,
        number: groupPhone(mtnMoneyAccount.phone), numberIntl: intlPhone(mtnMoneyAccount.phone), merchantCode: mtnMerchantInfo.merchantCode,
      },
    ],
  };
}

/**
 * Tout le texte courant de la fiche, à un seul endroit : une idée par page,
 * des phrases courtes. Le test de la fiche compte les mots et interdit les
 * mentions qui n'ont rien à y faire.
 */
export const MOBILE_MONEY_GUIDE_COPY = {
  docTitle: 'Coordonnées Mobile Money',
  titleTop: 'Coordonnées',
  titleBottom: 'Mobile Money',
  way: { flotte: 'Flotte', retrait: 'Retrait', preuve: 'Preuve' },
  cover: {
    kicker: 'Pour vos dépôts',
    lead: 'Deux façons de nous payer.',
    or: 'ou',
    choose: 'Choisissez une seule façon.',
    preuve: 'Puis la preuve',
    operators: 'Opérateurs acceptés',
    page: 'Page',
  },
  flotte: {
    eyebrow: 'Façon 1 sur 2',
    word: 'Flotte',
    en: 'Float',
    sentence: 'Depuis votre puce commerciale.',
    needs: 'Numéro + Titulaire',
    number: 'Numéro',
    holder: 'Titulaire',
    check: 'Titulaire différent ? Ne validez pas.',
  },
  retrait: {
    eyebrow: 'Façon 2 sur 2',
    word: 'Retrait',
    en: 'Withdrawal',
    sentence: 'Depuis votre compte Mobile Money.',
    needs: 'Code + Montant',
    code: 'Code',
    example: '50000',
    legend: 'Sans espace.',
  },
  preuve: {
    eyebrow: 'Dans les deux cas',
    word: 'La preuve',
    sentence: 'Transmettez-nous la capture juste après le paiement.',
    needs: '4 éléments',
    shot: 'Votre capture',
    items: ['Date et heure', 'Identifiant de transaction', 'Intitulé du compte', 'Montant'],
    clear: 'Capture complète, nette, lisible.',
    thanks: 'Merci pour votre confiance.',
  },
} as const;

/** Tous les textes de la fiche, à plat, pour compter les mots. */
export function mobileMoneyGuideWords(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(...v.split(/\s+/).filter(Boolean));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(MOBILE_MONEY_GUIDE_COPY);
  return out;
}

export const MOBILE_MONEY_GUIDE_FILENAME = 'coordonnees-mobile-money.pdf';
