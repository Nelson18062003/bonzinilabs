// L'app réception parle trois langues, et chaque écran doit le faire en
// entier : toute clé `t('…')` utilisée par ses écrans existe en français, en
// anglais et en chinois, et les trois fichiers portent exactement les mêmes
// clés `rc_*` / `kind_*`. Une clé ajoutée dans une seule langue fait échouer
// ce test — c'est le but.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fr from '@/i18n/locales/fr/agent.json';
import en from '@/i18n/locales/en/agent.json';
import zh from '@/i18n/locales/zh/agent.json';

const ROOT = join(__dirname, '..', '..');
const DIRS = ['mobile/screens/reception', 'mobile/components/reception'];
const EXTRA = ['mobile/screens/agent-cash/AgentCashLogin.tsx'];

function sources(): string[] {
  const files = DIRS.flatMap((d) => readdirSync(join(ROOT, d)).filter((f) => /\.tsx?$/.test(f)).map((f) => join(ROOT, d, f)));
  return [...files, ...EXTRA.map((f) => join(ROOT, f))].map((f) => readFileSync(f, 'utf8'));
}

const usedKeys = () => new Set(sources().flatMap((src) => [...src.matchAll(/\bt\('([A-Za-z0-9_.]+)'\)/g)].map((m) => m[1])));
const receptionKeys = (d: Record<string, unknown>) => Object.keys(d).filter((k) => k.startsWith('rc_') || k.startsWith('kind_')).sort();

describe('app réception — trois langues complètes', () => {
  it("chaque clé utilisée par un écran existe en fr, en et zh", () => {
    const keys = [...usedKeys()];
    expect(keys.length).toBeGreaterThan(50);
    const missing = { fr: keys.filter((k) => !(k in fr)), en: keys.filter((k) => !(k in en)), zh: keys.filter((k) => !(k in zh)) };
    expect(missing).toEqual({ fr: [], en: [], zh: [] });
  });

  it('les trois fichiers ont exactement les mêmes clés rc_* et kind_*', () => {
    expect(receptionKeys(en)).toEqual(receptionKeys(fr));
    expect(receptionKeys(zh)).toEqual(receptionKeys(fr));
  });

  it('aucune valeur vide, et le chinois est vraiment du chinois', () => {
    for (const k of receptionKeys(fr)) {
      expect((fr as Record<string, string>)[k].trim(), k).not.toBe('');
      expect((en as Record<string, string>)[k].trim(), k).not.toBe('');
      const z = (zh as Record<string, string>)[k];
      expect(z.trim(), k).not.toBe('');
      expect(/[一-鿿]/.test(z), `${k} en chinois : ${z}`).toBe(true);
    }
  });

  it("aucun format fr-FR figé dans l'app réception", () => {
    for (const src of sources()) expect(src).not.toMatch(/'fr-FR'/);
  });
});
