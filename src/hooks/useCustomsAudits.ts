// ============================================================
// « Vérifier ma déclaration » — les audits de DAU du CLIENT (app client,
// session `supabase`). La DAU est déposée dans le seau customs-documents,
// l'edge function customs-ai la lit (read_dau, en arrière-plan), l'app la
// juge (src/lib/customs/audit.ts) et enregistre les constats, puis le client
// l'envoie au commissionnaire agréé.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { customsKeys } from '@/lib/queryKeys';
import { compressImages } from '@/lib/imageCompression';
import type { AuditRecord } from '@/lib/customs/files';
import type { Finding } from '@/lib/customs/audit';
import { callCustomsAi, uploadCustomsFiles } from './useCustomsFiles';

type RpcResult<T> = ({ success: true } & T) | { success: false; error?: string };

async function rpcJson<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  const res = data as unknown as RpcResult<T>;
  if (!res || res.success !== true) throw new Error((res as { error?: string })?.error || 'Opération refusée');
  return res as T;
}

export function useAudit(id: string | undefined) {
  return useQuery({
    queryKey: customsKeys.audit(id),
    queryFn: async () => (await rpcJson<{ audit: AuditRecord }>('customs_audit_get', { p_id: id })).audit,
    enabled: !!id,
    // La lecture prend une à trois minutes : on regarde souvent. Chez le CAD : de temps en temps.
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'reading' ? 3_000 : s === 'submitted' || s === 'in_review' ? 30_000 : false;
    },
  });
}

export function useCreateAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { files: File[]; dauNumber?: string; paidOn?: string | null }) => {
      // Des photos de DAU : on garde de quoi lire les chiffres (2 400 px).
      const paths = await uploadCustomsFiles(await compressImages(v.files, 2400, 0.85));
      const created = await rpcJson<{ id: string; ref: string }>('customs_audit_create', {
        p_file_paths: paths, p_dau_number: v.dauNumber?.trim() || null, p_paid_on: v.paidOn || null,
      });
      // La lecture part tout de suite ; si elle ne démarre pas, l'écran de l'audit propose de la relancer.
      await callCustomsAi({ action: 'read_dau', audit_id: created.id }).catch(() => undefined);
      return created;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: customsKeys.myFiles() }); },
  });
}

export function useReadDau(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callCustomsAi({ action: 'read_dau', audit_id: id }),
    onSettled: () => { void qc.invalidateQueries({ queryKey: customsKeys.audit(id) }); },
  });
}

/** Les constats du moteur, pour la file du CAD et la liste du client (indicatifs). */
export function useSaveFindings(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { findings: Finding[]; paid: number; savings: number }) =>
      rpcJson('customs_audit_save_findings', {
        p_id: id, p_findings: v.findings, p_total_paid_xaf: Math.round(v.paid), p_overpaid_xaf: Math.max(0, Math.round(v.savings)),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: customsKeys.audit(id) });
      void qc.invalidateQueries({ queryKey: customsKeys.myFiles() });
    },
  });
}

export function useSubmitAudit(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => rpcJson('customs_audit_submit', { p_id: id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: customsKeys.audit(id) });
      void qc.invalidateQueries({ queryKey: customsKeys.myFiles() });
    },
  });
}

export function useCancelAudit(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => rpcJson('customs_audit_cancel', { p_id: id }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: customsKeys.myFiles() }); },
  });
}

/** Les pièces de SES audits, signées pour une heure avec la session du client. */
export function useMyAuditFileUrls(paths: string[] | undefined) {
  return useQuery({
    queryKey: [...customsKeys.all, 'my-audit-files', ...(paths ?? [])] as const,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('customs-documents').createSignedUrls(paths ?? [], 3600);
      if (error) throw new Error(error.message);
      return (data ?? []).map((d) => ({ path: d.path ?? '', url: d.signedUrl })).filter((d) => !!d.url);
    },
    enabled: !!paths?.length,
    staleTime: 30 * 60_000,
  });
}
