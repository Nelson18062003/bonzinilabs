// ============================================================
// Clés des armateurs : d'abord l'environnement des fonctions (Edge Functions →
// Secrets), sinon le coffre Vault de la base via la RPC cargo_secret, que seule
// la clé service peut appeler. Ainsi une clé posée d'un côté ou de l'autre
// suffit, et rien ne passe jamais par le dépôt.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function carrierSecret(sb: SupabaseClient, name: string): Promise<string> {
  const fromEnv = Deno.env.get(name);
  if (fromEnv) return fromEnv;
  const { data, error } = await sb.rpc("cargo_secret", { p_name: name });
  if (error || typeof data !== "string") return "";
  return data.trim();
}

/** Message lisible d'une erreur, y compris les objets d'erreur PostgREST (pas des Error). */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    const o = e as { message: string; details?: unknown; hint?: unknown };
    return [o.message, o.details, o.hint].filter((x) => typeof x === "string" && x).join(" · ");
  }
  try { return JSON.stringify(e); } catch { return String(e); }
}
