import { AgentCashLogin } from '@/mobile/screens/agent-cash/AgentCashLogin';

/**
 * La connexion du commercial : email + mot de passe, vers « /v » — le même
 * écran que la réception et l'entrepôt. Son adresse est souvent inventée
 * (« prenom@bonzini.com ») : le code par email de /m/login ne lui arrive pas.
 */
export function CommercialLogin() {
  return <AgentCashLogin home="/v" titleKey="cm_login" />;
}
