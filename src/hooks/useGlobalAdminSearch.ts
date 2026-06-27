import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';

/**
 * Global admin search backing the desktop topbar field. Runs three small,
 * capped lookups in parallel: clients (name / phone) and deposits / payments by
 * reference. Read-only, admin client, results grouped for the dropdown.
 *
 * The term is sanitised before being interpolated into the PostgREST `.or()`
 * filter — commas / parens / wildcards are stripped so a user query can neither
 * break the filter grammar nor inject extra conditions (OWASP: no raw user
 * input in queries).
 */
export interface GlobalSearchResults {
  clients: { userId: string; name: string; phone: string }[];
  deposits: { id: string; reference: string; amountXaf: number }[];
  payments: { id: string; reference: string; amountRmb: number }[];
}

export function useGlobalAdminSearch(rawTerm: string) {
  const term = (rawTerm ?? '')
    .replace(/[,()*%\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return useQuery({
    queryKey: ['global-admin-search', term],
    enabled: term.length >= 2,
    staleTime: 10_000,
    queryFn: async (): Promise<GlobalSearchResults> => {
      const like = `%${term}%`;
      const [clientsRes, depositsRes, paymentsRes] = await Promise.all([
        supabaseAdmin
          .from('clients')
          .select('user_id, first_name, last_name, phone')
          .or(`first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like}`)
          .limit(6),
        supabaseAdmin
          .from('deposits')
          .select('id, reference, amount_xaf')
          .ilike('reference', like)
          .order('created_at', { ascending: false })
          .limit(6),
        supabaseAdmin
          .from('payments')
          .select('id, reference, amount_rmb')
          .ilike('reference', like)
          .order('created_at', { ascending: false })
          .limit(6),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (depositsRes.error) throw depositsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      return {
        clients: (clientsRes.data ?? []).map((c) => ({
          userId: c.user_id,
          name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Client',
          phone: c.phone ?? '',
        })),
        deposits: (depositsRes.data ?? []).map((d) => ({
          id: d.id,
          reference: d.reference ?? '—',
          amountXaf: d.amount_xaf ?? 0,
        })),
        payments: (paymentsRes.data ?? []).map((p) => ({
          id: p.id,
          reference: p.reference ?? '—',
          amountRmb: p.amount_rmb ?? 0,
        })),
      };
    },
  });
}
