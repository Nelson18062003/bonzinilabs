// Hooks react-query de la centrale d'achat. Enveloppent la couche
// d'accès typée (src/integrations/supabase/procurement.ts), qui parle
// aux RPC proc_* via supabaseAdmin (module ADMIN).
//
// Les écrans consomment CES hooks (jamais le client directement), pour
// l'invalidation de cache + les toasts cohérents avec le reste de l'app.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { proc } from '@/integrations/supabase/procurement';
import type { ProcMissionStatus } from '@/integrations/supabase/procurement';

const KEY = 'procurement';

// Petit utilitaire : déballe un ProcResult ou lève l'erreur (pour react-query).
async function unwrap<T>(p: Promise<({ success: true } & T) | { success: false; error: string }>): Promise<T> {
  const r = await p;
  if (!r.success) throw new Error(r.error);
  return r;
}

// ─── Lectures ───────────────────────────────────────────────
export function useProcurementDashboard(clientUserId?: string | null) {
  return useQuery({
    queryKey: [KEY, 'dashboard', clientUserId ?? 'all'],
    queryFn: () => unwrap(proc.dashboard({ p_client_user_id: clientUserId ?? null })),
    staleTime: 20_000,
  });
}

export function useMissions(status?: ProcMissionStatus | null, clientUserId?: string | null) {
  return useQuery({
    queryKey: [KEY, 'missions', status ?? 'all', clientUserId ?? 'all'],
    queryFn: () => unwrap(proc.listMissions({ p_status: status ?? null, p_client_user_id: clientUserId ?? null })),
    staleTime: 20_000,
  });
}

export function useSuppliers(search?: string, activeOnly = true) {
  return useQuery({
    queryKey: [KEY, 'suppliers', search ?? '', activeOnly],
    queryFn: () => unwrap(proc.listSuppliers({ p_search: search ?? null, p_active_only: activeOnly })),
    staleTime: 30_000,
  });
}

export function useOutstandingBalances(missionId?: string | null) {
  return useQuery({
    queryKey: [KEY, 'outstanding', missionId ?? 'all'],
    queryFn: () => unwrap(proc.outstandingBalances({ p_mission_id: missionId ?? null })),
    staleTime: 20_000,
  });
}

export function useMissionReport(missionId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'mission-report', missionId],
    queryFn: () => unwrap(proc.missionReport({ p_mission_id: missionId! })),
    enabled: !!missionId,
    staleTime: 15_000,
  });
}

export function useSupplier360(supplierId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'supplier-360', supplierId],
    queryFn: () => unwrap(proc.supplier360({ p_supplier_id: supplierId! })),
    enabled: !!supplierId,
    staleTime: 15_000,
  });
}

export function usePurchaseOrder(poId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'po', poId],
    queryFn: () => unwrap(proc.purchaseOrderDetail({ p_purchase_order_id: poId! })),
    enabled: !!poId,
    staleTime: 15_000,
  });
}

// ─── Écritures (mutations) ──────────────────────────────────
// Fabrique générique : appelle une RPC d'écriture, toast + invalidation.
function useProcMutation<TArgs, TOut>(
  fn: (a: TArgs) => Promise<({ success: true } & TOut) | { success: false; error: string }>,
  successMsg: string | ((r: TOut) => string),
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: TArgs) => unwrap(fn(a)),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      toast.success(typeof successMsg === 'function' ? successMsg(r) : successMsg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useCreateMission = () => useProcMutation(proc.createMission, 'Mission créée');
export const useUpdateMission = () => useProcMutation(proc.updateMission, 'Mission mise à jour');
export const useUpsertSupplier = () =>
  useProcMutation(proc.upsertSupplier, (r) => (r.created ? 'Fournisseur créé' : 'Fournisseur mis à jour'));
export const useCreatePurchaseOrder = () => useProcMutation(proc.createPurchaseOrder, 'Commande créée');
export const useUpdatePurchaseOrder = () => useProcMutation(proc.updatePurchaseOrder, 'Commande mise à jour');
export const useAddOrderLine = () => useProcMutation(proc.addOrderLine, 'Ligne ajoutée');
export const useSetCommission = () => useProcMutation(proc.setCommission, 'Commission enregistrée');
export const useAttachDocument = () => useProcMutation(proc.attachDocument, 'Preuve jointe');
export const useRecordQc = () => useProcMutation(proc.recordQc, 'Inspection QC enregistrée');
export const useLogProductionEvent = () => useProcMutation(proc.logProductionEvent, 'Événement de production enregistré');
export const useRecordExpense = () => useProcMutation(proc.recordExpense, 'Frais enregistré');
export const useVoidRecord = () => useProcMutation(proc.voidRecord, 'Enregistrement annulé');

export const useRecordSupplierPayment = () =>
  useProcMutation(proc.recordSupplierPayment, (r) =>
    r.warning_no_qc_pass
      ? `Paiement enregistré. Attention : aucun QC « pass » sur cette commande.`
      : `Paiement enregistré. Reste à payer : ${r.outstanding_after?.toLocaleString('fr-FR')}`,
  );
