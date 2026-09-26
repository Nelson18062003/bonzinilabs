// ============================================================
// Branche le site sur l'app BONZINI HQ (voir src/lib/nativeBridge.ts).
// Monté une fois, dans le routeur et sous AdminAuthProvider. Hors de l'app,
// ne fait rien.
//   · dit à l'app qui est connecté (rôle, nom) et lui passe chaque nouveau
//     jeton d'accès — le site reste le seul à rafraîchir la session ;
//   · dit à l'app sur quelle page on est (pour allumer le bon onglet natif) ;
//   · laisse l'app naviguer, poser la session de sa connexion native, et
//     déconnecter.
// ============================================================
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { isNativeApp } from '@/lib/nativeApp';
import { installNativeSiteApi, postToApp } from '@/lib/nativeBridge';

export function NativeAppBridge() {
  const native = useMemo(() => isNativeApp(), []);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isLoading, logout } = useAdminAuth();

  // La page courante → l'onglet natif allumé.
  useEffect(() => {
    if (native) postToApp({ type: 'route', path: location.pathname + location.search });
  }, [native, location.pathname, location.search]);

  // Qui est connecté, et le jeton du moment (puis à chaque rafraîchissement).
  useEffect(() => {
    if (!native || isLoading) return;
    const user = currentUser
      ? { id: currentUser.id, email: currentUser.email, firstName: currentUser.firstName, lastName: currentUser.lastName, role: currentUser.role }
      : null;
    let cancelled = false;
    void supabaseAdmin.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const s = user ? data.session : null;
      postToApp({ type: 'auth', user, accessToken: s?.access_token ?? null, expiresAt: s?.expires_at ?? null });
    });
    const { data: { subscription } } = supabaseAdmin.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && user && session) {
        postToApp({ type: 'auth', user, accessToken: session.access_token, expiresAt: session.expires_at ?? null });
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [native, isLoading, currentUser]);

  // Ce que l'app peut demander.
  useEffect(() => installNativeSiteApi({
    navigate: (path) => navigate(path),
    logout,
    setSession: async (tokens) => {
      const { error } = await supabaseAdmin.auth.setSession(tokens);
      return error ? { success: false, error: error.message } : { success: true };
    },
  }), [navigate, logout]);

  return null;
}
