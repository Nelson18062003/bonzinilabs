// Les statuts « à traiter », recopiés du site (pas d'import natif ici : le
// test de parité src/tests/hqApp/parity.test.ts les compare au site).

/** src/lib/actionable.ts : ACTIONABLE_DEPOSIT_STATUSES. */
export const DEPOSITS_TO_PROCESS = ['proof_submitted', 'admin_review'];
/** src/lib/actionable.ts : ACTIONABLE_PAYMENT_STATUSES. */
export const PAYMENTS_TO_PROCESS = ['ready_for_payment', 'cash_scanned', 'processing'];
/** L'onglet « À remettre » de l'agent cash (useAgentCashPayments, statut 'pending'). */
export const CASH_PENDING = ['processing', 'cash_scanned', 'cash_pending', 'ready_for_payment'];

/** Les onglets qui portent une pastille, par rôle (clés de tabs.ts). */
export const BADGE_TABS = {
  admin: ['ops'],
  receptionist: ['pending'],
  warehouse_agent: ['checkin', 'handover'],
  cash_agent: ['payments'],
} as const;
