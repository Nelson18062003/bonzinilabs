// ============================================================
// Les paquets avion de 32 kg — hooks partagés par la réception de Guangzhou
// (/r), l'expédition (/m/cargo/avion) et l'entrepôt de Douala (/w).
// Sessions du personnel : supabaseAdmin. Chaque RPC vérifie le droit côté
// serveur (canReceiveParcels · canManageCargo · canReceiveAtDestination) ;
// un refus { success: false } n'est jamais pris pour un succès.
// ============================================================
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import type { AirPackage } from '@/lib/airPackage';
import type { ReceptionClient } from '@/lib/reception';

type RpcResult<T> = ({ success: true } & T) | { success: false; error?: string };

/** Erreur d'une RPC refusée : garde la réponse complète (ex. « over » : 32 kg dépassés). */
export class PackageRpcError extends Error {
  constructor(message: string, readonly payload: Record<string, unknown>) {
    super(message);
  }
}

async function rpcJson<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  const res = data as unknown as RpcResult<T>;
  if (!res || res.success !== true) {
    const payload = (res ?? {}) as Record<string, unknown>;
    throw new PackageRpcError((payload.error as string) || 'Opération refusée', payload);
  }
  return res as T;
}

export const PACKAGE_KEYS = {
  all: ['air-packages'] as const,
  list: (scope: string, airId?: string | null) => ['air-packages', 'list', scope, airId ?? null] as const,
  one: (id: string) => ['air-packages', 'one', id] as const,
};

/** Un paquet change : ses listes, sa fiche, l'expédition, la réception et Douala se rafraîchissent. */
export function invalidatePackages(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: PACKAGE_KEYS.all });
  void qc.invalidateQueries({ queryKey: ['cargo'] });
  void qc.invalidateQueries({ queryKey: ['reception'] });
  void qc.invalidateQueries({ queryKey: ['warehouse'] });
}

/** 'bureau' : pas encore partis (en cours, fermés, refusés, affectés à une expédition pas partie) ; 'all' : les 300 derniers. */
export function useAirPackages(scope: 'bureau' | 'all' = 'bureau', airId?: string | null, enabled = true) {
  return useQuery({
    queryKey: PACKAGE_KEYS.list(scope, airId),
    queryFn: () => rpcJson<{ packages: AirPackage[] }>('air_package_list', { p_scope: scope, p_air_id: airId ?? null }).then((r) => r.packages),
    enabled,
    staleTime: 10_000,
  });
}

export function useAirPackage(id: string | null | undefined) {
  return useQuery({
    queryKey: PACKAGE_KEYS.one(id ?? ''),
    queryFn: () => rpcJson<{ package: AirPackage }>('air_package_get', { p_package_id: id }).then((r) => r.package),
    enabled: !!id,
    staleTime: 5_000,
  });
}

/** Un paquet par son code scanné (PQ-…), à la demande. */
export function useFindAirPackage() {
  return useMutation({
    mutationFn: (code: string) => rpcJson<{ package: AirPackage }>('air_package_get', { p_code: code }).then((r) => r.package),
  });
}

export function useCreateAirPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notes?: string) => rpcJson<{ package: AirPackage }>('air_package_create', { p_notes: notes?.trim() || null }).then((r) => r.package),
    onSuccess: () => invalidatePackages(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface AddParcelResult {
  already: boolean;
  parcel_no: string;
  weight_kg?: number;
  client?: ReceptionClient | null;
  package: AirPackage;
}

/** Ajouter un colis par son code (scan de l'étiquette). Le refus remonte en erreur (l'écran l'affiche et bipe). */
export function useAddParcelToPackage(packageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => rpcJson<AddParcelResult>('air_package_add_parcel', { p_package_id: packageId, p_code: code }),
    onSuccess: (r) => {
      qc.setQueryData(PACKAGE_KEYS.one(packageId), r.package);
      invalidatePackages(qc);
    },
  });
}

export function useRemoveParcelFromPackage(packageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (parcelId: string) => rpcJson<{ package: AirPackage }>('air_package_remove_parcel', { p_parcel_id: parcelId }).then((r) => r.package),
    onSuccess: (pkg) => {
      qc.setQueryData(PACKAGE_KEYS.one(packageId), pkg);
      invalidatePackages(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface SealInput {
  grossWeightKg: number;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
}

export function useSealAirPackage(packageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: SealInput) =>
      rpcJson<{ package: AirPackage }>('air_package_seal', {
        p_package_id: packageId,
        p_gross_weight_kg: v.grossWeightKg,
        p_length_cm: v.lengthCm ?? null,
        p_width_cm: v.widthCm ?? null,
        p_height_cm: v.heightCm ?? null,
      }).then((r) => r.package),
    onSuccess: (pkg) => {
      qc.setQueryData(PACKAGE_KEYS.one(packageId), pkg);
      invalidatePackages(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReopenAirPackage(packageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => rpcJson<{ package: AirPackage }>('air_package_reopen', { p_package_id: packageId }).then((r) => r.package),
    onSuccess: (pkg) => {
      qc.setQueryData(PACKAGE_KEYS.one(packageId), pkg);
      invalidatePackages(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAirPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packageId: string) => rpcJson<object>('air_package_delete', { p_package_id: packageId }),
    onSuccess: () => invalidatePackages(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ── Expédition ────────────────────────────────────────────────────────── */

export function useAssignAirPackages(airId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packageIds: string[]) =>
      rpcJson<{ assigned: number; parcels: number; skipped: string[] }>('air_package_assign', { p_air_id: airId, p_package_ids: packageIds }),
    onSuccess: (r) => {
      invalidatePackages(qc);
      toast.success(`${r.assigned} paquet${r.assigned > 1 ? 's' : ''} affecté${r.assigned > 1 ? 's' : ''} (${r.parcels} colis)`);
      if (r.skipped?.length) toast.warning(`Non affectés : ${r.skipped.join(', ')}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnassignAirPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packageId: string) => rpcJson<{ package: AirPackage }>('air_package_unassign', { p_package_id: packageId }).then((r) => r.package),
    onSuccess: (pkg) => {
      invalidatePackages(qc);
      toast.success(`Paquet ${pkg.package_no} retiré de l’expédition`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface DepartureScanResult {
  already: boolean;
  package_no: string;
  scanned: number;
  total: number;
}

/** Scan au départ : le refus remonte en erreur (l'écran l'affiche et bipe). */
export function useScanPackageDeparture(airId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => rpcJson<DepartureScanResult>('air_package_scan_departure', { p_air_id: airId, p_code: code }),
    onSuccess: () => invalidatePackages(qc),
  });
}

export function useRefuseAirPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ packageId, reason }: { packageId: string; reason: string }) =>
      rpcJson<{ parcels: number; clients_told_departed: boolean; package: AirPackage }>('air_package_refuse', { p_package_id: packageId, p_reason: reason.trim() }),
    onSuccess: () => invalidatePackages(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ── Douala ────────────────────────────────────────────────────────────── */

export interface ReceiveResult {
  already: boolean;
  package_no: string;
  received: number;
  total: number;
  package: AirPackage;
}

/** Recevoir un paquet à l'entrepôt (scan PQ-…) : le refus remonte en erreur. */
export function useReceiveAirPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => rpcJson<ReceiveResult>('air_package_receive', { p_code: code }),
    onSuccess: () => invalidatePackages(qc),
  });
}

export function useOpenAirPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packageId: string) => rpcJson<{ package: AirPackage }>('air_package_open', { p_package_id: packageId }).then((r) => r.package),
    onSuccess: () => invalidatePackages(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}
