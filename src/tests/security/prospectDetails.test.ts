// ============================================================
// Test de non-régression SÉCURITÉ — fiche prospect complète et identité
// des clients (06/10/2026, 20261006120000).
//
//   · admin_set_client_identity : canEditClients, ou canRegisterClients
//     SEULEMENT pour le client qu'on a soi-même enregistré ; ligne
//     verrouillée avant d'être lue ; journalisée ;
//   · prospect_phones (les autres numéros d'un prospect) ne s'écrit que par
//     les RPC : une seule politique, en lecture ;
//   · prospect_create / prospect_update : anciennes signatures supprimées
//     (sinon PostgREST aurait deux fonctions du même nom), périmètre du
//     commercial vérifié, numéros verrouillés puis TOUS vérifiés avant la
//     moindre écriture ;
//   · droits : aides internes fermées à l'API, actions ouvertes au seul
//     personnel connecté ; étiquette @mola sur chaque nouvelle signature.
// Le comportement lui-même est éprouvé sur Postgres 16 (80 contrôles).
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'supabase/migrations');
const FILE = '20261006120000_prospect_details_client_identity.sql';
const sql = readFileSync(join(DIR, FILE), 'utf8');
const body = (fn: string) => new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\([\\s\\S]*?\\$\\$;`).exec(sql)?.[0] ?? '';

const CREATE_SIG = 'text, text, text, text, text, text, timestamptz, text[], uuid, text, date, text, jsonb, text, text';
const UPDATE_SIG = 'uuid, text, text, text, text, text, text, timestamptz, boolean, text[], text, date, boolean, text, jsonb, text, text';

/** L'étiquette @mola posée sur une signature, en JSON (null si absente). */
function molaOf(signature: string): Record<string, unknown> | null {
  const esc = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`COMMENT ON FUNCTION ${esc} IS\\s*'@mola:((?:[^']|'')*)';`).exec(sql);
  return m ? JSON.parse(m[1].replace(/''/g, "'")) : null;
}

describe('SÉCURITÉ — sexe et date de naissance d’un client (admin_set_client_identity)', () => {
  const fn = body('admin_set_client_identity');

  it('existe, SECURITY DEFINER, search_path fixé', () => {
    expect(fn).not.toBe('');
    expect(fn).toMatch(/SECURITY DEFINER\s+SET search_path = public/);
  });

  it('canEditClients, ou canRegisterClients seulement pour SON client', () => {
    expect(fn).toMatch(/admin_has_permission\(v_uid, 'canEditClients'\)/);
    expect(fn).toMatch(/admin_has_permission\(v_uid, 'canRegisterClients'\)/);
    expect(fn).toMatch(/IF NOT v_can_edit AND v_client\.registered_by IS DISTINCT FROM v_uid THEN/);
    // Le droit vient de la session, jamais d'un paramètre.
    expect(fn).toMatch(/v_uid UUID := auth\.uid\(\)/);
  });

  it('verrouille la ligne du client AVANT de la lire et de l’écrire', () => {
    const lock = fn.indexOf('FROM public.clients WHERE user_id = p_user_id FOR UPDATE');
    const write = fn.indexOf('UPDATE public.clients');
    expect(lock).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(lock);
    // Refus de droits AVANT de toucher la ligne (aucun verrou pour un inconnu).
    expect(fn.indexOf("'Accès non autorisé'")).toBeLessThan(lock);
  });

  it('n’accepte que MALE / FEMALE et une date de 16 à 110 ans ; journalise', () => {
    expect(fn).toMatch(/upper\(btrim\(p_gender\)\) NOT IN \('MALE', 'FEMALE'\)/);
    expect(fn).toMatch(/_birth_date_error\(p_date_of_birth\)/);
    expect(body('_birth_date_error')).toMatch(/BETWEEN 16 AND 110/);
    expect(fn).toMatch(/INSERT INTO public\.admin_audit_logs[\s\S]*'set_client_identity'/);
  });
});

describe('SÉCURITÉ — prospect_phones ne s’écrit que par les RPC', () => {
  it('RLS activée, une seule politique, en lecture, limitée à la fiche du commercial ou au responsable', () => {
    expect(sql).toMatch(/ALTER TABLE public\.prospect_phones ENABLE ROW LEVEL SECURITY/);
    const policies = sql.match(/CREATE POLICY[^;]*ON public\.prospect_phones[^;]*;/g) ?? [];
    expect(policies).toHaveLength(1);
    expect(policies[0]).toMatch(/FOR SELECT TO authenticated/);
    expect(policies[0]).toMatch(/current_commercial_source_id\(\)/);
    expect(policies[0]).toMatch(/admin_has_permission\(auth\.uid\(\), 'canManageSales'\)/);
  });

  it('aucune migration ne pose de politique d’écriture (ou sans FOR, donc ALL) sur prospect_phones', () => {
    for (const f of readdirSync(DIR).filter((x) => x.endsWith('.sql'))) {
      const all = readFileSync(join(DIR, f), 'utf8').match(/CREATE POLICY[^;]*ON public\.prospect_phones[^;]*;/g) ?? [];
      for (const p of all) expect(p, f).toMatch(/\bFOR\s+SELECT\b/i);
    }
  });

  it('aucun droit d’écriture accordé à anon / authenticated sur la table', () => {
    expect(sql).not.toMatch(/GRANT[^;]*(INSERT|UPDATE|DELETE|ALL)[^;]*ON TABLE public\.prospect_phones TO[^;]*\b(anon|authenticated)\b/i);
  });
});

