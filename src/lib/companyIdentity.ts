// ============================================================
// L'IDENTITÉ OFFICIELLE DE L'ENTREPRISE — ce qui figure sur les documents
// qui engagent (devis, reçu, facture, bon de retrait, étiquette) : la raison
// sociale, pas la marque. Les comptes bancaires viennent de la même source
// que les modes de dépôt de l'app (src/data/depositMethodsData.ts), pour
// qu'un devis dise où payer sans recopier un RIB à la main.
// ============================================================
import { banks } from '@/data/depositMethodsData';

/** La raison sociale, telle qu'elle figure sur les relevés bancaires et les bons. */
export const LEGAL_NAME = 'NORTON GAUSS BONZINI SARL';
/** La marque, pour l'en-tête et le pied. */
export const BRAND = 'Bonzini';
export const WEBSITE = 'bonzinilabs.com';
export const TAGLINE_CARGO = 'Cargo · Guangzhou → Douala';

export interface BankAccountLine { bank: string; accountName: string; iban: string; swift: string }

/** Les comptes au nom de la société, dans l'ordre des modes de dépôt. */
export function companyBankAccounts(): BankAccountLine[] {
  return banks.map((b) => ({ bank: b.bonziniAccount.bankName, accountName: b.bonziniAccount.accountName, iban: b.bonziniAccount.iban, swift: b.bonziniAccount.swift }));
}
