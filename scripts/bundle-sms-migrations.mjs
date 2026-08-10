#!/usr/bin/env node
/**
 * bundle-sms-migrations.mjs — réunit les migrations SMS en un fichier.
 *
 * POURQUOI : le déploiement se fait depuis l'éditeur SQL du dashboard
 * Supabase, sans CLI. Coller huit fichiers l'un après l'autre, dans le bon
 * ordre, est une source d'erreur inutile — surtout qu'un fichier oublié ne
 * se voit pas : les tables existent, mais un déclencheur manque.
 *
 * Le fichier produit est régénéré à chaque nouvelle migration plutôt que
 * maintenu à la main. Il reste idempotent : le rejouer en entier ne casse
 * rien, même si une partie a déjà été appliquée.
 *
 * Usage :
 *   node scripts/bundle-sms-migrations.mjs
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations');
const OUTPUT = 'scripts/generated/sms-migrations-completes.sql';

/** Les migrations du chantier SMS, dans l'ordre chronologique. */
const PREFIX = '20260810';

const RULE = '-- ' + '═'.repeat(60);

const HEADER = `-- ============================================================
-- BONZINI — SMS : TOUTES les migrations réunies en un seul fichier.
--
-- FICHIER GÉNÉRÉ par \`npm run bundle:sms-migrations\`. Ne pas modifier à
-- la main : toute correction se fait dans la migration d'origine.
--
-- À COLLER DANS L'ÉDITEUR SQL DE SUPABASE, EN UNE FOIS.
-- Équivalent de \`npx supabase db push\` pour l'ensemble du chantier SMS.
--
-- SANS DANGER, MÊME SI VOUS AVEZ DÉJÀ APPLIQUÉ UNE PARTIE : tout est
-- idempotent (CREATE ... IF NOT EXISTS, CREATE OR REPLACE, ON CONFLICT DO
-- NOTHING, DROP TRIGGER IF EXISTS, ADD COLUMN IF NOT EXISTS). Le rejouer
-- en entier ne casse rien et ne crée pas de doublon.
--
-- SANS EFFET DE BORD : tous les gabarits arrivent avec enabled = false.
-- Aucun SMS ne peut partir tant qu'un gabarit n'est pas activé à la main.
-- ============================================================
`;

const FOOTER_CHECK = `
${RULE}
-- Contrôle final — à lire après exécution
${RULE}
SELECT
  to_regclass('public.sms_outbox')          IS NOT NULL AS table_file,
  to_regclass('public.sms_template_map')    IS NOT NULL AS table_gabarits,
  to_regclass('public.sms_sender_routes')   IS NOT NULL AS table_expediteurs,
  to_regclass('public.phone_verifications') IS NOT NULL AS table_verifications,
  (SELECT count(*) FROM public.sms_template_map)                      AS gabarits,
  (SELECT count(*) FROM public.sms_template_map WHERE enabled)        AS gabarits_actifs,
  (SELECT count(*) FROM cron.job WHERE jobname = 'sms-drainer')       AS cron_drainage,
  (SELECT count(*) FROM public.clients WHERE preferred_locale = 'fr') AS clients_en_francais;
`;

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.startsWith(PREFIX) && f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error(`✗ Aucune migration ${PREFIX}* trouvée.`);
  process.exit(1);
}

const parts = [HEADER];

for (const file of files) {
  parts.push('', RULE, `-- ${file}`, RULE, '', readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
}

// Marque ces fichiers comme appliqués, pour qu'un futur `db push` ne les
// rejoue pas. Enveloppé : selon la version du CLI, la table d'historique
// peut être absente ou structurée autrement — sans conséquence sur le schéma.
const rows = files
  .map((f) => `    ('${f.slice(0, 14)}', '${f.slice(15, -4)}')`)
  .join(',\n');

parts.push(`
${RULE}
-- Historique des migrations
${RULE}
DO $migr$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
${rows}
  ON CONFLICT (version) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Historique non mis a jour. Sans consequence : le schema est en place.';
END;
$migr$;
`);

parts.push(FOOTER_CHECK);

const out = parts.join('\n');
mkdirSync(join(ROOT, dirname(OUTPUT)), { recursive: true });
writeFileSync(join(ROOT, OUTPUT), out);

console.log(`✓ ${OUTPUT} — ${files.length} migrations, ${out.split('\n').length} lignes`);
for (const f of files) console.log(`    · ${f}`);
