// ============================================================
// ENTREPÔT DE DOUALA — la coquille de la sous-app « /w », sur le modèle de
// la réception (« /r ») : une session admin, le rôle vérifié ici, une barre
// d'onglets à trois entrées. Entrent ceux qui pointent ou remettent des
// colis (agent d'entrepôt, ops, super admin). Les autres sont renvoyés à
// la connexion. Français seulement : l'entrepôt est au Cameroun.
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
import { WarehouseTabBar } from './WarehouseTabBar';

function Protected({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, hasPermission, currentUser } = useAdminAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/w/login" replace />;
  // Connecté mais pas agent d'entrepôt : vers SON espace, pas vers une connexion en boucle.
  if (!(hasPermission('canReceiveAtDestination') || hasPermission('canReleaseParcels'))) return <Navigate to={staffHomeFor(currentUser?.role)} replace />;
  return <>{children}</>;
}

export function WarehouseShell({ children, showTabBar = true }: { children: ReactNode; showTabBar?: boolean }) {
  return (
    <div className={cn('mx-auto flex min-h-screen w-full max-w-lg flex-col bg-background md:max-w-2xl')}>
      <main className={cn('flex-1', showTabBar && 'pb-24')}>
        <AnimatedPage>{children}</AnimatedPage>
      </main>
      {showTabBar && <WarehouseTabBar />}
    </div>
  );
}

export function WarehouseRouteWrapper({ children, requireAuth = true, showTabBar = true }: { children: ReactNode; requireAuth?: boolean; showTabBar?: boolean }) {
  return (
    <LanguageProvider>
      <ErrorBoundary onError={(error, info) => console.error('[Warehouse] Route error:', error.message, error.stack, info.componentStack)}>
        {requireAuth ? (
          <Protected>
            <WarehouseShell showTabBar={showTabBar}>{children}</WarehouseShell>
          </Protected>
        ) : (
          <WarehouseShell showTabBar={false}>{children}</WarehouseShell>
        )}
      </ErrorBoundary>
    </LanguageProvider>
  );
}
