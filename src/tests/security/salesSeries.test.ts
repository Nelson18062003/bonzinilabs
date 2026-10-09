// ============================================================
// Test de non-régression SÉCURITÉ — l'évolution des ventes
// (08/10/2026, 20261008100000_sales_series.sql).
//
//   · PORTÉE : le commercial ne reçoit QUE sa fiche (current_commercial_
//     source_id ; p_source_id ignoré) ; la direction passe par
//     admin_has_permission(…, 'canManageSales') ; tout autre appelant est
//     refusé avec le message de _sales_scope_error ; jamais is_admin ;
//   · lecture seule : aucune écriture, aucune politique, aucun droit sur une
//     table ; EXECUTE retiré à PUBLIC et anon, rendu à authenticated ;
//   · périodes à l'heure de Douala, garde-fous (24 mois, 26 semaines) ;
//   · mêmes définitions que le tableau du mois (_commercial_metrics) ;
//   · le contrat du front (SalesPoint, SalesFunnel, SalesSeriesSource,
//     SalesSeries dans useSales.ts) suit les clés produites par le SQL ;
//   · une seule signature (aucune surcharge PostgREST), étiquette @mola,
//     types.ts, fichier consolidé (copie conforme) et registre à jour.
// Le comportement lui-même est éprouvé sur Postgres 16 (87 contrôles, banc
// /var/lib/postgresql/w/pg8).
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIR = join(ROOT, 'supabase/migrations');
const FILE = '20261008100000_sales_series.sql';
const sql = readFileSync(join(DIR, FILE), 'utf8');
const fn = /CREATE OR REPLACE FUNCTION public\.sales_series\([\s\S]*?\n\$\$;/.exec(sql)?.[0] ?? '';
const hooks = readFileSync(join(ROOT, 'src/hooks/useSales.ts'), 'utf8');

/** Les clés d'une interface TypeScript du contrat (« nom: type; » ou « nom?: type; »). */
function interfaceKeys(name: string): string[] {
  const block = new RegExp(`export interface ${name}[^{]*\\{([\\s\\S]*?)\\n\\}`).exec(hooks)?.[1] ?? '';
  return [...block.matchAll(/^\s+([a-z_]+)\??:/gm)].map((m) => m[1]);
}

describe('SÉCURITÉ — sales_series : qui voit quoi', () => {
  it('une seule définition, SECURITY DEFINER, STABLE, search_path fixé', () => {
    expect(fn).not.toBe('');
    expect(sql.match(/CREATE OR REPLACE FUNCTION public\.sales_series\(/g)).toHaveLength(1);
    expect(fn).toMatch(
      /public\.sales_series\(\s*p_from DATE,\s*p_to DATE,\s*p_grain TEXT DEFAULT 'month',\s*p_source_id UUID DEFAULT NULL\s*\)/,
    );
    expect(fn).toMatch(/RETURNS JSONB\s+LANGUAGE plpgsql\s+STABLE\s+SECURITY DEFINER\s+SET search_path = public/);
  });

  it('la direction par admin_has_permission(canManageSales), le commercial par sa fiche, jamais is_admin', () => {
    expect(fn).toMatch(/v_manager BOOLEAN := public\.admin_has_permission\(auth\.uid\(\), 'canManageSales'\)/);
    expect(fn).toMatch(/v_own\s+UUID := public\.current_commercial_source_id\(\)/);
    expect(fn).not.toMatch(/is_admin\(/);
    // Aucune lecture du rôle « à la main ».
    expect(fn).not.toMatch(/FROM public\.user_roles/);
  });

  it('le commercial reçoit SA fiche, quoi qu’il demande ; les autres sont refusés comme ailleurs', () => {
    expect(fn).toMatch(/ELSIF v_own IS NOT NULL THEN\s+v_ids := ARRAY\[v_own\];\s+ELSE\s+RETURN public\._sales_scope_error\(\);/);
    // p_source_id n'est lu que dans la branche de la direction.
    const own = fn.indexOf('ELSIF v_own IS NOT NULL');
    const lastUse = fn.lastIndexOf('p_source_id');
    expect(own).toBeGreaterThan(-1);
    expect(lastUse).toBeLessThan(own);
  });

  it('la direction : fiches « commercial » seulement ; une fiche demandée doit en être une', () => {
    expect(fn).toMatch(/WHERE s\.kind = 'commercial';/);
    expect(fn).toMatch(/WHERE id = p_source_id AND kind = 'commercial'/);
    expect(fn).toMatch(/'Commercial introuvable'/);
    // Sans fiche choisie : les actives, plus les archivées actives dans la plage.
    expect(fn).toMatch(/WHERE NOT v_all OR src\.is_active\s+OR src\.id IN \(SELECT ev\.source_id FROM ev WHERE ev\.at >= v_from_at\)/);
  });

  it('la portée est vérifiée AVANT les paramètres (un autre rôle n’apprend rien)', () => {
    expect(fn.indexOf('_sales_scope_error()')).toBeLessThan(fn.indexOf("'Découpage inconnu"));
    expect(fn.indexOf('_sales_scope_error()')).toBeLessThan(fn.indexOf("'Plage trop longue"));
  });

  it('lecture seule : aucune écriture, aucune politique, aucun droit sur une table', () => {
    expect(fn).not.toMatch(/\b(INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE)\b/i);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).not.toMatch(/GRANT[^;]*ON (TABLE )?public\.\w+ TO/i);
    expect(sql).not.toMatch(/FUNCTION public\.(is_admin|admin_has_permission|current_commercial_source_id|_sales_scope_error)\(/);
  });

  it('EXECUTE retiré à PUBLIC et anon, rendu à authenticated et service_role', () => {
    const revoke = sql.indexOf('REVOKE ALL ON FUNCTION public.sales_series(DATE, DATE, TEXT, UUID) FROM PUBLIC, anon;');
    const grant = sql.indexOf('GRANT EXECUTE ON FUNCTION public.sales_series(DATE, DATE, TEXT, UUID) TO authenticated, service_role;');
    expect(revoke).toBeGreaterThan(-1);
    expect(grant).toBeGreaterThan(revoke);
    expect(sql).not.toMatch(/GRANT[^;]*sales_series[^;]*\banon\b/i);
  });

  it('aucune migration (celle-ci ou une suivante) ne rouvre sales_series à anon', () => {
    for (const f of readdirSync(DIR).filter((x) => x.endsWith('.sql') && x >= FILE)) {
      const content = readFileSync(join(DIR, f), 'utf8');
      expect(content, f).not.toMatch(/GRANT[^;]*public\.sales_series[^;]*\b(anon|PUBLIC)\b/i);
      expect(content, f).not.toMatch(/GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO[^;]*\banon\b/i);
    }
  });

  it('étiquette @mola : exposée en lecture, canManageSales', () => {
    const m = /COMMENT ON FUNCTION public\.sales_series\(date, date, text, uuid\) IS\s*'@mola:((?:[^']|'')*)';/.exec(sql);
    expect(m).not.toBeNull();
    const mola = JSON.parse(m![1].replace(/''/g, "'"));
    expect(mola).toEqual({
      expose: true,
      kind: 'read',
      permission: 'canManageSales',
      label:
        'Évolution des ventes par commercial, mois par mois ou semaine par semaine (clients, prospects, paiements, dépôts, fret avion, vols, bateau)',
    });
  });
});

