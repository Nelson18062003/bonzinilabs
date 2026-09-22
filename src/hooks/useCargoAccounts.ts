// ============================================================
// Les comptes cargo : les gros clients (PRC, Simon D1, Fabrice B1…) qui
// consolident leurs propres clients dans notre entrepôt et chargent leurs
// conteneurs. Un client rattaché à un compte apparaît dans la liste de ce
// compte (l'équivalent des fichiers « un par compte » de Guangzhou).
// Toutes les requêtes passent par supabaseAdmin (app admin).
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import type { ReceptionClient } from '@/lib/reception';

export interface CargoAccount {
  id: string;
  name: string;
  code: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
  client_count: number;
  parcels_waiting: number;
  created_at: string;
}

export interface CargoAccountInput {
  id?: string | null;
  name: string;
  code?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

type RpcResult<T> = ({ success: true } & T) | { success: false; error?: string };

async function rpcJson<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  const res = data as unknown as RpcResult<T>;
  if (!res || res.success !== true) throw new Error((res as { error?: string })?.error || 'Opération refusée');
  return res as T;
}

export const ACCOUNT_KEYS = { list: (all: boolean) => ['cargo', 'accounts', all ? 'all' : 'active'] as const };

export function useCargoAccounts(includeInactive = false) {
  return useQuery({
    queryKey: ACCOUNT_KEYS.list(includeInactive),
    queryFn: () => rpcJson<{ accounts: CargoAccount[] }>('cargo_account_list', { p_include_inactive: includeInactive }).then((r) => r.accounts),
    staleTime: 30_000,
  });
}

/** Les clients rattachés à un compte, avec ce qui attend pour chacun. */
export function useCargoAccountClients(accountId: string | null | undefined) {
  return useQuery({
    queryKey: ['cargo', 'accounts', 'clients', accountId],
    queryFn: () => rpcJson<{ clients: { client: ReceptionClient; parcels_waiting: number }[] }>('cargo_account_clients', { p_account_id: accountId }).then((r) => r.clients),
    enabled: !!accountId,
    staleTime: 30_000,
  });
}

export function useUpsertCargoAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: CargoAccountInput) => rpcJson<{ id: string }>('cargo_account_upsert', {
      p_id: a.id ?? null, p_name: a.name.trim(), p_code: a.code?.trim() || null, p_contact_name: a.contactName?.trim() || null,
      p_contact_phone: a.contactPhone?.trim() || null, p_notes: a.notes?.trim() || null, p_is_active: a.isActive ?? true,
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['cargo', 'accounts'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Rattacher un client à un compte (ou l'en détacher avec `accountId: null`). */
export function useAssignCargoAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { clientUserId: string; accountId: string | null }) => rpcJson<{ client: ReceptionClient }>('cargo_account_assign', { p_client_user_id: v.clientUserId, p_account_id: v.accountId }).then((r) => r.client),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cargo', 'accounts'] });
      void qc.invalidateQueries({ queryKey: ['reception'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
