// ============================================================================
// customs-supplier — le dépôt d'un fournisseur invité (docs/douane/00-plan.md,
// étape 7). Le fournisseur n'a pas de compte : il a un lien avec un jeton.
//
// POST multipart/form-data { token, kind, note?, file }
//   1. contrôle du fichier ici : taille, type déclaré ET octets réels (un .exe
//      renommé en .pdf est refusé) ;
//   2. contrôle du jeton, du document demandé et du quota en base
//      (customs_invite_upload_target, clé de service) ;
//   3. dépôt dans le dossier du client : <uid>/supplier-<uuid>.<ext> ;
//   4. inscription et notification du client (customs_invite_record_document) ;
//      si l'inscription échoue, le fichier est retiré du seau.
// Les erreurs sont des codes (invalid_or_expired, file_type…) : la page du
// fournisseur les dit en chinois, en anglais ou en français.
//
// Public (verify_jwt = false dans supabase/config.toml). Fichier autonome.
// ============================================================================
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_BYTES = 10 * 1024 * 1024;
const KINDS = ["final_invoice", "proforma", "packing_list", "product_sheet", "photos", "certificate_origin", "other"] as const;
const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Le type réel d'un fichier, lu dans ses premiers octets — pas dans son nom. */
export function sniff(bytes: Uint8Array): string | null {
  const b = (i: number) => bytes[i];
  if (bytes.length >= 4 && b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46) return "application/pdf"; // %PDF
  if (bytes.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export type Check = { ok: true; mime: string } | { ok: false; error: string; status: number };

/** Ce qui se vérifie sans la base : le jeton a la bonne forme, le document est connu, le fichier est ce qu'il dit être. */
export function checkUpload(token: unknown, kind: unknown, file: unknown, bytes: Uint8Array | null): Check {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return { ok: false, error: "invalid_or_expired", status: 403 };
  if (typeof kind !== "string" || !(KINDS as readonly string[]).includes(kind)) return { ok: false, error: "kind_not_requested", status: 400 };
  if (!(file instanceof File) || !bytes) return { ok: false, error: "no_file", status: 400 };
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return { ok: false, error: "file_size", status: 413 };
  const real = sniff(bytes);
  if (!real || !EXT[real]) return { ok: false, error: "file_type", status: 415 };
  // Un JPEG déclaré PNG passe (même famille) ; un binaire déclaré PDF, non.
  if (file.type && EXT[file.type] && (file.type === "application/pdf") !== (real === "application/pdf")) return { ok: false, error: "file_type", status: 415 };
  return { ok: true, mime: real };
}

export async function handle(req: Request, admin: SupabaseClient): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method" }, 405);
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES + 64 * 1024) return json({ success: false, error: "file_size" }, 413);

  let form: FormData;
  try { form = await req.formData(); } catch { return json({ success: false, error: "bad_request" }, 400); }
  const token = form.get("token");
  const kind = form.get("kind");
  const note = form.get("note");
  const file = form.get("file");
  const bytes = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : null;

  const check = checkUpload(token, kind, file, bytes);
  if (!check.ok) return json({ success: false, error: check.error }, check.status);

  const { data: target, error: targetErr } = await admin.rpc("customs_invite_upload_target", {
    p_token: token, p_kind: kind, p_mime: check.mime, p_size: bytes!.length,
  });
  if (targetErr) { console.error("customs-supplier target:", targetErr.message); return json({ success: false, error: "server" }, 500); }
  const t = target as { success: boolean; error?: string; folder?: string };
  if (!t.success || !t.folder) return json({ success: false, error: t.error ?? "invalid_or_expired" }, t.error === "invalid_or_expired" ? 403 : 400);

  const path = `${t.folder}/supplier-${crypto.randomUUID()}.${EXT[check.mime]}`;
  const { error: upErr } = await admin.storage.from("customs-documents").upload(path, bytes!, { contentType: check.mime, upsert: false });
  if (upErr) { console.error("customs-supplier upload:", upErr.message); return json({ success: false, error: "server" }, 500); }

  const name = (file as File).name?.replace(/[\u0000-\u001f]/g, "").slice(0, 200) || null;
  const { data: rec, error: recErr } = await admin.rpc("customs_invite_record_document", {
    p_token: token, p_kind: kind, p_path: path, p_name: name, p_mime: check.mime, p_size: bytes!.length,
    p_note: typeof note === "string" ? note.slice(0, 500) : null,
  });
  const r = rec as { success?: boolean; error?: string; id?: string } | null;
  if (recErr || !r?.success) {
    // Pas de fichier orphelin : ce qui n'est pas inscrit est retiré.
    await admin.storage.from("customs-documents").remove([path]);
    if (recErr) console.error("customs-supplier record:", recErr.message);
    return json({ success: false, error: r?.error ?? "server" }, recErr ? 500 : 400);
  }
  return json({ success: true, id: r.id });
}

if (!Deno.env.get("CUSTOMS_SUPPLIER_TEST")) {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  Deno.serve((req) => handle(req, admin));
}
