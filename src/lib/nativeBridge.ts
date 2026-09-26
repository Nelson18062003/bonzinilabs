// ============================================================
// LE PONT SITE → APP BONZINI HQ (et retour), côté site.
//
// L'app mobile (hq-app/) affiche ce site dans une WebView et l'habille de
// natif : connexion native, barre d'onglets native, scanner natif. Ce module
// est la seule porte entre les deux ; il ne fait rien hors de l'app.
//
// SESSION — une seule source de vérité : CE SITE. C'est lui qui garde la
// session et la rafraîchit (supabase-js). L'app ne fait que :
//   · poser la session obtenue par sa connexion native (setSession) ;
//   · recevoir chaque nouveau jeton d'accès (message « auth ») pour ses
//     propres appels (accueil natif, notifications).
// Deux rafraîchisseurs pour un même jeton se révoqueraient l'un l'autre :
// d'où ce choix.
//
// SCANNER — un écran du site qui scanne (useQrScanner) s'inscrit ici ; dans
// l'app, c'est la caméra native qui lit, puis rend le texte à cet écran.
// ============================================================
import { isNativeApp } from './nativeApp';

/** Ce que le site dit à l'app. */
export type SiteToApp =
  | { type: 'auth'; user: { id: string; email: string; firstName: string; lastName: string; role: string } | null; accessToken: string | null; expiresAt: number | null }
  | { type: 'route'; path: string }
  | { type: 'scan-open'; continuous: boolean }
  | { type: 'scan-close' };

/** Ce que l'app peut demander au site (window.__bonziniHQ). */
export interface NativeSiteApi {
  navigate: (path: string) => void;
  logout: () => Promise<void>;
  setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<{ success: boolean; error?: string }>;
  deliverScan: (text: string) => void;
}

type RNWindow = Window & { ReactNativeWebView?: { postMessage: (s: string) => void }; __bonziniHQ?: NativeSiteApi };

export function postToApp(msg: SiteToApp): void {
  if (!isNativeApp()) return;
  try {
    (window as RNWindow).ReactNativeWebView?.postMessage(JSON.stringify(msg));
  } catch {
    // pont indisponible (page encore en chargement) : rien à faire
  }
}

// ── Scanner ────────────────────────────────────────────────────────────
type ScanHandler = (text: string) => void;
let scanHandler: ScanHandler | null = null;
let scanContinuous = false;
/** Un scan arrivé avant que l'écran qui l'attend soit monté (scanner de la barre d'onglets). */
let pendingScan: string | null = null;

/**
 * Un écran du site veut scanner. Dans l'app : la caméra native s'ouvre (sauf si
 * un scan attend déjà — il est rendu tout de suite). Renvoie de quoi se désinscrire.
 */
export function registerNativeScanner(handler: ScanHandler, { continuous = false, autoOpen = true } = {}): () => void {
  scanHandler = handler;
  scanContinuous = continuous;
  if (pendingScan !== null) {
    const text = pendingScan;
    pendingScan = null;
    setTimeout(() => handler(text), 0);
  } else if (autoOpen) {
    postToApp({ type: 'scan-open', continuous });
  }
  return () => {
    if (scanHandler === handler) {
      scanHandler = null;
      postToApp({ type: 'scan-close' });
    }
  };
}

/** Rouvrir la caméra native (bouton « Scanner » de l'écran). */
export function openNativeScanner(): void {
  postToApp({ type: 'scan-open', continuous: scanContinuous });
}

/** Refermer la caméra native (l'écran a ce qu'il lui faut). */
export function closeNativeScanner(): void {
  postToApp({ type: 'scan-close' });
}

export function deliverScan(text: string): void {
  if (scanHandler) scanHandler(text);
  else pendingScan = text;
}

/** Installe window.__bonziniHQ (dans l'app seulement). */
export function installNativeSiteApi(api: Omit<NativeSiteApi, 'deliverScan'>): () => void {
  if (!isNativeApp()) return () => {};
  const w = window as RNWindow;
  w.__bonziniHQ = { ...api, deliverScan };
  return () => {
    if (w.__bonziniHQ?.navigate === api.navigate) delete w.__bonziniHQ;
  };
}
