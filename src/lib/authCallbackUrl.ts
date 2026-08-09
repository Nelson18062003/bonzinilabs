/**
 * Lecture de l'URL de retour d'authentification (/m/auth/callback).
 *
 * POURQUOI CE FICHIER EXISTE : `exchangeCodeForSession()` attend le CODE, pas
 * l'URL. Lui passer `window.location.href` fait chercher à GoTrue une flow
 * state dont l'identifiant serait l'URL entière — il n'en trouve aucune et
 * répond « invalid flow state, no valid flow state found ». C'est exactement
 * l'erreur qu'on voyait à chaque connexion Google.
 */

/** Le `?code=` de l'URL de retour, ou null. */
export function authCodeFromUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get('code');
  } catch {
    return null;
  }
}

/**
 * L'erreur renvoyée par le fournisseur (consentement refusé, compte bloqué…).
 * Elle arrive en clair dans l'URL et vaut mieux que « code manquant ».
 */
export function authErrorFromUrl(url: string): string | null {
  try {
    const params = new URL(url).searchParams;
    const description = params.get('error_description');
    const code = params.get('error');
    if (!description && !code) return null;
    return description ?? code;
  } catch {
    return null;
  }
}
