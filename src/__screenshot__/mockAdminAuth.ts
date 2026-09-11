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

export const useAdminAuth = () => ({
  currentUser: {
    id: 'screenshot-admin',
    email: 'demo@bonzinilabs.test',
    name: 'Demo Admin',
    role: 'super_admin' as const,
  },
  isLoading: false,
  // Le shell desktop (AdminRouteWrapper → ProtectedAdminRoute) redirige vers
  // /m/login sans ceci : on se déclare connecté pour capturer les écrans
  // complets, sidebar comprise.
  isAuthenticated: true,
  permissions: null,
  hasPermission: () => true,
  signOut: async () => undefined,
  logout: async () => undefined,
});
