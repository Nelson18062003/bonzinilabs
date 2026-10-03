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
import { downloadFile, saveOrShareFile } from '@/components/customer-code/exportShippingLabel';
import { BANK_GUIDE_FILENAME, bankGuideData, bankRibFilename } from '@/lib/bankDetailsGuide';
import type { GuideOrientation } from '@/lib/mobileMoneyGuide';
import type { BankOption } from '@/types/deposit';
import { BankDetailsPDF } from '@/lib/pdf/templates/BankDetailsPDF';
import { LEGAL_NAME } from '@/lib/companyIdentity';
import { withDocLang, type DocLang } from '@/lib/pdf/docLang';

export interface BankDetailsPdfOptions {
  orientation?: GuideOrientation;
  /** Une seule banque : son RIB sur une page. Sans elle : le livret complet. */
  bank?: BankOption;
  /** Les deux langues (par défaut), ou le français seul, ou l'anglais seul (lib/pdf/docLang.ts). */
  lang?: DocLang;
}

export async function buildBankDetailsPdf({ orientation = 'portrait', bank, lang = 'bi' }: BankDetailsPdfOptions = {}): Promise<File> {
  const el: ReactElement = createElement(BankDetailsPDF, { data: bankGuideData(), orientation, bank, lang });
  const blob = await pdf(el).toBlob();
  const name = bank ? bankRibFilename(bank, orientation) : BANK_GUIDE_FILENAME[orientation];
  return new File([blob], withDocLang(name, lang), { type: 'application/pdf' });
}

export async function downloadBankDetailsPdf(options: BankDetailsPdfOptions = {}): Promise<void> {
  downloadFile(await buildBankDetailsPdf(options));
}

export async function deliverBankDetailsPdf(options: BankDetailsPdfOptions = {}): Promise<'shared' | 'downloaded'> {
  const what = options.bank ? `RIB ${bankGuideData().accounts.find((a) => a.key === options.bank)?.name ?? ''}`.trim() : 'Coordonnées bancaires';
  return saveOrShareFile(await buildBankDetailsPdf(options), `${LEGAL_NAME} · ${what}`);
}
