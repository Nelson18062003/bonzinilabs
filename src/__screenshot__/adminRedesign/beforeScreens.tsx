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
import { DesktopAnalyticsDashboard } from '@/desktop/screens/analytics';
import { DesktopCreateClientDialog } from '@/desktop/screens/clients';

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

export function ShippedRatesPublish() {
  return (
    <DesktopAppShell>
      <DesktopRatesScreen initialView="publish" />
    </DesktopAppShell>
  );
}

export function ShippedRatesHistory() {
  return (
    <DesktopAppShell>
      <DesktopRatesScreen initialView="history" />
    </DesktopAppShell>
  );
}

export function ShippedRatesSettings() {
  return (
    <DesktopAppShell>
      <DesktopRatesScreen initialView="settings" />
    </DesktopAppShell>
  );
}

/**
 * Tableau de bord desktop — reconstruit (docs/admin-redesign/09).
 *
 * PAS de `DateRangeProvider` ici, volontairement. Le harnais en fournissait un,
 * et c'est précisément ce qui a masqué le plantage : la capture s'affichait
 * parfaitement pendant que la production tombait sur « useDateRange must be
 * used within a DateRangeProvider ». Un harnais qui ajoute un fournisseur que
 * l'application n'a pas ne teste plus l'application. L'écran se fournit
 * lui-même son contexte ; si un jour il cesse de le faire, la capture doit
 * tomber en même temps que la production.
 */
export function ShippedAnalytics() {
  return (
    <DesktopAppShell>
      <DesktopAnalyticsDashboard />
    </DesktopAppShell>
  );
}

/**
 * Création d'un client, telle qu'elle est livrée : la fenêtre PAR-DESSUS la
 * liste. On monte le composant de route lui-même (`DesktopCreateClientDialog`),
 * pas le formulaire seul — sinon la capture ne dirait rien de ce qui a
 * changé, à savoir que la liste reste derrière.
 */
export function ShippedCreateClient() {
  return (
    <DesktopAppShell>
      <DesktopCreateClientDialog />
    </DesktopAppShell>
  );
}
