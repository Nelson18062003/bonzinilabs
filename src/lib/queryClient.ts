/**
 * Global QueryClient configuration.
 *
 * Three production-grade behaviors are wired here:
 *
 * 1. Sane default cache freshness (5s stale, 5min gc, refetch on focus/reconnect).
 * 2. Automatic query invalidation after EVERY mutation succeeds — TkDodo's
 *    reference pattern. Mutations may opt into a narrower invalidation by
 *    declaring `meta: { invalidates: [...] }`; otherwise we invalidate all
 *    active queries (cheap because invalidate only refetches active ones).
 *    Reference: https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations
 * 3. Cross-tab sync via the BroadcastChannel API so that opening the admin
 *    in two tabs no longer shows divergent state.
 */

import { MutationCache, QueryClient } from '@tanstack/react-query';
import { broadcastQueryClient } from '@tanstack/query-broadcast-client-experimental';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      // Narrower invalidation list. When omitted, ALL active queries are invalidated.
      invalidates?: ReadonlyArray<readonly unknown[]>;
    };
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: 1,
    },
    mutations: {
      // Money mutations must not silently retry — the user has to see the error.
      retry: 0,
    },
  },
  mutationCache: new MutationCache({
    onSuccess: (_data, _vars, _ctx, mutation) => {
      const keys = mutation.meta?.invalidates;
      if (keys && keys.length > 0) {
        keys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key as readonly unknown[] });
        });
      } else {
        // Default: invalidate everything. Only refetches *active* queries,
        // marks the rest stale-on-mount. Cheaper than it sounds.
        queryClient.invalidateQueries();
      }
    },
  }),
});

// Sync invalidations across browser tabs of the same origin.
broadcastQueryClient({
  queryClient,
  broadcastChannel: 'bonzini-query-sync',
});
