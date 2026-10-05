// ============================================================
// L'organisation de l'équipe — une seule source pour « Mes équipes » :
// les équipes, les rôles de chacune, ce que chaque rôle fait et où il
// arrive après la connexion. Tous les rôles de AppRole y figurent (test).
// ============================================================
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { ADMIN_ROLE_LABELS, type AppRole } from '@/contexts/AdminAuthContext';
import { staffHomeFor, staffLoginFor, staffLoginTakesPassword } from '@/lib/staffHome';
import { normalizeText } from '@/lib/clientSearch';
import type { StaffPhone, StaffSite, TeamMember } from '@/hooks/useTeam';

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

/* ── Sites et numéros (06/10) ─────────────────────────────────────────── */

/**
 * Le site proposé à la création d'un accès, selon le rôle (code de
 * `staff_sites`) — modifiable à l'écran. Les autres rôles n'en ont pas.
 */
export const DEFAULT_SITE_CODE: Partial<Record<AppRole, string>> = {
  receptionist: 'gz_office',
  warehouse_agent: 'douala',
};

/** Le site proposé pour ce rôle, s'il existe (et est actif) dans la liste. */
export function defaultSiteFor<S extends Pick<StaffSite, 'code' | 'is_active'>>(role: AppRole, sites: S[] | null | undefined): S | null {
  const code = DEFAULT_SITE_CODE[role];
  if (!code) return null;
  return (sites ?? []).find((s) => s.code === code && s.is_active !== false) ?? null;
}

/**
 * L'accès est créé mais ses numéros et/ou son site n'ont pas suivi : ce qu'il
 * faut refaire, accordé à ce qui avait été demandé.
 */
export function profileFailedMessage(sent: { phones: boolean; site: boolean }): string {
  const what = sent.phones && sent.site
    ? 'ses numéros et son site n’ont pas pu être enregistrés'
    : sent.phones
      ? 'ses numéros n’ont pas pu être enregistrés'
      : 'son site n’a pas pu être enregistré';
  const redo = sent.phones ? 'les saisir' : 'le choisir';
  return `L’accès est créé, mais ${what}. Ouvrez sa fiche (« Voir sa fiche », puis « Modifier ») pour ${redo} à nouveau.`;
}

/** L'ordre des sites de départ ; les sites ajoutés suivent, par nom. */
const SITE_ORDER = ['gz_office', 'gz_warehouse', 'douala', 'yaounde'];
export function compareSites(a: Pick<StaffSite, 'code' | 'label'>, b: Pick<StaffSite, 'code' | 'label'>): number {
  const ia = a.code ? SITE_ORDER.indexOf(a.code) : -1;
  const ib = b.code ? SITE_ORDER.indexOf(b.code) : -1;
  if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });
}

/**
 * Les numéros d'un membre, principal d'abord. Une réponse ancienne (sans
 * `phones`) ou un membre dont le numéro n'a pas pu être converti au format
 * international : son numéro unique (`phone`), tel quel.
 */
export function memberPhones(m: Pick<TeamMember, 'phone'> & { phones?: StaffPhone[] | null }): StaffPhone[] {
  const list = m.phones ?? [];
  if (list.length > 0) return list;
  const legacy = m.phone?.trim();
  return legacy ? [{ phone_e164: legacy, country_iso: null, label: null }] : [];
}

/** Le pays d'un numéro : celui enregistré, sinon celui de son indicatif. */
export function phoneCountry(p: Pick<StaffPhone, 'phone_e164' | 'country_iso'>): string | null {
  if (p.country_iso) return p.country_iso;
  try {
    return parsePhoneNumberFromString(p.phone_e164)?.country ?? null;
  } catch {
    return null;
  }
}

/**
 * La recherche de « Mes équipes » : chaque mot tapé doit se retrouver dans le
 * nom, l'email, le site, la fiche commerciale ou le libellé d'un numéro — ou,
 * s'il contient des chiffres, dans l'un des numéros (« 2604 », « 86138… »).
 */
export function matchesMember(
  m: Pick<TeamMember, 'first_name' | 'last_name' | 'email' | 'phone'> & {
    phones?: StaffPhone[] | null;
    site?: Pick<StaffSite, 'label'> | null;
    source?: { label: string } | null;
  },
  query: string,
): boolean {
  const tokens = normalizeText(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return true;
  const phones = memberPhones(m);
  const digits = phones.map((p) => p.phone_e164.replace(/\D/g, ''));
  // Un numéro tapé avec ses espaces (« 6 71 51 33 76 ») se cherche d'un bloc.
  const typed = query.replace(/\D/g, '');
  if (/^[\d\s+().-]+$/.test(query.trim()) && typed.length >= 2) return digits.some((n) => n.includes(typed));
  const haystack = normalizeText(
    [memberName(m), m.email, m.site?.label, m.source?.label, ...phones.map((p) => p.label)].filter(Boolean).join(' '),
  );
  return tokens.every((token) => {
    if (haystack.includes(token)) return true;
    const d = token.replace(/\D/g, '');
    return d.length >= 2 && digits.some((n) => n.includes(d));
  });
}

// ── L'accès à transmettre (création, nouveau mot de passe) ─────────────────

/** Le site, tel qu'on le donne au personnel. */
export const STAFF_SITE = 'https://www.bonzinilabs.com';

export interface AccessLogin {
  /** La page de connexion à donner, complète. */
  url: string;
  /** Cette page accepte le mot de passe dans un navigateur (sinon : code email, ou l'app HQ). */
  password: boolean;
  /** La personne peut changer son mot de passe elle-même, depuis son espace. */
  canChange: boolean;
}

/**
 * Où et comment le membre se connecte. Les espaces de terrain (/a, /r, /w,
 * /v) ont leur page email + mot de passe ; les autres passent par /m/login,
 * qui sur le site envoie un code à l'adresse — inutile si elle est inventée.
 * Changer son mot de passe : /m/more/password (rôles de /m) et /v/password
 * (commercial) ; l'agent cash, la réception et l'entrepôt (comptes souvent
 * partagés) n'ont pas cet écran.
 */
export function accessLogin(role: AppRole): AccessLogin {
  const password = staffLoginTakesPassword(role);
  return { url: STAFF_SITE + staffLoginFor(role), password, canChange: role === 'commercial' || !password };
}

/** Le message prêt à envoyer (WhatsApp, SMS) : où, quel email, quel mot de passe. */
export function accessMessage({ name, email, password, role }: { name: string; email: string; password: string; role: AppRole }): string {
  const login = accessLogin(role);
  const where = login.password
    ? `Connexion : ${login.url} (ou l'app BONZINI HQ)`
    : `Connexion : l'app BONZINI HQ avec cet email et ce mot de passe, ou ${login.url} (code envoyé à ton email)`;
  return [
    `Bonjour ${name.split(' ')[0] || ''}, voici ton accès Bonzini Labs.`,
    where,
    `Email : ${email}`,
    `Mot de passe provisoire : ${password}`,
    ...(login.canChange ? ['Change-le après ta première connexion.'] : []),
  ].join('\n');
}
