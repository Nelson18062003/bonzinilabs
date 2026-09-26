// ============================================================
// RÉCEPTION — la coquille de la sous-app « /r », sur le modèle de l'agent
// cash : une session admin (AdminAuthProvider est monté une fois dans
// App.tsx), le rôle vérifié ici, une barre d'onglets à trois entrées.
// Seuls les rôles qui ont canReceiveParcels entrent (réceptionnaire, ops,
// super admin). Un agent cash ou un trésorier est renvoyé à la connexion.
// ============================================================
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { staffHomeFor } from '@/lib/staffHome';
import { Loader2 } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AnimatedPage } from '@/components/transitions/AnimatedPage';
import { cn } from '@/lib/utils';
import { ReceptionTabBar } from './ReceptionTabBar';

function Protected({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, hasPermission, currentUser } = useAdminAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/r/login" replace />;
  // Connecté mais pas réceptionnaire : vers SON espace, pas vers une connexion en boucle.
  if (!hasPermission('canReceiveParcels')) return <Navigate to={staffHomeFor(currentUser?.role)} replace />;
  return <>{children}</>;
}

export function ReceptionShell({ children, showTabBar = true }: { children: ReactNode; showTabBar?: boolean }) {
  return (
    <div className={cn('mx-auto flex min-h-screen w-full max-w-lg flex-col bg-background md:max-w-2xl')}>
      <main className={cn('flex-1', showTabBar && 'pb-24')}>
        <AnimatedPage>{children}</AnimatedPage>
      </main>
      {showTabBar && <ReceptionTabBar />}
    </div>
  );
}

export function ReceptionRouteWrapper({ children, requireAuth = true, showTabBar = true }: { children: ReactNode; requireAuth?: boolean; showTabBar?: boolean }) {
  return (
    <LanguageProvider>
      <ErrorBoundary onError={(error, info) => console.error('[Reception] Route error:', error.message, error.stack, info.componentStack)}>
        {requireAuth ? (
          <Protected>
            <ReceptionShell showTabBar={showTabBar}>{children}</ReceptionShell>
          </Protected>
        ) : (
          <ReceptionShell showTabBar={false}>{children}</ReceptionShell>
        )}
      </ErrorBoundary>
    </LanguageProvider>
  );
}
