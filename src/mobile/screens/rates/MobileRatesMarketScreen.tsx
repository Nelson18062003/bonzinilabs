/**
 * Marché Binance (maquettes 08-taux/14 à 16, sans le graphique de la journée
 * ni la marge marché / notre taux : ces deux ajouts attendent l'accord du
 * propriétaire).
 *
 *   · En tête, la suggestion Binance (¥ pour 1 000 000 XAF) et ses deux
 *     côtés : achat au Cameroun, vente en Chine. « Utiliser » ouvre la
 *     publication avec ce taux.
 *   · Le carnet en direct (edge function `binance-p2p-book`, toutes les 30 s) :
 *     Cameroun · XAF / Chine · ¥, Filtre Bonzini / Tout Binance / Filtres,
 *     meilleur prix, médiane, prix le plus fréquent, annonces, histogramme.
 *     Toucher une barre ouvre ses annonces.
 *   · « … » : Actualiser, Pause, Recalculer la suggestion, hauteur (% des
 *     annonces / % des USDT), largeur des paliers, zoom, tous les paliers.
 *
 * Mêmes calculs que la vue de l'ordinateur (`lib/p2pMarket`). Réservé à
 * `canManageRates`, comme l'edge function.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BarChart3, Layers, ListFilter, Maximize2, Pause, Play, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBinanceP2PBook } from '@/hooks/useBinanceP2PBook';
import { useComputeSuggestion, useLatestSuggestion } from '@/hooks/useDailyRates';
import {
  AD, MARKET, bestPrice, blankFilters, bonziniFilters, histogram, impliedRate, levels as toLevels, matcher, median, methodBit, priceDecimals,
  sameFilters, zoomOf, type P2PAd, type P2PFiat, type P2PFilters, type P2PLevel,
} from '@/lib/p2pMarket';
import { fmtClock, fmtCount, fmtPct, fmtPrice, fmtUsdt } from '@/components/rates/market/format';
import {
  ActionSheet, BigButton, BottomSheet, BoxSegmented, ChartCard, Chip, Dock, EmptyLine, HeroFigure, ItemList, ItemRow, Initials, MoreButton,
  ScreenError, ScreenLoader, ScreenTop, TEXT, Tag, useSheet, TextInput,
} from '@/mobile/designKit';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { ChipRow, ChoiceChips, Histogram, StatBox } from './parts';
import { dec, nb } from './rateFormat';

const STORE = 'bz-p2p-market-m2';
interface Prefs { fiat: P2PFiat; unit: 'count' | 'usdt'; bin: Record<P2PFiat, number> }
const DEFAULT_PREFS: Prefs = { fiat: 'XAF', unit: 'count', bin: { CNY: MARKET.CNY.defaultBin, XAF: MARKET.XAF.defaultBin } };
function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (p && typeof p === 'object') {
      const bin = (f: P2PFiat) => (MARKET[f].bins.includes(p.bin?.[f]) ? p.bin[f] : MARKET[f].defaultBin);
      return { fiat: p.fiat === 'CNY' ? 'CNY' : 'XAF', unit: p.unit === 'usdt' ? 'usdt' : 'count', bin: { CNY: bin('CNY'), XAF: bin('XAF') } };
    }
  } catch { /* stockage indisponible */ }
  return DEFAULT_PREFS;
}

/** Filtres d'un côté : « bonzini » tant que l'équipe n'a rien changé. */
type FilterState = P2PFilters | 'bonzini';

const KIND: [string, 0 | 1 | 2][] = [['Tous', 0], ['Marchands', 1], ['Pro', 2]];
const ORDERS: [string, number][] = [['Tous', 0], ['50', 50], ['200', 200], ['500', 500]];
const FINISH: [string, number][] = [['Tous', 0], ['90 %', 900], ['95 %', 950], ['98 %', 980]];
const TIME: [string, number][] = [['Tous', 0], ['15 min', 15], ['30 min', 30]];

export function MobileRatesMarketScreen() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canManageRates')) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Marché Binance" backTo="/m/more/rates" />
        <ScreenError title="Accès réservé" description="Le marché demande le droit de gérer les taux." />
      </div>
    );
  }
  return <Market onUse={() => navigate('/m/more/rates/publish', { state: { source: 'suggestion' } })} />;
}

