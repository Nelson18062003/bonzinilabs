// ============================================================================
// Tests Deno de customs-supplier — sans réseau : un faux Supabase.
//
//   CUSTOMS_SUPPLIER_TEST=1 deno test --allow-env --node-modules-dir=none \
//     supabase/functions/customs-supplier/supplier.deno.ts
// ============================================================================
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkUpload, handle, sniff } from "./index.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const TOKEN = "a".repeat(64);
const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj");
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EXE = new TextEncoder().encode("MZ\x90\x00 this is not a pdf");

Deno.test("le type d'un fichier se lit dans ses octets", () => {
  assert(sniff(PDF) === "application/pdf", "pdf");
  assert(sniff(JPG) === "image/jpeg", "jpeg");
  assert(sniff(PNG) === "image/png", "png");
  assert(sniff(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")) === "image/webp", "webp");
  assert(sniff(EXE) === null, "un exécutable n'est rien de connu");
});

Deno.test("les contrôles sans la base : jeton, document, taille, déguisement", () => {
  const f = (bytes: Uint8Array<ArrayBuffer>, type: string, name = "x") => new File([bytes], name, { type });
  assert(!checkUpload("court", "final_invoice", f(PDF, "application/pdf"), PDF).ok, "jeton mal formé");
  assert(!checkUpload(TOKEN, "passeport", f(PDF, "application/pdf"), PDF).ok, "document inconnu");
  assert(!checkUpload(TOKEN, "final_invoice", null, null).ok, "pas de fichier");
  const exe = checkUpload(TOKEN, "final_invoice", f(EXE, "application/pdf", "facture.pdf"), EXE);
  assert(!exe.ok && exe.error === "file_type", "un exécutable renommé en PDF est refusé");
  const pngAsJpeg = checkUpload(TOKEN, "photos", f(PNG, "image/jpeg"), PNG);
  assert(pngAsJpeg.ok && pngAsJpeg.mime === "image/png", "une image mal étiquetée garde son vrai type");
  const big = new Uint8Array(10 * 1024 * 1024 + 1); big.set(PDF);
  const tooBig = checkUpload(TOKEN, "final_invoice", f(big, "application/pdf"), big);
  assert(!tooBig.ok && tooBig.error === "file_size", "plus de 10 Mo");
});

/** Un faux Supabase : les RPC répondent ce qu'on leur dit, le seau garde la trace. */
function fake(target: Record<string, unknown>, record: Record<string, unknown>) {
  const calls: { rpc: [string, Record<string, unknown>][]; uploads: string[]; removed: string[] } = { rpc: [], uploads: [], removed: [] };
  const admin = {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.rpc.push([name, args]);
      return Promise.resolve({ data: name === "customs_invite_upload_target" ? target : record, error: null });
    },
    storage: {
      from: () => ({
        upload: (path: string) => { calls.uploads.push(path); return Promise.resolve({ error: null }); },
        remove: (paths: string[]) => { calls.removed.push(...paths); return Promise.resolve({ error: null }); },
      }),
    },
  } as unknown as SupabaseClient;
  return { admin, calls };
}
const post = (bytes: Uint8Array<ArrayBuffer>, type = "application/pdf", kind = "final_invoice") => {
  const form = new FormData();
  form.set("token", TOKEN);
  form.set("kind", kind);
  form.set("note", "Final invoice PO-118");
  form.set("file", new File([bytes], "Commercial invoice.pdf", { type }));
  return new Request("https://x/functions/v1/customs-supplier", { method: "POST", body: form });
};

Deno.test("le dépôt : dans le dossier du client, sous supplier-<uuid>, puis inscrit", async () => {
  const { admin, calls } = fake({ success: true, folder: "00000000-0000-0000-0000-00000000000a" }, { success: true, id: "doc-1" });
  const res = await handle(post(PDF), admin);
  const body = await res.json();
  assert(res.status === 200 && body.success && body.id === "doc-1", `réponse : ${res.status} ${JSON.stringify(body)}`);
  assert(/^00000000-0000-0000-0000-00000000000a\/supplier-[0-9a-f-]{36}\.pdf$/.test(calls.uploads[0]), `chemin : ${calls.uploads[0]}`);
  const rec = calls.rpc.find(([n]) => n === "customs_invite_record_document")![1];
  assert(rec.p_path === calls.uploads[0] && rec.p_mime === "application/pdf" && rec.p_note === "Final invoice PO-118", "l'inscription reprend le fichier déposé");
});

Deno.test("un jeton refusé par la base : rien n'est déposé", async () => {
  const { admin, calls } = fake({ success: false, error: "invalid_or_expired" }, {});
  const res = await handle(post(PDF), admin);
  assert(res.status === 403 && (await res.json()).error === "invalid_or_expired", "403");
  assert(calls.uploads.length === 0, "aucun dépôt");
});

Deno.test("une inscription refusée : le fichier déposé est retiré (pas d'orphelin)", async () => {
  const { admin, calls } = fake({ success: true, folder: "00000000-0000-0000-0000-00000000000a" }, { success: false, error: "too_many_files" });
  const res = await handle(post(PDF), admin);
  assert(res.status === 400 && (await res.json()).error === "too_many_files", "400");
  assert(calls.removed.length === 1 && calls.removed[0] === calls.uploads[0], "le fichier est retiré");
});
