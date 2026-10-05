// ============================================================
// L'organisation de l'équipe — une seule source pour « Mes équipes » :
// les équipes, les rôles de chacune, ce que chaque rôle fait et où il
// arrive après la connexion. Tous les rôles de AppRole y figurent (test).
// ============================================================
import { ADMIN_ROLE_LABELS, type AppRole } from '@/contexts/AdminAuthContext';
import { staffHomeFor } from '@/lib/staffHome';

export type TeamKey = 'direction' | 'bureau' | 'ventes' | 'guangzhou' | 'douala' | 'douane';

export interface TeamDef {
  key: TeamKey;
  label: string;
  hint: string;
  roles: AppRole[];
}

export const TEAMS: TeamDef[] = [
  { key: 'direction', label: 'Direction', hint: 'Accès complet, crée les accès', roles: ['super_admin'] },
  { key: 'bureau', label: 'Bureau', hint: 'Opérations, clientèle, support, trésorerie', roles: ['ops', 'customer_success', 'support', 'treasurer'] },
  { key: 'ventes', label: 'Commerciaux', hint: 'Prospects, clients apportés, objectifs du mois', roles: ['commercial'] },
  { key: 'guangzhou', label: 'Guangzhou', hint: 'Réception des colis, paiements cash', roles: ['receptionist', 'cash_agent'] },
  { key: 'douala', label: 'Douala', hint: 'Entrepôt : arrivées, remise des colis', roles: ['warehouse_agent'] },
  { key: 'douane', label: 'Douane', hint: 'Commissionnaire agréé', roles: ['customs_broker'] },
];

/** Ce que le rôle fait, en une phrase (écran de création, fiche du membre). */
export const ROLE_DESCRIPTION: Record<AppRole, string> = {
  super_admin: 'Accès complet. Crée, modifie et retire les accès de l’équipe.',
  ops: 'Dépôts, paiements, taux du jour, cargo, réception et Douala.',
  customer_success: 'Clients, dépôts à valider, messagerie.',
  support: 'Clients et messagerie, sans valider d’argent.',
  treasurer: 'Trésorerie : achats et ventes d’USDT, contreparties, inventaire.',
  commercial: 'Ses prospects, les clients qu’il apporte, ses chiffres et ses objectifs. Ne voit rien d’autre.',
  receptionist: 'Réception des colis à Guangzhou, nouveaux clients. Aucun accès à l’argent.',
  cash_agent: 'Remet les paiements en espèces aux fournisseurs.',
  warehouse_agent: 'Entrepôt de Douala : pointe les arrivées, encaisse, remet les colis.',
  customs_broker: 'Relit et signe les codes SH et les audits de déclaration. Aucun accès à l’argent ni aux colis.',
};

const SPACE_LABEL: Record<string, string> = {
  '/m': 'Administration',
  '/a': 'Paiements cash',
  '/r': 'Réception',
  '/w': 'Entrepôt Douala',
  '/v': 'Espace commercial',
  '/m/douane': 'Douane',
};

/** L'espace où le rôle arrive après la connexion, en clair. */
export function roleSpace(role: AppRole): string {
  const home = staffHomeFor(role);
  return SPACE_LABEL[home] ?? home;
}

export function teamOf(role: AppRole): TeamDef {
  return TEAMS.find((t) => t.roles.includes(role)) ?? TEAMS[1];
}

export function roleLabel(role: AppRole): string {
  return ADMIN_ROLE_LABELS[role] ?? role;
}

/** « Jean Mbarga », ou l'adresse si le nom manque. */
export function memberName(m: { first_name?: string | null; last_name?: string | null; email?: string | null }): string {
  return [m.first_name, m.last_name].filter(Boolean).join(' ').trim() || m.email || '—';
}

/** « il y a 3 h », « hier », « le 2 oct. », ou « jamais ». */
export function lastSeen(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'jamais connecté';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const min = Math.round((now - t) / 60000);
  if (min < 2) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'hier';
  if (d < 7) return `il y a ${d} jours`;
  return `le ${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}
