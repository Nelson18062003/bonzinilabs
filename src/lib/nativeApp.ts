// ============================================================
// Sommes-nous DANS l'app mobile BONZINI HQ (Expo, dossier `hq-app/`) ?
//
// L'app affiche ce site dans une WebView et le signale de deux façons :
// l'objet `window.ReactNativeWebView` (injecté par react-native-webview) et
// le suffixe « BonziniHQ/<version> » de l'agent utilisateur. On lit les deux :
// le premier n'existe qu'une fois la page chargée sur certains Android.
//
// Ce qui change dans l'app : connexion par code email OU mot de passe (pas
// de Google — Google refuse les WebView —, pas de clé d'accès — WebAuthn n'y
// fonctionne pas) ; Face ID / empreinte sont gérés par l'app elle-même.
// ============================================================
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & { ReactNativeWebView?: unknown };
  if (w.ReactNativeWebView) return true;
  return typeof navigator !== 'undefined' && /\bBonziniHQ\//.test(navigator.userAgent);
}
