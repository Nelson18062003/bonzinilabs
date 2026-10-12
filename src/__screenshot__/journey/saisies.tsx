// Captures du lot 10 (12/10/2026) — domaine « saisies » : les saisies en
// FENÊTRE par-dessus leur page (achat d'USDT, nouveau dépôt, nouveau
// paiement) et l'assistant de paiement mobile (coordonnées Alipay).
// Données : tools/journey/saisies.mjs (+ tools/adminFixtures.mjs).
import type { JourneyEntry } from './types';
import { DesktopAppShell } from '@/desktop/components/layout/DesktopAppShell';
import { DesktopTreasuryScreen } from '@/desktop/screens/treasury';
import { DesktopNewDeposit } from '@/desktop/screens/deposits';
import { DesktopNewPayment } from '@/desktop/screens/payments';
import { MobileNewPayment } from '@/mobile/screens/payments';

const purchase = { Comp: () => <DesktopAppShell><DesktopTreasuryScreen /></DesktopAppShell>, route: '/m/more/treasury/purchase' };
const deposit = { Comp: () => <DesktopAppShell><DesktopNewDeposit /></DesktopAppShell>, route: '/m/deposits/new?clientId=u3' };
const payment = { Comp: () => <DesktopAppShell><DesktopNewPayment /></DesktopAppShell>, route: '/m/payments/new' };

export const SCREENS: Record<string, JourneyEntry> = {
  'j.saisies.achat': purchase,
  'j.saisies.achatplusieurs': purchase,
  'j.saisies.achatreste': purchase,
  'j.saisies.depot': deposit,
  'j.saisies.paiement': payment,
  'j.saisies.paiementwechat': payment,
  'j.saisies.mobilepaiement': { Comp: MobileNewPayment, route: '/m/payments/new' },
};