function Market({ onUse }: { onUse: () => void }) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch { /* ignoré */ } }, [prefs]);
  const [live, setLive] = useState(true);
  const [full, setFull] = useState<Record<P2PFiat, boolean>>({ CNY: false, XAF: false });
  const [filterState, setFilterState] = useState<Record<P2PFiat, FilterState>>({ CNY: 'bonzini', XAF: 'bonzini' });
  const [selected, setSelected] = useState<Record<P2PFiat, number | null>>({ CNY: null, XAF: null });

  const more = useSheet();
  const adsSheet = useSheet();
  const levelsSheet = useSheet();
  const filtersSheet = useSheet();
  const binSheet = useSheet();

  const { data: suggestion } = useLatestSuggestion();
  const computeSuggestion = useComputeSuggestion();
  const cny = useBinanceP2PBook('CNY', { live });
  const xaf = useBinanceP2PBook('XAF', { live });
  const fiat = prefs.fiat;
  const q = fiat === 'CNY' ? cny : xaf;
  const book = q.data;
  const bin = prefs.bin[fiat];
  const best = MARKET[fiat].best === 'max';
  const fs = filterState[fiat];
  const f: P2PFilters = useMemo(
    () => (fs === 'bonzini' ? (book ? bonziniFilters(fiat, book.methods) : blankFilters()) : fs),
    [fs, book, fiat],
  );

  const setFilters = (nf: P2PFilters) => {
    setFilterState((s) => ({ ...s, [fiat]: nf }));
    setSelected((s) => ({ ...s, [fiat]: null }));
    if (nf.lo == null && nf.hi == null && (f.lo != null || f.hi != null)) setFull((s) => ({ ...s, [fiat]: false }));
  };

  const v = useMemo(() => {
    if (!book) return null;
    const ads = book.ads.filter(matcher(f, book.methods));
    const lv = toLevels(ads, bin);
    const zoom = zoomOf(ads, fiat, f, full[fiat]);
    const bars = zoom ? histogram(lv, bin, zoom, fiat, 120) : [];
    const shown = bars.reduce((s, l) => s + l.count, 0);
    const cumulative = new Map<number, number>();
    let c = 0;
    for (const l of best ? [...lv].reverse() : lv) { c += l.shareCount; cumulative.set(l.key, c); }
    const mode = lv.reduce<P2PLevel | null>((m, l) => (!m || l.count > m.count ? l : m), null);
    return { ads, lv, zoom, bars, hidden: ads.length - shown, cumulative, mode, med: median(ads), bestP: bestPrice(ads, fiat) };
  }, [book, f, bin, fiat, full, best]);

  const marketRate = useMemo(() => {
    const c = cny.data, x = xaf.data;
    if (!c || !x) return NaN;
    const mc = median(c.ads.filter(matcher(bonziniFilters('CNY', c.methods), c.methods)));
    const mx = median(x.ads.filter(matcher(bonziniFilters('XAF', x.methods), x.methods)));
    return impliedRate(mc, mx);
  }, [cny.data, xaf.data]);

  const picked = v && selected[fiat] != null && v.lv.some((l) => l.key === selected[fiat]) ? selected[fiat] : null;
  const selKey = picked ?? v?.mode?.key ?? null;
  const selLevel = v?.lv.find((l) => l.key === selKey) ?? null;
  const pdec = priceDecimals(fiat, bin);
  const unitLabel = fiat === 'XAF' ? 'XAF / USDT' : '¥ / USDT';
  const isBonzini = book ? sameFilters(f, bonziniFilters(fiat, book.methods)) : fs === 'bonzini';
  const isAll = sameFilters({ ...f, lo: null, hi: null }, blankFilters());
  const activeCount = isBonzini ? 0 : [f.pay.length, f.amount, f.kind, f.minOrders, f.minFinish, f.maxTime, f.lo != null || f.hi != null].filter(Boolean).length;
  const stale = q.isError && !!book;

  const openLevel = (key: number) => { setSelected((s) => ({ ...s, [fiat]: key })); adsSheet.show(); };

  const bars = v?.bars ?? [];
  const xLabels = bars.length
    ? [...new Set([0, Math.round((bars.length - 1) / 4), Math.round((bars.length - 1) / 2), Math.round(((bars.length - 1) * 3) / 4), bars.length - 1])]
        .map((i) => ({ at: i, label: fmtPrice(bars[i].price, fiat === 'XAF' && bin >= 1 ? 0 : pdec) }))
    : [];

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop
        title="Marché Binance"
        backTo="/m/more/rates"
        right={
          <>
            <Tag tone={stale ? 'pending' : live ? 'success' : 'neutral'}>{stale ? 'En retard' : live ? 'En direct' : 'En pause'}</Tag>
            <span className="w-1" />
            <MoreButton onClick={more.show} />
          </>
        }
      />

      {suggestion && (
        <>
          <div className="px-5 pt-4">
            <HeroFigure
              label="Binance · pour 1 000 000 XAF"
              value={<>¥&nbsp;{nb(suggestion.suggested_rate)}</>}
              sub={[
                `Il y a ${formatDistanceToNow(new Date(suggestion.computed_at), { locale: fr })}`,
                Number.isFinite(marketRate) ? <>Médianes <b className="font-bold">{nb(marketRate)}</b></> : null,
              ].filter(Boolean)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 px-5 pt-3">
            <StatBox label="Achat au Cameroun" value={dec(suggestion.cmr_rate_max + suggestion.cmr_margin_xaf, 2, 2)} sub="XAF / USDT" />
            <StatBox label="Vente en Chine" value={dec(suggestion.chn_rate_avg, 3, 3)} sub="¥ / USDT" />
          </div>
        </>
      )}

      <div className="px-5 pt-5">
        <BoxSegmented
          ariaLabel="Côté du marché"
          options={[{ value: 'XAF', label: 'Cameroun · XAF' }, { value: 'CNY', label: 'Chine · ¥' }]}
          value={fiat}
          onChange={(m) => setPrefs((p) => ({ ...p, fiat: m }))}
        />
      </div>
      <ChipRow className="pt-3">
        <Chip label="Filtre Bonzini" active={isBonzini} onClick={() => setFilterState((s) => ({ ...s, [fiat]: 'bonzini' }))} />
        <Chip label="Tout Binance" active={!isBonzini && isAll} onClick={() => setFilters(blankFilters())} />
        <Chip label="Filtres" icon={ListFilter} count={activeCount || null} active={false} onClick={filtersSheet.show} />
      </ChipRow>

      {q.isError && !book ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void q.refresh() }}>Carnet Binance illisible</EmptyLine>
      ) : !book || !v ? (
        <ScreenLoader className="min-h-[260px]" label="Lecture du carnet…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 px-5 pt-4">
            <StatBox label="Meilleur prix" value={fmtPrice(v.bestP, 2)} sub={best ? 'le plus haut' : 'le plus bas'} />
            <StatBox label="Médiane" value={fmtPrice(v.med, 2)} sub={unitLabel} />
            <StatBox label="Le plus fréquent" value={v.mode ? fmtPrice(v.mode.price, pdec) : '—'} sub={v.mode ? `${fmtCount(v.mode.count)} annonces` : undefined} />
            <StatBox label="Annonces" value={fmtCount(v.ads.length)} sub={`sur ${fmtCount(book.total)}`} />
          </div>
          <div className="px-5 pt-4">
            <ChartCard title={`Prix ${unitLabel}`} aside={prefs.unit === 'count' ? 'Annonces' : 'USDT'}>
              {bars.length > 0 ? (
                <Histogram
                  bars={bars.map((l) => ({ key: l.key, value: prefs.unit === 'count' ? l.shareCount : l.shareUsdt, display: prefs.unit === 'count' ? fmtCount(l.count) : fmtUsdt(l.usdt) }))}
                  selected={selKey}
                  onSelect={openLevel}
                  xLabels={xLabels}
                  ariaLabel="Distribution des prix"
                />
              ) : (
                <p className={cn('py-12 text-center text-[16px]', TEXT.muted)}>Aucune annonce avec ces filtres</p>
              )}
              {v.hidden > 0 && (
                <p className={cn('mt-3 text-[15px]', TEXT.muted)}>{fmtCount(v.hidden)} annonces hors du graphique</p>
              )}
            </ChartCard>
          </div>
        </>
      )}

      <div className="h-6" />
      {suggestion && (
        <Dock>
          <BigButton onClick={onUse}>Utiliser ¥ {nb(suggestion.suggested_rate)}</BigButton>
        </Dock>
      )}

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          {
            label: cny.isFetching || xaf.isFetching ? 'Actualisation…' : 'Actualiser',
            hint: book?.fetchedAt ? `Relevé à ${fmtClock(book.fetchedAt, MARKET[fiat].timeZone)} heure ${MARKET[fiat].hourOf}` : undefined,
            icon: RefreshCw,
            onClick: () => { void cny.refresh(); void xaf.refresh(); },
          },
          { label: live ? 'Pause' : 'Reprendre le direct', icon: live ? Pause : Play, onClick: () => setLive((l) => !l) },
          { label: 'Recalculer la suggestion', icon: Sparkles, onClick: () => computeSuggestion.mutate(), disabled: computeSuggestion.isPending },
          {
            label: prefs.unit === 'count' ? 'Hauteur : % des USDT' : 'Hauteur : % des annonces',
            icon: BarChart3,
            onClick: () => setPrefs((p) => ({ ...p, unit: p.unit === 'count' ? 'usdt' : 'count' })),
          },
          { label: 'Largeur des paliers', hint: `${fmtPrice(bin, priceDecimals('XAF', bin))} ${fiat}`, icon: Layers, onClick: binSheet.show },
          {
            label: v?.zoom?.mode === 'custom' ? 'Revenir à la vue normale' : v?.zoom?.mode === 'auto' ? 'Voir tout le carnet' : 'Resserrer la vue',
            icon: Maximize2,
            onClick: () => {
              if (v?.zoom?.mode === 'custom') setFilters({ ...f, lo: null, hi: null });
              else setFull((s) => ({ ...s, [fiat]: !s[fiat] }));
            },
            hidden: !v || (v.zoom?.mode === 'full' && !full[fiat]),
          },
          { label: 'Tous les paliers', icon: ListFilter, onClick: levelsSheet.show, disabled: !v },
        ]}
      />

      {/* ── 16 · les annonces d'un palier ── */}
      <BottomSheet open={adsSheet.open && !!selLevel} onClose={adsSheet.hide}>
        {selLevel && <LevelAds level={selLevel} fiat={fiat} dec={pdec} />}
      </BottomSheet>

      {/* ── Tous les paliers ── */}
      <BottomSheet open={levelsSheet.open} onClose={levelsSheet.hide}>
        <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Tous les paliers</h3>
        <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{v ? `${fmtCount(v.lv.length)} prix · ${fmtCount(v.ads.length)} annonces` : ''}</p>
        <div className="mt-2">
          {v && (best ? [...v.lv].reverse() : v.lv).map((l) => (
            <ItemRow
              key={l.key}
              title={`${fmtPrice(l.price, pdec)} ${fiat}`}
              subtitle={`${fmtCount(l.count)} annonces · ${fmtPct(l.shareCount)} · cumul ${fmtPct(v.cumulative.get(l.key) ?? 0)}`}
              amount={`${fmtUsdt(l.usdt)} USDT`}
              onClick={() => { levelsSheet.hide(); openLevel(l.key); }}
              chevron
            />
          ))}
        </div>
      </BottomSheet>

      {/* ── Largeur des paliers ── */}
      <BottomSheet open={binSheet.open} onClose={binSheet.hide}>
        <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Largeur des paliers</h3>
        <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{MARKET[fiat].label} · {fiat}</p>
        <ChoiceChips
          className="mt-4"
          options={MARKET[fiat].bins.map((b) => ({ value: b, label: fmtPrice(b, priceDecimals('XAF', b)) }))}
          value={bin}
          onChange={(b) => { setPrefs((p) => ({ ...p, bin: { ...p.bin, [fiat]: b } })); setSelected((s) => ({ ...s, [fiat]: null })); binSheet.hide(); }}
        />
      </BottomSheet>

      {/* ── Filtres ── */}
      <BottomSheet open={filtersSheet.open} onClose={filtersSheet.hide}>
        {book && <FilterGroups fiat={fiat} methods={book.methods} ads={book.ads} filters={f} onChange={setFilters} onBonzini={() => setFilterState((s) => ({ ...s, [fiat]: 'bonzini' }))} />}
        <div className="mt-5"><BigButton onClick={filtersSheet.hide}>Voir {v ? fmtCount(v.ads.length) : ''} annonces</BigButton></div>
      </BottomSheet>
    </div>
  );
}

