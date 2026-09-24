// ============================================================
// LA FICHE « COORDONNÉES BANCAIRES » — les données et les textes, tirés de la
// même source que l'écran de dépôt de l'app (src/data/depositMethodsData.ts),
// pour que la fiche remise au client dise toujours les mêmes RIB.
//
// Deux façons de payer par la banque, comme la Flotte et le Retrait :
//   · le VIREMENT (Bank transfer) : il faut l'IBAN, et le SWIFT depuis
//     l'étranger ;
//   · le DÉPÔT AU GUICHET (Cash deposit) : il faut le RIB — code banque, code
//     agence, n° de compte, clé.
// Un seul titulaire pour tous les comptes : NORTON GAUSS BONZINI SARL. Une
// page par banque, pour pouvoir donner un RIB seul quand on nous le demande.
// Un compte n'est imprimé que si son IBAN et sa clé RIB se vérifient.
// Bilingue (français d'abord, anglais dessous), portrait ou paysage. Aucun
// site, aucun numéro de téléphone.
// ============================================================
import { banks, getBankInfo } from '@/data/depositMethodsData';
import type { BankOption } from '@/types/deposit';
import type { Bi, GuideOrientation } from '@/lib/mobileMoneyGuide';

export interface BankGuideAccount {
  key: BankOption;
  /** Le nom de la banque, tel qu'on le dit : « Ecobank Cameroun ». */
  name: string;
  /** Le nom en un mot, pour le pied de page : « Ecobank ». */
  short: string;
  holder: string;
  /** L'IBAN, groupé comme sur le RIB : « CM21 10029 00002 30245039710 53 ». */
  iban: string;
  swift: string;
  bankCode: string;
  branchCode: string;
  accountNumber: string;
  ribKey: string;
}

export interface BankGuideData {
  accounts: BankGuideAccount[];
}

/** Contrôle officiel d'un IBAN (ISO 13616) : le reste modulo 97 doit valoir 1. Un IBAN camerounais fait 27 caractères. */
export function ibanIsValid(iban: string): boolean {
  const s = iban.replace(/\s/g, '').toUpperCase();
  if (s.startsWith('CM') && s.length !== 27) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const v = parseInt(ch, 36);
    if (Number.isNaN(v)) return false;
    for (const d of String(v)) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/** La clé RIB (zone CEMAC, même formule qu'en France) recalculée depuis banque, agence et compte. */
export function computeRibKey(bankCode: string, branchCode: string, accountNumber: string): string {
  const n = (89 * Number(bankCode) + 15 * Number(branchCode) + 3 * Number(accountNumber)) % 97;
  return String(97 - n).padStart(2, '0');
}

/** Le SWIFT (BIC) : 8 ou 11 caractères — banque (4 lettres), pays, lieu, agence facultative. */
export function swiftIsWellFormed(swift: string): boolean {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift);
}

/** Le nom de la banque tel qu'on le dit : « CCA-BANK Cameroun » → « CCA-Bank Cameroun ». */
function bankDisplayName(label: string): string {
  return label.replace('CCA-BANK', 'CCA-Bank');
}

/** Le nom en un mot, pour un bouton ou un pied de page : « Ecobank », « CCA-Bank », « UBA », « Afriland ». */
export function bankShortName(key: BankOption): string {
  const b = banks.find((x) => x.bank === key);
  return b ? bankDisplayName(b.label).split(' ')[0] : key;
}

/**
 * Un compte n'est imprimé que si ses chiffres se tiennent : IBAN valide
 * (modulo 97) et clé RIB conforme à banque/agence/compte. Un document officiel
 * ne doit jamais porter un IBAN que la banque de l'expéditeur refusera.
 */
export function accountIsConsistent(a: Pick<BankGuideAccount, 'iban' | 'bankCode' | 'branchCode' | 'accountNumber' | 'ribKey'>): boolean {
  return ibanIsValid(a.iban) && computeRibKey(a.bankCode, a.branchCode, a.accountNumber) === a.ribKey;
}

/** Tous nos comptes, tels que l'app les connaît (y compris ceux à vérifier). */
export function allBankAccounts(): BankGuideAccount[] {
  return banks.map((b) => ({
    key: b.bank,
    name: bankDisplayName(b.label),
    short: bankShortName(b.bank),
    holder: b.bonziniAccount.accountName,
    iban: b.bonziniAccount.iban,
    swift: b.bonziniAccount.swift,
    bankCode: b.bonziniAccount.codeBanque,
    branchCode: b.bonziniAccount.codeAgence,
    accountNumber: b.bonziniAccount.accountNumber,
    ribKey: b.bonziniAccount.cleRib,
  }));
}

/** Les comptes que la fiche imprime : ceux dont les chiffres se vérifient. */
export function bankGuideData(): BankGuideData {
  return { accounts: allBankAccounts().filter(accountIsConsistent) };
}

