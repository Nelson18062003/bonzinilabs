// Ancien nom (avant OKX) gardé pour les écrans qui l'appellent encore —
// l'écran mobile v2 de la PR #233. Équivaut à useP2PBook('binance', fiat).
import { useP2PBook } from './useP2PBook';
import type { P2PFiat } from '@/lib/p2pMarket';

export function useBinanceP2PBook(fiat: P2PFiat, opts: { live?: boolean } = {}) {
  return useP2PBook('binance', fiat, opts);
}
