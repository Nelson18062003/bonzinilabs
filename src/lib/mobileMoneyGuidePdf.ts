// ============================================================
// LA FICHE MOBILE MONEY — fabrication du fichier (react-pdf, en-tête officiel)
// et sa remise : téléchargement direct, ou feuille de partage sur téléphone.
// ============================================================
import { createElement, type ReactElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { deliverFile, downloadFile } from '@/components/customer-code/exportShippingLabel';
import { MOBILE_MONEY_GUIDE_FILENAME, mobileMoneyGuideData } from '@/lib/mobileMoneyGuide';
import { MobileMoneyGuidePDF } from '@/lib/pdf/templates/MobileMoneyGuidePDF';

export async function buildMobileMoneyGuidePdf(): Promise<File> {
  const el: ReactElement = createElement(MobileMoneyGuidePDF, { data: mobileMoneyGuideData() });
  const blob = await pdf(el).toBlob();
  return new File([blob], MOBILE_MONEY_GUIDE_FILENAME, { type: 'application/pdf' });
}

export async function downloadMobileMoneyGuidePdf(): Promise<void> { downloadFile(await buildMobileMoneyGuidePdf()); }

export async function deliverMobileMoneyGuidePdf(): Promise<'shared' | 'downloaded'> {
  return deliverFile(await buildMobileMoneyGuidePdf(), 'Bonzini · Coordonnées Mobile Money');
}
