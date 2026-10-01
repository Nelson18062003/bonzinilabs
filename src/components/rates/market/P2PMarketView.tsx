/**
 * Sous-module « Marché Binance » du module Taux de change — la distribution
 * en direct du carnet Binance P2P (maquette validée le 01/10/2026).
 *
 *   · deux côtés : Vente en Chine (CNY) · Achat au Cameroun (XAF)
 *   · le NOMBRE TOTAL d'annonces du marché, puis ce qui reste avec les filtres
 *   · l'histogramme : pour chaque prix, sa part de toutes les annonces
 *   · filtres toujours ouverts à gauche (sur ordinateur), effet immédiat
 *   · tous les paliers en tableau + les annonces du palier choisi
 *
 * Le carnet est relevé toutes les 30 s par l'edge function `binance-p2p-book`.
 * Desktop d'abord ; sur téléphone tout s'empile et les filtres se replient.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBinanceP2PBook } from '@/hooks/useBinanceP2PBook';
import {
  AD, MARKET, bestPrice, priceDecimals, blankFilters, bonziniFilters, histogram, impliedRate, levels as toLevels, matcher, median, sameFilters, zoomOf,
  type P2PFiat, type P2PFilters,
} from '@/lib/p2pMarket';
import { P2PHistogram } from './P2PHistogram';
import { P2PRangeStrip } from './P2PRangeStrip';
import { P2PFilterPanel } from './P2PFilterPanel';
import { chipCls } from './styles';
import { fmtClock, fmtCount, fmtPct, fmtPrice, fmtUsdt } from './format';

const STORE = 'bz-p2p-market-v2';
interface Prefs { fiat: P2PFiat; unit: 'count' | 'usdt'; bin: Record<P2PFiat, number>; filters: Record<P2PFiat, P2PFilters> }
const DEFAULT_PREFS: Prefs = {
  fiat: 'CNY', unit: 'count',
  bin: { CNY: MARKET.CNY.defaultBin, XAF: MARKET.XAF.defaultBin },
  filters: { CNY: blankFilters(), XAF: blankFilters() },
};
// Préférences relues champ par champ : une valeur absente ou fausse (palier
// 0, champ manquant) viderait le graphique. Le zoom n'est pas restauré — le
// prix aura bougé d'ici la prochaine ouverture.
const num = (v: unknown, ok: number[] | null, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && (!ok || ok.includes(v)) ? v : d);
function cleanFilters(x: unknown): P2PFilters {
  const o = (x ?? {}) as Partial<Record<keyof P2PFilters, unknown>>;
  return {
    ...blankFilters(),
    pay: Array.isArray(o.pay) ? o.pay.filter((id): id is string => typeof id === 'string') : [],
    amount: Number.isSafeInteger(o.amount) && (o.amount as number) > 0 ? (o.amount as number) : 0,
    kind: num(o.kind, [0, 1, 2], 0) as 0 | 1 | 2,
    minOrders: num(o.minOrders, null, 0),
    minFinish: num(o.minFinish, null, 0),
    maxTime: num(o.maxTime, null, 0),
  };
}
function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (p && typeof p === 'object') {
      return {
        fiat: p.fiat === 'XAF' ? 'XAF' : 'CNY',
        unit: p.unit === 'usdt' ? 'usdt' : 'count',
        bin: { CNY: num(p.bin?.CNY, MARKET.CNY.bins, MARKET.CNY.defaultBin), XAF: num(p.bin?.XAF, MARKET.XAF.bins, MARKET.XAF.defaultBin) },
        filters: { CNY: cleanFilters(p.filters?.CNY), XAF: cleanFilters(p.filters?.XAF) },
      };
    }
  } catch { /* stockage indisponible : réglages par défaut */ }
  return DEFAULT_PREFS;
}

const segBtn = (on: boolean) => cn(
  'h-9 rounded-[7px] px-4 text-[14px] font-bold transition-colors',
  on ? 'bg-card text-foreground ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
);
const segSm = (on: boolean) => cn(
  'h-[30px] rounded-[7px] px-3 text-[13px] font-bold transition-colors',
  on ? 'bg-card text-foreground ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
);

