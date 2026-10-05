// ============================================================
// « Enregistré par » — qui, dans l'équipe, a créé la fiche d'un client.
//
// Posé en base au moment de la création (déclencheur
// `clients_stamp_registration`, depuis le jeton de la session) : le nom du
// collaborateur, son rôle et son SITE ce jour-là (Guangzhou · bureau,
// Douala…). Jamais choisi, jamais réécrit. Vide pour un client inscrit
// lui-même (application, Google).
//
// Les créations par l'équipe sont journalisées depuis le 10/02/2026 et ont
// été rattrapées : un client sans « Enregistré par » créé depuis s'est
// inscrit lui-même ; avant, on ne sait pas.
// ============================================================
import type { AppRole } from '@/contexts/AdminAuthContext';
import { roleLabel } from '@/lib/team';

export const REGISTRATION_TRACKED_SINCE = '2026-02-10T00:00:00Z';

export interface ClientRegistrationFields {
  created_at?: string | null;
  registered_by: string | null;
  registered_by_name: string | null;
  registered_role: string | null;
  registered_site: string | null;
  registered_at: string | null;
}

export type ClientRegistration =
  | { kind: 'staff'; name: string; role: string | null; site: string | null; at: string | null }
  | { kind: 'self' }
  | { kind: 'unknown' };

export function clientRegistration(c: ClientRegistrationFields | null | undefined): ClientRegistration {
  if (c?.registered_by) {
    return {
      kind: 'staff',
      name: c.registered_by_name?.trim() || 'Un membre de l’équipe',
      role: c.registered_role ? roleLabel(c.registered_role as AppRole) : null,
      site: c.registered_site?.trim() || null,
      at: c.registered_at,
    };
  }
  const created = c?.created_at ? Date.parse(c.created_at) : NaN;
  if (!Number.isNaN(created) && created >= Date.parse(REGISTRATION_TRACKED_SINCE)) return { kind: 'self' };
  return { kind: 'unknown' };
}

/** « Kevin Nkolo · Réceptionnaire · Guangzhou · bureau », « Inscrit lui-même (application) » ou « Non renseigné ». */
export function registrationText(r: ClientRegistration): string {
  if (r.kind === 'self') return 'Inscrit lui-même (application)';
  if (r.kind === 'unknown') return 'Non renseigné (créé avant le suivi)';
  return [r.name, r.role, r.site ?? 'site non renseigné'].filter(Boolean).join(' · ');
}

/** « le 6 oct. 2026 », ou null. */
export function registrationDate(r: ClientRegistration): string | null {
  if (r.kind !== 'staff' || !r.at) return null;
  const d = new Date(r.at);
  if (Number.isNaN(d.getTime())) return null;
  return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