describe('sales_series : périodes de Douala et garde-fous', () => {
  it('chaque événement est rangé à l’heure de Douala ; bornes de Douala', () => {
    expect(fn).toMatch(/date_trunc\(v_grain, ev\.at AT TIME ZONE 'Africa\/Douala'\)::date AS period/);
    for (const v of ['v_from_at', 'v_to_at', 'v_prev_at']) {
      expect(fn).toMatch(new RegExp(`${v}\\s*:= v_\\w+::timestamp AT TIME ZONE 'Africa/Douala';`));
    }
    expect(fn).not.toMatch(/AT TIME ZONE 'UTC'/);
    // p_from / p_to ramenés aux débuts de période sans dépendre du fuseau de la session.
    expect(fn).toMatch(/v_from := date_trunc\(v_grain, p_from::timestamp\)::date;/);
    expect(fn).toMatch(/IF v_to < p_to THEN\s+v_to := \(v_to \+ v_step\)::date;/);
  });

  it('mois ou semaine (du lundi), début < fin, 24 mois ou 26 semaines au plus', () => {
    expect(fn).toMatch(/IF v_grain NOT IN \('month', 'week'\) THEN/);
    expect(fn).toMatch(/IF p_from >= p_to THEN/);
    expect(fn).toMatch(/IF p_from < DATE '2000-01-01' OR p_to > DATE '2100-01-01' THEN/);
    // Les bornes extrêmes sont refusées AVANT le premier calcul de date (pas de débordement).
    expect(fn.indexOf("DATE '2100-01-01'")).toBeLessThan(fn.indexOf('date_trunc('));
    expect(fn).toMatch(/v_max\s+:= CASE v_grain WHEN 'month' THEN 24 ELSE 26 END;/);
    expect(fn).toMatch(/'Plage trop longue : 24 mois au plus'/);
    expect(fn).toMatch(/'Plage trop longue : 26 semaines au plus'/);
    // Le nombre de périodes est vérifié AVANT de les générer.
    expect(fn.indexOf('IF v_n > v_max')).toBeLessThan(fn.indexOf('generate_series'));
  });

  it('séries sans trou : une ligne vide par fiche et par période', () => {
    expect(fn).toMatch(/SELECT k\.id, NULL, 'tick', NULL, NULL, wper\.period/);
    expect(fn).toMatch(/GROUP BY GROUPING SETS \(\(x\.source_id, x\.period, x\.cur\), \(x\.source_id, x\.cur\), \(x\.period, x\.cur\), \(x\.cur\)\)/);
  });

  it('aucune boucle par période (requêtes ensemblistes)', () => {
    expect(fn).not.toMatch(/\bLOOP\b/);
  });
});

