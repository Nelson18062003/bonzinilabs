// ============================================================
// LA FICHE COORDONNÉES BANCAIRES — fabrication du fichier (react-pdf) et sa
// remise : téléchargement direct, ou feuille de partage sur téléphone.
//   · le livret complet (toutes nos banques), en portrait ou en paysage ;
//   · le RIB d'une seule banque, sur une page — ce qu'on envoie quand un
//     client demande « votre RIB Ecobank ».
// Le document est émis au nom de la société : NORTON GAUSS BONZINI SARL.
// ============================================================
import { createElement, type ReactElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { deliverFile, downloadFile } from '@/components/customer-code/exportShippingLabel';
import { BANK_GUIDE_FILENAME, bankGuideData, bankRibFilename } from '@/lib/bankDetailsGuide';
import type { GuideOrientation } from '@/lib/mobileMoneyGuide';
import type { BankOption } from '@/types/deposit';
import { BankDetailsPDF } from '@/lib/pdf/templates/BankDetailsPDF';
import { LEGAL_NAME } from '@/lib/companyIdentity';

export interface BankDetailsPdfOptions {
  orientation?: GuideOrientation;
  /** Une seule banque : son RIB sur une page. Sans elle : le livret complet. */
  bank?: BankOption;
}

export async function buildBankDetailsPdf({ orientation = 'portrait', bank }: BankDetailsPdfOptions = {}): Promise<File> {
  const el: ReactElement = createElement(BankDetailsPDF, { data: bankGuideData(), orientation, bank });
  const blob = await pdf(el).toBlob();
  const name = bank ? bankRibFilename(bank, orientation) : BANK_GUIDE_FILENAME[orientation];
  return new File([blob], name, { type: 'application/pdf' });
}

export async function downloadBankDetailsPdf(options: BankDetailsPdfOptions = {}): Promise<void> {
  downloadFile(await buildBankDetailsPdf(options));
}

export async function deliverBankDetailsPdf(options: BankDetailsPdfOptions = {}): Promise<'shared' | 'downloaded'> {
  const what = options.bank ? `RIB ${bankGuideData().accounts.find((a) => a.key === options.bank)?.name ?? ''}`.trim() : 'Coordonnées bancaires';
  return deliverFile(await buildBankDetailsPdf(options), `${LEGAL_NAME} · ${what}`);
}
