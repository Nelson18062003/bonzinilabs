// ============================================================
// LA FICHE MOBILE MONEY — fabrication du fichier (react-pdf) et sa remise :
// téléchargement direct, ou feuille de partage sur téléphone. Le document est
// émis au nom de la société : NORTON GAUSS BONZINI SARL.
// ============================================================
import { createElement, type ReactElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { deliverFile, downloadFile } from '@/components/customer-code/exportShippingLabel';
import { MOBILE_MONEY_GUIDE_FILENAME, mobileMoneyGuideData, type GuideOrientation } from '@/lib/mobileMoneyGuide';
import { MobileMoneyGuidePDF } from '@/lib/pdf/templates/MobileMoneyGuidePDF';
import { LEGAL_NAME } from '@/lib/companyIdentity';

export async function buildMobileMoneyGuidePdf(orientation: GuideOrientation = 'portrait'): Promise<File> {
  const el: ReactElement = createElement(MobileMoneyGuidePDF, { data: mobileMoneyGuideData(), orientation });
  const blob = await pdf(el).toBlob();
  return new File([blob], MOBILE_MONEY_GUIDE_FILENAME[orientation], { type: 'application/pdf' });
}

export async function downloadMobileMoneyGuidePdf(orientation: GuideOrientation = 'portrait'): Promise<void> {
  downloadFile(await buildMobileMoneyGuidePdf(orientation));
}

export async function deliverMobileMoneyGuidePdf(orientation: GuideOrientation = 'portrait'): Promise<'shared' | 'downloaded'> {
  return deliverFile(await buildMobileMoneyGuidePdf(orientation), `${LEGAL_NAME} · Coordonnées Mobile Money`);
}