describe('sales_series : les mêmes définitions que le tableau du mois', () => {
  it('paiements TERMINÉS datés comme _commercial_metrics', () => {
    expect(fn).toMatch(/WHERE p\.status = 'completed'/);
    expect(fn).toMatch(/coalesce\(p\.processed_at, p\.cash_paid_at, p\.updated_at\) >= v_prev_at/);
  });

  it('dépôts VALIDÉS, montant confirmé sinon déclaré', () => {
    expect(fn).toMatch(/d\.status = 'validated' AND d\.validated_at >= v_prev_at/);
    expect(fn).toMatch(/coalesce\(d\.confirmed_amount_xaf, d\.amount_xaf\)/);
  });

  it('colis : avion = bureau (kg), bateau = entrepôt (m³), dépôts annulés exclus', () => {
    expect(fn).toMatch(/CASE pd\.location WHEN 'office' THEN 'air' ELSE 'sea' END/);
    expect(fn).toMatch(/CASE pd\.location WHEN 'office' THEN pa\.weight_kg ELSE pa\.cbm END/);
    expect(fn).toMatch(/pd\.status <> 'cancelled' AND pd\.location IN \('office', 'warehouse'\)/);
  });

  it('vols distincts, datés par le départ réel (à défaut la création)', () => {
    expect(fn).toMatch(/JOIN public\.air_shipments a ON a\.id = pa\.air_shipment_id/);
    expect(fn).toMatch(/SELECT DISTINCT cl\.source_id, NULL::uuid, coalesce\(a\.departed_at, a\.created_at\), 'flight'/);
    expect(fn).toMatch(/count\(DISTINCT x\.flight_id\) FILTER \(WHERE x\.kind = 'flight'\)/);
  });

  it('prospects : ajoutés, gagnés (converted_at), perdus (status_changed_at) ; entonnoir par statut actuel', () => {
    expect(fn).toMatch(/'p_new'/);
    expect(fn).toMatch(/p\.status = 'won'\s+AND p\.converted_at >= v_prev_at/);
    expect(fn).toMatch(/p\.status = 'lost'\s+AND p\.status_changed_at >= v_prev_at/);
    for (const s of ['new', 'contacted', 'interested', 'to_verify', 'won', 'lost']) {
      expect(fn).toMatch(new RegExp(`FILTER \\(WHERE p\\.status = '${s}'\\)`));
    }
  });

  it('clients actifs comptés DISTINCTEMENT (paiement, dépôt ou colis)', () => {
    expect(fn).toMatch(/count\(DISTINCT x\.user_id\) FILTER \(WHERE x\.kind IN \('pay', 'dep', 'air', 'sea'\)\)/);
  });
});

