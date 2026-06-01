/**
 * Logique de garde d'authentification — fonctions PURES, testables.
 *
 * Extraites de AuthCallbackPage / ProtectedRoute pour avoir UNE source de
 * vérité (et des tests unitaires). Sécurité-sensible : voir la revue de
 * sécurité (findings H2 et M1).
 */

/** Forme minimale d'une identité Supabase nécessaire à la vérification. */
export interface OAuthIdentityLike {
  provider: string;
  identity_data?: Record<string, unknown> | null;
}

/** Forme minimale d'un utilisateur Supabase pour la garde. */
export interface UserLike {
  identities?: OAuthIdentityLike[] | null;
}

/**
 * Email vérifié de façon AUTORITAIRE (finding H2).
 *
 * - On lit le claim depuis `identities[].identity_data.email_verified`
 *   (renvoyé par le provider), JAMAIS depuis `user_metadata` (modifiable par
 *   l'utilisateur) ni `email_confirmed_at` (positionné par Supabase en OAuth
 *   indépendamment de la vérification réelle).
 * - FAIL-CLOSED : seul `=== true` strict est accepté. Tout le reste
 *   (`"true"` chaîne, `undefined`, `false`, identité absente) ⇒ non vérifié.
 * - S'il n'y a AUCUNE identité OAuth (compte email/mot de passe classique),
 *   la vérification email est gérée par Supabase Auth → on retourne true ici
 *   (cette garde ne concerne que le flux OAuth).
 */
export function isProviderEmailVerified(user: UserLike): boolean {
  const ids = user.identities ?? [];
  const oauth = ids.filter((i) => i.provider !== 'email');
  if (oauth.length === 0) return true;
  return oauth.some((i) => i.identity_data?.email_verified === true);
}

/**
 * Le profil client est-il « complet » pour accéder aux fonctions financières ?
 *
 * (finding M1) Le TÉLÉPHONE est le seul champ bloquant : requis dans les deux
 * parcours de création existants (self-signup ET création admin), donc présent
 * chez tous les clients legacy ; et c'est précisément ce qu'un compte Google
 * n'a pas. On NE gate PAS sur le pays (optionnel pour les clients créés par un
 * admin → gater dessus enfermerait des clients legacy hors de leur app).
 *
 * FAIL-CLOSED : profil absent/null ⇒ incomplet.
 */
export function isProfileComplete(
  profile: { phone?: string | null } | null | undefined,
): boolean {
  return !!profile?.phone;
}
