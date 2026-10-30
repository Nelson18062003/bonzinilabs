// DEV-ONLY (SCREENSHOT_MOCK=1) : remplace useP2PBook. Le runner Playwright
// injecte des relevés réels dans window.__P2P_BOOKS__, par plateforme :
// { binance: { CNY: [...], XAF: [...] }, okx: { CNY: [...], XAF: [...] } }
// (l'ancien format { CNY, XAF } vaut pour Binance). On les fait défiler
// toutes les 5 s pour voir le graphique bouger.
import { useEffect, useState } from 'react';
import type { P2PBook, P2PExchange, P2PFiat } from '@/lib/p2pMarket';

type Books = Record<P2PFiat, P2PBook[]>;
export function useP2PBook(exchange: P2PExchange, fiat: P2PFiat, { live = true }: { live?: boolean } = {}) {
  const raw = (window as unknown as { __P2P_BOOKS__?: Partial<Record<P2PExchange, Books>> & Partial<Books> }).__P2P_BOOKS__ ?? {};
  const books = (raw[exchange] ?? (exchange === 'binance' && raw.CNY ? (raw as Books) : undefined))?.[fiat] ?? [];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!live || books.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % books.length), 5000);
    return () => clearInterval(t);
  }, [live, books.length]);
  const data = books[i % Math.max(1, books.length)];
  return { data, isError: !data, error: data ? null : new Error('Aucun relevé'), isFetching: false, refetch: async () => undefined, refresh: async () => setI((n) => (n + 1) % Math.max(1, books.length)) };
}
