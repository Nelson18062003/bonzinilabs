/**
 * Découvert autorisé — arithmétique partagée entre l'admin et l'app client.
 *
 * Un portefeuille porte un `overdraft_limit_xaf` (0 = aucun découvert). Le
 * solde peut descendre jusqu'à `-limit` sur action de l'équipe. Ces trois
 * fonctions évitent que chaque écran refasse le calcul à sa façon.
 */

/** Ce qu'une opération de l'équipe peut encore débiter : solde + découvert autorisé. */
export function availableXaf(balanceXaf: number, overdraftLimitXaf: number): number {
  return balanceXaf + Math.max(0, overdraftLimitXaf);
}

/** Découvert effectivement consommé (0 si le solde est positif). */
export function overdraftUsedXaf(balanceXaf: number): number {
  return Math.max(0, -balanceXaf);
}

/** Vrai quand le solde est négatif. */
export function isOverdrawn(balanceXaf: number): boolean {
  return balanceXaf < 0;
}

/** Paliers proposés dans le formulaire d'autorisation. */
export const OVERDRAFT_PRESETS_XAF = [500_000, 1_000_000, 2_000_000, 5_000_000] as const;
