// ============================================================
// La veille douane côté public et client (session `supabase`, ou aucune :
// les avis publiés sont lisibles par tous — RLS customs_notices_public_read).
// L'espace équipe lit les brouillons avec useAdminNotices (supabaseAdmin).
// ============================================================
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { customsKeys } from '@/lib/queryKeys';
import type { Notice } from '@/lib/customs/notices';

export function useCustomsNotices(enabled = true) {
  return useQuery({
    enabled,
    queryKey: customsKeys.notices('public'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customs_notices' as never)
        .select('*')
        .eq('published' as never, true as never)
        .order('starts_on', { ascending: false, nullsFirst: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Notice[];
    },
    staleTime: 5 * 60_000,
  });
}
