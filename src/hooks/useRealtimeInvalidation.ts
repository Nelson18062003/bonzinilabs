/**
 * Subscribes to Supabase Realtime postgres_changes for the tables that
 * power admin-visible UI, and invalidates the matching React Query caches
 * on every change. This is the push-based safety net so that:
 *
 *   - actions taken in another tab/admin appear without a manual reload
 *   - server-side triggers (e.g. wallet credit on deposit validation)
 *     surface in the UI without per-mutation invalidation gymnastics
 *
 * Mount once inside the AdminAuthProvider — it depends on an authenticated
 * admin session for RLS to deliver the events.
 *
 * Performance note: Supabase advises switching to private Broadcast channels
 * if you exceed ~1000 concurrent subscribers or hit RLS perf walls.
 * https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  depositKeys,
  paymentKeys,
  walletKeys,
  ledgerKeys,
  dashboardKeys,
} from '@/lib/queryKeys';

const TABLES_TO_QUERY_KEYS = {
  deposits: [depositKeys.all, dashboardKeys.all] as const,
  payments: [paymentKeys.all, dashboardKeys.all] as const,
  wallets: [walletKeys.all, dashboardKeys.all] as const,
  ledger_entries: [ledgerKeys.all, walletKeys.all, dashboardKeys.all] as const,
  payment_proofs: [paymentKeys.all] as const,
  deposit_proofs: [depositKeys.all] as const,
} as const;

export function useRealtimeInvalidation() {
  const queryClient = useQueryClient();
  const { isAuthenticated, currentUser } = useAdminAuth();

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    const channel = supabaseAdmin.channel('admin-realtime-invalidation');

    (Object.keys(TABLES_TO_QUERY_KEYS) as Array<keyof typeof TABLES_TO_QUERY_KEYS>).forEach(
      (table) => {
        channel.on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'postgres_changes' as any,
          { event: '*', schema: 'public', table },
          () => {
            for (const key of TABLES_TO_QUERY_KEYS[table]) {
              queryClient.invalidateQueries({ queryKey: key as readonly unknown[] });
            }
            // Also catch admin-prefixed legacy keys still scattered in older hooks.
            queryClient.invalidateQueries({ queryKey: [`admin-${table}`] });
            queryClient.invalidateQueries({ queryKey: [`admin-${table.replace(/s$/, '')}`] });
          },
        );
      },
    );

    channel.subscribe();

    return () => {
      supabaseAdmin.removeChannel(channel);
    };
  }, [isAuthenticated, currentUser, queryClient]);
}

/**
 * Headless component that mounts the realtime subscription. Render this
 * INSIDE AdminAuthProvider so it can read the auth state.
 */
export function AdminRealtimeListener() {
  useRealtimeInvalidation();
  return null;
}
