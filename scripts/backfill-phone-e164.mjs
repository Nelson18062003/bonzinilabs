#!/usr/bin/env node
/**
 * backfill-phone-e164.mjs — reprise des numéros historiques vers E.164.
 *
 * POURQUOI CE SCRIPT EXISTE : `clients.phone` est une colonne texte libre.
 * Telnyx, lui, n'accepte que du E.164 strict. Avant d'activer le moindre
 * gabarit, il faut savoir combien de clients sont réellement joignables —
 * et lesquels ne le sont pas.
 *
 * ⚠️ AUCUNE DEVINETTE. Un numéro local sans pays identifiable n'est pas
 * « corrigé au mieux » : il est signalé pour revue humaine. Envoyer
 * « votre solde est de X » au mauvais numéro est pire que ne rien envoyer.
 *
 * Réutilise src/lib/phone.ts — la même normalisation que le front, donc pas
 * de second jeu de règles qui divergerait avec le temps.
 *
 * Usage :
 *   node scripts/backfill-phone-e164.mjs            # simulation (par défaut)
 *   node scripts/backfill-phone-e164.mjs --apply    # écrit en base
 *
 * Variables d'environnement requises :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

import { normalizePhone } from '../src/lib/phone.ts';

const APPLY = process.argv.includes('--apply');
const PAGE_SIZE = 500;

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('✗ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.');
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

async function main() {
  console.log(
    APPLY
      ? '▶ Mode ÉCRITURE — la base va être modifiée.\n'
      : '▶ Mode SIMULATION — aucune écriture. Ajoutez --apply pour appliquer.\n',
  );

  const stats = { scanned: 0, already: 0, normalized: 0, unchanged: 0, failed: 0 };
  const failures = [];
  const updates = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('clients')
      .select('id, user_id, first_name, last_name, phone, country, phone_e164')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('✗ Lecture impossible :', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      stats.scanned++;

      // Déjà normalisé et cohérent : on n'y touche pas.
      if (row.phone_e164) {
        stats.already++;
        continue;
      }

      if (!row.phone || String(row.phone).trim() === '') {
        stats.failed++;
        failures.push({ ...row, why: 'aucun numéro renseigné' });
        continue;
      }

      const result = normalizePhone(row.phone, row.country);

      if (!result) {
        stats.failed++;
        failures.push({
          ...row,
          why: row.country
            ? `numéro invalide pour « ${row.country} »`
            : 'numéro local sans pays — indevinable',
        });
        continue;
      }

      stats.normalized++;
      updates.push({ user_id: row.user_id, e164: result.e164, country: result.country });
    }

    if (data.length < PAGE_SIZE) break;
  }

  if (APPLY && updates.length > 0) {
    let written = 0;
    for (const u of updates) {
      const { error } = await supabase
        .from('clients')
        .update({ phone_e164: u.e164, phone_country: u.country })
        .eq('user_id', u.user_id);

      if (error) {
        console.error(`  ✗ ${u.user_id} : ${error.message}`);
        stats.unchanged++;
      } else {
        written++;
      }
    }
    console.log(`✓ ${written} numéro(s) écrit(s) en base.\n`);
  }

  console.log('─'.repeat(62));
  console.log(`Clients analysés          ${String(stats.scanned).padStart(6)}`);
  console.log(`Déjà en E.164             ${String(stats.already).padStart(6)}`);
  console.log(`Normalisables             ${String(stats.normalized).padStart(6)}`);
  console.log(`À revoir manuellement     ${String(stats.failed).padStart(6)}`);
  if (stats.unchanged) {
    console.log(`Échecs d'écriture         ${String(stats.unchanged).padStart(6)}`);
  }
  console.log('─'.repeat(62));

  const reachable = stats.already + stats.normalized;
  const pct = stats.scanned ? Math.round((reachable / stats.scanned) * 100) : 0;
  console.log(`\nJoignables par SMS : ${reachable}/${stats.scanned} (${pct} %)\n`);

  if (failures.length > 0) {
    console.log(`À revoir — ${failures.length} client(s) :\n`);
    for (const f of failures.slice(0, 50)) {
      const name = `${f.first_name ?? ''} ${f.last_name ?? ''}`.trim() || '(sans nom)';
      console.log(
        `  ${name.padEnd(28).slice(0, 28)} ${String(f.phone ?? '—').padEnd(20).slice(0, 20)} ${f.why}`,
      );
    }
    if (failures.length > 50) {
      console.log(`  … et ${failures.length - 50} autre(s).`);
    }
    console.log(
      '\nCes clients ne recevront aucun SMS tant que leur numéro n’est pas corrigé.',
    );
  }

  if (!APPLY && stats.normalized > 0) {
    console.log(`\nRelancez avec --apply pour écrire les ${stats.normalized} numéro(s) normalisé(s).`);
  }
}

main().catch((e) => {
  console.error('✗ Échec :', e);
  process.exit(1);
});
