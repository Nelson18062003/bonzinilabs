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
  exchange_rates:          [rateKeys.all],
  rate_adjustments:        [rateKeys.all],
  user_roles:              [adminKeys.all],
  admin_audit_logs:        [adminKeys.all],
};

// Tables the CLIENT app cares about (subset — RLS hides the rest anyway,
// but narrower subscriptions save bandwidth and RLS eval cost on the server).
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
  'exchange_rates',
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
        // Back-compat: older hooks still use hand-typed 'admin-*' / 'my-*'
        // keys that predate the factories. Catch them by table-name heuristic
        // so the global safety net covers the legacy surface too.
        queryClient.invalidateQueries({ queryKey: [`admin-${table}`] });
        queryClient.invalidateQueries({ queryKey: [`my-${table}`] });
        const singular = table.replace(/s$/, '').replace(/_events$/, '');
        queryClient.invalidateQueries({ queryKey: [`admin-${singular}`] });
        queryClient.invalidateQueries({ queryKey: [`my-${singular}`] });
      },
    );
  });

  channel.subscribe();
  return channel;
}

export function useClientRealtimeInvalidation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const channel = subscribeTables(
      supabase,
      `client-realtime-${user.id}`,
      CLIENT_TABLES,
      queryClient,
    );
    // Notifications is its own case — RLS-scoped per user
    channel.on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
      () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    );
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}

export function useAdminRealtimeInvalidation() {
  const queryClient = useQueryClient();
  const { isAuthenticated, currentUser } = useAdminAuth();

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    const channel = subscribeTables(
      supabaseAdmin,
      'admin-realtime-invalidation',
      ADMIN_TABLES,
      queryClient,
    );
    return () => {
      supabaseAdmin.removeChannel(channel);
    };
  }, [isAuthenticated, currentUser, queryClient]);
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
