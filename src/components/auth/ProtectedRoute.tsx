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

  // Garde de complétion : le TÉLÉPHONE est le champ métier bloquant.
  // C'est le seul champ requis dans les DEUX parcours de création existants
  // (self-signup ET création admin), donc tous les clients legacy l'ont ; et
  // c'est précisément ce qu'un compte Google n'a pas. On NE gate PAS sur le
  // pays : il est optionnel pour les clients créés par un admin (défaut NULL),
  // gater dessus enfermerait des clients legacy hors de leur app.
  // FAIL-CLOSED : profil absent/en erreur → on renvoie vers l'onboarding
  // plutôt que d'exposer l'UI financière sur un fetch raté.
  if (requireComplete && (!profile || !profile.phone)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
