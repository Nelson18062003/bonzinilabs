// ============================================================
// Test de non-régression SÉCURITÉ — garde-fous des RPC « argent ».
//
// Contexte : scan_cash_payment et confirm_cash_payment étaient SECURITY
// DEFINER, exécutables par `authenticated`/`anon`, et ne contenaient AUCUN
// contrôle (ni propriétaire, ni rôle). N'importe quel client de l'app
// pouvait donc marquer un paiement cash comme « remis en espèces », avec
// une signature arbitraire, et écrire l'écriture PAYMENT_EXECUTED au grand
// livre. Le seul statut refusé étant `completed`, un paiement annulé (donc
// DÉJÀ remboursé) pouvait aussi être re-encaissé.
//
// Ce test verrouille deux invariants sur les migrations :
//   1. la migration correctrice contient bien les gardes ;
//   2. AUCUNE migration ultérieure ne redéfinit ces fonctions sans garde
//      (le cas classique de régression : un correctif métier réécrit la
//      fonction à partir d'une vieille copie et efface l'autorisation).
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations');
const FIX = '20260831220000_secure_cash_chain_and_amounts.sql';

/** Fonctions qui déplacent de l'argent ou en actent le déplacement. */
const MONEY_RPCS = [
  'scan_cash_payment',
  'confirm_cash_payment',
  'validate_deposit',
  'admin_adjust_wallet',
  'create_wallet_adjustment',
  'process_payment',
] as const;

const migrationFiles = () => readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

describe('SÉCURITÉ — la chaîne cash est autorisée et non rejouable', () => {
  const sql = readFileSync(join(MIGRATIONS_DIR, FIX), 'utf8');

  it.each(['scan_cash_payment', 'confirm_cash_payment'])(
    '%s exige la permission canProcessPayments',
    (fn) => {
      const body = sql.slice(sql.indexOf(`FUNCTION public.${fn}`));
      expect(body).toContain("admin_has_permission(auth.uid(), 'canProcessPayments')");
    },
  );

  it.each(['scan_cash_payment', 'confirm_cash_payment'])(
    '%s refuse les statuts terminaux (un paiement annulé est déjà remboursé)',
    (fn) => {
      const body = sql.slice(sql.indexOf(`FUNCTION public.${fn}`));
      // Le statut `completed` ne suffit pas : `rejected` et
      // `cancelled_by_admin` ont déjà recrédité le portefeuille.
      expect(body).toContain("IN ('rejected', 'cancelled_by_admin')");
    },
  );

  it('verrouille la ligne paiement avant de la lire (double encaissement)', () => {
    const body = sql.slice(sql.indexOf('FUNCTION public.confirm_cash_payment'));
    expect(body).toContain('WHERE id = p_payment_id FOR UPDATE');
  });

  it('impose des montants strictement positifs (un signe inversé inverse l’opération)', () => {
    for (const guard of ['p_amount IS NULL OR p_amount <= 0', 'v_credit_amount IS NULL OR v_credit_amount <= 0']) {
      expect(sql).toContain(guard);
    }
  });

  it('lie le dépôt à son propriétaire, sauf pour le staff qui le saisit', () => {
    expect(sql).toContain('p_user_id IS DISTINCT FROM auth.uid()');
    // Le garde est injecté depuis un littéral SQL : les apostrophes y sont
    // doublées (''canProcessDeposits'').
    expect(sql).toContain("admin_has_permission(auth.uid(), ''canProcessDeposits'')");
  });
});

describe('SÉCURITÉ — aucune migration ultérieure ne redéfinit une RPC argent sans garde', () => {
  // Une migration postérieure qui réécrit une de ces fonctions doit
  // reconduire une autorisation. Les migrations qui se contentent de
  // patcher le corps existant (replace() sur pg_get_functiondef) ne
  // contiennent pas « CREATE OR REPLACE FUNCTION public.<nom> » et ne sont
  // donc pas concernées.
  const later = migrationFiles().filter((f) => f > FIX);

  it.each(MONEY_RPCS)('%s reste gardée dans les migrations postérieures', (fn) => {
    const offenders = later.filter((file) => {
      const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      const idx = content.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}`);
      if (idx === -1) return false;
      // Redéfinition complète : elle doit porter un contrôle d'autorisation.
      return !content.slice(idx).includes('admin_has_permission');
    });

    expect(
      offenders,
      `${fn} est redéfinie sans admin_has_permission dans : ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});
