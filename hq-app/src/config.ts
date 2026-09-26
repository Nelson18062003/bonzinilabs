// ============================================================
// Où l'app va chercher les écrans : le site de production. Chaque mise en
// ligne du site (Vercel, branche main) arrive dans l'app sans republier sur
// les stores. Changer `extra.baseUrl` dans app.json pour tester une préprod.
// ============================================================
import Constants from 'expo-constants';

type Extra = { baseUrl?: string; startPath?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const BASE_URL = (extra.baseUrl ?? 'https://www.bonzinilabs.com').replace(/\/+$/, '');
/** La connexion unique : une fois connecté, le site envoie chacun vers SON espace (/m, /a, /r, /w). */
export const START_URL = BASE_URL + (extra.startPath ?? '/m/login');
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
