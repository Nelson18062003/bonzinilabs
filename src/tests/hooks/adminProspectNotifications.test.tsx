/**
 * La cloche de la direction (07/10) : une notification « Numéro déjà
 * client · <commercial> » par fiche « À vérifier » — une seule par prospect,
 * même si plusieurs clients sont reconnus —, vers l'écran de décision, et
 * comptée dans le badge. Seulement pour canManageSales : les autres rôles
 * n'envoient AUCUNE requête prospect_claims_pending (le serveur la
 * refuserait) et ne voient rien de tel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  perms: new Set<string>(),
  rpc: vi.fn(),
}));

vi.mock('@/contexts/AdminAuthContext', async (orig) => ({
  ...(await orig<typeof import('@/contexts/AdminAuthContext')>()),
  useAdminAuth: () => ({ hasPermission: (p: string) => h.perms.has(p) }),
}));
vi.mock('@/integrations/supabase/client', () => {
  // Dépôts, paiements, conteneurs : rien à traiter (le sujet est la fiche « À vérifier »).
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    select: self, in: self, neq: self, order: self, limit: self, eq: self,
    then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(r),
  });
  return { supabaseAdmin: { from: () => chain, rpc: h.rpc }, supabase: { from: () => chain, rpc: h.rpc } };
});

import { PROSPECT_CLAIMS_PATH, useAdminNotificationCount, useAdminNotifications } from '@/hooks/useAdminNotifications';

const prospect = (id: string, first_name: string, last_name: string) => ({ id, first_name, last_name, source_id: 'src-rodrigue', phone_e164: '+237699887766', phones: [] });
const client = (user_id: string, name: string, customer_code: string) => ({ user_id, name, customer_code, deposits_count: 0, payments_count: 0 });
const ROWS = [
  { claim_id: 'k1', prospect: prospect('pr-fotso', 'Nadine', 'Fotso'), source_id: 'src-rodrigue', source_label: 'Rodrigue Tchami', matched_phone: '+237699887766', created_at: '2026-10-05T13:52:00Z', client: client('u3', 'Nadia Fotso', 'BZ-207781') },
  { claim_id: 'k2', prospect: prospect('pr-kamdem', 'Serge', 'Kamdem'), source_id: 'src-rodrigue', source_label: 'Rodrigue Tchami', matched_phone: '+237677304118', created_at: '2026-10-05T10:05:00Z', client: client('u-k1', 'Serge Kamdem', 'BZ-355120') },
  { claim_id: 'k3', prospect: prospect('pr-kamdem', 'Serge', 'Kamdem'), source_id: 'src-rodrigue', source_label: 'Rodrigue Tchami', matched_phone: '+237691552007', created_at: '2026-10-05T10:05:00Z', client: client('u-k2', 'Arlette Kamdem', 'BZ-390044') },
];

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  h.rpc.mockReset();
  h.rpc.mockImplementation(async (name: string) =>
    name === 'prospect_claims_pending' ? { data: { success: true, rows: ROWS }, error: null } : { data: null, error: null },
  );
});

describe('Notifications de la direction — fiches « À vérifier »', () => {
  it('canManageSales : une entrée par fiche, titre, sous-titre et lien vers l’écran', async () => {
    h.perms = new Set(['canManageSales', 'canManageUsers']);
    const { result } = renderHook(() => useAdminNotifications(), { wrapper });
    await waitFor(() => expect(result.current.data?.some((n) => n.type === 'prospect_to_verify')).toBe(true));
    const mine = result.current.data!.filter((n) => n.type === 'prospect_to_verify');
    expect(mine).toHaveLength(2);
    expect(mine[0]).toMatchObject({
      id: 'prospect-claim-pr-fotso',
      title: 'Numéro déjà client · Rodrigue Tchami',
      // Espace insécable avant « : » (jamais un deux-points seul en début de ligne).
      subtitle: 'Nadine Fotso · client reconnu\u00a0: Nadia Fotso',
      targetPath: `${PROSPECT_CLAIMS_PATH}?fiche=pr-fotso`,
    });
    expect(mine[1].subtitle).toBe('Serge Kamdem · 2 clients reconnus');
    expect(mine[1].amount).toBeUndefined();
    expect(h.rpc).toHaveBeenCalledWith('prospect_claims_pending', {});
  });

  it('canManageSales : le badge compte les fiches (pas les clients reconnus)', async () => {
    h.perms = new Set(['canManageSales']);
    const { result } = renderHook(() => useAdminNotificationCount(), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(2));
  });

  it('sans canManageSales : aucune requête, aucune entrée de ce type', async () => {
    h.perms = new Set(['canProcessDeposits', 'canProcessPayments', 'canManageUsers']);
    const { result } = renderHook(() => ({ list: useAdminNotifications(), count: useAdminNotificationCount() }), { wrapper });
    await waitFor(() => expect(result.current.list.data).toBeDefined());
    await waitFor(() => expect(result.current.count.data).toBe(0));
    expect(result.current.list.data!.some((n) => n.type === 'prospect_to_verify')).toBe(false);
    expect(h.rpc).not.toHaveBeenCalledWith('prospect_claims_pending', expect.anything());
  });
});
