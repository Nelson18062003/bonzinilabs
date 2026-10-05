// ============================================================
// Test de non-régression SÉCURITÉ — le commercial reste isolé.
//
// Le rôle `commercial` (05/10/2026) n'a que SES RPC, limitées à sa fiche.
// Son isolation repose sur deux règles, faciles à défaire sans le voir :
//   1. is_admin(uid) l'exclut : une soixantaine de politiques RLS et une
//      quinzaine de RPC s'appuient encore sur is_admin. Une migration qui
//      redéfinirait is_admin « comme avant » lui rouvrirait les
//      portefeuilles, les dépôts, les bénéficiaires…
//   2. aucune politique ne teste « a une ligne user_roles » à la main.
// Et ses tables (prospects, objectifs) ne s'écrivent que par RPC.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'supabase/migrations');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');

/** Le corps de la DERNIÈRE définition d'une fonction (celle qui tourne en production). */
function lastDefinition(signature: RegExp): string {
  let body = '';
  for (const f of FILES) {
    const sql = read(f);
    const re = new RegExp(signature.source + '[\\s\\S]*?\\$\\$;', 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) body = m[0];
  }
  return body;
}

describe('SÉCURITÉ — le commercial reste isolé du reste de la plateforme', () => {
  it('la dernière définition de is_admin(uuid) exclut le commercial et les comptes désactivés', () => {
    const body = lastDefinition(/CREATE OR REPLACE FUNCTION public\.is_admin\(_user_id UUID\)/);
    expect(body, 'is_admin(_user_id UUID) introuvable').not.toBe('');
    expect(body).toMatch(/role::text\s*<>\s*'commercial'/);
    expect(body).toMatch(/is_disabled = false OR is_disabled IS NULL/);
  });

  it('les politiques réécrites passent par is_admin (portefeuilles, journal d’audit)', () => {
    const sql = read('20261005160000_teams_commercials.sql');
    for (const name of ['Admins can view all wallets', 'Admins can view audit logs', 'Admins can insert audit logs']) {
      const re = new RegExp(`CREATE POLICY "${name}"[^;]*public\\.is_admin\\(auth\\.uid\\(\\)\\)`);
      expect(sql, name).toMatch(re);
    }
  });

  it('prospects et objectifs n’ont aucune politique d’écriture (tout passe par les RPC)', () => {
    for (const f of FILES) {
      const sql = read(f);
      expect(sql, f).not.toMatch(/CREATE POLICY[^;]*ON public\.(prospects|commercial_objectives)\s+FOR\s+(INSERT|UPDATE|DELETE|ALL)/i);
    }
  });

  it('chaque RPC des ventes vérifie le périmètre ou la permission', () => {
    const sql = read('20261005160000_teams_commercials.sql');
    const rpcs = ['prospect_create', 'prospect_update', 'prospect_set_status', 'commercial_dashboard', 'commercial_clients'];
    for (const fn of rpcs) {
      const body = new RegExp(`FUNCTION public\\.${fn}\\([\\s\\S]*?\\$\\$;`).exec(sql)?.[0] ?? '';
      expect(body, fn).toMatch(/_sales_scope\(/);
    }
    for (const fn of ['prospect_reassign', 'prospect_link_client', 'set_commercial_objective', 'sales_overview']) {
      const body = new RegExp(`FUNCTION public\\.${fn}\\([\\s\\S]*?\\$\\$;`).exec(sql)?.[0] ?? '';
      expect(body, fn).toMatch(/admin_has_permission\([^;]*'canManageSales'\)/);
    }
    for (const fn of ['team_members', 'team_create_member', 'team_update_member', 'team_link_commercial']) {
      const body = new RegExp(`FUNCTION public\\.${fn}\\([\\s\\S]*?\\$\\$;`).exec(sql)?.[0] ?? '';
      expect(body, fn).toMatch(/admin_has_permission\([^;]*'canManageUsers'\)/);
    }
  });
});
