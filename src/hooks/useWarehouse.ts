// ============================================================
// Les hooks de l'entrepôt de Douala — sous-app « /w » (session admin,
// supabaseAdmin). Toutes les RPC renvoient { success, error?, ... } ; un
// refus n'est jamais pris pour un succès. Gardes : canReceiveAtDestination
// (pointer), canReleaseParcels (remettre), canCollectParcelPayments (encaisser).
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import type { ClientAtWarehouse, Release, WarehouseDay, WarehouseParcel } from '@/lib/warehouse';

type RpcResult<T> = ({ success: true } & T) | { success: false; error?: string; code?: string };

export class UnknownCodeError extends Error { constructor(public code: string) { super('unknown_code'); } }
export class UnpaidError extends Error { constructor(message: string) { super(message); } }

async function rpcJson<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  const res = data as unknown as RpcResult<T>;
  if (!res || res.success !== true) {
    const r = res as { error?: string; code?: string };
    if (r?.error === 'unknown_code') throw new UnknownCodeError(r.code ?? '');
    if (r?.code === 'unpaid') throw new UnpaidError(r.error ?? 'Devis non soldé');
    throw new Error(r?.error || 'Opération refusée');
  }
  return res as T;
}

export const WH_KEYS = {
  day: ['warehouse', 'day'] as const,
  arrival: (kind: string, id: string) => ['warehouse', 'arrival', kind, id] as const,
  client: (code: string) => ['warehouse', 'client', code] as const,
  release: (id: string) => ['warehouse', 'release', id] as const,
};

export function useWarehouseDay(enabled = true) {
  return useQuery({ queryKey: WH_KEYS.day, queryFn: () => rpcJson<WarehouseDay>('warehouse_day'), staleTime: 15_000, refetchInterval: 60_000, enabled });
}

export function useWarehouseArrival(kind: 'air' | 'sea' | undefined, id: string | undefined) {
  return useQuery({
    queryKey: WH_KEYS.arrival(kind ?? '', id ?? ''),
    queryFn: () => rpcJson<{ kind: 'air' | 'sea'; id: string; label: string; sub: string | null; parcels: WarehouseParcel[] }>('warehouse_arrival_parcels', { p_kind: kind, p_id: id }),
    enabled: !!kind && !!id,
    staleTime: 10_000,
  });
}

function useWhMutation<TArgs, TOut>(name: string, args: (a: TArgs) => Record<string, unknown>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: TArgs) => rpcJson<TOut>(name, args(a)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouse'] }); qc.invalidateQueries({ queryKey: ['reception'] }); qc.invalidateQueries({ queryKey: ['cargo'] }); if (success) toast.success(success); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useCheckinParcel = () => useWhMutation<{ parcelId: string; location?: string; condition?: 'ok' | 'damaged'; note?: string }, { parcel: WarehouseParcel }>(
  'warehouse_checkin_parcel', (a) => ({ p_parcel_id: a.parcelId, p_location: a.location ?? null, p_condition: a.condition ?? 'ok', p_note: a.note ?? null }),
);
export const useCheckinMany = () => useWhMutation<{ parcelIds: string[]; location?: string }, { checked: number }>(
  'warehouse_checkin_many', (a) => ({ p_parcel_ids: a.parcelIds, p_location: a.location ?? null }),
);
export const useFlagMissing = () => useWhMutation<{ parcelId: string; missing: boolean; note?: string }, { parcel: WarehouseParcel }>(
  'warehouse_flag_missing', (a) => ({ p_parcel_id: a.parcelId, p_missing: a.missing, p_note: a.note ?? null }),
);

/** Trouver un colis par son numéro (tapé ou scanné). */
export function useFindParcel() {
  return useMutation({ mutationFn: (query: string) => rpcJson<{ parcel: WarehouseParcel }>('warehouse_find_parcel', { p_query: query }).then((r) => r.parcel) });
}

/** Le client qui se présente : ses colis prêts, pas encore là, ses devis. */
export function useClientAtWarehouse(code: string | undefined) {
  return useQuery({
    queryKey: WH_KEYS.client(code ?? ''),
    queryFn: () => rpcJson<ClientAtWarehouse>('warehouse_client_parcels', { p_code: code }),
    enabled: !!code,
    staleTime: 5_000,
    retry: (n, e) => !(e instanceof UnknownCodeError) && n < 2,
  });
}

/** La signature du bon de retrait : un PNG dans le seau privé. Renvoie le chemin. */
export async function uploadSignature(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  if (blob.type !== 'image/png' || blob.size > 1_048_576) throw new Error('Signature illisible : refaites signer');
  const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const { error } = await supabaseAdmin.storage.from('parcel-signatures').upload(path, blob, { contentType: 'image/png', upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export function useSignatureUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['warehouse', 'signature', path],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.storage.from('parcel-signatures').createSignedUrl(path as string, 3600);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: 50 * 60_000,
  });
}

export function useReleaseParcels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { parcelIds: string[]; pickedByName: string; pickedByPhone?: string; signaturePath?: string | null; note?: string }) =>
      rpcJson<{ release: Release }>('warehouse_release_parcels', { p_parcel_ids: a.parcelIds, p_picked_by_name: a.pickedByName, p_picked_by_phone: a.pickedByPhone ?? null, p_signature_path: a.signaturePath ?? null, p_note: a.note ?? null }).then((r) => r.release),
    onSuccess: (rel) => { qc.setQueryData(WH_KEYS.release(rel.id), rel); qc.invalidateQueries({ queryKey: ['warehouse'] }); qc.invalidateQueries({ queryKey: ['reception'] }); qc.invalidateQueries({ queryKey: ['cargo'] }); },
    onError: (e: Error) => { if (!(e instanceof UnpaidError)) toast.error(e.message); },
  });
}

export function useRelease(id: string | undefined) {
  return useQuery({
    queryKey: WH_KEYS.release(id ?? ''),
    queryFn: () => rpcJson<{ release: Release }>('warehouse_release_get', { p_release_id: id }).then((r) => r.release),
    enabled: !!id,
  });
}
