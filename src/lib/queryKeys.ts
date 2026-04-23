/**
 * Centralized query key factories.
 *
 * Why: hand-typed query keys cause silent invalidation misses (e.g.
 * invalidating ['payment-proofs'] while the actual cache key is
 * ['admin-payment-proofs', id]). Defining keys here gives one source
 * of truth so a typo is a TS error, not a stale UI.
 *
 * Naming convention follows the TkDodo factory pattern: `all` is the
 * broadest prefix, `lists()`/`detail(id)` build narrower keys that
 * still match the prefix during invalidation.
 */

export const depositKeys = {
  all: ['deposits'] as const,
  lists: () => [...depositKeys.all, 'list'] as const,
  detail: (id: string | undefined) => [...depositKeys.all, 'detail', id] as const,
  timeline: (id: string | undefined) => [...depositKeys.all, 'timeline', id] as const,
  proofs: (id: string | undefined) => [...depositKeys.all, 'proofs', id] as const,
  stats: () => [...depositKeys.all, 'stats'] as const,
};

export const paymentKeys = {
  all: ['payments'] as const,
  lists: () => [...paymentKeys.all, 'list'] as const,
  detail: (id: string | undefined) => [...paymentKeys.all, 'detail', id] as const,
  timeline: (id: string | undefined) => [...paymentKeys.all, 'timeline', id] as const,
  proofs: (id: string | undefined) => [...paymentKeys.all, 'proofs', id] as const,
  stats: () => [...paymentKeys.all, 'stats'] as const,
};

export const walletKeys = {
  all: ['wallets'] as const,
  byUser: (userId: string | undefined) => [...walletKeys.all, 'byUser', userId] as const,
  list: () => [...walletKeys.all, 'list'] as const,
};

export const ledgerKeys = {
  all: ['ledger'] as const,
  byUser: (userId: string | undefined) => [...ledgerKeys.all, 'byUser', userId] as const,
};

export const clientKeys = {
  all: ['clients'] as const,
  detail: (id: string | undefined) => [...clientKeys.all, 'detail', id] as const,
  list: () => [...clientKeys.all, 'list'] as const,
};

export const rateKeys = {
  all: ['rates'] as const,
  daily: () => [...rateKeys.all, 'daily'] as const,
  exchange: () => [...rateKeys.all, 'exchange'] as const,
  adjustments: () => [...rateKeys.all, 'adjustments'] as const,
};

export const beneficiaryKeys = {
  all: ['beneficiaries'] as const,
  byUser: (userId: string | undefined) => [...beneficiaryKeys.all, 'byUser', userId] as const,
};

export const notificationKeys = {
  all: ['notifications'] as const,
};

export const adminKeys = {
  all: ['admins'] as const,
  list: () => [...adminKeys.all, 'list'] as const,
  detail: (id: string | undefined) => [...adminKeys.all, 'detail', id] as const,
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
};
