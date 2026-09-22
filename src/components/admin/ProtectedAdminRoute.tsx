import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const { isAuthenticated, isLoading, currentUser } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/m/login" replace />;
  }

  // Le réceptionnaire a sa propre app (« /r ») : l'accueil admin ne lui
  // montrerait rien qu'il puisse faire. On l'y emmène, quelle que soit la
  // porte par laquelle il est entré (connexion admin, lien, retour arrière).
  if (currentUser?.role === 'receptionist') {
    return <Navigate to="/r" replace />;
  }
  // L'agent d'entrepôt de Douala aussi (« /w »).
  if (currentUser?.role === 'warehouse_agent') {
    return <Navigate to="/w" replace />;
  }

  return <>{children}</>;
}
