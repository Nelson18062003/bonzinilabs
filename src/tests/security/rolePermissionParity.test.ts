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
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROLE_PERMISSIONS, type AppRole, type RolePermission } from '@/contexts/AdminAuthContext';

// La matrice vit dans la DERNIÈRE migration qui (re)définit
// admin_has_permission : chaque nouvelle permission redéfinit la fonction en
// entier (voir 20260911120000_cargo_module.sql), et c'est cette version-là
// qui tourne en production.
const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations');
const DEFINES_MATRIX = /FUNCTION public\.admin_has_permission\(_user_id UUID, _permission TEXT\)/;
const MIGRATION = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .filter((f) => DEFINES_MATRIX.test(readFileSync(join(MIGRATIONS_DIR, f), 'utf8')))
  .map((f) => join(MIGRATIONS_DIR, f))
  .pop() as string;

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

// ============================================================
// Troisième matrice : la passerelle Mola.
//
// `supabase/functions/admin-assistant/index.ts` garde SA PROPRE copie de
// ROLE_PERMISSIONS pour garder les capacités @mola (`do_capability` lit
// `perms[meta.permission]`). Une clé absente de cette copie vaut `undefined`,
// donc faux : l'action devient injoignable pour TOUS les rôles, super_admin
// compris. C'est exactement ce qui est arrivé aux capacités Cargo, que les
// deux autres matrices connaissaient déjà.
//
// La règle AI-native de CLAUDE.md — « un agent piloté par un humain doit
// pouvoir atteindre toutes les actions, dans les limites des droits de la
// personne » — impose donc que cette troisième copie reste identique.
// ============================================================
const GATEWAY = join(process.cwd(), 'supabase/functions/admin-assistant/index.ts');

/** Extrait la matrice TypeScript de la passerelle : rôle -> permission -> bool. */
function parseGatewayMatrix(ts: string): Record<string, Record<string, boolean>> {
  const block = /const ROLE_PERMISSIONS: Record<string, Record<PermKey, boolean>> = \{([\s\S]*?)\n\};/.exec(ts);
  if (!block) throw new Error('matrice ROLE_PERMISSIONS introuvable dans la passerelle Mola');
  const matrix: Record<string, Record<string, boolean>> = {};
  const roleRe = /(\w+):\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = roleRe.exec(block[1])) !== null) {
    const perms: Record<string, boolean> = {};
    for (const [, key, val] of m[2].matchAll(/(can\w+):\s*(true|false)/g)) perms[key] = val === 'true';
    matrix[m[1]] = perms;
  }
  return matrix;
}

describe('SÉCURITÉ — la passerelle Mola connaît les mêmes permissions', () => {
  const gatewayMatrix = parseGatewayMatrix(readFileSync(GATEWAY, 'utf8'));
  const appRoles = Object.keys(ROLE_PERMISSIONS) as AppRole[];
  const permissionKeys = Object.keys(ROLE_PERMISSIONS.super_admin) as (keyof RolePermission)[];

  it('déclare exactement les mêmes rôles que l’app', () => {
    expect(Object.keys(gatewayMatrix).sort()).toEqual([...appRoles].sort());
  });

  it.each(appRoles)('« %s » a exactement les mêmes clés de permission', (role) => {
    expect(
      Object.keys(gatewayMatrix[role] ?? {}).sort(),
      `clé manquante côté passerelle : l’action devient injoignable pour ${role}`,
    ).toEqual([...permissionKeys].sort());
  });

  it.each(appRoles)('« %s » a exactement les mêmes valeurs que l’app', (role) => {
    for (const perm of permissionKeys) {
      expect(
        gatewayMatrix[role]?.[perm],
        `${role}.${perm} diverge entre la passerelle Mola et AdminAuthContext`,
      ).toBe(ROLE_PERMISSIONS[role][perm]);
    }
  });

  it('les permissions Cargo sont bien connues de la passerelle', () => {
    // Régression : les cinq capacités Cargo exposées à Mola étaient refusées
    // pour tout le monde parce que ces deux clés manquaient ici.
    for (const role of appRoles) {
      expect(gatewayMatrix[role]).toHaveProperty('canViewCargo');
      expect(gatewayMatrix[role]).toHaveProperty('canManageCargo');
    }
    expect(gatewayMatrix.super_admin.canManageCargo).toBe(true);
  });
});
