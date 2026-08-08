/**
 * The dimensional contract, enforced statically.
 *
 * `tests/e2e/desktop-metrology.spec.ts` measures what the browser paints and is
 * the real proof — but it needs a dev server and a Chromium, so it runs late
 * and rarely. This test reads the source instead: it costs milliseconds, runs
 * in `npm run test`, and catches the class of drift that produced the defect
 * this whole pass exists to fix (seventeen font sizes, six control heights, a
 * third of all spacing off the grid) at the moment someone types it.
 *
 * It is deliberately a *source* check, not a render check. A class that never
 * reaches the screen still fails here, which is the right trade: the contract
 * is about what the codebase is allowed to express, not only about what
 * happens to be visible on the five routes the e2e spec visits.
 *
 * See `src/desktop/ui/tokens.ts` for why each ladder has the rungs it has.
 */
import { describe, expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src/desktop');

/** Every source file the contract governs. */
function sources(): string[] {
  return globSync('**/*.{ts,tsx}', { cwd: ROOT }).map((p) => join(ROOT, p));
}

interface Rule {
  /** What the operator would see if this slipped through. */
  why: string;
  pattern: RegExp;
  /** Files that are allowed to fail this rule, and why. */
  allow?: (file: string) => boolean;
}

/** `tokens.ts` defines the ladders, so it is the one file that may name them. */
const isTokens = (f: string) => f.endsWith('ui/tokens.ts');

const RULES: Record<string, Rule> = {
  'font sizes off the five-step scale (12/13/15/20/28)': {
    why: 'Seventeen distinct sizes is what made the first pass look assembled rather than designed.',
    // Any arbitrary text size that is not one of the five, including the
    // half-pixel sizes (10.5, 11.5, 12.5, 13.5) the console used to carry.
    pattern: /text-\[(?!(?:12|13|15|20|28)px\])[0-9.]+px\]/g,
    allow: isTokens,
  },
  'Tailwind default text sizes': {
    why: 'text-xs/sm/base/lg land on 12/14/16/18 — 14, 16 and 18 are not on this scale.',
    pattern: /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)\b/g,
  },
  'spacing off the 4px grid': {
    why: 'The half-step utilities resolve to 2, 6, 10 and 14px. A third of the console sat off-grid.',
    pattern: /\b(?:gap|gap-x|gap-y|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|space-x|space-y)-[0-9]+\.5\b/g,
  },
  'arbitrary radii': {
    why: 'rounded-3xl and rounded-[24px] were the same value spelled two ways, both off the scale.',
    pattern: /rounded-(?:\[[^\]]+\]|2xl|3xl)/g,
  },
  'ratio line-heights': {
    why: 'leading-tight/snug/relaxed resolve differently per font size — five px results from three classes.',
    pattern: /\bleading-(?:tight|snug|relaxed|loose|none)\b/g,
  },
  'shadcn colour variables': {
    why: 'text-muted-foreground is outside the audited DFG ramp and is not guaranteed to clear AA at 12px.',
    pattern: /\b(?:text|bg|border)-muted(?:-foreground)?\b/g,
  },
  'raw Tailwind palette colours': {
    why: 'Status colour must come from the shared tones so mobile and desktop agree on what "validé" means.',
    pattern: /\b(?:text|bg|border|ring)-(?:red|green|blue|emerald|amber|orange|yellow|purple|violet|indigo|rose|teal|cyan|lime|sky|fuchsia|pink)-[0-9]{2,3}\b/g,
  },
  'the mobile treasury control kit': {
    why: 'Pill is 36px and Segmented ~39px — a second control vocabulary that never lines up with 24/28/32.',
    pattern: /from ['"]@?\/?.*components\/treasury\/(?:ui|Segmented)['"]/g,
  },
};

describe('contrat dimensionnel (src/desktop)', () => {
  const files = sources();

  it('scanne bien tout le répertoire', () => {
    // Guards against a glob change silently turning every assertion into a
    // vacuous pass — the failure mode that makes a green suite worthless.
    expect(files.length).toBeGreaterThan(30);
  });

  for (const [name, rule] of Object.entries(RULES)) {
    it(name, () => {
      const offenders: string[] = [];
      for (const file of files) {
        if (rule.allow?.(file)) continue;
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(rule.pattern)) {
          const line = src.slice(0, m.index).split('\n').length;
          offenders.push(`${file.replace(process.cwd() + '/', '')}:${line}  ${m[0]}`);
        }
      }
      expect(offenders, `${rule.why}\n\n${offenders.join('\n')}`).toEqual([]);
    });
  }
});