function LevelAds({ level, fiat, dec: d }: { level: P2PLevel; fiat: P2PFiat; dec: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const ads = [...level.ads].sort((a, b) => b[AD.usdt] - a[AD.usdt]);
  return (
    <>
      <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Annonces à {fmtPrice(level.price, d)} {fiat}</h3>
      <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{fmtCount(level.count)} annonces · {fmtPct(level.shareCount)} · {fmtUsdt(level.usdt)} USDT</p>
      <ItemList className="mt-2 px-0">
        {ads.map((a: P2PAd, i) => (
          <ItemRow
            key={`${a[AD.nick]}-${i}`}
            leading={<Initials name={a[AD.nick]} />}
            title={a[AD.nick]}
            subtitle={open === i
              ? `Limites ${fmtUsdt(a[AD.min])} – ${fmtUsdt(a[AD.max])} ${fiat}`
              : `${fmtCount(a[AD.orders])} ordres/mois · ${fmtPct(a[AD.finish] / 10, 1)}`}
            amount={`${fmtUsdt(a[AD.usdt])} USDT`}
            tag={a[AD.kind] > 0 ? { tone: 'neutral', label: a[AD.kind] === 2 ? 'Pro' : 'Marchand' } : undefined}
            onClick={() => setOpen((o) => (o === i ? null : i))}
          />
        ))}
      </ItemList>
    </>
  );
}

const parseNum = (s: string) => {
  const n = parseFloat(s.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

function FilterGroups({
  fiat, methods, ads, filters: f, onChange, onBonzini,
}: {
  fiat: P2PFiat;
  methods: { id: string; name: string }[];
  ads: P2PAd[];
  filters: P2PFilters;
  onChange: (f: P2PFilters) => void;
  onBonzini: () => void;
}) {
  const set = (patch: Partial<P2PFilters>) => onChange({ ...f, ...patch });
  const counts = useMemo(() => methods.map((_, i) => ads.filter((a) => a[AD.pay] & methodBit(i)).length), [methods, ads]);
  const list = methods.map((m, i) => ({ ...m, n: counts[i] })).filter((m) => m.n > 0 || f.pay.includes(m.id)).sort((a, b) => b.n - a.n).slice(0, 12);
  const [lo, setLo] = useState(f.lo == null ? '' : fmtPrice(f.lo, 2));
  const [hi, setHi] = useState(f.hi == null ? '' : fmtPrice(f.hi, 2));
  useEffect(() => { setLo(f.lo == null ? '' : fmtPrice(f.lo, 2)); setHi(f.hi == null ? '' : fmtPrice(f.hi, 2)); }, [f.lo, f.hi]);

  const group = (title: string, children: React.ReactNode) => (
    <div className="mt-5">
      <div className={cn('mb-2 text-[16px] font-semibold', TEXT.strong)}>{title}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Filtres</h3>
        <span className="flex gap-4">
          <button type="button" onClick={onBonzini} className={cn('text-[16px] font-semibold underline underline-offset-[3px]', TEXT.strong)}>Bonzini</button>
          <button type="button" onClick={() => onChange(blankFilters())} className={cn('text-[16px] font-semibold underline underline-offset-[3px]', TEXT.strong)}>Tout effacer</button>
        </span>
      </div>
      {group('Mode de paiement', list.map((m) => (
        <Chip
          key={m.id}
          label={m.name}
          count={m.n}
          active={f.pay.includes(m.id)}
          onClick={() => set({ pay: f.pay.includes(m.id) ? f.pay.filter((x) => x !== m.id) : [...f.pay, m.id] })}
        />
      )))}
      {group(`Montant (${fiat})`, [0, ...MARKET[fiat].amounts].map((a) => (
        <Chip key={a} label={a ? fmtCount(a) : 'Tous'} active={f.amount === a} onClick={() => set({ amount: a })} />
      )))}
      {group('Annonceur', KIND.map(([l, k]) => <Chip key={l} label={l} active={f.kind === k} onClick={() => set({ kind: k })} />))}
      {group('Ordres par mois', ORDERS.map(([l, n]) => <Chip key={l} label={n ? `${l} et plus` : l} active={f.minOrders === n} onClick={() => set({ minOrders: n })} />))}
      {group('Réussite', FINISH.map(([l, n]) => <Chip key={l} label={l} active={f.minFinish === n} onClick={() => set({ minFinish: n })} />))}
      {group('Délai de paiement', TIME.map(([l, n]) => <Chip key={l} label={l} active={f.maxTime === n} onClick={() => set({ maxTime: n })} />))}
      <div className="mt-5">
        <div className={cn('mb-2 text-[16px] font-semibold', TEXT.strong)}>Prix</div>
        <div className="flex items-center gap-3">
          <TextInput inputMode="decimal" value={lo} onChange={(e) => setLo(e.target.value)} onBlur={() => set({ lo: parseNum(lo) })} placeholder="De" aria-label="Prix minimum" className="flex-1" />
          <span className={TEXT.muted}>–</span>
          <TextInput inputMode="decimal" value={hi} onChange={(e) => setHi(e.target.value)} onBlur={() => set({ hi: parseNum(hi) })} placeholder="À" aria-label="Prix maximum" className="flex-1" />
        </div>
      </div>
    </>
  );
}
