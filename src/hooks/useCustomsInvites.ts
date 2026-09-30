// ============================================================
// Les invitations fournisseur (étape 7).
//   Côté client (session `supabase`) : inviter, fermer un lien, lire les dépôts.
//   Côté fournisseur (aucune session) : la page /f/:token lit l'invitation par
//   la RPC publique et dépose ses fichiers par l'edge function customs-supplier.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } from '@/lib/env';
import { customsKeys } from '@/lib/queryKeys';
import type { InviteSummary } from '@/lib/customs/tasks';

export type DocKind = 'final_invoice' | 'proforma' | 'packing_list' | 'product_sheet' | 'photos' | 'certificate_origin' | 'other';
export const DOC_KINDS: DocKind[] = ['final_invoice', 'proforma', 'packing_list', 'product_sheet', 'photos', 'certificate_origin', 'other'];

export interface InviteDocument { id: string; kind: DocKind; file_path: string; file_name: string | null; mime: string; size_bytes: number; note: string | null; created_at: string }
export interface Invite extends InviteSummary {
  supplier_contact: string | null;
  language: 'zh' | 'en' | 'fr';
  requested: DocKind[];
  message: string | null;
  classification_id: string | null;
  expires_at: string;
  documents: InviteDocument[];
}

type RpcResult<T> = ({ success: true } & T) | { success: false; error?: string };
async function rpcJson<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  const res = data as unknown as RpcResult<T>;
  if (!res || res.success !== true) throw new Error((res as { error?: string })?.error || 'Opération refusée');
  return res as T;
}

export function useMyInvites(enabled = true) {
  return useQuery({
    queryKey: customsKeys.invites(),
    queryFn: async () => (await rpcJson<{ invites: Invite[] }>('customs_my_invites')).invites,
    enabled,
    staleTime: 15_000,
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { supplierName: string; requested: DocKind[]; contact?: string; language: 'zh' | 'en' | 'fr'; message?: string; dueOn?: string | null; classificationId?: string | null }) =>
      rpcJson<{ id: string; token: string }>('customs_invite_create', {
        p_supplier_name: v.supplierName, p_requested: v.requested, p_supplier_contact: v.contact || null, p_language: v.language,
        p_message: v.message || null, p_due_on: v.dueOn || null, p_classification_id: v.classificationId || null,
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: customsKeys.invites() }); },
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rpcJson('customs_invite_revoke', { p_id: id }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: customsKeys.invites() }); },
  });
}

/** Un nouveau lien pour la même invitation (l'ancien cesse de marcher). */
export function useRotateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rpcJson<{ id: string; token: string }>('customs_invite_rotate', { p_id: id }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: customsKeys.invites() }); },
  });
}

/** Les documents déposés dans SON dossier, signés pour une heure avec la session du client. */
export function useMyDocumentUrls(paths: string[]) {
  return useQuery({
    queryKey: [...customsKeys.all, 'my-documents', ...paths] as const,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('customs-documents').createSignedUrls(paths, 3600);
      if (error) throw new Error(error.message);
      return Object.fromEntries((data ?? []).filter((d) => d.path && d.signedUrl).map((d) => [d.path!, d.signedUrl]));
    },
    enabled: paths.length > 0,
    staleTime: 30 * 60_000,
  });
}

/** Le lien à envoyer au fournisseur. */
export const supplierLink = (token: string) => `${window.location.origin}/f/${token}`;

// ─── Côté fournisseur (sans compte) ─────────────────────────────────────────

export interface PublicInvite {
  supplier_name: string;
  language: 'zh' | 'en' | 'fr';
  requested: DocKind[];
  message: string | null;
  due_on: string | null;
  expires_at: string;
  importer: string | null;
  documents: { kind: DocKind; file_name: string | null; created_at: string }[];
}

export function useSupplierInvite(token: string | undefined) {
  return useQuery({
    queryKey: customsKeys.supplierInvite(token),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('customs_invite_public' as never, { p_token: token } as never);
      if (error) throw new Error(error.message);
      const res = data as unknown as { success: boolean; invite?: PublicInvite };
      return res.success ? res.invite! : null;
    },
    enabled: !!token,
    retry: 1,
  });
}

export function useSupplierUpload(token: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { kind: DocKind; file: File; note?: string }) => {
      const form = new FormData();
      form.set('token', token ?? '');
      form.set('kind', v.kind);
      if (v.note) form.set('note', v.note);
      form.set('file', v.file);
      const res = await fetch(`${VITE_SUPABASE_URL}/functions/v1/customs-supplier`, {
        method: 'POST',
        headers: { apikey: VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      // Le code d'erreur est traduit par la page (chinois, anglais, français).
      if (!res.ok || data.success !== true) throw new Error(data.error || 'server');
      return data;
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: customsKeys.supplierInvite(token) }); },
  });
}
