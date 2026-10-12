import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { AgentCashLogin } from '@/mobile/screens/agent-cash/AgentCashLogin';

/**
 * La connexion du réceptionnaire : le même écran que l'agent cash, vers « /r ».
 * Déjà connecté (retour du téléphone, favori) : droit à l'accueil, sans
 * repasser par le formulaire.
 */
export function ReceptionLogin() {
  const { isAuthenticated, isLoading, hasPermission } = useAdminAuth();
  if (!isLoading && isAuthenticated && hasPermission('canReceiveParcels')) return <Navigate to="/r" replace />;
  return <AgentCashLogin home="/r" titleKey="rc_login" />;
}
