/**
 * Mini-carnet sous l'histogramme : tout le carnet filtré en petites barres
 * (hauteur en racine carrée pour que la traîne reste visible) et la fenêtre
 * affichée en surbrillance. Glisser dessus = choisir une fourchette de prix.
 */
import { useEffect, useRef, useState } from 'react';
import { binLow, type P2PLevel } from '@/lib/p2pMarket';
import { fmtPrice } from './format';

const BH = 54;
const L = 48, R = 12;

export function P2PRangeStrip({
  levels, bin, lo, hi, onRange, dec = 2,
}: {
  levels: P2PLevel[];
  bin: number;
  lo: number;
  hi: number;
  onRange: (lo: number, hi: number) => void;
  /** décimales des graduations (0 pour le XAF) */
  dec?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(800);
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 800));
    ro.observe(el);
    setW(el.clientWidth || 800);
    return () => ro.disconnect();
  }, []);

  if (!levels.length) return null;
  const k0 = levels[0].key, k1 = levels[levels.length - 1].key;
  const p0 = binLow(k0, bin), p1 = binLow(k1 + 1, bin);
  const x = (p: number) => L + ((p - p0) / (p1 - p0 || 1)) * (W - L - R);
  const inv = (px: number) => p0 + ((Math.min(Math.max(px, L), W - R) - L) / (W - L - R)) * (p1 - p0);
  const maxN = Math.max(1, ...levels.map((l) => l.count));
  const bw = Math.max(1, (W - L - R) / (k1 - k0 + 1) - 1);
  const sel = drag ? [Math.min(drag.a, drag.b), Math.max(drag.a, drag.b)] : [x(lo), x(hi + bin)];
  const nTicks = Math.max(2, Math.floor(W / 110));
  const ticks = Array.from({ length: nTicks }, (_, i) => p0 + ((p1 - p0) * i) / (nTicks - 1));

  const local = (e: React.PointerEvent) => e.clientX - wrap.current!.getBoundingClientRect().left;

  return (
    <div
      ref={wrap}
      className="relative cursor-crosshair touch-none select-none"
      onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); const p = local(e); setDrag({ a: p, b: p }); }}
      onPointerMove={(e) => drag && setDrag({ ...drag, b: local(e) })}
      onPointerCancel={() => setDrag(null)}
      onPointerUp={() => {
        if (!drag) return;
        const a = Math.min(drag.a, drag.b), b = Math.max(drag.a, drag.b);
        setDrag(null);
        if (b - a < 4) return; // simple clic : on ne change rien
        const loK = Math.floor(inv(a) / bin + 1e-6), hiK = Math.floor(inv(b) / bin - 1e-6);
        onRange(binLow(loK, bin), binLow(Math.max(loK, hiK), bin));
      }}
      aria-label="Glisser pour choisir une fourchette de prix"
    >
      <svg width={W} height={BH + 22} className="block">
        {levels.map((l) => {
          const h = Math.sqrt(l.count / maxN) * (BH - 4);
          return <rect key={l.key} x={x(l.price)} y={BH - h} width={bw} height={h} style={{ fill: 'hsl(var(--muted-foreground))', opacity: 0.45 }} />;
        })}
        <rect x={sel[0]} y={0} width={Math.max(2, sel[1] - sel[0])} height={BH} rx={3}
          style={{ fill: 'hsl(var(--foreground))', fillOpacity: 0.07, stroke: 'hsl(var(--foreground))', strokeWidth: 1 }} />
        <rect x={sel[0] - 2} y={0} width={4} height={BH} rx={2} style={{ fill: 'hsl(var(--foreground))' }} />
        <rect x={sel[1] - 2} y={0} width={4} height={BH} rx={2} style={{ fill: 'hsl(var(--foreground))' }} />
        {ticks.map((p) => (
          <text key={p} x={x(p)} y={BH + 17} textAnchor="middle" className="fill-muted-foreground text-[13px] font-medium">{fmtPrice(p, dec)}</text>
        ))}
      </svg>
    </div>
  );
}
