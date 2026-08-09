/**
 * Filtre un paramètre `next` avant redirection.
 *
 * POURQUOI : /m/auth/callback accepte un `next` pour enchaîner après l'échange
 * du ?code= (retour Google, ou lien « mot de passe oublié » qui doit mener au
 * choix du mot de passe). Un `next` non filtré transformerait cette route en
 * redirection ouverte : un lien vers /m/auth/callback?next=https://evil.tld
 * renverrait la personne sur un site tiers juste après s'être authentifiée —
 * l'endroit rêvé pour un faux écran de connexion.
 *
 * Règle : uniquement un chemin interne de l'app admin. Tout le reste retombe
 * sur `fallback`.
 */
export function safeNextPath(next: string | null, fallback = '/m'): string {
  if (!next) return fallback;

  // « //evil.tld » et « /\evil.tld » sont interprétés comme des URL absolues
  // par les navigateurs (protocol-relative) : ils ne doivent jamais passer.
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback;

  // Chemin interne de l'app admin, et rien d'autre. Exclut du même coup
  // « https://… », « javascript:… » et les chemins d'une autre app.
  if (!next.startsWith('/m/')) return fallback;

  return next;
}
