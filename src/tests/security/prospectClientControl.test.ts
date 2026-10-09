// ============================================================
// Test de non-régression SÉCURITÉ — numéro déjà client (« À vérifier »)
// et prospect ↔ client par le super admin (07/10/2026, 20261007100000).
//
//   · CLOISONNEMENT : la migration n'ouvre rien au commercial. La table des
//     vérifications ne se lit qu'avec canManageSales et ne s'écrit que par
//     les RPC ; la vérification d'un numéro pendant la saisie et les réponses
//     de prospect_create / prospect_update ne disent RIEN du client reconnu ;
//   · le numéro d'un AUTRE client fait partir la fiche « À vérifier » et
//     notifie le super admin ; celui d'un de SES clients reste refusé ;
//   · la décision (attribuer / refuser) et le passage client → prospect sont
//     gardés par admin_has_permission, verrouillent avant de lire, refusent
//     les statuts terminaux, et le second ne touche qu'un client SANS AUCUNE
//     opération (instantané au journal AVANT la suppression) ;
//   · mêmes signatures qu'au 06/10 (aucune surcharge PostgREST), droits
//     fermés pour les aides internes, étiquette @mola sur chaque fonction ;
//   · le contrat du front (statuts, réponses de phone_check) suit le SQL.
// Le comportement lui-même est éprouvé sur Postgres 16 (104 contrôles, + 36
// pour les corrections de la relecture, + un dépôt simultané réel).
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'supabase/migrations');
const FILE = '20261007100000_prospect_client_control.sql';
const sql = readFileSync(join(DIR, FILE), 'utf8');
const LATER_OR_EQUAL = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql') && f >= FILE)
  .sort();
const body = (fn: string) => new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\([\\s\\S]*?\\$\\$;`).exec(sql)?.[0] ?? '';

const CREATE_SIG = 'text, text, text, text, text, text, timestamptz, text[], uuid, text, date, text, jsonb, text, text';
const UPDATE_SIG = 'uuid, text, text, text, text, text, text, timestamptz, boolean, text[], text, date, boolean, text, jsonb, text, text';

/** L'étiquette @mola posée sur une signature, en JSON (null si absente). */
function molaOf(signature: string): Record<string, unknown> | null {
  const esc = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`COMMENT ON FUNCTION ${esc} IS\\s*'@mola:((?:[^']|'')*)';`).exec(sql);
  return m ? JSON.parse(m[1].replace(/''/g, "'")) : null;
}

/** Les clés d'un jsonb_build_object('a', …, 'b', …) : les littéraux en snake_case suivis d'une virgule. */
function builtKeys(call: string): string[] {
  return [...call.matchAll(/'([a-z_]+)'\s*,/g)].map((m) => m[1]);
}

