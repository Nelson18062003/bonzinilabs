// ============================================================
// Test de non-régression SÉCURITÉ — parité matrice de permissions.
//
// Contexte : les RPC sensibles étaient gardées par is_admin(), qui ne
// teste AUCUN rôle (vrai pour toute ligne non désactivée de user_roles).
// N'importe quel rôle (cash_agent, treasurer, support…) pouvait donc
// créditer un portefeuille, valider un dépôt ou rediriger le bénéficiaire
// d'un paiement. Corrigé par admin_has_permission(uid, permission), qui
// DOIT rester le miroir exact de ROLE_PERMISSIONS.
//
// Ce test échoue si la matrice SQL et la matrice applicative divergent —
// c'est-à-dire si quelqu'un ajoute un rôle/une permission côté app sans
// mettre à jour le garde-fou serveur (ou l'inverse).
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROLE_PERMISSIONS, type AppRole, type RolePermission } from '@/contexts/AdminAuthContext';

const MIGRATION = join(
  process.cwd(),
  'supabase/migrations/20260831160000_role_permission_enforcement.sql',
);

/** Extrait la matrice du CASE SQL : permission -> rôles autorisés. */
function parseSqlMatrix(sql: string): Record<string, Set<string>> {
  const matrix: Record<string, Set<string>> = {};
  const re = /WHEN\s+'(\w+)'\s+THEN\s+ur\.role::text\s+IN\s+\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const roles = m[2]
      .split(',')
      .map((r) => r.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);
    matrix[m[1]] = new Set(roles);
  }
  return matrix;
}

describe('SÉCURITÉ — admin_has_permission est le miroir de ROLE_PERMISSIONS', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  const sqlMatrix = parseSqlMatrix(sql);
  const appRoles = Object.keys(ROLE_PERMISSIONS) as AppRole[];
  const permissionKeys = Object.keys(ROLE_PERMISSIONS.super_admin) as (keyof RolePermission)[];

  it('la migration expose bien une matrice SQL', () => {
    expect(Object.keys(sqlMatrix).length).toBeGreaterThan(0);
  });

  it.each(permissionKeys)('« %s » autorise exactement les mêmes rôles côté SQL', (perm) => {
    const expected = appRoles.filter((r) => ROLE_PERMISSIONS[r][perm]).sort();
    const actual = [...(sqlMatrix[perm] ?? [])].sort();
    expect(actual, `permission ${perm} absente ou divergente dans la migration SQL`).toEqual(expected);
  });

  it('n’autorise aucun rôle inconnu (faute de frappe = permission muette)', () => {
    const known = new Set<string>(appRoles);
    for (const [perm, roles] of Object.entries(sqlMatrix)) {
      for (const role of roles) {
        expect(known.has(role), `rôle inconnu « ${role} » pour ${perm}`).toBe(true);
      }
    }
  });

  it('canManageUsers reste réservé au super_admin', () => {
    expect([...(sqlMatrix.canManageUsers ?? [])]).toEqual(['super_admin']);
  });

  it('les rôles sans mandat financier ne peuvent pas ajuster les portefeuilles', () => {
    const wallets = sqlMatrix.canAdjustWallets ?? new Set();
    for (const role of ['cash_agent', 'treasurer', 'support', 'customer_success']) {
      expect(wallets.has(role), `${role} ne doit pas pouvoir créditer/débiter un portefeuille`).toBe(false);
    }
  });

  it('un admin désactivé ne peut avoir aucune permission (filtre is_disabled)', () => {
    // Le helper filtre is_disabled AVANT le CASE : sans ce filtre, un admin
    // révoqué garderait ses droits tant que son JWT reste valide.
    expect(sql).toMatch(/is_disabled = false OR ur\.is_disabled IS NULL/i);
  });
});
