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
import { packableParcels, type AirPackage, type PackableBoard } from '@/lib/airPackage';
import type { Deposit, ReceptionClient } from '@/lib/reception';

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

let heavyRefresh: ReturnType<typeof setTimeout> | null = null;

/**
 * Un paquet change : ses listes, sa fiche, l'expédition, la réception et Douala
 * se rafraîchissent. `fresh` : la fiche que la réponse vient d'écrire (pas la
 * peine de la relire). Les grandes listes (réception, cargo, Douala) attendent
 * la fin d'une rafale de scans : une seule relecture, pas une par colis.
 */
export function invalidatePackages(qc: QueryClient, fresh?: string) {
  void qc.invalidateQueries({ queryKey: PACKAGE_KEYS.all, predicate: (q) => !(fresh && q.queryKey[1] === 'one' && q.queryKey[2] === fresh) });
  if (heavyRefresh) clearTimeout(heavyRefresh);
  heavyRefresh = setTimeout(() => {
    heavyRefresh = null;
    void qc.invalidateQueries({ queryKey: ['cargo'] });
    void qc.invalidateQueries({ queryKey: ['reception'] });
    void qc.invalidateQueries({ queryKey: ['warehouse'] });
  }, 400);
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

/** Les colis à emballer, et s'il en reste au-delà de ceux lus (300 dépôts). */
export type PackableList = PackableBoard & { truncated: boolean };

const toPackable = (r: { truncated: boolean; deposits: Deposit[] }): PackableList => ({ ...packableParcels(r.deposits), truncated: r.truncated });

/**
 * Ce qui attend un paquet : les colis avion du bureau, prêts ou à compléter
 * (sans client, pas pesé) — air_package_packable, lisible par la réception
 * (canReceiveParcels) sans l'accès à la console cargo. Sous ['reception'] :
 * un dépôt fermé, un colis pesé ou un paquet rempli la rafraîchissent.
 */
export function usePackableParcels(enabled = true) {
  return useQuery({
    queryKey: ['reception', 'packable'] as const,
    queryFn: () => rpcJson<{ total: number; truncated: boolean; deposits: Deposit[] }>('air_package_packable', { p_limit: 300 }),
    select: toPackable,
    enabled,
    staleTime: 15_000,
    retry: 1,
  });
}

/**
 * La pastille de l'onglet Paquets : les colis qui attendent un paquet (prêts +
 * à compléter ; un colis de plus de 32 kg part seul et ne compte pas), sans
 * relire les dépôts — air_package_packable avec p_limit = 0.
 */
export function usePackableCount(enabled = true) {
  return useQuery({
    queryKey: ['reception', 'packable', 'count'] as const,
    queryFn: () => rpcJson<{ ready_count?: number; to_fix_count?: number }>('air_package_packable', { p_limit: 0 })
      .then((r) => (Number(r.ready_count) || 0) + (Number(r.to_fix_count) || 0)),
    enabled,
    staleTime: 30_000,
    retry: false,
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
      invalidatePackages(qc, packageId);
    },
  });
}

/** Ce qu'a donné une mise en paquet : chaque paquet rempli (créé ou complété), et les refus du serveur. */
export interface PackRunResult {
  packages: {
    /** Vide si le paquet n'a pas pu être créé (`error`). */
    id: string;
    package_no: string;
    created: boolean;
    /** Créé pour l'occasion puis supprimé : aucun de ses colis n'a été accepté. */
    dropped: boolean;
    added: string[];
    refused: { parcel_no: string; error: string }[];
    /** Le paquet lui-même a échoué (création impossible) : ses colis n'ont pas bougé. */
    error: string | null;
  }[];
}

/** Au-delà, une mise en paquet se fait en plusieurs fois : un appel au serveur par colis. */
export const MAX_PACK_PARCELS = 200;

/**
 * Mettre des colis en paquet(s), selon un plan (planPacking) : chaque paquet
 * nouveau se crée, puis ses colis y entrent un par un — le serveur revérifie
 * chacun (client, pesée, 32 kg). Un échec ne perd jamais ce qui est déjà fait :
 * il est noté sur la ligne de son paquet, et la suite continue. Un paquet créé
 * qui reste vide est supprimé aussitôt. `onProgress` : colis traités / total.
 */
export function usePackParcels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bins, onProgress }: {
      bins: { packageId: string | null; packageNo: string | null; parcelNos: string[] }[];
      onProgress?: (done: number, total: number) => void;
    }): Promise<PackRunResult> => {
      const total = bins.reduce((t, b) => t + b.parcelNos.length, 0);
      if (total > MAX_PACK_PARCELS) throw new Error(`${MAX_PACK_PARCELS} colis au plus à la fois : allégez la sélection`);
      let done = 0;
      const out: PackRunResult = { packages: [] };
      try {
        for (const bin of bins) {
          if (bin.parcelNos.length === 0) continue;
          const row: PackRunResult['packages'][number] = { id: bin.packageId ?? '', package_no: bin.packageNo ?? '', created: !bin.packageId, dropped: false, added: [], refused: [], error: null };
          out.packages.push(row);
          if (!bin.packageId) {
            try {
              const pkg = (await rpcJson<{ package: AirPackage }>('air_package_create', { p_notes: null })).package;
              row.id = pkg.id;
              row.package_no = pkg.package_no;
            } catch (e) {
              row.error = (e as Error).message;
              done += bin.parcelNos.length;
              onProgress?.(done, total);
              continue;
            }
          }
          for (const no of bin.parcelNos) {
            try {
              const r = await rpcJson<AddParcelResult>('air_package_add_parcel', { p_package_id: row.id, p_code: no });
              row.added.push(r.parcel_no);
            } catch (e) {
              row.refused.push({ parcel_no: no, error: (e as Error).message });
            }
            done += 1;
            onProgress?.(done, total);
          }
          if (row.created && row.added.length === 0) {
            await rpcJson<object>('air_package_delete', { p_package_id: row.id }).then(() => { row.dropped = true; }, () => undefined);
          }
        }
        return out;
      } finally {
        invalidatePackages(qc);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveParcelFromPackage(packageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (parcelId: string) => rpcJson<{ package: AirPackage }>('air_package_remove_parcel', { p_parcel_id: parcelId }).then((r) => r.package),
    onSuccess: (pkg) => {
      qc.setQueryData(PACKAGE_KEYS.one(packageId), pkg);
      invalidatePackages(qc, packageId);
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
      invalidatePackages(qc, packageId);
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
      invalidatePackages(qc, packageId);
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