describe('SÉCURITÉ — le commercial reste cloisonné (07/10)', () => {
  it('la migration ne redéfinit ni is_admin, ni admin_has_permission, ni current_commercial_source_id', () => {
    expect(sql).not.toMatch(/FUNCTION public\.is_admin\(/);
    expect(sql).not.toMatch(/FUNCTION public\.admin_has_permission\(/);
    expect(sql).not.toMatch(/FUNCTION public\.current_commercial_source_id\(/);
  });

  it('aucune politique ni aucun droit n’est posé sur les tables des clients', () => {
    const policies = sql.match(/CREATE POLICY[^;]*;/g) ?? [];
    for (const p of policies) expect(p).toMatch(/ON public\.prospect_client_claims\b/);
    expect(sql).not.toMatch(/GRANT[^;]*ON (TABLE )?public\.(clients|wallets|deposits|payments|client_phones|ledger_entries|wallet_adjustments)\b/i);
  });

  it('prospect_client_claims : RLS, une seule politique, en lecture, canManageSales', () => {
    expect(sql).toMatch(/ALTER TABLE public\.prospect_client_claims ENABLE ROW LEVEL SECURITY/);
    const policies = sql.match(/CREATE POLICY[^;]*ON public\.prospect_client_claims[^;]*;/g) ?? [];
    expect(policies).toHaveLength(1);
    expect(policies[0]).toMatch(/FOR SELECT TO authenticated/);
    expect(policies[0]).toMatch(/admin_has_permission\(auth\.uid\(\), 'canManageSales'\)/);
    expect(policies[0]).not.toMatch(/current_commercial_source_id/);
  });

  it('prospect_client_claims : droits par défaut retirés, la seule lecture rendue', () => {
    const revoke = sql.indexOf('REVOKE ALL ON TABLE public.prospect_client_claims FROM PUBLIC, anon, authenticated;');
    const grant = sql.indexOf('GRANT SELECT ON TABLE public.prospect_client_claims TO authenticated;');
    expect(revoke).toBeGreaterThan(-1);
    expect(grant).toBeGreaterThan(revoke);
    expect(sql).not.toMatch(/GRANT[^;]*(INSERT|UPDATE|DELETE|ALL)[^;]*ON TABLE public\.prospect_client_claims TO[^;]*\b(anon|authenticated)\b/i);
  });

  it('aucune migration (celle-ci ou une suivante) ne pose de politique d’écriture sur prospect_client_claims', () => {
    for (const f of LATER_OR_EQUAL) {
      const all = readFileSync(join(DIR, f), 'utf8').match(/CREATE POLICY[^;]*ON public\.prospect_client_claims[^;]*;/g) ?? [];
      for (const p of all) expect(p, f).toMatch(/\bFOR\s+SELECT\b/i);
    }
  });

  it('prospect_phone_check ne renvoie que success / status / l’id de SA fiche, sans lire un client lui-même', () => {
    const fn = body('prospect_phone_check');
    expect(fn).not.toBe('');
    const calls = fn.match(/jsonb_build_object\([^;]*?\)(?=;)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      for (const k of builtKeys(c)) expect(['success', 'status', 'prospect_id', 'error']).toContain(k);
    }
    // Le client n'est jamais lu ici : seulement « ce numéro est-il pris ? ».
    expect(fn).not.toMatch(/FROM public\.clients/);
    expect(fn).not.toMatch(/FROM public\.client_phones/);
    // L'id renvoyé est celui d'une fiche de SA source.
    expect(fn).toMatch(/WHERE p\.source_id = v_src/);
  });

  it('prospect_create / prospect_update : la réponse ne nomme jamais le client', () => {
    expect(body('prospect_create')).toMatch(/RETURN jsonb_build_object\('success', true, 'id', v_id, 'to_verify', v_to_verify\);/);
    // La modification dit le statut FINAL (relecture), jamais le client.
    const ret = /RETURN jsonb_build_object\('success', true, 'to_verify'[\s\S]*?\);/.exec(body('prospect_update'))?.[0] ?? '';
    // (« v_final = 'to_verify' » donne une seconde fois le littéral to_verify : les clés distinctes.)
    expect([...new Set(builtKeys(ret))]).toEqual(['success', 'to_verify', 'status', 'notified', 'released']);
    for (const fn of ['prospect_create', 'prospect_update']) {
      expect(body(fn), fn).not.toMatch(/'client_user_id'|'customer_code'|'client'\s*,/);
    }
  });

  it('la vérification d’un numéro passe par le périmètre du commercial (ou la direction)', () => {
    const fn = body('prospect_phone_check');
    expect(fn).toMatch(/v_src UUID := public\.current_commercial_source_id\(\)/);
    expect(fn).toMatch(/v_src IS NULL AND NOT public\.admin_has_permission\(auth\.uid\(\), 'canManageSales'\)/);
    expect(fn).toMatch(/public\._sales_scope\(v_src\) IS NULL/);
  });
});

describe('SÉCURITÉ — numéro déjà client : « À vérifier » au lieu d’un refus', () => {
  it('la contrainte de statut accepte to_verify, nommée ; l’index des numéros suivis reste aux fiches ouvertes', () => {
    expect(sql).toMatch(/ADD CONSTRAINT prospects_status_check\s+CHECK \(status IN \('new', 'contacted', 'interested', 'to_verify', 'won', 'lost'\)\)/);
    expect(sql).not.toMatch(/prospects_open_phone_key/);
  });

  it('_prospect_number_conflict distingue SES clients (own_client) des autres (client)', () => {
    const fn = body('_prospect_number_conflict');
    expect(fn).toMatch(/WHEN EXISTS \(SELECT 1 FROM cl WHERE cl\.source_id = p_source_id\) THEN 'own_client'/);
    expect(fn).toMatch(/'client'/);
    // Une fiche « À vérifier » garde ses numéros (pas de doublon chez un collègue).
    expect(fn).toMatch(/status IN \('new','contacted','interested','to_verify'\)/);
  });

  it.each(['prospect_create', 'prospect_update'])('%s : numéros verrouillés, puis TOUT vérifié, puis écrit, puis les vérifications ouvertes', (name) => {
    const fn = body(name);
    const lock = fn.indexOf('_prospect_lock_numbers(');
    const conflict = fn.indexOf('_prospect_number_conflict(');
    const others = fn.indexOf('_prospect_numbers_refusal(');
    const matches = fn.indexOf('_prospect_client_matches(');
    const firstWrite = Math.min(
      ...['INSERT INTO public.prospects', 'UPDATE public.prospects', 'DELETE FROM public.prospect_phones', 'INSERT INTO public.prospect_phones']
        .map((w) => fn.indexOf(w))
        .filter((i) => i > -1),
    );
    const claims = fn.indexOf('_prospect_claim_clients(');
    expect(lock).toBeGreaterThan(-1);
    expect(conflict).toBeGreaterThan(lock);
    expect(others).toBeGreaterThan(lock);
    expect(matches).toBeGreaterThan(lock);
    expect(firstWrite).toBeGreaterThan(Math.max(conflict, others, matches));
    expect(claims).toBeGreaterThan(firstWrite);
    // Seul le numéro d'un AUTRE client passe ; tout autre conflit reste un refus.
    expect(fn).toMatch(/v_conflict IS NOT NULL AND v_conflict <> 'client'/);
    expect(fn).toMatch(/_prospect_numbers_refusal\([^)]*, true\)/);
    expect(fn).toMatch(/' est déjà celui d''un de vos clients'/);
  });

  it('prospect_update : une fiche « devenu client » reste figée (jamais « À vérifier »)', () => {
    expect(body('prospect_update')).toMatch(/v_to_verify := v_p\.status <> 'won'/);
    expect(body('prospect_update')).toMatch(/SELECT \* INTO v_p FROM public\.prospects WHERE id = p_id FOR UPDATE/);
  });

  it('la direction est notifiée (super admin seulement), sans jamais faire échouer la saisie', () => {
    const fn = body('_prospect_claim_clients');
    expect(fn).toMatch(/public\.send_staff_push\('canManageSales', 'Numéro déjà client',/);
    expect(fn).toMatch(/' a saisi '[\s\S]*'\) : déjà client Bonzini — à vérifier'/);
    expect(fn).toMatch(/'\/m\/equipe\/ventes\/a-verifier', ARRAY\['super_admin'\], auth\.uid\(\)\)/);
    expect(fn).toMatch(/EXCEPTION WHEN OTHERS THEN\s+RAISE WARNING/);
    // Seulement s'il y a du nouveau (une vérification ouverte ou rouverte).
    expect(fn).toMatch(/IF v_n > 0 THEN/);
  });

  it('send_staff_push_user : une personne active, interne, jamais d’échec', () => {
    const fn = body('send_staff_push_user');
    expect(fn).toMatch(/WHERE d\.user_id = p_user_id/);
    expect(fn).toMatch(/r\.is_disabled = false OR r\.is_disabled IS NULL/);
    expect(fn).toMatch(/EXCEPTION WHEN OTHERS THEN\s+RAISE WARNING 'send_staff_push_user: %', SQLERRM;\s+RETURN 0;/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.send_staff_push_user\(UUID, TEXT, TEXT, TEXT\) FROM PUBLIC, anon, authenticated;/);
  });

  it('le commercial ne change pas le statut d’une fiche « À vérifier » ; il ne le pose jamais', () => {
    const fn = body('prospect_set_status');
    expect(fn).toMatch(/p_status NOT IN \('new','contacted','interested','lost'\)/);
    expect(fn).toMatch(/v_p\.status = 'to_verify'[\s\S]*'Cette fiche attend la vérification de la direction'/);
    expect(fn).toMatch(/public\._sales_scope\(v_p\.source_id\) IS NULL/);
  });

  it('prospect_link_client refuse une fiche « À vérifier » (elle se tranche ailleurs)', () => {
    const fn = body('prospect_link_client');
    expect(fn).toMatch(/admin_has_permission\(v_uid, 'canManageSales'\)/);
    expect(fn).toMatch(/v_p\.status = 'to_verify'/);
    expect(fn.indexOf("v_p.status = 'to_verify'")).toBeLessThan(fn.indexOf('FROM public.clients WHERE user_id = p_user_id FOR UPDATE'));
  });
});

describe('SÉCURITÉ — la décision de la direction (prospect_resolve_claim)', () => {
  const fn = body('prospect_resolve_claim');

  it('canManageSales, vérifiée avant toute lecture', () => {
    const guard = fn.indexOf("admin_has_permission(v_uid, 'canManageSales')");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(fn.indexOf('FROM public.prospect_client_claims'));
    expect(fn).toMatch(/v_uid UUID := auth\.uid\(\)/);
  });

  it('verrous : le client, puis le prospect, puis ses vérifications ; seule une fiche « À vérifier » se tranche', () => {
    const client = fn.indexOf('FROM public.clients WHERE user_id = v_client_id FOR UPDATE');
    const prospect = fn.indexOf('FROM public.prospects WHERE id = p_prospect_id FOR UPDATE');
    const claims = fn.indexOf("FROM public.prospect_client_claims WHERE prospect_id = p_prospect_id AND status = 'pending' FOR UPDATE");
    expect(client).toBeGreaterThan(-1);
    expect(prospect).toBeGreaterThan(client);
    expect(claims).toBeGreaterThan(prospect);
    expect(fn).toMatch(/IF v_p\.status <> 'to_verify' THEN/);
  });

  it('attribuer : origine posée sous le verrou des sources, ancien « devenu client » détaché, autres fiches classées', () => {
    expect(fn).toMatch(/set_config\('bonzini\.client_source_write', 'on', true\)[\s\S]*UPDATE public\.clients[\s\S]*set_config\('bonzini\.client_source_write', '', true\)/);
    expect(fn).toMatch(/lost_reason = 'Client réattribué par la direction'/);
    expect(fn).toMatch(/ELSE 'Client attribué à un autre commercial' END/);
    // Un doublon du MÊME commercial le dit, sans seconde notification.
    expect(fn).toMatch(/v_dup := v_other\.source_id IS NOT DISTINCT FROM v_p\.source_id/);
    expect(fn).toMatch(/'Doublon : ce client vous est attribué par une autre de vos fiches'/);
    expect(fn).toMatch(/IF NOT v_dup THEN\s+PERFORM public\.send_staff_push_user/);
    // Le prospect passe « devenu client » AVANT l'origine du client (le déclencheur ne le prend plus pour un ouvert).
    expect(fn.indexOf("SET status = 'won'")).toBeLessThan(fn.indexOf('UPDATE public.clients'));
    // Plusieurs clients reconnus : il faut choisir.
    expect(fn).toMatch(/'Plusieurs clients ont ces numéros : choisissez lequel attribuer'/);
    expect(fn).toMatch(/'Cette fiche commercial est archivée/);
  });

  it('journalisée, et le commercial concerné est notifié', () => {
    expect(fn).toMatch(/INSERT INTO public\.admin_audit_logs[\s\S]*'prospect_resolve_claim'/);
    expect(fn).toMatch(/send_staff_push_user\(v_src\.staff_user_id, 'Client attribué'/);
    expect(fn).toMatch(/send_staff_push_user\(v_src\.staff_user_id, 'Fiche classée'/);
  });

  it('la liste « À vérifier » : canManageSales, seulement les fiches encore « À vérifier »', () => {
    const list = body('prospect_claims_pending');
    expect(list).toMatch(/IF NOT public\.admin_has_permission\(auth\.uid\(\), 'canManageSales'\) THEN/);
    expect(list).toMatch(/JOIN public\.prospects p ON p\.id = k\.prospect_id AND p\.status = 'to_verify'/);
    expect(list).toMatch(/WHERE k\.status = 'pending'/);
    // L'adresse technique d'un compte « téléphone seul » n'est pas donnée pour une vraie.
    expect(list).toMatch(/LIKE '%@bonzini-client\.local' THEN NULL/);
  });
});

describe('SÉCURITÉ — client → prospect (super admin, client sans aucune opération)', () => {
  const fn = body('admin_client_to_prospect');
  const blockers = body('_client_prospect_blockers');

  it.each(['admin_client_to_prospect', 'admin_client_prospect_eligibility'])('%s : canManageUsers ET canManageSales', (name) => {
    expect(body(name)).toMatch(
      /IF NOT \(public\.admin_has_permission\(v_uid, 'canManageUsers'\) AND public\.admin_has_permission\(v_uid, 'canManageSales'\)\) THEN/,
    );
  });

  it('les blocages couvrent toute trace d’activité (argent, colis, cargo, douane, personnel, vérification en attente)', () => {
    for (const needle of [
      'FROM public.user_roles WHERE user_id = p_user_id',
      'FROM public.deposits WHERE user_id = p_user_id',
      'FROM public.payments WHERE user_id = p_user_id',
      'FROM public.ledger_entries WHERE user_id = p_user_id',
      'FROM public.wallet_adjustments WHERE user_id = p_user_id',
      'coalesce(v_bal, 0) <> 0',
      'coalesce(v_od, 0) > 0',
      "'parcel_deposits'",
      "'parcel_releases'",
      "'cargo_shipments'",
      "'cargo_packages'",
      "'customs_classifications'",
      "'customs_audits'",
      "'payment_batches'",
      "k.status = 'pending' AND p.status = 'to_verify'",
    ]) {
      expect(blockers, needle).toContain(needle);
    }
    // Dépôts et paiements : TOUS statuts (un dépôt refusé ou un paiement annulé est une opération).
    expect(blockers).not.toMatch(/FROM public\.(deposits|payments) WHERE user_id = p_user_id AND status/);
  });

  it('verrouille le client et son portefeuille, puis les numéros, puis recalcule les blocages sous verrou', () => {
    const client = fn.indexOf('FROM public.clients WHERE user_id = p_user_id FOR UPDATE');
    const wallet = fn.indexOf('FROM public.wallets WHERE user_id = p_user_id FOR UPDATE');
    const numbers = fn.indexOf('_prospect_lock_numbers(');
    const recheck = fn.indexOf('_client_prospect_blockers(p_user_id)');
    expect(client).toBeGreaterThan(-1);
    expect(wallet).toBeGreaterThan(client);
    expect(numbers).toBeGreaterThan(wallet);
    expect(recheck).toBeGreaterThan(numbers);
  });

  it('instantané au journal AVANT la suppression ; suppression par admin_delete_client, vérifiée ; tout ou rien', () => {
    const audit = fn.indexOf("'client_to_prospect', 'client', p_user_id");
    const del = fn.indexOf('public.admin_delete_client(p_user_id)');
    expect(audit).toBeGreaterThan(fn.indexOf('_client_prospect_blockers(p_user_id)'));
    expect(del).toBeGreaterThan(audit);
    expect(fn).toMatch(/IF NOT coalesce\(\(v_del ->> 'success'\)::boolean, false\) THEN\s+RAISE EXCEPTION/);
    // Le bloc (journal, suppression, prospect) est annulé d'un coup sur une erreur.
    expect(fn).toMatch(/EXCEPTION\s+WHEN raise_exception THEN/);
  });

  it('jamais l’adresse technique comme email ; seulement une fiche commercial active', () => {
    expect(fn).toMatch(/v_email LIKE '%@bonzini-client\.local'/);
    expect(fn).toMatch(/v_src\.kind <> 'commercial' OR NOT v_src\.is_active/);
  });
});

describe('SÉCURITÉ — signatures, droits et étiquettes', () => {
  it('mêmes signatures qu’au 06/10 : aucune nouvelle surcharge de prospect_create / prospect_update', () => {
    expect(sql).not.toMatch(/DROP FUNCTION[^;]*prospect_(create|update)/);
    expect(molaOf(`public.prospect_create(${CREATE_SIG})`)).not.toBeNull();
    expect(molaOf(`public.prospect_update(${UPDATE_SIG})`)).not.toBeNull();
  });

  it('les aides internes sont fermées à l’API', () => {
    for (const sig of [
      'public._prospect_number_conflict(TEXT, UUID, UUID)',
      'public._prospect_numbers_error(TEXT[], UUID, UUID)',
      'public._prospect_numbers_refusal(TEXT[], UUID, UUID, BOOLEAN)',
      'public._prospect_client_matches(TEXT[], UUID)',
      'public._prospect_claim_clients(UUID, TEXT[], UUID)',
      'public._client_prospect_blockers(UUID)',
      'public.send_staff_push_user(UUID, TEXT, TEXT, TEXT)',
      'public._prospect_release_if_unclaimed(UUID, BOOLEAN)',
      'public._client_erasable_data(UUID)',
      'public._client_prospect_warnings(UUID)',
      'public._clients_release_prospect_claims()',
      'public._prospect_claims_release()',
    ]) {
      expect(sql, sig).toContain(`REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC, anon, authenticated;`);
    }
  });

  it('les actions : retirées à anon, ouvertes au personnel connecté (chaque RPC vérifie la permission)', () => {
    const loop = /FOREACH f IN ARRAY ARRAY\[([\s\S]*?)\] LOOP/.exec(sql)?.[1] ?? '';
    for (const sig of [
      `public.prospect_create(${CREATE_SIG})`,
      `public.prospect_update(${UPDATE_SIG})`,
      'public.prospect_set_status(uuid, text, text)',
      'public.prospect_link_client(uuid, uuid)',
      'public.prospect_phone_check(text, uuid)',
      'public.prospect_claims_pending()',
      'public.prospect_resolve_claim(uuid, text, uuid, text)',
      'public.admin_client_prospect_eligibility(uuid)',
      'public.admin_client_to_prospect(uuid, uuid, text)',
    ]) {
      expect(loop, sig).toContain(`'${sig}'`);
    }
    expect(sql).toMatch(/EXECUTE format\('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f\);/);
    expect(sql).not.toMatch(/GRANT EXECUTE ON ALL FUNCTIONS/i);
  });

  it('chaque fonction (re)définie porte une étiquette @mola en JSON valable', () => {
    const defined = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map((m) => m[1]);
    expect(defined.length).toBeGreaterThanOrEqual(15);
    for (const name of defined) {
      const m = new RegExp(`COMMENT ON FUNCTION public\\.${name}\\([^)]*\\) IS\\s*'@mola:((?:[^']|'')*)';`).exec(sql);
      expect(m, name).not.toBeNull();
      expect(() => JSON.parse(m![1].replace(/''/g, "'")), name).not.toThrow();
    }
  });

  it('Mola : la liste et la décision ouvertes à la direction ; le reste non exposé', () => {
    expect(molaOf('public.prospect_claims_pending()')).toMatchObject({ expose: true, kind: 'read', permission: 'canManageSales' });
    expect(molaOf('public.prospect_resolve_claim(uuid, text, uuid, text)')).toMatchObject({
      expose: true,
      kind: 'write',
      permission: 'canManageSales',
      confirm: true,
      danger: false,
      resolve: { p_client_user_id: 'client' },
    });
    expect(molaOf('public.prospect_phone_check(text, uuid)')).toMatchObject({ expose: false });
    expect(molaOf('public.admin_client_prospect_eligibility(uuid)')).toMatchObject({ expose: false });
    expect(molaOf('public.admin_client_to_prospect(uuid, uuid, text)')).toMatchObject({ expose: false, confirm: true, danger: true });
    expect(String(molaOf(`public.prospect_create(${CREATE_SIG})`)?.label)).toMatch(/sexe[\s\S]*ville[\s\S]*p_pain_points[\s\S]*p_help_needed[\s\S]*À vérifier/);
  });
});

describe('SÉCURITÉ — relecture du lot 7', () => {
  const toProspect = body('admin_client_to_prospect');
  const resolve = body('prospect_resolve_claim');
  const update = body('prospect_update');
  const release = body('_prospect_release_if_unclaimed');

  it('client → prospect : le compte de connexion verrouillé (FOR UPDATE) après le portefeuille, avant les numéros — une insertion en cours qui le référence est attendue', () => {
    const wallet = toProspect.indexOf('FROM public.wallets WHERE user_id = p_user_id FOR UPDATE');
    const auth = toProspect.indexOf('FROM auth.users WHERE id = p_user_id FOR UPDATE');
    expect(auth).toBeGreaterThan(wallet);
    expect(toProspect.indexOf('_prospect_lock_numbers(')).toBeGreaterThan(auth);
    expect(toProspect.indexOf('_client_prospect_blockers(p_user_id)')).toBeGreaterThan(auth);
  });

  it('client → prospect : l’instantané garde TOUT ce que la suppression efface (fiche entière, bénéficiaires, support, compte, décisions)', () => {
    expect(toProspect).toMatch(/VALUES \(v_uid, 'client_to_prospect', 'client', p_user_id, public\._client_erasable_data\(p_user_id\) \|\| jsonb_build_object\(\s+'client', to_jsonb\(v_client\),/);
    const data = body('_client_erasable_data');
    expect(data).toMatch(/FROM public\.beneficiaries b WHERE b\.client_id = \$1/);
    expect(data).toMatch(/FROM public\.chat_conversations c LEFT JOIN public\.chat_messages m/);
    // Les messages eux-mêmes, pas seulement leur nombre.
    expect(data).toMatch(/jsonb_agg\(to_jsonb\(m\) ORDER BY m\.created_at, m\.id\)/);
    // Le compte de connexion : des champs choisis, jamais le mot de passe.
    expect(data).toMatch(/FROM \(SELECT to_jsonb\(au\) AS j FROM auth\.users au WHERE au\.id = p_user_id\) u/);
    expect(data).not.toMatch(/encrypted_password|raw_user_meta_data/);
    expect(data).toMatch(/FROM public\.prospect_client_claims k WHERE k\.client_user_id = p_user_id/);
    expect(data).toMatch(/'support_conversations', v_convs,\s+'account', v_account, 'prospect_claims', v_claims/);
    // Une table absente ne casse rien.
    expect(data).toMatch(/EXCEPTION WHEN undefined_table OR undefined_column THEN/);
    expect(body('admin_client_prospect_eligibility')).toMatch(/'warnings', to_jsonb\(public\._client_prospect_warnings\(p_user_id\)\)/);
  });

  it('prospect_update : une vérification dont le client n’a plus aucun numéro de la fiche est close ; plus aucune → la fiche sort de « À vérifier »', () => {
    expect(update).toMatch(/note = 'Numéro retiré par le commercial'/);
    expect(update).toMatch(/v_released := public\._prospect_release_if_unclaimed\(p_id, false\)/);
    // Tous ses numéros verrouillés d'un coup quand elle peut sortir de « À vérifier » (pas d'interblocage).
    expect(update).toMatch(/_prospect_lock_numbers\(v_new_numbers \|\| CASE WHEN v_p\.status = 'to_verify' THEN v_existing ELSE ARRAY\[\]::TEXT\[\] END\)/);
  });

  it('libération : la fiche verrouillée avant d’être lue, seulement sans vérification en attente sur un client existant, numéros revérifiés', () => {
    expect(release.indexOf('FROM public.prospects WHERE id = p_prospect_id FOR UPDATE')).toBeGreaterThan(-1);
    expect(release).toMatch(/IF NOT FOUND OR v_p\.status <> 'to_verify' THEN/);
    expect(release).toMatch(/JOIN public\.clients c ON c\.user_id = k\.client_user_id\s+WHERE k\.prospect_id = p_prospect_id AND k\.status = 'pending'\) THEN\s+RETURN NULL;/);
    expect(release).toMatch(/_prospect_lock_numbers\(v_numbers\)[\s\S]*_prospect_number_conflict\(v_n, v_p\.source_id, p_prospect_id\)/);
    expect(release).toMatch(/WHEN 'client'\s+THEN 'Déjà client de Bonzini'/);
  });

  it('client supprimé : deux déclencheurs DIFFÉRÉS (après toutes les cascades) libèrent la fiche, sans jamais faire échouer la suppression', () => {
    expect(sql).toMatch(/CREATE CONSTRAINT TRIGGER clients_release_prospect_claims\s+AFTER DELETE ON public\.clients\s+DEFERRABLE INITIALLY DEFERRED/);
    expect(sql).toMatch(/CREATE CONSTRAINT TRIGGER prospect_claims_release\s+AFTER DELETE ON public\.prospect_client_claims\s+DEFERRABLE INITIALLY DEFERRED\s+FOR EACH ROW\s+WHEN \(OLD\.status = 'pending'\)/);
    for (const fn of ['_clients_release_prospect_claims', '_prospect_claims_release']) {
      expect(body(fn), fn).toMatch(/EXCEPTION WHEN OTHERS THEN\s+RAISE WARNING[^;]*;\s+RETURN NULL;/);
      expect(body(fn), fn).toMatch(/_prospect_release_if_unclaimed\([^)]*, true\)/);
    }
  });

  it('attribuer : refusé si le client n’a plus aucun des numéros de la fiche ; le commercial qui perd le client est prévenu', () => {
    expect(resolve).toMatch(/'Ce client n''a plus aucun des numéros de cette fiche : refusez-la'/);
    expect(resolve.indexOf("plus aucun des numéros")).toBeLessThan(resolve.indexOf("SET status = 'won'"));
    expect(resolve).toMatch(/WHERE id = v_client\.source_id AND kind = 'commercial'[\s\S]*send_staff_push_user\(v_prev_staff, 'Client réattribué'/);
  });

  it('refuser : le commercial lit un motif FIXE ; la note de la direction reste interne (vérification, journal)', () => {
    const reject = resolve.slice(resolve.indexOf("IF p_decision = 'reject' THEN"), resolve.indexOf('-- ── Attribuer ──'));
    expect(reject).toMatch(/SET status = 'lost', lost_reason = 'Déjà client de Bonzini',/);
    expect(reject).not.toMatch(/lost_reason = coalesce\(v_note/);
    expect(reject).toMatch(/note = v_note, direction_rejected_at = now\(\)/);
    expect(reject).toMatch(/jsonb_build_object\('decision', 'reject', 'source_id', v_p\.source_id, 'note', v_note,/);
    // La notification ne porte pas la note non plus.
    expect(reject).toMatch(/send_staff_push_user\(v_src\.staff_user_id, 'Fiche classée',\s+v_name \|\| ' : déjà client Bonzini — fiche classée par la direction'/);
  });

  it('refuser : la date du refus de la direction est gardée (et seulement par elle) ; la liste dit un refus antérieur et une fiche archivée', () => {
    expect(resolve).toMatch(/note = v_note, direction_rejected_at = now\(\)/);
    expect((sql.match(/direction_rejected_at = now\(\)/g) ?? []).length).toBe(1);
    const pending = body('prospect_claims_pending');
    expect(pending).toMatch(/'source_active', coalesce\(s\.is_active, false\)/);
    expect(pending).toMatch(/'previously_rejected_at', \(SELECT max\(k2\.direction_rejected_at\)[\s\S]*?p2\.source_id = p\.source_id\)/);
    // La réouverture d'une vérification (même fiche) ne l'efface pas.
    expect(body('_prospect_claim_clients')).not.toMatch(/direction_rejected_at/);
  });
});

describe('CONTRAT — le front suit le SQL', () => {
  const salesTs = readFileSync(join(process.cwd(), 'src/lib/sales.ts'), 'utf8');
  const hooksTs = readFileSync(join(process.cwd(), 'src/hooks/useSales.ts'), 'utf8');
  const union = (src: string, name: string) =>
    (new RegExp(`export type ${name} =([^;]*);`).exec(src)?.[1].match(/'([a-z_]+)'/g) ?? []).map((s) => s.slice(1, -1)).sort();

  it('les statuts de prospect du front sont ceux de la contrainte SQL', () => {
    const check = /CHECK \(status IN \(([^)]*)\)\)/.exec(sql)?.[1] ?? '';
    const sqlStatuses = (check.match(/'([a-z_]+)'/g) ?? []).map((s) => s.slice(1, -1)).sort();
    expect(union(salesTs, 'ProspectStatus')).toEqual(sqlStatuses);
  });

  it('les réponses de prospect_phone_check sont celles que le front attend', () => {
    const fn = body('prospect_phone_check');
    const conflict = body('_prospect_number_conflict');
    const produced = new Set(['free', 'invalid', ...(conflict.match(/THEN '([a-z_]+)'|ELSE '([a-z_]+)'/g) ?? []).map((s) => /'([a-z_]+)'/.exec(s)![1])]);
    expect(fn).toMatch(/'free'/);
    expect(fn).toMatch(/'invalid'/);
    expect([...produced].sort()).toEqual(union(hooksTs, 'PhoneCheckStatus'));
  });
});
