// Helpers purs de la fonction `passkey`.
//
// Isolés ici pour être testables hors Deno : aucune dépendance à Deno.env, au
// réseau ou à Supabase. Couverts par src/tests/lib/passkeyHelpers.test.ts.

/** base64url (sans padding) — le format d'échange de WebAuthn. */
export function b64uEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/**
 * Le RP ID doit être un suffixe enregistrable de l'origine, sinon le navigateur
 * refuse la clé. En local l'origine est http://localhost:8080 → « localhost » ;
 * partout ailleurs, le domaine de production.
 */
export function rpIdFor(origin: string, productionRpId: string): string {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' ? 'localhost' : productionRpId;
  } catch {
    return productionRpId;
  }
}

/** « iPhone » plutôt qu'une chaîne User-Agent illisible. */
export function deviceLabelFrom(userAgent: string | null): string {
  const ua = userAgent ?? '';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Téléphone Android';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'PC Windows';
  return 'Appareil';
}

/**
 * Anti-clonage. Les authenticators iOS/Android renvoient toujours 0 : dans ce
 * cas le compteur ne porte aucune information et la clé reste acceptée. Dès
 * qu'un compteur existe (> 0), il DOIT progresser strictement — sinon la
 * signature vient probablement d'une copie de la clé.
 */
export function isCounterAcceptable(storedCounter: number, newCounter: number): boolean {
  if (storedCounter === 0) return true;
  return newCounter > storedCounter;
}

/** Une origine inconnue ne doit jamais pouvoir demander un défi. */
export function isAllowedOrigin(origin: string | null, allowed: string[]): origin is string {
  return !!origin && allowed.includes(origin);
}
