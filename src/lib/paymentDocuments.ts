// ============================================================
// LES DOCUMENTS « COORDONNÉES DE PAIEMENT » — un seul point d'entrée pour
// fabriquer, en portrait ou en paysage :
//   · le livret de toutes nos banques ;
//   · le RIB d'une seule banque (une page) ;
//   · la fiche Mobile Money (Orange Money et MTN MoMo).
// Chacun en PDF, ou en UNE image PNG qui réunit toutes les pages (pour
// WhatsApp, à copier ou à télécharger). L'image est faite des pages du PDF,
// dessinées par pdf.js : les deux disent exactement la même chose.
// ============================================================
import type { BankOption } from '@/types/deposit';
import type { GuideOrientation } from '@/lib/mobileMoneyGuide';
import { bankGuideData } from '@/lib/bankDetailsGuide';
import { buildBankDetailsPdf } from '@/lib/bankDetailsPdf';
import { buildMobileMoneyGuidePdf } from '@/lib/mobileMoneyGuidePdf';
import { LEGAL_NAME } from '@/lib/companyIdentity';

export type PaymentDoc =
  | { kind: 'banks' }
  | { kind: 'rib'; bank: BankOption }
  | { kind: 'mobile-money' };

export type PaymentDocFormat = 'pdf' | 'png';

/** Un identifiant stable (état « en cours » d'un bouton, clé de liste). */
export function paymentDocId(doc: PaymentDoc, format: PaymentDocFormat, orientation: GuideOrientation): string {
  const what = doc.kind === 'rib' ? `rib-${doc.bank}` : doc.kind;
  return `${what}:${format}:${orientation}`;
}

/** Le titre de la feuille de partage : « NORTON GAUSS BONZINI SARL · RIB UBA Cameroun ». */
export function paymentDocTitle(doc: PaymentDoc): string {
  if (doc.kind === 'mobile-money') return `${LEGAL_NAME} · Coordonnées Mobile Money`;
  if (doc.kind === 'banks') return `${LEGAL_NAME} · Coordonnées bancaires`;
  const name = bankGuideData().accounts.find((a) => a.key === doc.bank)?.name ?? doc.bank;
  return `${LEGAL_NAME} · RIB ${name}`;
}

export function paymentDocPdf(doc: PaymentDoc, orientation: GuideOrientation): Promise<File> {
  if (doc.kind === 'mobile-money') return buildMobileMoneyGuidePdf(orientation);
  return buildBankDetailsPdf({ orientation, bank: doc.kind === 'rib' ? doc.bank : undefined });
}

/** Tout le document dans UNE image PNG. pdf.js n'est chargé qu'ici, à la demande. */
export async function paymentDocImage(doc: PaymentDoc, orientation: GuideOrientation): Promise<File> {
  const [{ pdfToSheetImage }, pdf] = await Promise.all([import('@/lib/pdfToImages'), paymentDocPdf(doc, orientation)]);
  return pdfToSheetImage(pdf);
}
