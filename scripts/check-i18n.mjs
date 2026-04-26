#!/usr/bin/env node
/**
 * check-i18n.mjs — i18n key drift auditor
 *
 * Walks every .ts / .tsx file under src/, extracts all i18n calls
 *   t('foo.bar')          / t("foo.bar")
 *   t(`foo.bar`)
 *   i18n.t('ns:foo.bar')
 *   t('foo.bar', { ns: 'payments' })
 * resolves the namespace from the closest `useTranslation('ns')` /
 * `i18n.t('ns:key')` / `t('key', { ns })` hint, then cross-checks the
 * key against every locale file in src/i18n/locales/<lang>/<ns>.json.
 *
 * Exit codes:
 *   0 — every static key resolves in every language.
 *   1 — at least one language is missing keys.  A report is printed to
 *       stdout and a JSON dump is written to docs/i18n-audit.json.
 *
 * Dynamic keys (template strings with ${...}) are listed under
 * "dynamic" — they cannot be statically verified, but the report lets
 * us audit them by hand.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// ──────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────
const ROOT       = resolve(new URL('..', import.meta.url).pathname);
const SRC_DIR    = join(ROOT, 'src');
const LOCALE_DIR = join(ROOT, 'src/i18n/locales');
const REPORT_DIR = join(ROOT, 'docs');
const REPORT_FILE = join(REPORT_DIR, 'i18n-audit.json');

const LANGUAGES = ['fr', 'en', 'zh'];
const NAMESPACES = [
  'common', 'landing', 'auth', 'formatters',
  'agent', 'client', 'payments', 'deposits',
];
const DEFAULT_NS = 'common';

// Files / dirs we never scan
const EXCLUDED_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', '.next', '.turbo',
  'i18n', // locale JSON live here, not source code
]);

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (/\.(tsx?|jsx?)$/.test(name)) yield full;
  }
}

function loadLocales() {
  const tree = {};
  for (const lang of LANGUAGES) {
    tree[lang] = {};
    for (const ns of NAMESPACES) {
      const file = join(LOCALE_DIR, lang, `${ns}.json`);
      if (!existsSync(file)) continue;
      try {
        tree[lang][ns] = JSON.parse(readFileSync(file, 'utf8'));
      } catch (e) {
        console.error(`Failed to parse ${file}: ${e.message}`);
        process.exit(2);
      }
    }
  }
  return tree;
}

/** Has a nested key like "form.beneficiary.title" inside an object? */
function hasKey(obj, dotted) {
  if (!obj) return false;
  let cur = obj;
  for (const part of dotted.split('.')) {
    if (cur == null || typeof cur !== 'object' || !(part in cur)) return false;
    cur = cur[part];
  }
  // Accept any non-undefined leaf — empty strings are valid translations.
  return cur !== undefined;
}

// ──────────────────────────────────────────────────────────────────
// Extraction
// ──────────────────────────────────────────────────────────────────

