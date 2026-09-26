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
