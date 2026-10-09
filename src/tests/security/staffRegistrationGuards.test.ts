// ============================================================
// Test de non-régression SÉCURITÉ — sites, numéros du personnel et
// « Enregistré par » (06/10/2026).
//
//   · les RPC de Mes équipes restent au super admin (canManageUsers) ;
//   · « Enregistré par » vient de la SESSION (auth.uid()), jamais de
//     l'appelant, et ne se réécrit pas ;
//   · la réception ne pose l'origine « colis reçu » que sur un client
//     qu'elle a elle-même enregistré, et jamais par-dessus une origine.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261006100000_staff_sites_phones_registration.sql'), 'utf8');
const body = (fn: string) => new RegExp(`FUNCTION public\\.${fn}\\([\\s\\S]*?\\$(?:fn)?\\$;`).exec(sql)?.[0] ?? '';

describe('SÉCURITÉ — sites, numéros du personnel, « Enregistré par »', () => {
  it('chaque RPC de Mes équipes vérifie canManageUsers', () => {
    for (const fn of ['team_sites', 'team_create_site', 'team_set_member_profile', 'team_members']) {
      expect(body(fn), fn).toMatch(/admin_has_permission\(auth\.uid\(\), 'canManageUsers'\)|admin_has_permission\(v_uid, 'canManageUsers'\)/);
    }
  });

  it('« Enregistré par » vient de la session et ignore ce qu’envoie l’appelant', () => {
    const fn = body('clients_stamp_registration');
    expect(fn).toMatch(/v_uid UUID := auth\.uid\(\)/);
    // À l'insertion, tout est d'abord vidé ; à la mise à jour, l'ancienne valeur est gardée.
    expect(fn).toMatch(/NEW\.registered_by\s*:= NULL;/);
    expect(fn).toMatch(/NEW\.registered_by\s*:= OLD\.registered_by;/);
    // Seul un membre ACTIF du personnel compte.
    expect(fn).toMatch(/is_disabled = false OR ur\.is_disabled IS NULL/);
    expect(sql).toMatch(/CREATE TRIGGER clients_stamp_registration\s+BEFORE INSERT OR UPDATE ON public\.clients/);
  });

  it('la réception ne pose l’origine que sur SON client, jamais par-dessus une autre', () => {
    const fn = body('reception_set_client_origin');
    expect(fn).toMatch(/admin_has_permission\(v_uid, 'canRegisterClients'\)/);
    expect(fn).toMatch(/registered_by IS DISTINCT FROM v_uid/);
    expect(fn).toMatch(/v_client\.source_id IS NOT NULL/);
    expect(fn).toMatch(/FOR UPDATE/);
  });

  it('le déclencheur n’est pas appelable depuis l’API', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.clients_stamp_registration\(\) FROM PUBLIC, anon, authenticated;/);
  });
});
