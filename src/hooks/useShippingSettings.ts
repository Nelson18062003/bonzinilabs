// ============================================================
// RÉGLAGES D'EXPÉDITION — adresses en Chine + coordonnées de la société,
// lus par les DEUX apps (le client rend l'étiquette, l'admin aussi) et
// modifiés depuis l'app admin seulement.
//
// Deux hooks de lecture, un par client Supabase : `supabase` (app client)
// et `supabaseAdmin` (app admin). Les sessions sont isolées ; un hook admin
// appelé avec le client « client » renverrait une ligne vide sans erreur
// (voir .claude/rules/supabase-clients.md). Tant que la ligne n'est pas
// arrivée, on rend les valeurs de départ : l'étiquette ne clignote pas.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { DEFAULT_SHIPPING_SETTINGS, parseShippingSettings, type ShippingSettings } from '@/lib/customerCode';
import { toast } from 'sonner';

const KEY = 'shipping';
const STALE = 5 * 60 * 1000;

async function fetchShipping(client: SupabaseClient<Database>): Promise<ShippingSettings> {
  const { data, error } = await client.from('platform_settings').select('value').eq('key', KEY).maybeSingle();
  if (error) throw error;
  return parseShippingSettings(data?.value);
}

/** App CLIENT. */
export function useShippingSettings() {
  return useQuery({
    queryKey: ['platform-settings', KEY, 'client'],
    queryFn: () => fetchShipping(supabase),
    staleTime: STALE,
    placeholderData: DEFAULT_SHIPPING_SETTINGS,
  });
}

/** App ADMIN. */
export function useAdminShippingSettings() {
  return useQuery({
    queryKey: ['platform-settings', KEY, 'admin'],
    queryFn: () => fetchShipping(supabaseAdmin),
    staleTime: STALE,
    placeholderData: DEFAULT_SHIPPING_SETTINGS,
  });
}

/** App ADMIN — enregistre (RPC gardée par canManageUsers). */
export function useUpdateShippingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: ShippingSettings) => {
      const { data, error } = await supabaseAdmin.rpc('update_platform_setting', {
        p_key: KEY,
        p_value: value as unknown as Database['public']['Tables']['platform_settings']['Row']['value'],
      });
      if (error) throw error;
      const res = data as unknown as { success: boolean; error?: string };
      if (!res?.success) throw new Error(res?.error ?? 'Enregistrement refusé');
      return value;
    },
    onSuccess: (value) => {
      qc.setQueryData(['platform-settings', KEY, 'admin'], value);
      toast.success('Réglages d’expédition enregistrés');
    },
    onError: (err) => {
      toast.error('Enregistrement impossible', { description: err instanceof Error ? err.message : undefined });
    },
  });
}
