// Formats d'affichage du sous-module « Marché Binance » (fr-FR, espaces fines).
const nf = (d: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtPrice = (v: number, dec = 2) => (Number.isFinite(v) ? nf(dec).format(v) : '—');
export const fmtCount = (v: number) => nf(0).format(v);
/** 14,9 % · 0,13 % — deux décimales sous 1 % pour que les petits paliers restent lisibles. */
export const fmtPct = (v: number, dec?: number) => `${nf(dec ?? (v > 0 && v < 1 ? 2 : 1)).format(v)}\u202f%`;
/** 202,9 M · 49 k · 2 120 */
export const fmtUsdt = (v: number) =>
  v >= 1e6 ? `${nf(1).format(v / 1e6)}\u202fM` : v >= 1e4 ? `${nf(0).format(v / 1e3)}\u202fk` : nf(0).format(v);

/** Heure d'un relevé dans un fuseau donné (Asia/Shanghai côté Chine, Africa/Douala côté Cameroun). */
export const fmtClock = (iso: string, timeZone: string, seconds = true) =>
  new Date(iso).toLocaleTimeString('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}) });
