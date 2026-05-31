import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMyProfile } from '@/hooks/useProfile';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * Si true (défaut), exige un profil métier complet (téléphone + pays) et
   * redirige sinon vers /onboarding. Mettre false pour les pages qui doivent
   * rester accessibles pendant l'onboarding (ex. la page /onboarding elle-même).
   */
  requireComplete?: boolean;
}

export function ProtectedRoute({ children, requireComplete = true }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  // Le profil n'est requêté que si l'on doit vérifier la complétion.
  const { data: profile, isLoading: profileLoading } = useMyProfile();

  if (isLoading || (requireComplete && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Garde de complétion : phone + country sont les champs métier bloquants
  // (un compte Google fraîchement créé ne les a pas encore). On bloque l'accès
  // aux fonctions financières tant qu'ils manquent.
  if (requireComplete && profile && (!profile.phone || !profile.country)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
