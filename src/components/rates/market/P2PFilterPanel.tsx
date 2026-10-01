/**
 * Filtres du marché — TOUJOURS ouverts, effet immédiat (pas de bouton
 * « Appliquer »). Reprend les filtres de Binance P2P : mode de paiement,
 * montant, type d'annonceur, ordres/mois, réussite, délai — plus le zoom de
 * prix. Chaque mode de paiement affiche son nombre d'annonces.
 */
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AD, MARKET, methodBit, blankFilters, bonziniFilters, sameFilters, type P2PBook, type P2PFiat, type P2PFilters } from '@/lib/p2pMarket';
import { fmtCount, fmtPrice, fmtUsdt } from './format';
import { chipCls } from './styles';
import { TextField } from '@/components/form/TextField';

const KIND: [string, 0 | 1 | 2][] = [['Tous', 0], ['Marchands', 1], ['Pro', 2]];
const ORDERS: [string, number][] = [['Tous', 0], ['50', 50], ['200', 200], ['500', 500]];
const FINISH: [string, number][] = [['Tous', 0], ['90 %', 900], ['95 %', 950], ['98 %', 980]];
const TIME: [string, number][] = [['Tous', 0], ['15 min', 15], ['30 min', 30]];


const parseNum = (s: string) => {
  const v = parseFloat(s.replace(/[\s  ]/g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

export function P2PFilterPanel({
  fiat, book, filters, onChange,
}: {
  fiat: P2PFiat;
  book: P2PBook;
  filters: P2PFilters;
  onChange: (f: P2PFilters) => void;
}) {
  const f = filters;
  const set = (patch: Partial<P2PFilters>) => onChange({ ...f, ...patch });
  const bz = bonziniFilters(fiat, book.methods);
  const counts = useMemo(() => book.methods.map((_, i) => book.ads.filter((a) => a[AD.pay] & methodBit(i)).length), [book]);
  const methods = book.methods
    .map((m, i) => ({ ...m, i, n: counts[i] }))
    .filter((m) => m.n > 0 || f.pay.includes(m.id))
    .sort((a, b) => b.n - a.n);

  // champs texte : saisie libre, valeur appliquée au fil de la frappe (montant)
  // ou à la sortie du champ (prix)
  const [amount, setAmount] = useState(f.amount ? fmtCount(f.amount) : '');
  const [lo, setLo] = useState(f.lo == null ? '' : fmtPrice(f.lo, 2));
  const [hi, setHi] = useState(f.hi == null ? '' : fmtPrice(f.hi, 2));
  useEffect(() => { setAmount(f.amount ? fmtCount(f.amount) : ''); }, [f.amount, fiat]);
  useEffect(() => { setLo(f.lo == null ? '' : fmtPrice(f.lo, 2)); setHi(f.hi == null ? '' : fmtPrice(f.hi, 2)); }, [f.lo, f.hi, fiat]);


  return (
    <section aria-label="Filtres" className="rounded-[10px] border border-border bg-card px-[18px] pb-[18px]">
      <div className="flex items-center justify-between pb-1.5 pt-3.5">
        <h3 className="text-[16px] font-extrabold text-foreground">Filtres</h3>
        <button type="button" onClick={() => onChange(blankFilters())} className="p-1 text-[13px] font-bold text-muted-foreground underline underline-offset-[3px] hover:text-foreground">
          Tout effacer
        </button>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <button type="button" className={cn(chipCls(sameFilters(f, blankFilters())), 'h-9 justify-center')} onClick={() => onChange(blankFilters())}>Tout Binance</button>
        <button type="button" className={cn(chipCls(sameFilters(f, bz)), 'h-9 justify-center')} onClick={() => onChange(bz)}>Filtre Bonzini</button>
      </div>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Bonzini = {fiat === 'CNY' ? 'Alipay ou WeChat, ' : ''}200 ordres/mois, 95 % de réussite.
      </p>

      <Group label="Mode de paiement" hint="vide = tous">
        <div className="flex flex-wrap gap-1.5">
          {methods.map((m) => {
            const on = f.pay.includes(m.id);
            return (
              <button key={m.id} type="button" aria-pressed={on} className={chipCls(on)} onClick={() => set({ pay: on ? f.pay.filter((id) => id !== m.id) : [...f.pay, m.id] })}>
                {m.name.replace(/\s*-\s*OM$/, '')} <small className="text-[12px] font-medium opacity-75">{fmtCount(m.n)}</small>
              </button>
            );
          })}
        </div>
      </Group>

      <Group label="Montant à traiter" hint={`en ${fiat}`}>
        <TextField
          variant="numeric" size="sm" placeholder="Tous montants" autoComplete="off" value={amount}
          onChange={(e) => { setAmount(e.target.value); const v = parseNum(e.target.value); set({ amount: v && v > 0 && Number.isSafeInteger(Math.round(v)) ? Math.round(v) : 0 }); }}
          aria-label={`Montant à traiter en ${fiat}`}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MARKET[fiat].amounts.map((v) => (
            <button key={v} type="button" className={chipCls(f.amount === v)} onClick={() => set({ amount: f.amount === v ? 0 : v })}>{fmtUsdt(v)}</button>
          ))}
        </div>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Garde les annonces dont les limites acceptent ce montant.</p>
      </Group>

      <Group label="Zoom sur les prix" hint={`en ${fiat}`}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TextField variant="decimal" size="sm" placeholder="min" value={lo} aria-label="Prix minimum"
            onChange={(e) => setLo(e.target.value)} onBlur={() => set({ lo: parseNum(lo) })} onKeyDown={(e) => e.key === 'Enter' && set({ lo: parseNum(lo) })} />
          <span className="text-muted-foreground">à</span>
          <TextField variant="decimal" size="sm" placeholder="max" value={hi} aria-label="Prix maximum"
            onChange={(e) => setHi(e.target.value)} onBlur={() => set({ hi: parseNum(hi) })} onKeyDown={(e) => e.key === 'Enter' && set({ hi: parseNum(hi) })} />
        </div>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Ou glissez sur la petite barre sous le graphique. Les % restent calculés sur toutes les annonces.</p>
      </Group>

      <Group label="Annonceurs"><Chips opts={KIND} cur={f.kind} on={(v) => set({ kind: v as 0 | 1 | 2 })} /></Group>
      <Group label="Ordres par mois, au moins"><Chips opts={ORDERS} cur={f.minOrders} on={(v) => set({ minOrders: v })} /></Group>
      <Group label="Taux de réussite, au moins"><Chips opts={FINISH} cur={f.minFinish} on={(v) => set({ minFinish: v })} /></Group>
      <Group label="Délai de paiement, au plus"><Chips opts={TIME} cur={f.maxTime} on={(v) => set({ maxTime: v })} /></Group>
    </section>
  );
}

function Group({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border-t border-border pt-3.5">
      <div className="mb-2 flex justify-between text-[13px] font-bold text-foreground">
        {label} {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chips({ opts, cur, on }: { opts: [string, number][]; cur: number; on: (v: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opts.map(([l, v]) => (
        <button key={l} type="button" aria-pressed={v === cur} className={chipCls(v === cur)} onClick={() => on(v)}>{l}</button>
      ))}
    </div>
  );
}