describe('SÉCURITÉ — prospect_create / prospect_update', () => {
  it('les anciennes signatures sont supprimées avant de recréer les fonctions', () => {
    const dropC = sql.indexOf('DROP FUNCTION IF EXISTS public.prospect_create(text, text, text, text, text, text, timestamptz, text[], uuid);');
    const dropU = sql.indexOf('DROP FUNCTION IF EXISTS public.prospect_update(uuid, text, text, text, text, text, text, timestamptz, boolean, text[]);');
    expect(dropC).toBeGreaterThan(-1);
    expect(dropU).toBeGreaterThan(-1);
    expect(sql.indexOf('CREATE OR REPLACE FUNCTION public.prospect_create(')).toBeGreaterThan(dropC);
    expect(sql.indexOf('CREATE OR REPLACE FUNCTION public.prospect_update(')).toBeGreaterThan(dropU);
  });

  it('le périmètre du commercial est vérifié (sa fiche, ou le responsable)', () => {
    expect(body('prospect_create')).toMatch(/v_src UUID := public\._sales_scope\(p_source_id\)/);
    expect(body('prospect_update')).toMatch(/public\._sales_scope\(v_p\.source_id\) IS NULL/);
    expect(body('prospect_set_status')).toMatch(/public\._sales_scope\(v_p\.source_id\) IS NULL/);
  });

  it('prospect_update verrouille le prospect AVANT de le lire', () => {
    const fn = body('prospect_update');
    expect(fn.indexOf('FROM public.prospects WHERE id = p_id FOR UPDATE')).toBeGreaterThan(-1);
    expect(fn.indexOf('FROM public.prospects WHERE id = p_id FOR UPDATE')).toBeLessThan(fn.indexOf('v_p.status'));
  });

  it('nom, sexe, ville obligatoires à la création', () => {
    const fn = body('prospect_create');
    expect(fn).toMatch(/'Le nom est requis'/);
    expect(fn).toMatch(/v_gender NOT IN \('MALE', 'FEMALE'\)/);
    expect(fn).toMatch(/'La ville est requise'/);
  });

  it.each(['prospect_create', 'prospect_update'])('%s : numéros verrouillés, puis TOUT vérifié, puis écrit', (name) => {
    const fn = body(name);
    const lock = fn.indexOf('_prospect_lock_numbers(');
    const conflict = fn.indexOf('_prospect_number_conflict(');
    const others = fn.indexOf('_prospect_numbers_error(');
    const firstWrite = Math.min(
      ...['INSERT INTO public.prospects', 'UPDATE public.prospects', 'DELETE FROM public.prospect_phones', 'INSERT INTO public.prospect_phones']
        .map((w) => fn.indexOf(w))
        .filter((i) => i > -1),
    );
    expect(lock).toBeGreaterThan(-1);
    expect(conflict).toBeGreaterThan(lock);
    expect(others).toBeGreaterThan(lock);
    expect(firstWrite).toBeGreaterThan(Math.max(conflict, others));
  });

  it('un numéro (principal ou autre) d’un client ou d’un prospect ouvert est reconnu des deux côtés', () => {
    const fn = body('_prospect_number_conflict');
    expect(fn).toMatch(/_phone_is_client\(p_e164\)/);
    expect(fn).toMatch(/FROM public\.prospects p[\s\S]*p\.phone_e164 = p_e164/);
    expect(fn).toMatch(/FROM public\.prospect_phones pp[\s\S]*pp\.phone_e164 = p_e164/);
    expect(fn).toMatch(/status IN \('new','contacted','interested'\)/);
  });

  it('le déclencheur d’attribution lit aussi les autres numéros et ne bloque jamais une inscription', () => {
    const fn = body('clients_match_prospect');
    expect(fn).toMatch(/public\.prospect_phones pp WHERE pp\.prospect_id = p\.id AND pp\.phone_e164 = NEW\.phone_e164/);
    expect(fn).toMatch(/EXCEPTION WHEN OTHERS THEN\s+RAISE WARNING/);
    // La définition du déclencheur (ordre, colonnes) n'est pas touchée.
    expect(sql).not.toMatch(/CREATE TRIGGER prospect_match_client/);
  });
});