describe('sales_series : le contrat du front suit le SQL', () => {
  it('chaque chiffre de SalesPoint est produit par le SQL', () => {
    const keys = interfaceKeys('SalesPoint');
    expect(keys).toHaveLength(16);
    const aliases = new Set([...fn.matchAll(/\bAS "?([a-z_]+)"?/g)].map((m) => m[1]));
    for (const k of keys) expect(aliases, k).toContain(k);
  });

  it('SalesFunnel, SalesSeriesSource, SalesSeries : mêmes clés que le SQL', () => {
    const aliases = new Set([...fn.matchAll(/\bAS "?([a-z_]+)"?/g)].map((m) => m[1]));
    for (const k of interfaceKeys('SalesFunnel')) expect(aliases, k).toContain(k);
    const built = new Set([...fn.matchAll(/'([a-z_]+)',/g)].map((m) => m[1]));
    for (const k of interfaceKeys('SalesSeriesSource')) expect(built, k).toContain(k);
    for (const k of interfaceKeys('SalesSeries')) expect(built, k).toContain(k);
  });

  it('le hook appelle sales_series avec les quatre paramètres', () => {
    expect(hooks).toMatch(/rpcJson<SalesSeries>\('sales_series', \{\s*p_from: p\.from,\s*p_to: p\.to,\s*p_grain: p\.grain,\s*p_source_id: p\.sourceId \?\? null,\s*\}\)/);
  });

  it('types.ts connaît sales_series (p_from, p_to obligatoires ; p_grain, p_source_id facultatifs)', () => {
    const types = readFileSync(join(ROOT, 'src/integrations/supabase/types.ts'), 'utf8');
    const block = /\n {6}sales_series: \{\n {8}Args: \{([\s\S]*?)\}\n {8}Returns: Json\n {6}\}/.exec(types)?.[1] ?? '';
    expect(block).toMatch(/p_from: string/);
    expect(block).toMatch(/p_to: string/);
    expect(block).toMatch(/p_grain\?: string/);
    expect(block).toMatch(/p_source_id\?: string/);
  });
});

describe('Fichier consolidé et registre', () => {
  const consolidated = readFileSync(join(ROOT, 'migrations/20261006_consolidated.sql'), 'utf8');

  it('la partie D est une copie conforme, après la partie C', () => {
    const c = consolidated.indexOf(readFileSync(join(DIR, '20261007100000_prospect_client_control.sql'), 'utf8'));
    const d = consolidated.indexOf(sql);
    expect(c, '20261007100000 absente ou modifiée').toBeGreaterThan(-1);
    expect(d, '20261008100000 absente ou modifiée').toBeGreaterThan(c);
    expect(consolidated).toContain('-- SECTION 4 — Partie D : copie conforme de 20261008100000_sales_series.sql');
  });

  it('les prérequis de la partie D sont vérifiés en tête (expéditions aériennes, colis)', () => {
    const pre = consolidated.indexOf('SECTION 0 — Prérequis');
    expect(pre).toBeGreaterThan(-1);
    expect(pre).toBeLessThan(consolidated.indexOf(sql));
    for (const needle of ["('air_shipments',", "('parcels',", "('parcel_deposits',", "'air_shipment_id',", "'departed_at',"]) {
      expect(consolidated.slice(pre, consolidated.indexOf('SECTION 1 —')), needle).toContain(needle);
    }
  });

  it('la commande de réparation nomme 20261008100000', () => {
    const repair = 'npx supabase migration repair --status applied 20261006100000 20261006120000 20261007100000 20261008100000';
    expect(consolidated).toContain(repair);
    expect(readFileSync(join(ROOT, 'docs/MIGRATIONS-A-APPLIQUER.md'), 'utf8')).toContain(repair);
  });
});
