/**
 * "BEFORE" harness entries — the REAL admin desktop screens, unmodified,
 * rendered with fixture-intercepted network (tools/shoot-admin-before.mjs).
 * Ground truth for the redesign: what the operator actually sees today.
 */
import { DesktopAppShell } from '@/desktop/components/layout/DesktopAppShell';
import { DesktopDepositsScreen } from '@/desktop/screens/deposits';
import { DesktopPaymentsScreen } from '@/desktop/screens/payments';
import { MobileNewDeposit } from '@/mobile/screens/deposits';
import { MobileNewPayment } from '@/mobile/screens/payments';

export { DesktopDepositsScreen, DesktopPaymentsScreen };

/** /m/deposits/new on desktop today: mobile wizard centred in the shell
 *  (AdminRouteWrapper fallback — the `desktop` prop it passes doesn't exist). */
export function BeforeNewDeposit() {
  return (
    <DesktopAppShell>
      <div className="mx-auto max-w-2xl">
        <MobileNewDeposit />
      </div>
    </DesktopAppShell>
  );
}

/** /m/payments/new on desktop today: the 5-step wizard as a phone-sized card. */
export function BeforeNewPayment() {
  return (
    <DesktopAppShell>
      <MobileNewPayment desktop />
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
