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
const REPORT_MD = join(REPORT_DIR, 'I18N_AUDIT.md');

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

/** Right after a t(...) call we may see `, { ns: 'foo', ... }` — match that. */
const NS_OPT_AFTER_RE = /^\s*,\s*\{[^}]*?(?<![A-Za-z0-9_$])ns\s*:\s*['"]([^'"]+)['"]/;

function fileNamespace(src) {
  // Resolution order:
  //   1. useTranslation('ns')   → that ns
  //   2. useTranslation(['ns']) → first
  //   3. useLanguage()          → custom context that wraps useTranslation('agent')
  //                              (src/contexts/LanguageContext.tsx)
  //   4. fallback to DEFAULT_NS ('common')
  const m1 = src.match(/useTranslation\(\s*['"]([^'"]+)['"]\s*\)/);
  if (m1) return m1[1];
  const m2 = src.match(/useTranslation\(\s*\[\s*['"]([^'"]+)['"]/);
  if (m2) return m2[1];
  if (/from\s+['"]@\/contexts\/LanguageContext['"]/.test(src) && /useLanguage\(\)/.test(src)) {
    return 'agent';
  }
  return DEFAULT_NS;
}

/** Extract every t(...) literal from a source file. */
function extractCalls(src, file) {
  const calls = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\/\//.test(line)) continue;
    const re = new RegExp(T_CALL_RE.source, 'g');
    let m;
    while ((m = re.exec(line)) !== null) {
      const raw = m[2];
      if (raw.length === 0) continue;
      // Look at the slice of the line right after this match for an
      // explicit { ns: 'xxx' } option object — works correctly even when
      // multiple t() calls live on the same line.
      const after = line.slice(m.index + m[0].length);
      const nsMatch = after.match(NS_OPT_AFTER_RE);
      calls.push({
        raw,
        line: i + 1,
        file,
        dynamic: /\$\{/.test(raw),
        explicitNs: nsMatch ? nsMatch[1] : undefined,
      });
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

  // Persist human-readable Markdown report.
  writeFileSync(REPORT_MD, renderMarkdown(summary, missing, dynamic));

  console.log(`  JSON report → ${relative(ROOT, REPORT_FILE)}`);
  console.log(`  MD report   → ${relative(ROOT, REPORT_MD)}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(fail ? 1 : 0);
}

// ──────────────────────────────────────────────────────────────────
// Markdown rendering
// ──────────────────────────────────────────────────────────────────
function renderMarkdown(summary, missing, dynamic) {
  const lines = [];
  lines.push('# i18n audit');
  lines.push('');
  lines.push('> Auto-generated by `npm run check:i18n` — do not edit by hand.');
  lines.push('> Re-run after touching translations or any `t(...)` call.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Files scanned: **${summary.files_scanned}**`);
  lines.push(`- Static keys: **${summary.static_keys}**`);
  lines.push(`- Dynamic calls (template strings): **${summary.dynamic_calls}**`);
  lines.push('');
  lines.push('| Language | Missing | Coverage |');
  lines.push('|---|---:|---:|');
  for (const row of summary.languages) {
    const flag = row.missing === 0 ? '✓' : '✗';
    lines.push(`| ${flag} ${row.lang.toUpperCase()} | ${row.missing} | ${row.coverage_pct}% |`);
  }
  lines.push('');

  for (const lang of LANGUAGES) {
    const list = missing[lang] ?? [];
    if (list.length === 0) {
      lines.push(`## ${lang.toUpperCase()} — no missing keys ✓`);
      lines.push('');
      continue;
    }
    lines.push(`## ${lang.toUpperCase()} — ${list.length} missing keys`);
    lines.push('');
    const byNs = new Map();
    for (const c of list) {
      if (!byNs.has(c.ns)) byNs.set(c.ns, []);
      byNs.get(c.ns).push(c);
    }
    const namespaces = [...byNs.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [ns, items] of namespaces) {
      lines.push(`### \`${ns}\` (${items.length})`);
      lines.push('');
      lines.push('| Key | First call site |');
      lines.push('|---|---|');
      for (const c of items.sort((a, b) => a.key.localeCompare(b.key))) {
        lines.push(`| \`${c.key}\` | \`${c.file}:${c.line}\` |`);
      }
      lines.push('');
    }
  }

  if (dynamic.length > 0) {
    lines.push('## Dynamic calls (manual audit required)');
    lines.push('');
    lines.push('Template-string keys with `${…}` interpolation cannot be statically validated.');
    lines.push('Make sure every possible value covered by the interpolation has a corresponding entry.');
    lines.push('');
    lines.push('| Pattern | Namespace | Call site |');
    lines.push('|---|---|---|');
    for (const c of dynamic.sort((a, b) => a.raw.localeCompare(b.raw))) {
      lines.push(`| \`${c.raw}\` | \`${c.ns}\` | \`${c.file}:${c.line}\` |`);
    }
    lines.push('');
  }

  return lines.join('\n') + '\n';
}

main();
