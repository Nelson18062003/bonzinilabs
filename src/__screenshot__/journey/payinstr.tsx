// Captures du lot 9 (12/10/2026) — domaine « payinstr » :
//   · l'instruction de paiement sur téléphone (fiche, feuille ouverte par
//     « ?instruction=1 », Alipay avec QR puis virement) ;
//   · le menu latéral de l'ordinateur, déplié puis réduit en rail.
// Données : tools/adminFixtures.mjs (paiements p1 virement, p5 Alipay + QR).
import type { JourneyEntry } from './types';
import { MobilePaymentDetail } from '@/mobile/screens/payments';
import { DesktopAppShell } from '@/desktop/components/layout/DesktopAppShell';
import { DesktopPaymentsScreen } from '@/desktop/screens/payments';

const detail = { Comp: MobilePaymentDetail, path: '/m/payments/:paymentId' };
const desk = { Comp: () => <DesktopAppShell><DesktopPaymentsScreen /></DesktopAppShell>, route: '/m/payments' };

export const SCREENS: Record<string, JourneyEntry> = {
  'j.payinstr.detail': { ...detail, route: '/m/payments/p5' },
  'j.payinstr.sheet': { ...detail, route: '/m/payments/p5?instruction=1' },
  'j.payinstr.sheetbank': { ...detail, route: '/m/payments/p1?instruction=1' },
  'j.payinstr.deskopen': desk,
  'j.payinstr.deskrail': desk,
  'j.payinstr.desktip': desk,
};
