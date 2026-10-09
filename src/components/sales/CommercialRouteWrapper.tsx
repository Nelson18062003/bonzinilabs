// ============================================================
// ESPACE COMMERCIAL — la coquille de « /v », sur le modèle de la réception :
// une session du personnel (AdminAuthProvider est monté une fois dans
// App.tsx), le droit vérifié ici, une barre à trois onglets.
//
// Seul canProspect entre (le commercial). Tout autre membre du personnel
// est renvoyé vers SON espace ; sans session, vers « /v/login » (email +
// mot de passe) : son adresse est souvent inventée, et le code par email
// de /m/login ne lui arriverait pas (06/10).
// Le thème `.admin-theme` donne l'encre neutre de l'administration ;
// `.sales-ui` (06/10) le relit dans le langage visuel de l'espace commercial
// (beautifului.dev : encre, filets fins, flou léger) — cf. src/index.css.
// ============================================================
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AnimatedPage } from '@/components/transitions/AnimatedPage';
import { staffHomeFor } from '@/lib/staffHome';
import { isNativeApp } from '@/lib/nativeApp';
import { cn } from '@/lib/utils';
import { CommercialTabBar } from './CommercialTabBar';

/** Dans l'app BONZINI HQ, la barre d'onglets est native : celle du site se retire. */
const inApp = isNativeApp();

function Protected({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, hasPermission, currentUser } = useAdminAuth();
  if (isLoading) {
    return (
      <div className="admin-theme sales-ui flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/v/login" replace />;
  // Connecté mais pas commercial : vers SON espace, pas vers une connexion en boucle.
  if (!hasPermission('canProspect')) return <Navigate to={staffHomeFor(currentUser?.role)} replace />;
  return <>{children}</>;
}

/**
 * `bare` : l'écran occupe toute la hauteur lui-même (la connexion) — aucune
 * marge basse, sinon une bande grise apparaît sous la page et l'écran défile
 * pour rien.
 */
export function CommercialShell({ children, showTabBar = true, bare = false }: { children: ReactNode; showTabBar?: boolean; bare?: boolean }) {
  const withBar = showTabBar && !inApp;
  return (
    <div className="admin-theme sales-ui min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col md:max-w-2xl">
        <main className={cn('flex-1', withBar ? 'pb-28' : bare ? '' : 'pb-10')}>
          <AnimatedPage>{children}</AnimatedPage>
        </main>
        {withBar && <CommercialTabBar />}
      </div>
    </div>
  );
}

export function CommercialRouteWrapper({
  children,
  requireAuth = true,
  showTabBar = true,
  bare = false,
}: {
  children: ReactNode;
  requireAuth?: boolean;
  showTabBar?: boolean;
  /** L'écran occupe toute la hauteur lui-même (connexion, mot de passe). */
  bare?: boolean;
}) {
  return (
    <LanguageProvider>
      <ErrorBoundary onError={(error, info) => console.error('[Commercial] Route error:', error.message, error.stack, info.componentStack)}>
        {requireAuth ? (
          <Protected>
            <CommercialShell showTabBar={showTabBar} bare={bare}>
              {children}
            </CommercialShell>
          </Protected>
        ) : (
          <CommercialShell showTabBar={false} bare>
            {children}
          </CommercialShell>
        )}
      </ErrorBoundary>
    </LanguageProvider>
  );
}
