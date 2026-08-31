/**
 * Trésorerie — barre d'état (docs/admin-redesign/07 §3.2).
 *
 * Les chiffres qui pilotent la journée, visibles quelle que soit la vue :
 * stock USDT, WAC, et les soldes agrégés par devise. Rien d'autre — l'ancien
 * accueil répétait ces mêmes valeurs sur trois écrans sans qu'aucun ne soit
 * la référence.
 *
 * Un stock USDT négatif signifie mécaniquement un achat non saisi : il est
 * traité comme une alerte, pas comme une valeur parmi d'autres.
 */
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/desktop/designKit';
import { fmtCompact, fmtNum, type TreasuryCurrency } from './treasuryFormat';

interface Figure {
  label: string;
  value: string;
  unit: string;
  hint?: string;
  danger?: boolean;
}

function FigureCell({ f, last }: { f: Figure; last: boolean }) {
  return (
    <div
      className={cn(
        'min-w-0 flex-1 px-5 py-3.5',
        !last && 'border-r border-black/[0.06] dark:border-white/[0.06]',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('text-[11px] font-bold uppercase tracking-wider', f.danger ? 'text-[#C0504D] dark:text-[#E79A9A]' : TEXT.muted)}>
          {f.label}
        </span>
        {f.danger && <AlertTriangle className="h-3.5 w-3.5 text-[#C0504D] dark:text-[#E79A9A]" />}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={cn('text-[22px] font-extrabold leading-none tracking-tight tabular-nums', f.danger ? 'text-[#C0504D] dark:text-[#E79A9A]' : TEXT.strong)}>
          {f.value}
        </span>
        <span className={cn('text-[11px] font-semibold', TEXT.muted)}>{f.unit}</span>
      </div>
      {f.hint && <div className={cn('mt-1 truncate text-[11px]', TEXT.muted)}>{f.hint}</div>}
    </div>
  );
}

export function TreasuryStatusBar({
  stockUsdt,
  wac,
  totals,
}: {
  stockUsdt: number | undefined;
  wac: number | undefined;
  totals: Partial<Record<TreasuryCurrency, { total: number; count: number }>>;
}) {
  const stockNegative = (stockUsdt ?? 0) < 0;

  const accountsHint = (cur: TreasuryCurrency) => {
    const n = totals[cur]?.count ?? 0;
    return `${n} compte${n > 1 ? 's' : ''}`;
  };

  const figures: Figure[] = [
    {
      label: 'Stock USDT',
      value: fmtNum(stockUsdt, 2),
      unit: 'USDT',
      hint: stockNegative ? 'Achat manquant à saisir' : 'Disponible à la vente',
      danger: stockNegative,
    },
    { label: 'WAC', value: fmtNum(wac, 2), unit: 'XAF/USDT', hint: "Coût moyen du stock" },
    { label: 'XAF', value: fmtCompact(totals.XAF?.total ?? 0, 'XAF'), unit: 'XAF', hint: accountsHint('XAF') },
    { label: 'CNY', value: fmtCompact(totals.CNY?.total ?? 0, 'CNY'), unit: 'CNY', hint: accountsHint('CNY') },
  ];

  return (
    <div className={cn('overflow-hidden rounded-[14px]', SURFACE.card, SURFACE.shadow)}>
      <div className="flex divide-y-0">
        {figures.map((f, i) => (
          <FigureCell key={f.label} f={f} last={i === figures.length - 1} />
        ))}
      </div>
      {stockNegative && (
        <div className="flex items-center gap-2 border-t border-black/[0.06] bg-[#FBE7E7] px-5 py-2.5 dark:border-white/[0.06] dark:bg-[#3A2526]">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#C0504D] dark:text-[#E79A9A]" />
          <span className="text-[12px] font-medium text-[#C0504D] dark:text-[#E79A9A]">
            Stock USDT négatif ({fmtNum(stockUsdt, 2)}) — il manque un achat au journal. Le WAC et le bénéfice sont faux tant que ce n'est pas corrigé.
          </span>
        </div>
      )}
    </div>
  );
}