/** Une banque que la fiche sait imprimer (clé ou libellé), sinon undefined. */
export function printableBank(value: string | null | undefined): BankOption | undefined {
  const key = value ? getBankInfo(value)?.bank : undefined;
  return key && bankGuideData().accounts.some((a) => a.key === key) ? key : undefined;
}

/**
 * Tout le texte de la fiche, à un seul endroit, en français et en anglais :
 * une idée par page, des phrases courtes. Le test de la fiche compte les mots
 * de chaque langue et interdit les mentions qui n'ont rien à y faire.
 */
export const BANK_GUIDE_COPY = {
  docTitle: { fr: 'Coordonnées bancaires', en: 'Bank details' },
  page: { fr: 'Page', en: 'Page' },
  /** Le pied de page du livret : les banques, puis la preuve. */
  way: {
    preuve: { fr: 'Preuve', en: 'Proof' },
  },
  mention: {
    label: { fr: 'Mention obligatoire', en: 'Required reference' },
    value: { fr: 'Votre nom + n° de commande', en: 'Your name + order number' },
  },
  cover: {
    kicker: { fr: 'Pour vos dépôts', en: 'For your deposits' },
    title: { fr: 'Coordonnées bancaires', en: 'Bank details' },
    holder: { fr: 'Titulaire unique', en: 'Sole account holder' },
    lead: { fr: 'Deux façons de nous payer.', en: 'Two ways to pay us.' },
    or: { fr: 'ou', en: 'or' },
    banks: { fr: 'Choisissez une banque', en: 'Choose one bank' },
    preuve: { fr: 'Puis la preuve', en: 'Then proof of payment' },
  },
  bank: {
    eyebrow: { fr: 'Banque', en: 'Bank' },
    of: { fr: 'sur', en: 'of' },
    zone: { fr: 'Cameroun · Zone CEMAC', en: 'Cameroon · CEMAC zone' },
    holder: { fr: 'Titulaire du compte', en: 'Account holder' },
  },
  virement: {
    word: { fr: 'Virement', en: 'Bank transfer' },
    sentence: { fr: 'Depuis votre compte bancaire.', en: 'From your bank account.' },
    needs: { fr: 'IBAN + SWIFT', en: 'IBAN + SWIFT' },
    iban: { fr: 'IBAN', en: 'IBAN' },
    swift: { fr: 'SWIFT / BIC', en: 'SWIFT / BIC' },
    abroad: { fr: "Le SWIFT sert depuis l'étranger.", en: 'SWIFT is for transfers from abroad.' },
  },
  guichet: {
    word: { fr: 'Dépôt au guichet', en: 'Cash deposit' },
    sentence: { fr: 'En espèces, au guichet.', en: 'In cash, at the counter.' },
    needs: { fr: 'RIB', en: 'RIB' },
    bankCode: { fr: 'Code banque', en: 'Bank code' },
    branchCode: { fr: 'Code agence', en: 'Branch code' },
    accountNumber: { fr: 'N° de compte', en: 'Account number' },
    ribKey: { fr: 'Clé RIB', en: 'RIB key' },
  },
  preuve: {
    eyebrow: { fr: 'Dans les deux cas', en: 'In both cases' },
    after: { fr: 'Après le paiement', en: 'After paying' },
    word: { fr: 'La preuve', en: 'Proof of payment' },
    sentence: { fr: "Envoyez l'avis de virement ou le bordereau.", en: 'Send us the transfer advice or deposit slip.' },
    needs: { fr: '4 éléments', en: '4 items' },
    shot: { fr: 'Votre document', en: 'Your document' },
    items: [
      { fr: 'Date du paiement', en: 'Payment date' },
      { fr: 'Montant', en: 'Amount' },
      { fr: 'Bénéficiaire', en: 'Beneficiary' },
      { fr: 'Mention : nom + n° de commande', en: 'Reference: name + order number' },
    ],
    clear: { fr: 'Document complet, net, lisible.', en: 'Complete, sharp, readable document.' },
    thanks: { fr: 'Merci pour votre confiance.', en: 'Thank you for your trust.' },
  },
} as const;

/** Tous les textes d'une langue, à plat, pour compter les mots. */
export function bankGuideWords(lang: 'fr' | 'en'): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.fr === 'string' && typeof o.en === 'string') { out.push(...String(o[lang]).split(/\s+/).filter(Boolean)); return; }
      Object.values(o).forEach(walk);
    }
  };
  walk(BANK_GUIDE_COPY);
  return out;
}

export type { Bi };

export const BANK_GUIDE_FILENAME: Record<GuideOrientation, string> = {
  portrait: 'coordonnees-bancaires-portrait.pdf',
  landscape: 'coordonnees-bancaires-paysage.pdf',
};

/** Le RIB d'une seule banque : « rib-ecobank.pdf », « rib-ecobank-paysage.pdf ». */
export function bankRibFilename(key: BankOption, orientation: GuideOrientation = 'portrait'): string {
  return `rib-${key.toLowerCase()}${orientation === 'landscape' ? '-paysage' : ''}.pdf`;
}
