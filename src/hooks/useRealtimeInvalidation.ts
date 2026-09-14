/**
 * Subscribes to Supabase Realtime postgres_changes for EVERY table the app
 * reads, and invalidates the matching React Query caches on each change.
 *
 * Two separate channels because the client app and the admin/agent app
 * use isolated Supabase sessions (different storageKeys) and therefore
 * different RLS evaluations — a single shared channel would lose events
 * for one of them.
 *
 * Coverage:
 *   - Client app (supabase):       deposits, payments, wallets, proofs,
 *                                  ledger, rates, beneficiaries, notifications
 *   - Admin/Agent app (supabaseAdmin): the above PLUS clients, user_roles,
 *                                  audit logs
 *
 * Performance note: Supabase advises switching to private Broadcast channels
 * if you exceed ~1000 concurrent subscribers or hit RLS perf walls.
 * https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
 */

import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { ACTION_BADGE_KEYS } from '@/hooks/useAdminNotifications';
import {
  depositKeys,
  paymentKeys,
  walletKeys,
  ledgerKeys,
  clientKeys,
  rateKeys,
  beneficiaryKeys,
  notificationKeys,
  adminKeys,
  dashboardKeys,
} from '@/lib/queryKeys';

// Every table the app touches → the query key prefixes that depend on it.
// Keep prefixes only (not full keyed queries) so prefix-matching invalidation
// catches every descendant key without us enumerating them.
const CARGO_KEY = ['cargo'] as const;
const TABLE_INVALIDATIONS: Record<string, ReadonlyArray<readonly unknown[]>> = {
  deposits:                [depositKeys.all, dashboardKeys.all],
  deposit_proofs:          [depositKeys.all],
  deposit_timeline_events: [depositKeys.all],
  payments:                [paymentKeys.all, dashboardKeys.all],
  payment_proofs:          [paymentKeys.all],
  payment_timeline_events: [paymentKeys.all],
  wallets:                 [walletKeys.all, dashboardKeys.all],
  ledger_entries:          [ledgerKeys.all, walletKeys.all, dashboardKeys.all],
  clients:                 [clientKeys.all, dashboardKeys.all],
  beneficiaries:           [beneficiaryKeys.all],
  daily_rates:             [rateKeys.all],
  rate_adjustments:        [rateKeys.all],
  user_roles:              [adminKeys.all],
  admin_audit_logs:        [adminKeys.all],
  // Cargo : tout est sous le préfixe ['cargo', …] (useCargo.ts). Le cron
  // cargo-sync et un second admin écrivent ces tables sans passer par l'app.
  cargo_shipments:         [CARGO_KEY],
  cargo_events:            [CARGO_KEY],
  cargo_costs:             [CARGO_KEY],
  cargo_packages:          [CARGO_KEY],
  cargo_documents:         [CARGO_KEY],
  cargo_lookups:           [CARGO_KEY],
};

// Tables the CLIENT app cares about (subset — RLS hides the rest anyway,
// but narrower subscriptions save bandwidth and RLS eval cost on the server).
/** Radicaux des clés tapées à la main que chaque table doit rafraîchir. */
const TABLE_STEMS: Record<string, readonly string[]> = {
  deposits:                ['deposit'],
  deposit_proofs:          ['deposit'],
  deposit_timeline_events: ['deposit'],
  payments:                ['payment'],
  payment_proofs:          ['payment'],
  payment_timeline_events: ['payment'],
  wallets:                 ['wallet', 'client'],
  ledger_entries:          ['ledger', 'wallet', 'client'],
  clients:                 ['client'],
  beneficiaries:           ['benef'],
  daily_rates:             ['rate'],
  rate_adjustments:        ['rate'],
  user_roles:              ['admin'],
};

