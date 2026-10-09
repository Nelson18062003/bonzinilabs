/**
 * L'espace du commercial (« /v ») ne lit QUE ses clients et ses prospects
 * (demande du directeur, 07/10) — garanti côté écrans :
 *   · aucun écran de « /v » ne parle à Supabase lui-même : tout passe par
 *     les hooks de `@/hooks/useSales` ;
 *   · il n'en emploie que ceux du commercial (sa fiche, ses prospects, la
 *     vérification d'un numéro) — jamais ceux de la direction (fiches « À
 *     vérifier » avec le client reconnu, client → prospect, vue des ventes,
 *     objectifs, réattribution, recherche d'un prospect au bureau) ;
 *   · ces hooks-là n'appellent que des RPC limitées à SA fiche
 *     (`current_commercial_source_id()` côté serveur) et la table
 *     `prospects` (RLS) — jamais `clients`, `wallets`, `deposits`… ;
 *   · la vérification d'un numéro ne garde que le statut (et la fiche à
 *     lui, pour « mine ») : aucun nom de client n'arrive jusqu'à l'écran.
 * Le cloisonnement lui-même est au serveur (is_admin() exclut le rôle
 * commercial ; src/tests/security/*) : ce test empêche un écran de le
 * contourner en appelant une lecture de la direction.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');
const SALES_DIR = join(ROOT, 'components/sales');
const files = readdirSync(SALES_DIR)
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => ({ name: f, src: readFileSync(join(SALES_DIR, f), 'utf8') }));
const hooksSrc = readFileSync(join(ROOT, 'hooks/useSales.ts'), 'utf8');

/** Les hooks du commercial : sa fiche, ses prospects, ses clients, la vérification d'un numéro. */
const COMMERCIAL_HOOKS = [
  'useCommercialDashboard',
  'useCommercialClients',
  'useProspects',
  'useCreateProspect',
  'useUpdateProspect',
  'useSetProspectStatus',
  'useProspectPhoneCheck',
  'useProspectNumbersCheck',
];

/** Ce que ces hooks ont le droit de lire ou d'écrire : des RPC limitées à SA fiche, et `prospects` sous RLS. */
const COMMERCIAL_RPCS = ['commercial_dashboard', 'commercial_clients', 'prospect_create', 'prospect_update', 'prospect_set_status', 'prospect_phone_check'];
const COMMERCIAL_TABLES = ['prospects'];

/** Le corps d'une fonction exportée de useSales.ts. */
function hookBody(name: string): string {
  const m = new RegExp(`export function ${name}\\b[\\s\\S]*?\\n}\\n`).exec(hooksSrc);
  if (!m) throw new Error(`hook introuvable : ${name}`);
  return m[0];
}

describe('Espace commercial — il ne lit que ses clients et ses prospects', () => {
  it('aucun écran de « /v » ne parle à Supabase lui-même', () => {
    for (const f of files) {
      expect(f.src, f.name).not.toMatch(/@\/integrations\/supabase/);
      expect(f.src, f.name).not.toMatch(/\.from\(\s*['"]/);
      expect(f.src, f.name).not.toMatch(/\.rpc\(/);
    }
  });

  it('les seuls hooks de données employés sont ceux du commercial', () => {
    const used = new Set<string>();
    for (const f of files) {
      // Aucun autre module de hooks de données (clients, dépôts, paiements…).
      const hookImports = [...f.src.matchAll(/from '@\/hooks\/([\w/]+)'/g)].map((m) => m[1]);
      for (const h of hookImports) expect(['useSales', 'useDebouncedValue'], `${f.name} importe @/hooks/${h}`).toContain(h);
      for (const m of f.src.matchAll(/import \{([^}]*)\} from '@\/hooks\/useSales'/g)) {
        for (const part of m[1].split(',')) {
          const id = part.trim();
          if (id && !id.startsWith('type ')) used.add(id);
        }
      }
    }
    expect([...used].sort()).toEqual(expect.arrayContaining(['useProspectPhoneCheck', 'useProspects']));
    for (const h of used) expect(COMMERCIAL_HOOKS, `hook de la direction employé dans « /v » : ${h}`).toContain(h);
  });

  it('ces hooks n’appellent que des RPC limitées à SA fiche, et la table des prospects', () => {
    const seen = new Set<string>();
    for (const name of COMMERCIAL_HOOKS) {
      for (const m of hookBody(name).matchAll(/rpcJson<[\s\S]*?>\(\s*'(\w+)'|\.from\('(\w+)'\)/g)) seen.add(m[1] ?? m[2]);
    }
    // L'analyse voit bien chaque appel (sinon le test passerait à vide).
    expect([...seen].sort()).toEqual([...COMMERCIAL_RPCS, ...COMMERCIAL_TABLES].sort());
    for (const name of COMMERCIAL_HOOKS) {
      const body = hookBody(name);
      for (const m of body.matchAll(/rpcJson<[\s\S]*?>\(\s*'(\w+)'/g)) expect(COMMERCIAL_RPCS, `${name} → ${m[1]}`).toContain(m[1]);
      for (const m of body.matchAll(/\.from\('(\w+)'\)/g)) expect(COMMERCIAL_TABLES, `${name} → table ${m[1]}`).toContain(m[1]);
      // Aucun appel direct de PostgREST hors de rpcJson / .from (un « supabaseAdmin.rpc » glissé dans un hook).
      expect(body, name).not.toMatch(/supabaseAdmin\.rpc\(/);
    }
  });

  it('la vérification d’un numéro ne garde que son statut (et la fiche à lui) : aucun nom de client', () => {
    const check = hookBody('useProspectPhoneCheck');
    expect(check).toMatch(/rpcJson<\{ status: PhoneCheckStatus; prospect_id\?: string \}>/);
    const live = files.find((f) => f.name === 'usePhoneCheck.ts')?.src ?? '';
    expect(live).toMatch(/\{ e164, status, prospectId \}/);
    expect(live).not.toMatch(/\bname\b|customer_code|company/);
  });
});
