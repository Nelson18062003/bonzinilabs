// ============================================================
// Les dossiers douane du CLIENT (app client, session `supabase`) : ses fiches
// de classement, l'assistant IA (edge function customs-ai) et l'envoi au
// commissionnaire agréé. Toutes les RPC renvoient { success, error?, … } ;
// un refus n'est jamais pris pour un succès.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } from '@/lib/env';
import { validateUploadFile } from '@/lib/utils';
import { uploadWithRetry } from '@/lib/storageUpload';
import { compressImages } from '@/lib/imageCompression';
import { customsKeys } from '@/lib/queryKeys';
import type { AuditSummary, Classification, ClassificationSummary } from '@/lib/customs/files';

type RpcResult<T> = ({ success: true } & T) | { success: false; error?: string };

async function rpcJson<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  const res = data as unknown as RpcResult<T>;
  if (!res || res.success !== true) throw new Error((res as { error?: string })?.error || 'Opération refusée');
  return res as T;
}

export const CUSTOMS_BUCKET = 'customs-documents';

/** Téléverse les pièces dans le dossier du client : <uid>/<uuid>.<ext>. */
export async function uploadCustomsFiles(files: File[]): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Connexion requise');
  const paths: string[] = [];
  for (const file of files) {
    validateUploadFile(file);
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await uploadWithRetry(() => supabase.storage.from(CUSTOMS_BUCKET).upload(path, file, { contentType: file.type, upsert: false }));
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

export function useMyCustomsFiles(enabled = true) {
  return useQuery({
    queryKey: customsKeys.myFiles(),
    queryFn: () => rpcJson<{ classifications: ClassificationSummary[]; audits: AuditSummary[] }>('customs_my_files'),
    enabled,
    staleTime: 15_000,
  });
}

export function useClassification(id: string | undefined) {
  return useQuery({
    queryKey: customsKeys.classification(id),
    queryFn: async () => (await rpcJson<{ classification: Classification }>('customs_classification_get', { p_id: id })).classification,
    enabled: !!id,
    // Pendant la relecture du commissionnaire, on regarde de temps en temps.
    refetchInterval: (q) => (q.state.data && ['submitted', 'in_review'].includes(q.state.data.status) ? 30_000 : false),
  });
}

export function useCreateClassification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { productName: string; description: string; photos: File[] }) => {
      // 1568 px : le bord le plus long que l'assistant lit sans le réduire lui-même.
      const photoPaths = v.photos.length ? await uploadCustomsFiles(await compressImages(v.photos, 1568, 0.82)) : [];
      return rpcJson<{ id: string; ref: string }>('customs_classification_create', {
        p_product_name: v.productName, p_description: v.description || null, p_facts: {}, p_photo_paths: photoPaths,
      });
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: customsKeys.myFiles() }); },
  });
}

export function usePostClassification(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => rpcJson('customs_classification_post', { p_id: id, p_body: body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: customsKeys.classification(id) }); },
  });
}

export function useSubmitClassification(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => rpcJson('customs_classification_submit', { p_id: id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: customsKeys.classification(id) });
      void qc.invalidateQueries({ queryKey: customsKeys.myFiles() });
    },
  });
}

export function useCancelClassification(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => rpcJson('customs_classification_cancel', { p_id: id }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: customsKeys.myFiles() }); },
  });
}

/**
 * L'edge function customs-ai, appelée avec le JWT du client (pas .invoke() :
 * voir .claude/rules/supabase-clients.md).
 */
export async function callCustomsAi(body: Record<string, unknown>): Promise<{ success: true; status?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Connexion requise');
  const res = await fetch(`${VITE_SUPABASE_URL}/functions/v1/customs-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: VITE_SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; status?: string };
  if (!res.ok || data.success !== true) throw new Error(data.error || `L'assistant n'a pas répondu (${res.status})`);
  return { success: true, status: data.status };
}

/** Un tour de l'assistant. Les pistes du vocabulaire du marché (« régulateur » → 85.04…) partent avec la demande. */
export function useClassify(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hints: { code: string; tip?: string }[]) => callCustomsAi({ action: 'classify', classification_id: id, hints }),
    onSettled: () => { void qc.invalidateQueries({ queryKey: customsKeys.classification(id) }); },
  });
}

/** Les photos de SES fiches, signées pour une heure avec la session du client. */
export function useMyCustomsPhotoUrls(paths: string[] | undefined) {
  return useQuery({
    queryKey: [...customsKeys.all, 'my-photos', ...(paths ?? [])] as const,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(CUSTOMS_BUCKET).createSignedUrls(paths ?? [], 3600);
      if (error) throw new Error(error.message);
      return (data ?? []).map((d) => d.signedUrl).filter((u): u is string => !!u);
    },
    enabled: !!paths?.length,
    staleTime: 30 * 60_000,
  });
}