const CLIENT_TABLES = [
  'deposits',
  'deposit_proofs',
  'deposit_timeline_events',
  'payments',
  'payment_proofs',
  'payment_timeline_events',
  'wallets',
  'ledger_entries',
  'beneficiaries',
  'daily_rates',
] as const;

// Tables the ADMIN/AGENT app cares about (everything).
const ADMIN_TABLES = Object.keys(TABLE_INVALIDATIONS);

function subscribeTables(
  client: SupabaseClient,
  channelName: string,
  tables: readonly string[],
  queryClient: QueryClient,
) {
  const channel = client.channel(channelName);

  tables.forEach((table) => {
    channel.on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: '*', schema: 'public', table },
      () => {
        const prefixes = TABLE_INVALIDATIONS[table] ?? [];
        for (const key of prefixes) {
          queryClient.invalidateQueries({ queryKey: key as readonly unknown[] });
        }
        // Clés « historiques » tapées à la main ('admin-deposits-paginated',
        // 'admin-deposit-proofs', 'deposit-stats', 'client-ledger', …) : elles
        // ne descendent pas des fabriques. On invalide toute query dont le
        // premier segment contient le radical de la table — c'est le filet
        // qui manquait : la preuve envoyée par le client n'apparaissait pas
        // sur la fiche admin ouverte, ni dans la file « À traiter ».
        const stems = TABLE_STEMS[table] ?? [];
        if (stems.length) {
          queryClient.invalidateQueries({
            predicate: (q) => typeof q.queryKey[0] === 'string' && stems.some((st) => (q.queryKey[0] as string).includes(st)),
          });
        }
        if (table === 'deposits' || table === 'payments') {
          for (const k of ACTION_BADGE_KEYS) queryClient.invalidateQueries({ queryKey: k });
        }
      },
    );
  });

  channel.subscribe();
  return channel;
}

export function useClientRealtimeInvalidation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Dépend de l'identifiant, pas de l'objet `user` (recréé à chaque
  // TOKEN_REFRESHED) ; nom de canal unique pour que le retrait asynchrone de
  // l'ancien canal ne tue pas le nouveau — même correctif que côté admin.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const channel = subscribeTables(
      supabase,
      `client-realtime-${userId}:${Date.now()}`,
      CLIENT_TABLES,
      queryClient,
    );
    // Notifications is its own case — RLS-scoped per user
    channel.on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    );
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

export function useAdminRealtimeInvalidation() {
  const queryClient = useQueryClient();
  const { isAuthenticated, currentUser } = useAdminAuth();

  // On dépend de l'IDENTITÉ (l'id), pas de l'objet : AdminAuthContext pose un
  // nouvel objet `currentUser` à chaque rafraîchissement de jeton (toutes les
  // heures, et à chaque retour au premier plan sur iOS). Avec l'objet en
  // dépendance, l'effet se relançait : `removeChannel` est asynchrone, et
  // `channel('admin-realtime-invalidation')` rendait le MÊME canal en train
  // de partir — `subscribe()` ne faisait rien, le canal était retiré à l'ack,
  // et les listes cessaient de se mettre à jour en direct. D'où aussi un nom
  // de canal unique par abonnement.
  const adminId = currentUser?.id ?? null;
  useEffect(() => {
    if (!isAuthenticated || !adminId) return;
    const channel = subscribeTables(
      supabaseAdmin,
      `admin-realtime-invalidation:${adminId}:${Date.now()}`,
      ADMIN_TABLES,
      queryClient,
    );
    return () => {
      supabaseAdmin.removeChannel(channel);
    };
  }, [isAuthenticated, adminId, queryClient]);
}

/**
 * Headless components that mount the realtime subscriptions. Render
 * AdminRealtimeListener inside AdminAuthProvider; ClientRealtimeListener
 * inside AuthProvider.
 */
export function AdminRealtimeListener() {
  useAdminRealtimeInvalidation();
  return null;
}

export function ClientRealtimeListener() {
  useClientRealtimeInvalidation();
  return null;
}
