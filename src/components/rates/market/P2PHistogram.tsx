/**
 * Histogramme du carnet Binance P2P — une barre par palier de prix, hauteur =
 * part du palier dans TOUTES les annonces filtrées (ou dans les USDT).
 * SVG maison (pas de lib de graphe) : barres à sommet arrondi posées sur
 * l'axe, paliers vides gardés, ligne de médiane, étiquettes directes
 * espacées, survol avec infobulle, clic = choisir un palier. Les barres
 * glissent d'un relevé à l'autre (framer-motion anime position et hauteur).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { binKey, priceDecimals, type P2PFiat, type P2PLevel, MARKET } from '@/lib/p2pMarket';
import { fmtCount, fmtPct, fmtPrice, fmtUsdt } from './format';

const H = 360;
const M = { t: 30, r: 12, b: 34, l: 48 };
const INK = 'hsl(var(--foreground))';

function niceMax(v: number) {
  const steps = [1, 2, 2.5, 5, 10];
  const mag = 10 ** Math.floor(Math.log10(Math.max(v, 0.01)));
  for (const s of steps) if (s * mag >= v) return s * mag;
  return 10 * mag;
}

export function P2PHistogram({
  fiat, bars, bin, unit, median, selected, onSelect, cumulative,
}: {
  fiat: P2PFiat;
  bars: P2PLevel[];
  bin: number;
  unit: 'count' | 'usdt';
  median: number;
  selected: number | null;
  onSelect: (key: number | null) => void;
  /** part cumulée « à ce prix ou mieux », par palier */
  cumulative: Map<number, number>;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(800);
  // survol : on ne re-rend qu'au changement de palier ; l'infobulle s'ancre
  // sur la barre (pas sur la souris) pour ne pas re-rendre à chaque pixel
  const [hover, setHover] = useState<{ key: number; x: number; y: number } | null>(null);
  const reduce = useReducedMotion();
  const clipId = `p2p-clip-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 800));
    ro.observe(el);
    setW(el.clientWidth || 800);
    return () => ro.disconnect();
  }, []);

  const share = (l: P2PLevel) => (unit === 'count' ? l.shareCount : l.shareUsdt);
  const g = useMemo(() => {
    const n = Math.max(1, bars.length);
    const bw = (W - M.l - M.r) / n;
    const gap = bw > 6 ? 2 : bw > 3 ? 1 : 0;
    const ymax = niceMax(Math.max(1, ...bars.map(share)));
    const y = (v: number) => H - M.b - (v / ymax) * (H - M.b - M.t);
    const x = (i: number) => M.l + i * bw;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * ymax);
    const every = Math.max(1, Math.ceil(46 / bw));
    // étiquettes directes : toutes si la place le permet, sinon les 4 plus
    // hautes à 50 px d'écart au moins
    const room = bw >= 46;
    const cand = bars.map((l, i) => ({ l, i })).filter((o) => share(o.l) > 0).sort((a, b) => share(b.l) - share(a.l));
    const labels: number[] = [];
    for (const o of cand) {
      if (!room && labels.length >= 4) break;
      if (room && share(o.l) < 0.5) continue;
      if (labels.every((j) => Math.abs(j - o.i) * bw >= 50)) labels.push(o.i);
    }
    return { bw, gap, ymax, y, x, ticks, every, labels: new Set(labels) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, W, unit]);

  const dec = priceDecimals(fiat, bin);
  const k0 = bars[0]?.key ?? 0;
  const medIdx = Number.isFinite(median) ? binKey(median, bin) - k0 : -1;
  const hovered = hover ? bars.find((l) => l.key === hover.key) : null;
  const best = MARKET[fiat].best === 'max';
  const range = (l: P2PLevel) => (bin === 0.01 ? fmtPrice(l.price, 2) : `${fmtPrice(l.price, 2)} – ${fmtPrice(l.price + bin - 0.01, 2)}`);

  return (
    <div ref={wrap} className="relative" onMouseLeave={() => setHover(null)}>
      <svg width={W} height={H} role="img" aria-label={`Distribution de ${bars.reduce((s, l) => s + l.count, 0)} annonces par prix`} className="block overflow-visible">
        {g.ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={g.y(t)} y2={g.y(t)} stroke="hsl(var(--border))" strokeOpacity={t === 0 ? 1 : 0.6} />
            <text x={M.l - 8} y={g.y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[13px] font-medium">
              {fmtPct(t, 0)}
            </text>
          </g>
        ))}

        {/* barres : rect animés (x, y, largeur, hauteur) ; le coin arrondi du
            pied est caché sous l'axe par le clip → sommet arrondi, pied carré */}
        <clipPath id={clipId}><rect x={0} y={0} width={W} height={H - M.b} /></clipPath>
        <g clipPath={`url(#${clipId})`}>
          {bars.map((l, i) => {
            const w = Math.max(1, g.bw - g.gap);
            const s = share(l);
            const h = s > 0 ? Math.max(2, H - M.b - g.y(s)) : 0;
            const dim = (selected != null && l.key !== selected) || (hover != null && l.key !== hover.key && l.key !== selected);
            return (
              <motion.rect
                key={l.key}
                rx={Math.min(4, w / 2)}
                initial={{ x: g.x(i) + g.gap / 2, y: H - M.b, width: w, height: 0 }}
                animate={{ x: g.x(i) + g.gap / 2, y: H - M.b - h, width: w, height: h > 0 ? h + 4 : 0 }}
                transition={{ duration: reduce ? 0 : 0.6, ease: [0.2, 0.7, 0.2, 1] }}
                style={{ fill: INK, opacity: dim ? 0.28 : selected === l.key ? 1 : 0.85, transition: 'opacity .15s' }}
              />
            );
          })}
        </g>

        {bars.map((l, i) => g.labels.has(i) && (
          <motion.text
            key={`lab-${l.key}`}
            animate={{ x: g.x(i) + g.bw / 2, y: g.y(share(l)) - 7 }}
            initial={false}
            transition={{ duration: reduce ? 0 : 0.6 }}
            textAnchor="middle"
            className="fill-foreground text-[13px] font-bold"
          >
            {fmtPct(share(l))}
          </motion.text>
        ))}

        {medIdx >= 0 && medIdx < bars.length && (() => {
          const mx = g.x(medIdx) + g.bw / 2;
          const right = mx > W - 150;
          return (
            <g>
              <line x1={mx} x2={mx} y1={M.t - 18} y2={H - M.b} stroke={INK} strokeWidth={1.5} strokeDasharray="4 4" />
              <text x={mx + (right ? -6 : 6)} y={M.t - 8} textAnchor={right ? 'end' : 'start'} className="fill-foreground text-[13px] font-bold">
                médiane {fmtPrice(median, 2)}
              </text>
            </g>
          );
        })()}

        {bars.map((l, i) => (i % g.every === 0) && (
          <text key={`x-${l.key}`} x={g.x(i) + g.bw / 2} y={H - M.b + 20} textAnchor="middle" className="fill-muted-foreground text-[13px] font-medium">
            {fmtPrice(l.price, dec)}
          </text>
        ))}

        {/* zones de survol : toute la hauteur, plus larges que la barre */}
        {bars.map((l, i) => (
          <rect
            key={`hit-${l.key}`}
            x={g.x(i)} y={M.t - 20} width={g.bw} height={H - M.b - M.t + 20}
            fill="transparent" className="cursor-pointer"
            onMouseEnter={() => setHover({ key: l.key, x: g.x(i) + g.bw / 2, y: Math.min(g.y(share(l)), H - M.b - 40) })}
            onClick={() => onSelect(selected === l.key ? null : l.key)}
          />
        ))}
      </svg>

      {hover && hovered && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 min-w-[200px] rounded-lg border border-border bg-card px-3 py-2.5 text-[13px] shadow-lg"
          style={{ left: hover.x + 16 + 220 > W ? hover.x - 232 : hover.x + 16, top: Math.max(0, Math.min(hover.y - 150, H - 170)) }}
        >
          <p className="mb-1.5 text-[16px] font-extrabold text-foreground">{range(hovered)} {fiat}</p>
          <Row k="Annonces" v={fmtCount(hovered.count)} />
          <Row k="Part des annonces" v={fmtPct(hovered.shareCount)} />
          <Row k="USDT disponibles" v={fmtUsdt(hovered.usdt)} />
          <Row k="Part des USDT" v={fmtPct(hovered.shareUsdt)} />
          {hovered.count > 0 && (
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              {fmtPct(cumulative.get(hovered.key) ?? 0)} des annonces sont à ce prix ou {best ? 'plus haut' : 'plus bas'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 text-muted-foreground">
      {k} <b className="font-bold text-foreground">{v}</b>
    </div>
  );
}
