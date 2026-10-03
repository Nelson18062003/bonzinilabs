import { AgentCashLogin } from '@/mobile/screens/agent-cash/AgentCashLogin';

/** La connexion de l'agent d'entrepôt : le même écran que l'agent cash, vers « /w ». */
export function WarehouseLogin() {
  return <AgentCashLogin home="/w" titleKey="wh_login" />;
}
