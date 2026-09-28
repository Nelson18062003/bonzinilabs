// ============================================================
// Liens entrants : « bonzinihq://… », une page bonzinilabs.com, une
// notification touchée. Ils deviennent une page du personnel (/m, /a, /r,
// /w) mise en attente, ouverte dès que la personne est connectée et que le
// site a quitté la page de connexion (sinon la redirection du site après
// connexion l'écraserait).
//
// Formes acceptées :
//   bonzinihq://open?path=/m/deposits/123
//   bonzinihq:///m/deposits/123        bonzinihq://m/deposits/123
//   https://www.bonzinilabs.com/m/deposits/123
// Tout le reste est ignoré. Le site garde le dernier mot sur les droits.
// Pas d'import natif : testé par src/tests/hqApp/parity.test.ts (racine).
// ============================================================

const SITE_HOSTS = ['www.bonzinilabs.com', 'bonzinilabs.com'];
const STAFF_PATH = /^\/(m|a|r|w)(\/[A-Za-z0-9._~%\-/]*)?(\?[A-Za-z0-9._~%\-=&+]*)?$/;
const LOGIN = /^\/(m|a|r|w)\/login\b/;

/** Une page du personnel sûre, ou null. */
export function staffPath(path: string): string | null {
  const p = path.replace(/#.*$/, '');
  if (!STAFF_PATH.test(p) || LOGIN.test(p) || p.includes('..')) return null;
  return p;
}

/** La valeur d'un paramètre d'une chaîne de requête (« ?a=1&path=… »). */
function param(search: string, name: string): string | null {
  for (const pair of search.replace(/^\?/, '').split('&')) {
    const i = pair.indexOf('=');
    if (i > 0 && pair.slice(0, i) === name) {
      try {
        return decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Le chemin du site visé par un lien entrant, ou null. Analyse à la main
 * (pas de `URL`) : ce code peut tourner avant que le polyfill URL de
 * React Native ne soit chargé.
 */
export function sitePathFromUrl(raw: string): string | null {
  const text = raw.trim();
  if (text.startsWith('/')) return staffPath(text);
  const m = text.match(/^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?/i);
  if (!m) return null;
  const [, scheme, rawHost, path, search = ''] = m;
  const host = rawHost.toLowerCase();
  switch (scheme.toLowerCase()) {
    case 'https':
      return SITE_HOSTS.includes(host) ? staffPath(path + search) : null;
    case 'bonzinihq': {
      if (host === 'open') {
        const p = param(search, 'path');
        return p ? staffPath(p) : null;
      }
      // bonzinihq://m/deposits/1 → hôte « m » ; bonzinihq:///m/… → pas d'hôte.
      return staffPath(host ? `/${host}${path}${search}` : path + search);
    }
    default:
      return null;
  }
}

let pending: string | null = null;
const listeners = new Set<() => void>();

/** Met une page en attente d'ouverture (la plus récente l'emporte). */
export function queueSitePath(path: string | null): void {
  if (!path) return;
  pending = path;
  listeners.forEach((l) => l());
}

/** Prend la page en attente (une seule fois). */
export function takeSitePath(): string | null {
  const p = pending;
  pending = null;
  return p;
}

export function peekSitePath(): string | null {
  return pending;
}

export function onSitePathQueued(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
