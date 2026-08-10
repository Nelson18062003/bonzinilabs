#!/usr/bin/env node
/**
 * bundle-send-sms.mjs — assemble send-sms en un fichier autonome.
 *
 * POURQUOI : la fonction send-sms importe ../_shared/gsm7.ts et
 * ../_shared/sms-templates.ts. L'éditeur de fonctions du dashboard Supabase
 * ne gère qu'un fichier : sans CLI, la fonction est indéployable telle quelle.
 *
 * Ce script recolle les trois fichiers en un seul module Deno valide, à coller
 * dans le dashboard.
 *
 * ⚠️ LE FICHIER PRODUIT NE DOIT JAMAIS ÊTRE ÉDITÉ À LA MAIN. C'est tout
 * l'intérêt de le générer : les gabarits restent définis à UN SEUL endroit
 * (_shared/sms-templates.ts), couvert par les tests. Une copie modifiée
 * séparément divergerait en silence — et un gabarit corrigé d'un côté mais
 * pas de l'autre, sur des messages qui annoncent des soldes, est exactement
 * le genre de bug qu'on ne voit jamais venir.
 *
 * Un test (src/tests/lib/sendSmsBundle.test.ts) échoue si le fichier généré
 * n'est plus à jour vis-à-vis des sources.
 *
 * Usage :
 *   node scripts/bundle-send-sms.mjs          # écrit le fichier
 *   node scripts/bundle-send-sms.mjs --check  # vérifie seulement (code 1 si périmé)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SOURCES = {
  gsm7: 'supabase/functions/_shared/gsm7.ts',
  templates: 'supabase/functions/_shared/sms-templates.ts',
  entry: 'supabase/functions/send-sms/index.ts',
};

export const OUTPUT = 'scripts/generated/send-sms.dashboard.ts';

/** Toute déclaration d'import, y compris multi-lignes. */
const IMPORT_RE = /^import\s+[\s\S]*?from\s+["']([^"']+)["'];?\s*$/gm;

/**
 * Sépare les imports externes (https://…, conservés) des imports relatifs
 * (./…, ../… — supprimés puisque leur contenu est inliné).
 */
function splitImports(source) {
  const external = [];
  const body = source.replace(IMPORT_RE, (statement, specifier) => {
    if (specifier.startsWith('.')) return '';
    external.push(statement.trim());
    return '';
  });
  return { external, body };
}

export function buildBundle() {
  const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

  const gsm7 = splitImports(read(SOURCES.gsm7));
  const templates = splitImports(read(SOURCES.templates));
  const entry = splitImports(read(SOURCES.entry));

  // Dédoublonnage en conservant l'ordre de première apparition.
  const imports = [...new Set([...gsm7.external, ...templates.external, ...entry.external])];

  const section = (title, content) =>
    `// ${'═'.repeat(72)}\n// ${title}\n// ${'═'.repeat(72)}\n${content.trim()}\n`;

  return [
    '// ============================================================',
    '// FICHIER GÉNÉRÉ — NE PAS MODIFIER À LA MAIN.',
    '//',
    "// Produit par `npm run bundle:send-sms` à partir de :",
    `//   · ${SOURCES.gsm7}`,
    `//   · ${SOURCES.templates}`,
    `//   · ${SOURCES.entry}`,
    '//',
    "// Destiné à l'éditeur de fonctions du dashboard Supabase, qui ne gère",
    "// qu'un seul fichier. Toute correction se fait dans les sources ci-dessus,",
    '// puis on régénère : sinon les deux versions divergent en silence.',
    '// ============================================================',
    '',
    imports.join('\n'),
    '',
    section('gsm7.ts — encodage GSM 03.38', gsm7.body),
    '',
    section('sms-templates.ts — les 17 gabarits × FR/EN', templates.body),
    '',
    section('send-sms/index.ts — le drainer', entry.body),
    '',
  ].join('\n');
}

/** Contenu actuellement sur disque — '' si le fichier n'existe pas encore. */
export function readBundleOnDisk() {
  const outPath = join(ROOT, OUTPUT);
  return existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
}

// Exécution directe uniquement : importé depuis un test, ce module ne doit
// rien écrire ni terminer le processus.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const bundle = buildBundle();
  const outPath = join(ROOT, OUTPUT);

  if (process.argv.includes('--check')) {
    if (readBundleOnDisk() !== bundle) {
      console.error(`✗ ${OUTPUT} est périmé. Lancez : npm run bundle:send-sms`);
      process.exit(1);
    }
    console.log(`✓ ${OUTPUT} est à jour.`);
  } else {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, bundle);
    console.log(`✓ ${OUTPUT} écrit (${bundle.split('\n').length} lignes).`);
  }
}
