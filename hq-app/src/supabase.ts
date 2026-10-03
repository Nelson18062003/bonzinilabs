// ============================================================
// Supabase côté app — jamais de session gardée ici.
//
//   · La connexion native (LoginScreen) crée un client jetable : la session
//     obtenue est aussitôt confiée au site, qui la garde et la rafraîchit ;
//     l'app ne rafraîchit jamais (deux rafraîchisseurs du même jeton se
//     révoqueraient l'un l'autre).
//   · `db` : les lectures natives (accueil, compteurs, notifications) avec le
//     jeton d'accès que le site transmet à chaque rafraîchissement.
// Mêmes règles que le site : RLS + RPC gardées par admin_has_permission.
// ============================================================
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

let accessToken: string | null = null;
let expiresAt: number | null = null;

/** Le jeton du moment, transmis par le site. */
export function setAccessToken(token: string | null, exp: number | null): void {
  accessToken = token;
  expiresAt = exp;
}

/** Le jeton est-il utilisable (avec 30 s de marge) ? */
export function hasFreshToken(): boolean {
  return !!accessToken && (!expiresAt || expiresAt * 1000 - Date.now() > 30_000);
}

export const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  accessToken: async () => accessToken,
});
