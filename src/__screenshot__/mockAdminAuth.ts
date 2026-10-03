/**
 * Contexte admin substitué pour le harnais de capture (SCREENSHOT_MOCK=1).
 * Donne toutes les permissions : les écrans se rendent au lieu de rediriger
 * vers /m. Aucun appel réseau, aucune session.
 *
 * Le reste du module réel est réexporté tel quel : l'alias Vite s'applique à
 * TOUTE l'application (le scanner de dépendances passe sur les trois entrées
 * index.html), donc ce fichier doit être un sur-ensemble du vrai module —
 * sinon les écrans qui importent ADMIN_ROLE_LABELS, ROLE_PERMISSIONS ou le
 * provider ne compilent plus.
 *
 * Chemin RELATIF volontaire : l'alias ne réécrit que le spécificateur
 * « @/contexts/AdminAuthContext », donc ceci vise le vrai module sans cycle.
 * Le `export *` ignore les noms exportés localement — notre useAdminAuth
 * l'emporte donc sur celui du module réel (règle ESM).
 */
export * from '../contexts/AdminAuthContext';

// Rôle simulé : `localStorage.screenshot-role` (posé par le harnais via
// ROLE=cash_agent) — la chaîne agent cash n'accepte que ce rôle-là.
// `?role=…` dans l'URL (connexion unique de l'app BONZINI HQ) l'emporte.
function urlParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}
function mockRole(): string {
  const fromUrl = urlParam('role');
  if (fromUrl) return fromUrl;
  try {
    return localStorage.getItem('screenshot-role') === 'cash_agent' ? 'cash_agent' : 'super_admin';
  } catch {
    return 'super_admin';
  }
}
/** `?anon=1` : personne n'est connecté (écran de connexion). */
const anonymous = () => urlParam('anon') === '1';
const demoRefusal = async () => ({ success: false, error: 'Démo : connexion désactivée' });

export const useAdminAuth = () => ({
  currentUser: anonymous() ? null : {
    id: 'screenshot-admin',
    email: 'demo@bonzinilabs.test',
    name: 'Demo Admin',
    firstName: 'Kevin',
    lastName: 'Nkolo',
    role: mockRole(),
  },
  isLoading: false,
  // Le shell desktop (AdminRouteWrapper → ProtectedAdminRoute) redirige vers
  // /m/login sans ceci : on se déclare connecté pour capturer les écrans
  // complets, sidebar comprise.
  isAuthenticated: !anonymous(),
  permissions: null,
  lastEmail: null,
  login: demoRefusal,
  requestEmailCode: demoRefusal,
  verifyEmailCode: demoRefusal,
  loginWithPasskey: demoRefusal,
  loginWithGoogle: demoRefusal,
  hasPermission: () => true,
  signOut: async () => undefined,
  logout: async () => undefined,
});