describe('SÉCURITÉ — droits d’exécution et étiquettes Mola', () => {
  const INTERNAL = [
    'public._birth_date_error(DATE)',
    'public._email_error(TEXT)',
    'public._prospect_phone_list(JSONB, TEXT)',
    'public._prospect_lock_numbers(TEXT[])',
    'public._prospect_number_conflict(TEXT, UUID, UUID)',
    'public._prospect_numbers_error(TEXT[], UUID, UUID)',
    'public.clients_match_prospect()',
  ];

  it.each(INTERNAL)('%s : fermée à l’API (PUBLIC, anon, authenticated)', (sig) => {
    expect(sql).toContain(`REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC, anon, authenticated;`);
  });

  it('aucun GRANT EXECUTE direct à anon (les actions passent par la boucle REVOKE / GRANT)', () => {
    for (const line of sql.split('\n')) {
      if (line.trimStart().toUpperCase().startsWith('GRANT EXECUTE')) expect(line).not.toMatch(/\banon\b|\bPUBLIC\b/);
    }
  });

  it('les actions : REVOKE à PUBLIC et anon, GRANT à authenticated, sur les NOUVELLES signatures', () => {
    const loop = /FOREACH f IN ARRAY ARRAY\[([\s\S]*?)\] LOOP/.exec(sql)?.[1] ?? '';
    for (const sig of [
      `public.prospect_create(${CREATE_SIG})`,
      `public.prospect_update(${UPDATE_SIG})`,
      'public.prospect_set_status(uuid, text, text)',
      'public.prospect_lookup_phone(text)',
      'public.admin_set_client_identity(uuid, text, date, boolean)',
    ]) {
      expect(loop, sig).toContain(`'${sig}'`);
    }
    expect(sql).toMatch(/EXECUTE format\('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f\)/);
    expect(sql).toMatch(/EXECUTE format\('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f\)/);
  });

  it('@mola sur les nouvelles signatures de prospect_create / prospect_update', () => {
    const create = molaOf(`public.prospect_create(${CREATE_SIG})`);
    const update = molaOf(`public.prospect_update(${UPDATE_SIG})`);
    for (const m of [create, update]) {
      expect(m).not.toBeNull();
      expect(m).toMatchObject({ expose: true, kind: 'write', permission: 'canManageSales', confirm: true });
    }
    expect(String(create?.label)).toMatch(/nom.*sexe.*ville/);
    expect(String(create?.label)).toMatch(/p_pain_points/);
    expect(String(create?.label)).toMatch(/p_help_needed/);
    expect(String(update?.label)).toMatch(/p_phones/);
  });

  it('@mola de admin_set_client_identity : exposée, canEditClients, confirmation, client par référence', () => {
    expect(molaOf('public.admin_set_client_identity(uuid, text, date, boolean)')).toEqual({
      expose: true,
      kind: 'write',
      permission: 'canEditClients',
      confirm: true,
      danger: false,
      label: "Renseigner le sexe et la date de naissance d'un client",
      resolve: { p_user_id: 'client' },
    });
  });

  it('chaque fonction créée par la migration porte une étiquette @mola', () => {
    const created = [...sql.matchAll(/CREATE OR REPLACE FUNCTION (public\.\w+)\(/g)].map((m) => m[1]);
    expect(created.length).toBeGreaterThanOrEqual(12);
    for (const fn of new Set(created)) {
      expect(sql, fn).toMatch(new RegExp(`COMMENT ON FUNCTION ${fn.replace('.', '\\.')}\\([^)]*\\) IS\\s*'@mola:`));
    }
  });
});

describe('Fichier consolidé du 06/10', () => {
  const consolidated = readFileSync(join(process.cwd(), 'migrations/20261006_consolidated.sql'), 'utf8');
  const partA = readFileSync(join(DIR, '20261006100000_staff_sites_phones_registration.sql'), 'utf8');

  it('contient les deux migrations du jour, copies conformes, dans l’ordre', () => {
    const a = consolidated.indexOf(partA);
    const b = consolidated.indexOf(sql);
    expect(a, '20261006100000 absente ou modifiée').toBeGreaterThan(-1);
    expect(b, '20261006120000 absente ou modifiée').toBeGreaterThan(a);
  });

  it('vérifie d’abord les prérequis (prospects, fonctions des commerciaux, colonnes des clients)', () => {
    const pre = consolidated.indexOf('SECTION 0 — Prérequis');
    expect(pre).toBeGreaterThan(-1);
    expect(pre).toBeLessThan(consolidated.indexOf(partA));
    for (const needle of ["('prospects',", "('prospect_create',", "('clients_match_prospect',", "'gender',", "'date_of_birth',"]) {
      expect(consolidated, needle).toContain(needle);
    }
  });
});
