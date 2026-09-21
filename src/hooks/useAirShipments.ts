// ============================================================
// Les hooks des expéditions aériennes — app ADMIN (supabaseAdmin).
// Toutes les RPC renvoient { success, error?, ... } ; un refus n'est jamais
// pris pour un succès. Lecture : canViewCargo · écriture : canManageCargo.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import type { AirParcel, AirShipment, AirStatus } from '@/lib/airShipment';

type RpcResult<T> = ({ success: true } & T) | { success: false; error?: string };

async function rpcJson<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  const res = data as unknown as RpcResult<T>;
  if (!res || res.success !== true) throw new Error((res as { error?: string })?.error || 'Opération refusée');
  return res as T;
}

export const AIR_KEYS = {
  list: ['cargo', 'air'] as const,
  one: (id: string) => ['cargo', 'air', id] as const,
  loadable: (id: string) => ['cargo', 'air', id, 'loadable'] as const,
};

export interface AirShipmentInput {
  awbNumber?: string;
  airline?: string;
  flightNo?: string;
  etd?: string | null;
  eta?: string | null;
  origin?: string;
  destination?: string;
  freightUsd?: number | null;
  notes?: string;
}

const toArgs = (v: AirShipmentInput) => ({
  p_awb_number: v.awbNumber ?? null, p_airline: v.airline ?? null, p_flight_no: v.flightNo ?? null,
  p_etd: v.etd || null, p_eta: v.eta || null, p_origin: v.origin ?? null, p_destination: v.destination ?? null,
  p_freight_usd: v.freightUsd ?? null, p_notes: v.notes ?? null,
});

export function useAirShipments() {
  return useQuery({
    queryKey: AIR_KEYS.list,
    queryFn: () => rpcJson<{ shipments: AirShipment[] }>('cargo_air_list').then((r) => r.shipments),
    staleTime: 15_000,
  });
}

export function useAirShipment(id: string | null | undefined) {
  return useQuery({
    queryKey: AIR_KEYS.one(id ?? ''),
    queryFn: () => rpcJson<{ shipment: AirShipment }>('cargo_air_get', { p_air_id: id }).then((r) => r.shipment),
    enabled: !!id,
    staleTime: 15_000,
  });
}

function useAirMutation<TArgs>(name: string, args: (a: TArgs) => Record<string, unknown>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: TArgs) => rpcJson<{ shipment: AirShipment }>(name, args(a)).then((r) => r.shipment),
    onSuccess: (s) => {
      qc.setQueryData(AIR_KEYS.one(s.id), s);
      qc.invalidateQueries({ queryKey: AIR_KEYS.list });
      qc.invalidateQueries({ queryKey: ['reception'] });
      if (success) toast.success(success);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useCreateAirShipment = () => useAirMutation<AirShipmentInput>('cargo_air_create', toArgs, 'Expédition ouverte');
export const useUpdateAirShipment = () => useAirMutation<{ id: string } & AirShipmentInput>('cargo_air_update', (a) => ({ p_air_id: a.id, ...toArgs(a) }), 'Fiche enregistrée');
export const useSetAirStatus = () => useAirMutation<{ id: string; status: AirStatus; at?: string | null }>('cargo_air_set_status', (a) => ({ p_air_id: a.id, p_status: a.status, p_at: a.at ?? null }));

/** Ce qu'on peut mettre dans cet avion : les colis reçus, ni en boîte ni en vol. */
export function useAirLoadableParcels(id: string | null | undefined) {
  return useQuery({
    queryKey: AIR_KEYS.loadable(id ?? ''),
    queryFn: () => rpcJson<{ parcels: AirParcel[] }>('cargo_air_loadable_parcels', { p_air_id: id }).then((r) => r.parcels),
    enabled: !!id,
  });
}

export function useAirLoadParcels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { id: string; parcelIds: string[] }) =>
      rpcJson<{ loaded: number; weight_kg: number; cbm: number }>('cargo_air_load_parcels', { p_air_id: a.id, p_parcel_ids: a.parcelIds }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cargo'] }); qc.invalidateQueries({ queryKey: ['reception'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAirUnloadParcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (parcelId: string) => rpcJson<Record<string, never>>('cargo_air_unload_parcel', { p_parcel_id: parcelId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cargo'] }); qc.invalidateQueries({ queryKey: ['reception'] }); toast.success('Colis retiré de l\'avion'); },
    onError: (e: Error) => toast.error(e.message),
  });
}
