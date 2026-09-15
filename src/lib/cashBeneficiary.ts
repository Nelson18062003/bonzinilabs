// ============================================================
// Nom de la personne qui reçoit les espèces (paiement `method = cash`).
// `cash_beneficiary_type` vaut 'self' (le client vient lui-même), 'other'
// (un tiers, nommé dans cash_beneficiary_first/last_name) ou null (ancien
// enregistrement). Même lecture que l'admin (MobilePaymentDetailV2,
// DesktopPaymentPanel) : seul 'other' désigne un tiers ; sinon c'est le
// client — jamais « — » quand on connaît son nom.
// ============================================================
export interface CashBeneficiarySource {
  cash_beneficiary_type?: string | null;
  cash_beneficiary_first_name?: string | null;
  cash_beneficiary_last_name?: string | null;
  beneficiary_name?: string | null;
  profile?: { first_name?: string | null; last_name?: string | null } | null;
}

const full = (a?: string | null, b?: string | null) => `${a ?? ''} ${b ?? ''}`.trim();

export function cashBeneficiaryName(p: CashBeneficiarySource | null | undefined): string {
  if (!p) return '—';
  const third = full(p.cash_beneficiary_first_name, p.cash_beneficiary_last_name);
  const client = full(p.profile?.first_name, p.profile?.last_name);
  if (p.cash_beneficiary_type === 'other') return third || p.beneficiary_name || '—';
  return client || third || p.beneficiary_name || '—';
}
