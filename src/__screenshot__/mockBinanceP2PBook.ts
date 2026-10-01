// DEV-ONLY (SCREENSHOT_MOCK=1) : remplace useBinanceP2PBook. Le runner
// Playwright injecte des relevés réels dans window.__P2P_BOOKS__ ; on les
// fait défiler toutes les 5 s pour voir le graphique bouger.
import { useEffect, useState } from 'react';
import type { P2PBook, P2PFiat } from '@/lib/p2pMarket';

export function useBinanceP2PBook(fiat: P2PFiat, { live = true }: { live?: boolean } = {}) {
  const books = ((window as unknown as { __P2P_BOOKS__?: Record<P2PFiat, P2PBook[]> }).__P2P_BOOKS__ ?? { CNY: [], XAF: [] })[fiat];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!live || books.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % books.length), 5000);
    return () => clearInterval(t);
  }, [live, books.length]);
  const data = books[i];
  return { data, isError: !data, error: data ? null : new Error('Aucun relevé'), isFetching: false, refetch: async () => undefined };
}