// Match `useTranslation('ns')` or `useTranslation("ns")` (single arg).
const NS_HOOK_RE = /useTranslation\(\s*['"]([^'"]+)['"]\s*\)/g;
// Match `useTranslation(['ns1', 'ns2', …])` — first entry wins.
const NS_HOOK_ARRAY_RE = /useTranslation\(\s*\[\s*['"]([^'"]+)['"]/g;

/** All `t(…)` and `i18n.t(…)` call sites with the literal first arg. */
const T_CALL_RE = /(?<![A-Za-z0-9_$])(?:i18n\.)?t\(\s*(['"`])((?:\\.|(?!\1).)+?)\1/g;

/** `t('key', { ns: 'foo' })` — pull explicit ns from options object. */
const T_NS_OPT_RE = /(?<![A-Za-z0-9_$])(?:i18n\.)?t\(\s*['"`](?:\\.|[^'"`])+?['"`]\s*,\s*\{[^}]*ns\s*:\s*['"]([^'"]+)['"]/g;

function fileNamespace(src) {
  // Resolution order:
  //   1. useTranslation('ns')   → that ns
  //   2. useTranslation(['ns']) → first
  //   3. fallback to DEFAULT_NS ('common')
  const m1 = src.match(/useTranslation\(\s*['"]([^'"]+)['"]\s*\)/);
  if (m1) return m1[1];
  const m2 = src.match(/useTranslation\(\s*\[\s*['"]([^'"]+)['"]/);
  if (m2) return m2[1];
  return DEFAULT_NS;
}

/** Extract every t(...) literal from a source file. */
function extractCalls(src, file) {
  const calls = [];
  // We iterate line-by-line so that we can attach line numbers.
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip simple comment lines (still imperfect — JS-only single-pass).
    if (/^\s*\/\//.test(line)) continue;
    let m;
    const re = new RegExp(T_CALL_RE.source, 'g');
    while ((m = re.exec(line)) !== null) {
      const raw = m[2];
      // Skip when the pattern is just a variable (no dot) — usually noise.
      if (raw.length === 0) continue;
      calls.push({
        raw,
        line: i + 1,
        file,
        // template-literal interpolation marker
        dynamic: /\$\{/.test(raw),
      });
    }
    // Also catch explicit { ns: 'xxx' } overrides
    const re2 = new RegExp(T_NS_OPT_RE.source, 'g');
    while ((m = re2.exec(line)) !== null) {
      const ns = m[1];
      const last = calls[calls.length - 1];
      if (last && last.line === i + 1) last.explicitNs = ns;
    }
  }
  return calls;
}

/** Resolve the namespace for a given t() call. */
function resolveNs(call, fileNs) {
  if (call.explicitNs) return { ns: call.explicitNs, key: call.raw };
  // `t('ns:key.path')` — explicit namespace prefix; only honour it when the
  // prefix is a known namespace, so keys with stray colons (rare) don't get
  // mis-routed.
  const idx = call.raw.indexOf(':');
  if (idx > 0) {
    const candidate = call.raw.slice(0, idx);
    if (NAMESPACES.includes(candidate)) {
      return { ns: candidate, key: call.raw.slice(idx + 1) };
    }
  }
  return { ns: fileNs, key: call.raw };
}

// ──────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────
function main() {
  const locales = loadLocales();
  const allCalls = [];
  let totalFiles = 0;

  for (const file of walk(SRC_DIR)) {
    const src = readFileSync(file, 'utf8');
    if (!/\bt\s*\(/.test(src) && !/\bi18n\.t\s*\(/.test(src)) continue;
    totalFiles++;
    const fileNs = fileNamespace(src);
    for (const call of extractCalls(src, file)) {
      const { ns, key } = resolveNs(call, fileNs);
      allCalls.push({
        file: relative(ROOT, file),
        line: call.line,
        raw: call.raw,
        ns,
        key,
        dynamic: call.dynamic,
      });
    }
  }

  // De-duplicate static keys per (ns, key) — keep one example occurrence.
  const staticByKey = new Map();
  const dynamic = [];
  for (const c of allCalls) {
    if (c.dynamic) {
      dynamic.push(c);
      continue;
    }
    const id = `${c.ns}::${c.key}`;
    if (!staticByKey.has(id)) staticByKey.set(id, c);
  }

  // Cross-check.
  const missing = {};
  for (const lang of LANGUAGES) missing[lang] = [];
  for (const c of staticByKey.values()) {
    for (const lang of LANGUAGES) {
      const dict = locales[lang]?.[c.ns];
      if (!dict || !hasKey(dict, c.key)) {
        missing[lang].push(c);
      }
    }
  }

  // Report
  const totalStatic = staticByKey.size;
  const summary = {
    files_scanned: totalFiles,
    static_keys: totalStatic,
    dynamic_calls: dynamic.length,
    languages: LANGUAGES.map((l) => ({
      lang: l,
      missing: missing[l].length,
      coverage_pct: totalStatic === 0 ? 100 : +((100 * (totalStatic - missing[l].length)) / totalStatic).toFixed(2),
    })),
  };

  const fail = LANGUAGES.some((l) => missing[l].length > 0);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  i18n key audit');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Files scanned : ${totalFiles}`);
  console.log(`  Static keys   : ${totalStatic}`);
  console.log(`  Dynamic calls : ${dynamic.length}  (template strings with \${…})`);
  console.log('');
  for (const row of summary.languages) {
    const flag = row.missing === 0 ? '✓' : '✗';
    console.log(`  ${flag} ${row.lang.toUpperCase()} — ${row.missing} missing  (${row.coverage_pct}% coverage)`);
  }
  console.log('');

  if (fail) {
    for (const lang of LANGUAGES) {
      const list = missing[lang];
      if (list.length === 0) continue;
      console.log(`── ${lang.toUpperCase()} missing (${list.length})`);
      // Group by namespace for readability.
      const byNs = new Map();
      for (const c of list) {
        if (!byNs.has(c.ns)) byNs.set(c.ns, []);
        byNs.get(c.ns).push(c);
      }
      for (const [ns, items] of [...byNs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        console.log(`   [${ns}]  ${items.length} keys`);
        for (const c of items.sort((a, b) => a.key.localeCompare(b.key))) {
          console.log(`     · ${c.key}   (${c.file}:${c.line})`);
        }
      }
      console.log('');
    }
  }

  // Persist machine-readable report.
  if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(
    REPORT_FILE,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        summary,
        missing,
        dynamic,
      },
      null,
      2,
    ),
  );
  console.log(`  Report written → ${relative(ROOT, REPORT_FILE)}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(fail ? 1 : 0);
}

main();
