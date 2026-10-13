// ============================================================
// Les hooks des expéditions aériennes — app ADMIN (supabaseAdmin).
// Toutes les RPC renvoient { success, error?, ... } ; un refus n'est jamais
// pris pour un succès. Lecture : canViewCargo · écriture : canManageCargo.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { invalidatePackages } from '@/hooks/useAirPackages';
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

export function useAirShipments(enabled = true) {
  return useQuery({
    queryKey: AIR_KEYS.list,
    queryFn: () => rpcJson<{ shipments: AirShipment[] }>('cargo_air_list').then((r) => r.shipments),
    staleTime: 15_000,
    enabled,
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

/** `inlineError` : l'écran affiche lui-même le refus (sous le bouton) — pas de toast en double. */
function useAirMutation<TArgs>(name: string, args: (a: TArgs) => Record<string, unknown>, success?: string, inlineError = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: TArgs) => rpcJson<{ shipment: AirShipment }>(name, args(a)).then((r) => r.shipment),
    onSuccess: (s) => {
      qc.setQueryData(AIR_KEYS.one(s.id), s);
      qc.invalidateQueries({ queryKey: AIR_KEYS.list });
      qc.invalidateQueries({ queryKey: ['reception'] });
      // Les paquets suivent l'expédition (partis, reçus) : /r/paquets et Douala se rafraîchissent.
      qc.invalidateQueries({ queryKey: ['air-packages'] });
      if (success) toast.success(success);
    },
    onError: (e: Error) => { if (!inlineError) toast.error(e.message); },
  });
}

export const useCreateAirShipment = () => useAirMutation<AirShipmentInput>('cargo_air_create', toArgs, 'Expédition ouverte');
export const useUpdateAirShipment = () => useAirMutation<{ id: string } & AirShipmentInput>('cargo_air_update', (a) => ({ p_air_id: a.id, ...toArgs(a) }), 'Fiche enregistrée');
export const useSetAirStatus = () => useAirMutation<{ id: string; status: AirStatus; at?: string | null }>('cargo_air_set_status', (a) => ({ p_air_id: a.id, p_status: a.status, p_at: a.at ?? null }), undefined, true);

export interface ShipResult {
  airId: string;
  /** L'expédition ouverte pour l'occasion (null : un vol qui existait). */
  created: AirShipment | null;
  assigned: number;
  parcels: number;
  skipped: string[];
  /** Le vol est ouvert mais les paquets n'ont pas pu y monter : la raison du serveur. */
  assignError: string | null;
}

/**
 * Mettre des paquets fermés sur un vol — un vol en préparation, ou un vol
 * ouvert à l'instant (`create`). Le vol ouvert reste ouvert même si les
 * paquets sont refusés : `assignError` le dit, on n'efface rien.
 */
export function useShipPackages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ airId, create, packageIds }: { airId?: string | null; create?: AirShipmentInput; packageIds: string[] }): Promise<ShipResult> => {
      let created: AirShipment | null = null;
      let id = airId ?? null;
      if (!id) {
        if (!create) throw new Error('Choisissez un vol');
        created = (await rpcJson<{ shipment: AirShipment }>('cargo_air_create', toArgs(create))).shipment;
        id = created.id;
      }
      const res: ShipResult = { airId: id, created, assigned: 0, parcels: 0, skipped: [], assignError: null };
      if (packageIds.length === 0) return res;
      try {
        const r = await rpcJson<{ assigned: number; parcels: number; skipped: string[] | null }>('air_package_assign', { p_air_id: id, p_package_ids: packageIds });
        return { ...res, assigned: r.assigned, parcels: r.parcels, skipped: r.skipped ?? [] };
      } catch (e) {
        if (!created) throw e;
        return { ...res, assignError: (e as Error).message };
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: AIR_KEYS.list });
      // Les paquets, la réception et Douala suivent (une seule relecture des grandes listes).
      invalidatePackages(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

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
