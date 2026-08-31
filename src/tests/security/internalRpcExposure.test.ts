// ============================================================
// Test de non-régression SÉCURITÉ — surface API des fonctions internes.
//
// Supabase accorde par défaut l'EXECUTE à `anon` et `authenticated` sur
// toute fonction de `public` : une fonction de maintenance devient donc
// appelable en HTTP (/rest/v1/rpc/<nom>) alors que son corps ne contient
// aucun garde-fou — « seul le cron l'appelle » n'est pas un contrôle
// d'accès. claim_email_batch / claim_sms_batch renvoyaient ainsi des lots
// de messages en attente (email, téléphone, montants, solde) à un appelant
// NON AUTHENTIFIÉ, et mola_purge_old_conversations laissait n'importe quel
// compte connecté supprimer l'historique de l'assistant.
//
// Ce test échoue si une migration ultérieure ré-accorde l'EXECUTE à anon
// ou authenticated sur l'une de ces fonctions (typiquement via un
// « GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public »).
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations');
const REVOKE = '20260831230000_revoke_internal_function_exposure.sql';

/** Fonctions cron / helpers de trigger : jamais exposées à l'API. */
const INTERNAL_FUNCTIONS = [
  'claim_email_batch',
  'claim_sms_batch',
  'run_email_drainer',
  'run_sms_drainer',
  'run_deposit_reminders',
  'run_profile_reminders',
  'run_sms_deposit_reminders',
  'mola_purge_old_conversations',
  '_create_client_and_wallet',
  '_enqueue_welcome',
] as const;

describe('SÉCURITÉ — les fonctions internes ne sont pas exposées à l’API', () => {
  const sql = readFileSync(join(MIGRATIONS_DIR, REVOKE), 'utf8');

  it.each(INTERNAL_FUNCTIONS)('%s : EXECUTE retiré à anon et authenticated', (fn) => {
    const revoked = sql
      .split('\n')
      .some(
        (line) =>
          line.trimStart().startsWith('REVOKE EXECUTE') &&
          line.includes(`public.${fn}(`) &&
          line.includes('anon, authenticated'),
      );
    expect(revoked, `aucun REVOKE anon+authenticated pour ${fn}`).toBe(true);
  });

  it('la purge (destructive) porte aussi un contrôle dans son corps', () => {
    // La révocation protège l'API ; le contrôle protège contre un futur
    // GRANT. auth.uid() est NULL pour le cron et service_role.
    expect(sql).toContain("admin_has_permission(auth.uid(), 'canManageUsers')");
    expect(sql).toContain('auth.uid() IS NOT NULL');
  });

  it('aucune migration ultérieure ne ré-accorde ces fonctions', () => {
    const later = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql') && f > REVOKE)
      .filter((file) => {
        const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
        return content.split('\n').some((line) => {
          if (!line.trimStart().toUpperCase().startsWith('GRANT EXECUTE')) return false;
          if (!/\b(anon|authenticated|PUBLIC)\b/.test(line)) return false;
          // Un GRANT global rouvre tout le schéma d'un coup.
          if (/ALL FUNCTIONS IN SCHEMA\s+public/i.test(line)) return true;
          return INTERNAL_FUNCTIONS.some((fn) => line.includes(`public.${fn}(`));
        });
      });

    expect(later, `ces migrations ré-exposent des fonctions internes : ${later.join(', ')}`).toEqual([]);
  });
});
