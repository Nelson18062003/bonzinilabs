// ============================================================
// Garde d'appelant commune aux edge functions internes (cron, RPC → fonction).
//
// isServiceCaller(req) : vrai si le Bearer est une clé service du projet.
//   1. égalité en temps constant avec SUPABASE_SERVICE_ROLE_KEY (clé injectée
//      par le runtime — aujourd'hui au format « sb_secret_… ») ;
//   2. sinon, on demande à Supabase : GET /auth/v1/admin/users avec ce Bearer
//      ne répond 200 qu'à une clé service (JWT « service_role » historique ou
//      clé secrète), jamais à la clé anonyme ni à un JWT utilisateur.
//
// Pourquoi (incident du 19/09/2026) : la base garde dans Vault le JWT service
// historique (219 caractères), tandis que le runtime des fonctions reçoit la
// nouvelle clé secrète (41 caractères). Les deux sont valides ; une égalité
// stricte refusait pourtant tous les appels de pg_net (401) et les
// recherches cargo restaient « en cours » pour toujours.
// ============================================================

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export function bearerOf(req: Request): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

/** Vrai si l'appel porte une clé service du projet (pg_cron, pg_net, fonction → fonction). */
export async function isServiceCaller(req: Request): Promise<boolean> {
  const token = bearerOf(req);
  if (!token) return false;
  const local = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (local && timingSafeEqual(token, local)) return true;

  const url = Deno.env.get("SUPABASE_URL");
  if (!url) return false;
  try {
    const res = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: { apikey: token, Authorization: `Bearer ${token}` },
    });
    // On ne lit pas le corps : seul le verdict (200 = clé service) compte.
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}
