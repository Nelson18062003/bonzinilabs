import { AgentCashLogin } from '@/mobile/screens/agent-cash/AgentCashLogin';

/** La connexion du réceptionnaire : le même écran que l'agent cash, vers « /r ». */
export function ReceptionLogin() {
  return <AgentCashLogin home="/r" titleKey="rc_login" />;
}
