// ============================================================
// Réglages de l'app : le site (écrans), Supabase (données natives).
// Tout vient de app.json → extra : changer d'environnement = changer app.json.
// La clé Supabase est la clé PUBLIQUE (publishable) : la sécurité est dans
// les règles RLS et les RPC gardées par rôle, pas dans ce secret.
// ============================================================
import Constants from 'expo-constants';

type Extra = { baseUrl?: string; startPath?: string; supabaseUrl?: string; supabaseKey?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const BASE_URL = (extra.baseUrl ?? 'https://www.bonzinilabs.com').replace(/\/+$/, '');
/** Le site ouvre ici ; la connexion est native, puis chacun va dans SON espace. */
export const START_URL = BASE_URL + (extra.startPath ?? '/m/login');
export const SUPABASE_URL = extra.supabaseUrl ?? 'https://fmhsohrgbznqmcvqktjw.supabase.co';
export const SUPABASE_KEY = extra.supabaseKey ?? '';
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
/** Ajouté à l'agent utilisateur : le site sait qu'il est dans l'app (src/lib/nativeApp.ts). */
export const USER_AGENT_SUFFIX = `BonziniHQ/${APP_VERSION}`;

/** Les pages qui s'ouvrent DANS l'app ; tout le reste part vers le navigateur ou l'app concernée. */
export function isAppUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'www.bonzinilabs.com' || u.hostname === 'bonzinilabs.com' || u.origin === new URL(BASE_URL).origin);
  } catch {
    return false;
  }
}

/** Verrouillage Face ID / empreinte : au lancement, puis après cette absence. */
export const RELOCK_AFTER_MS = 5 * 60 * 1000;
