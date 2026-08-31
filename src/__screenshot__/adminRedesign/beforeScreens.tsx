/**
 * "BEFORE" harness entries — the REAL admin desktop screens, unmodified,
 * rendered with fixture-intercepted network (tools/shoot-admin-before.mjs).
 * Ground truth for the redesign: what the operator actually sees today.
 */
import { DesktopAppShell } from '@/desktop/components/layout/DesktopAppShell';
import { DesktopDepositsScreen, DesktopNewDeposit } from '@/desktop/screens/deposits';
import { DesktopPaymentsScreen, DesktopNewPayment } from '@/desktop/screens/payments';
import { DesktopClientsScreen } from '@/desktop/screens/clients';
import { DesktopRatesScreen } from '@/desktop/screens/rates';

export { DesktopDepositsScreen, DesktopPaymentsScreen };

/** /m/deposits/new as routed on desktop (now the one-page form). */
export function BeforeNewDeposit() {
  return (
    <DesktopAppShell>
      <DesktopNewDeposit />
    </DesktopAppShell>
  );
}

/** /m/payments/new as routed on desktop (now the one-page form). */
export function BeforeNewPayment() {
  return (
    <DesktopAppShell>
      <DesktopNewPayment />
    </DesktopAppShell>
  );
}

/** Lists/details ARE the desktop screens, but they render inside the shell. */
export function BeforeDeposits() {
  return (
    <DesktopAppShell>
      <DesktopDepositsScreen />
    </DesktopAppShell>
  );
}

export function BeforePayments() {
  return (
    <DesktopAppShell>
      <DesktopPaymentsScreen />
    </DesktopAppShell>
  );
}

/** Écrans LIVRÉS (refonte clients + taux) — pour vérification visuelle. */
export function ShippedClients() {
  return (
    <DesktopAppShell>
      <DesktopClientsScreen />
    </DesktopAppShell>
  );
}

export function ShippedRates() {
  return (
    <DesktopAppShell>
      <DesktopRatesScreen />
    </DesktopAppShell>
  );
}