export function P2PMarketView({ compact = false }: { compact?: boolean }) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [live, setLive] = useState(true);
  const [full, setFull] = useState<Record<P2PFiat, boolean>>({ CNY: false, XAF: false });
  const [selected, setSelected] = useState<Record<P2PFiat, number | null>>({ CNY: null, XAF: null });
  const [filtersOpen, setFiltersOpen] = useState(!compact);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch { /* ignoré */ } }, [prefs]);

  const fiat = prefs.fiat;
  const cny = useBinanceP2PBook('CNY', { live });
  const xaf = useBinanceP2PBook('XAF', { live });
  const q = fiat === 'CNY' ? cny : xaf;
  const book = q.data;
  const f = prefs.filters[fiat];
  const bin = prefs.bin[fiat];
  const best = MARKET[fiat].best === 'max';

  const setFilters = (nf: P2PFilters) => {
    setPrefs((p) => ({ ...p, filters: { ...p.filters, [fiat]: nf } }));
    setSelected((s) => ({ ...s, [fiat]: null }));
    if (nf.lo == null && nf.hi == null && (f.lo != null || f.hi != null)) setFull((s) => ({ ...s, [fiat]: false }));
  };

  const v = useMemo(() => {
    if (!book) return null;
    const ads = book.ads.filter(matcher(f, book.methods));
    const lv = toLevels(ads, bin);
    const zoom = zoomOf(ads, fiat, f, full[fiat]);
    const bars = zoom ? histogram(lv, bin, zoom, fiat) : [];
    const shown = bars.reduce((s, l) => s + l.count, 0);
    // part cumulée « à ce prix ou mieux » (du meilleur prix vers le pire)
    const cumulative = new Map<number, number>();
    let c = 0;
    for (const l of best ? [...lv].reverse() : lv) { c += l.shareCount; cumulative.set(l.key, c); }
    const mode = lv.reduce<(typeof lv)[number] | null>((m, l) => (!m || l.count > m.count ? l : m), null);
    return {
      ads, lv, zoom, bars, hidden: ads.length - shown, cumulative, mode,
      med: median(ads), bestP: bestPrice(ads, fiat),
      usdt: ads.reduce((s, a) => s + a[AD.usdt], 0),
      totalUsdt: book.ads.reduce((s, a) => s + a[AD.usdt], 0),
      distinct: new Set(book.ads.map((a) => a[AD.price])).size,
    };
  }, [book, f, bin, fiat, full, best]);

  // Taux que donne le marché : médianes des deux côtés au filtre Bonzini
  const rate = useMemo(() => {
    const c = cny.data, x = xaf.data;
    if (!c || !x) return NaN;
    const mc = median(c.ads.filter(matcher(bonziniFilters('CNY', c.methods), c.methods)));
    const mx = median(x.ads.filter(matcher(bonziniFilters('XAF', x.methods), x.methods)));
    return impliedRate(mc, mx);
  }, [cny.data, xaf.data]);

  // palier choisi encore présent dans le relevé ? sinon on retombe sur le plus fréquent
  const picked = v && selected[fiat] != null && v.lv.some((l) => l.key === selected[fiat]) ? selected[fiat] : null;
  const selKey = picked ?? v?.mode?.key ?? null;
  const selLevel = v?.lv.find((l) => l.key === selKey) ?? null;
  const dec = priceDecimals(fiat, bin);
  const activeCount = [f.pay.length, f.amount, f.kind, f.minOrders, f.minFinish, f.maxTime].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* ── Côté + direct ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Côté du marché" className="inline-flex rounded-[10px] border border-border bg-muted p-[3px]">
          {(['CNY', 'XAF'] as P2PFiat[]).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={fiat === m} className={segBtn(fiat === m)}
              onClick={() => setPrefs((p) => ({ ...p, fiat: m }))}>
              {MARKET[m].label} · {m}
            </button>
          ))}
        </div>
        <LiveBadge live={live} fetchedAt={book?.fetchedAt} fetching={q.isFetching} stale={q.isError && !!book} />
        <button type="button" onClick={() => setLive((l) => !l)} className={cn(chipCls(false), 'h-9 px-4 font-bold')}>
          {live ? 'Pause' : 'Reprendre'}
        </button>
        <span className="flex-1" />
        {Number.isFinite(rate) && (
          <span className="text-[14px] text-muted-foreground">
            Taux que donne le marché (médianes, filtre Bonzini) : <b className="text-[16px] font-extrabold text-foreground">{fmtCount(rate)}</b> CNY pour 1 M XAF
          </span>
        )}
      </div>

      {q.isError && !book ? (
        <div className="rounded-[10px] border border-border bg-card p-10 text-center">
          <p className="text-[16px] font-bold text-foreground">Impossible de lire le carnet Binance</p>
          <p className="mt-1 text-[14px] text-muted-foreground">{(q.error as Error)?.message}</p>
          <button type="button" onClick={() => q.refetch()} className={cn(chipCls(true), 'mt-4 h-9 px-4')}>Réessayer</button>
        </div>
      ) : !book || !v ? (
        <div className="flex items-center justify-center gap-2 rounded-[10px] border border-border bg-card p-16 text-[14px] text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Lecture du carnet Binance complet…
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[288px_minmax(0,1fr)]">
          {/* ── Filtres ── */}
          <div className="lg:sticky lg:top-5">
            {compact && (
              <button type="button" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}
                className="mb-2 flex w-full items-center justify-between rounded-[10px] border border-border bg-card px-4 py-3 text-[16px] font-bold text-foreground">
                Filtres{activeCount ? ` · ${activeCount} actif${activeCount > 1 ? 's' : ''}` : ''}
                <ChevronDown className={cn('h-5 w-5 text-muted-foreground transition-transform', !filtersOpen && '-rotate-90')} />
              </button>
            )}
            {filtersOpen && <P2PFilterPanel fiat={fiat} book={book} filters={f} onChange={setFilters} />}
          </div>

          <div className="min-w-0 space-y-5">
            {/* ── Chiffres ── */}
            <section aria-label="Chiffres" className="grid grid-cols-2 overflow-hidden rounded-[10px] border border-border bg-card sm:grid-cols-3 xl:grid-cols-5">
              <Kpi big k="Annonces sur le marché" v={fmtCount(book.total)} s={`${fmtUsdt(v.totalUsdt)} USDT · ${v.distinct} prix différents`} className="col-span-2 sm:col-span-1" />
              <Kpi k="Avec vos filtres" v={fmtCount(v.ads.length)} s={`${fmtPct((v.ads.length / Math.max(1, book.total)) * 100)} du marché · ${fmtUsdt(v.usdt)} USDT`} />
              <Kpi k="Médiane" v={fmtPrice(v.med, 2)} s="la moitié au-dessus, la moitié en dessous" />
              <Kpi k="Prix le plus fréquent" v={v.mode ? fmtPrice(v.mode.price, dec) : '—'} s={v.mode ? `${fmtCount(v.mode.count)} annonces · ${fmtPct(v.mode.shareCount)}` : '—'} />
              <Kpi k="Meilleur prix" v={fmtPrice(v.bestP, 2)} s={Number.isFinite(v.bestP) ? `${v.ads.filter((a) => a[AD.price] === v.bestP).length} annonce(s) · ${best ? 'le plus haut' : 'le plus bas'}` : '—'} />
            </section>

            {/* ── Graphique ── */}
            <section aria-label="Distribution des prix" className="rounded-[10px] border border-border bg-card px-[18px] pb-2.5 pt-[18px]">
              <div className="mb-1.5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-[18px] font-extrabold text-foreground">Distribution des prix</h3>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {v.ads.length
                      ? `${fmtCount(v.ads.length)} annonces, groupées par palier de ${fmtPrice(bin, dec)} ${fiat}. La hauteur = part de chaque prix dans ${prefs.unit === 'count' ? 'le nombre total d’annonces' : 'les USDT disponibles'}.`
                      : 'Aucune annonce avec ces filtres.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-muted-foreground">Hauteur :</span>
                  <div className="inline-flex rounded-[10px] border border-border bg-muted p-[3px]">
                    <button type="button" className={segSm(prefs.unit === 'count')} onClick={() => setPrefs((p) => ({ ...p, unit: 'count' }))}>% des annonces</button>
                    <button type="button" className={segSm(prefs.unit === 'usdt')} onClick={() => setPrefs((p) => ({ ...p, unit: 'usdt' }))}>% des USDT</button>
                  </div>
                  <span className="text-[13px] text-muted-foreground">Palier :</span>
                  <div className="inline-flex rounded-[10px] border border-border bg-muted p-[3px]">
                    {MARKET[fiat].bins.map((b) => (
                      <button key={b} type="button" className={segSm(b === bin)}
                        onClick={() => { setPrefs((p) => ({ ...p, bin: { ...p.bin, [fiat]: b } })); setSelected((s) => ({ ...s, [fiat]: null })); }}>
                        {fmtPrice(b, priceDecimals('XAF', b))}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {v.bars.length > 0 ? (
                <>
                  <P2PHistogram
                    fiat={fiat} bars={v.bars} bin={bin} unit={prefs.unit} median={v.med}
                    selected={picked} onSelect={(k) => setSelected((s) => ({ ...s, [fiat]: k }))} cumulative={v.cumulative}
                  />
                  <div className="mt-1.5 border-t border-border pt-2.5">
                    <div className="mb-1 flex items-start justify-between gap-4 text-[13px] text-muted-foreground">
                      <span>
                        {v.zoom?.mode === 'auto'
                          ? `Vue resserrée : ${fmtCount(v.hidden)} annonces (${fmtPct((v.hidden / v.ads.length) * 100)}) ${best ? 'sous' : 'au-dessus de'} ${fmtPrice(best ? v.zoom.lo : v.zoom.hi, 2)} sont hors du graphique, mais comptent dans les %. Glissez ici pour zoomer.`
                          : v.zoom?.mode === 'custom'
                            ? `Zoom de ${fmtPrice(v.zoom.lo, 2)} à ${fmtPrice(v.zoom.hi, 2)} ${fiat} · ${fmtCount(v.hidden)} annonces hors du graphique, comptées dans les %.`
                            : 'Tout le carnet. Glissez sur cette barre pour zoomer sur une fourchette de prix.'}
                      </span>
                      {(v.zoom?.mode !== 'full' || full[fiat]) && (
                        <button type="button" className="shrink-0 whitespace-nowrap font-bold text-foreground underline underline-offset-[3px]"
                          onClick={() => {
                            if (v.zoom?.mode === 'custom') setFilters({ ...f, lo: null, hi: null });
                            else setFull((s) => ({ ...s, [fiat]: !s[fiat] }));
                          }}>
                          {v.zoom?.mode === 'custom' ? 'Revenir à la vue normale' : v.zoom?.mode === 'auto' ? 'Voir tout le carnet' : 'Resserrer la vue'}
                        </button>
                      )}
                    </div>
                    <P2PRangeStrip levels={v.lv} bin={bin} lo={v.bars[0].price} hi={v.bars[v.bars.length - 1].price}
                      onRange={(lo, hi) => setFilters({ ...f, lo, hi })} dec={priceDecimals(fiat, 1)} />
                  </div>
                </>
              ) : (
                <p className="py-16 text-center text-[14px] text-muted-foreground">Aucune annonce avec ces filtres. Retirez-en un à gauche.</p>
              )}
            </section>

            {/* ── Paliers + annonces du palier ── */}
            <div className="grid gap-5 min-[1640px]:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <section aria-label="Tous les paliers" className="min-w-0 rounded-[10px] border border-border bg-card pb-1.5 pt-4">
                <h3 className="mx-[18px] text-[16px] font-extrabold text-foreground">Tous les paliers</h3>
                <p className="mx-[18px] mb-2.5 mt-0.5 text-[13px] text-muted-foreground">Chaque prix, son nombre d&apos;annonces et sa part. Cliquez pour voir les annonces.</p>
                <div className="max-h-[440px] overflow-auto">
                  <table className="w-full min-w-[480px] border-collapse text-[14px] tabular-nums">
                    <thead><tr>{['Prix', 'Annonces', 'Part', 'Cumul', 'USDT dispo'].map((h, i) => <Th key={h} left={i === 0}>{h}</Th>)}</tr></thead>
                    <tbody>
                      {(() => {
                        const rows = best ? [...v.lv].reverse() : v.lv;
                        const maxN = Math.max(1, ...rows.map((l) => l.count));
                        return rows.map((l) => (
                          <tr key={l.key} onClick={() => setSelected((s) => ({ ...s, [fiat]: l.key }))}
                            className={cn('cursor-pointer hover:bg-accent', l.key === selKey && 'bg-muted')}>
                            <Td left strong>{fmtPrice(l.price, dec)}</Td>
                            <Td>{fmtCount(l.count)}</Td>
                            <Td>
                              <span className="mr-2 inline-block h-2 rounded-sm bg-foreground/85 align-middle" style={{ width: Math.max(2, (l.count / maxN) * 56) }} />
                              {fmtPct(l.shareCount)}
                            </Td>
                            <Td>{fmtPct(v.cumulative.get(l.key) ?? 0)}</Td>
                            <Td>{fmtUsdt(l.usdt)}</Td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </section>

              <section aria-label="Annonces du palier" className="min-w-0 rounded-[10px] border border-border bg-card pb-1.5 pt-4">
                <h3 className="mx-[18px] text-[16px] font-extrabold text-foreground">
                  {selLevel ? `Annonces à ${fmtPrice(selLevel.price, dec)} ${fiat}` : 'Annonces'}
                </h3>
                <p className="mx-[18px] mb-2.5 mt-0.5 text-[13px] text-muted-foreground">
                  {selLevel
                    ? `${fmtCount(selLevel.count)} annonces · ${fmtPct(selLevel.shareCount)} du total · ${fmtUsdt(selLevel.usdt)} USDT disponibles.${picked == null ? ' Palier le plus fréquent ; cliquez une barre pour en voir un autre.' : ''}`
                    : 'Cliquez une barre du graphique.'}
                </p>
                <div className="max-h-[440px] overflow-auto">
                  <table className="w-full min-w-[520px] border-collapse text-[14px] tabular-nums">
                    <thead><tr>{['Annonceur', 'Ordres/mois', 'Réussite', 'USDT dispo', 'Limites'].map((h, i) => <Th key={h} left={i === 0}>{h}</Th>)}</tr></thead>
                    <tbody>
                      {(selLevel ? [...selLevel.ads].sort((a, b) => b[AD.usdt] - a[AD.usdt]) : []).map((a, i) => (
                        <tr key={`${a[AD.nick]}-${i}`}>
                          <Td left>
                            <span className="inline-block max-w-[180px] truncate align-middle">{a[AD.nick]}</span>
                            {a[AD.kind] > 0 && (
                              <span className="ml-1.5 rounded-[5px] bg-muted px-1.5 text-[12px] font-bold leading-5 text-foreground">{a[AD.kind] === 2 ? 'Pro' : 'Marchand'}</span>
                            )}
                          </Td>
                          <Td>{fmtCount(a[AD.orders])}</Td>
                          <Td>{fmtPct(a[AD.finish] / 10, 1)}</Td>
                          <Td>{fmtUsdt(a[AD.usdt])}</Td>
                          <Td>{fmtUsdt(a[AD.min])} – {fmtUsdt(a[AD.max])}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <p className="text-[13px] text-muted-foreground">
              Source : carnet Binance P2P (USDT) complet, relevé toutes les 30 secondes.{' '}
              {fiat === 'CNY' ? 'Côté Chine : toutes les annonces où l’on peut vendre ses USDT contre des CNY.' : 'Côté Cameroun : toutes les annonces où l’on peut acheter des USDT en XAF.'}
              {!sameFilters(f, blankFilters()) && ' Filtres actifs : seules les annonces qui les passent comptent dans les %.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function LiveBadge({ live, fetchedAt, fetching, stale }: { live: boolean; fetchedAt?: string; fetching: boolean; stale: boolean }) {
  // stale : la dernière mise à jour a échoué, on montre l'ancien relevé — le
  // dire, plutôt que d'afficher « En direct » sur des chiffres qui ont vieilli
  const ok = live && !stale;
  return (
    <span className={cn(
      'inline-flex h-[30px] items-center gap-2 rounded-lg px-3 text-[13px] font-bold',
      ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
        : stale ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' : 'bg-muted text-muted-foreground',
    )}>
      <span className={cn('h-2 w-2 rounded-full', ok ? 'bg-emerald-500 animate-pulse' : stale ? 'bg-amber-500' : 'bg-muted-foreground')} />
      {stale ? 'Mise à jour en échec' : live ? 'En direct' : 'En pause'}{fetchedAt ? ` · relevé de ${fmtClock(fetchedAt)}` : ''}
      {fetching && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Mise à jour" />}
    </span>
  );
}

function Kpi({ k, v, s, big, className }: { k: string; v: string; s: string; big?: boolean; className?: string }) {
  return (
    <div className={cn('min-w-0 border-b border-l border-border px-[18px] py-4 [&:nth-child(1)]:border-l-0', className)}>
      <div className="text-[13px] font-medium text-muted-foreground">{k}</div>
      <div className={cn('mt-1 whitespace-nowrap font-extrabold leading-tight tracking-tight text-foreground', big ? 'text-[30px]' : 'text-[26px]')}>{v}</div>
      <div className="mt-0.5 text-[13px] text-muted-foreground">{s}</div>
    </div>
  );
}

function Th({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return (
    <th className={cn('sticky top-0 whitespace-nowrap bg-muted px-3 py-2 text-[13px] font-bold text-muted-foreground', left ? 'pl-[18px] text-left' : 'text-right last:pr-[18px]')}>
      {children}
    </th>
  );
}

function Td({ children, left, strong }: { children: React.ReactNode; left?: boolean; strong?: boolean }) {
  return (
    <td className={cn('whitespace-nowrap border-t border-border px-3 py-2', left ? 'pl-[18px] text-left' : 'text-right last:pr-[18px]', strong ? 'font-bold text-foreground' : 'text-foreground/85')}>
      {children}
    </td>
  );
}
