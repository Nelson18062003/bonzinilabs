// Carnet Binance P2P en direct pour le sous-module « Marché Binance ».
// Admin uniquement → `supabaseAdmin` (session) + fetch direct de l'edge
// function (functions.invoke échoue en « Invalid JWT » — supabase-clients.md).
// Rafraîchi toutes les 30 s tant que l'écran est visible ; l'ancien relevé
// reste affiché pendant le chargement du suivant (react-query garde `data`
// pendant un refetch), et chaque devise a son propre cache.
import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } from '@/lib/env';
import type { P2PBook, P2PFiat } from '@/lib/p2pMarket';

export const P2P_REFRESH_MS = 30_000;

async function fetchBook(fiat: P2PFiat): Promise<P2PBook> {
  const { data: { session } } = await supabaseAdmin.auth.getSession();
  if (!session) throw new Error('Session admin requise');
  const res = await fetch(`${VITE_SUPABASE_URL}/functions/v1/binance-p2p-book`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ fiat }),
  });
  const json = await res.json().catch(() => ({ success: false, error: res.statusText }));
  if (!res.ok || !json.success) throw new Error(json.error || `Erreur ${res.status}`);
  return json.book as P2PBook;
}

export function useBinanceP2PBook(fiat: P2PFiat, { live = true }: { live?: boolean } = {}) {
  return useQuery({
    queryKey: ['binance-p2p-book', fiat],
    queryFn: () => fetchBook(fiat),
    refetchInterval: live ? P2P_REFRESH_MS : false,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
    retry: 1,
  });
}
