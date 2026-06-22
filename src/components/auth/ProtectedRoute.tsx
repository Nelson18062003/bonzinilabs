import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMyProfile } from '@/hooks/useProfile';
import { isProfileComplete } from '@/lib/authGate';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE } from '@/mobile/designKit';

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
      <div className={cn('flex min-h-screen items-center justify-center', SURFACE.canvas)}>
        <Loader2 className="h-8 w-8 animate-spin text-[#8B5CF6]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Garde de complétion (cf. @/lib/authGate, finding M1) : le TÉLÉPHONE est le
  // champ métier bloquant. Fail-closed : profil absent/en erreur → onboarding.
  if (requireComplete && !isProfileComplete(profile)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
