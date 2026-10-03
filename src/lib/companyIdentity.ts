// ============================================================
// L'IDENTITÉ OFFICIELLE DE L'ENTREPRISE — ce qui figure sur les documents
// qui engagent (devis, reçu, facture, bon de retrait, étiquette) : la raison
// sociale, pas la marque. Les comptes bancaires viennent de la même source
// que les modes de dépôt de l'app (src/data/depositMethodsData.ts), pour
// qu'un devis dise où payer sans recopier un RIB à la main.
// ============================================================
import { banks } from '@/data/depositMethodsData';
import { bankGuideData } from '@/lib/bankDetailsGuide';

/** La raison sociale, telle qu'elle figure sur les relevés bancaires et les bons. */
export const LEGAL_NAME = 'NORTON GAUSS BONZINI SARL';
/** La marque, pour l'en-tête et le pied. */
export const BRAND = 'Bonzini';
export const WEBSITE = 'bonzinilabs.com';
export const TAGLINE_CARGO = 'Cargo · Guangzhou → Douala';

/**
 * L'identité légale imprimée en tête des documents cargo (devis, reçu,
 * facture), telle que le fondateur l'a dictée pour les packing lists client
 * (20/09/2026) : raison sociale, nom commercial, capital, RCCM, NIU, siège,
 * téléphones. L'adresse du nouveau bureau de Douala n'est pas encore fixée :
 * on écrit la ville seule plutôt qu'une adresse périmée (Bépanda).
 */
export const CARGO_COMPANY = {
  legalName: LEGAL_NAME,
  shortName: 'N.G.B SARL',
  tradeName: 'Bonzini Trading Cargo',
  activities: { fr: "Central d'achat · Air Cargo · Sea Cargo", en: 'Purchasing · Air Cargo · Sea Cargo' },
  capital: '10 000 000 FCFA',
  rccm: 'DLBB/2017/B/245',
  niu: 'M091712668533F',
  seat: { fr: 'Douala, Cameroun', en: 'Douala, Cameroon' },
  phonesCameroon: ['(+237) 677 332 759', '(+237) 690 933 686'],
  phoneChina: '(+86) 131 3849 5598',
  email: 'bonzininortongauss@gmail.com',
} as const;

export interface BankAccountLine { bank: string; accountName: string; iban: string; swift: string }

/**
 * Les comptes au nom de la société, dans l'ordre des modes de dépôt — ceux
 * dont l'IBAN et la clé RIB se vérifient seulement : un devis ne doit jamais
 * imprimer un IBAN que la banque du client refusera.
 */
export function companyBankAccounts(): BankAccountLine[] {
  const verified = new Set(bankGuideData().accounts.map((a) => a.key));
  return banks
    .filter((b) => verified.has(b.bank))
    .map((b) => ({ bank: b.bonziniAccount.bankName, accountName: b.bonziniAccount.accountName, iban: b.bonziniAccount.iban, swift: b.bonziniAccount.swift }));
}
