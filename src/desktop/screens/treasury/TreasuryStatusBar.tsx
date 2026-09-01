/**
 * Trésorerie — barre d'état (docs/admin-redesign/07 §3.2), habillage
 * « salle des marchés ».
 *
 * Les chiffres qui pilotent la journée, visibles quelle que soit la vue :
 * stock USDT, WAC, et les soldes agrégés par devise. Chiffres en mono, un
 * filet vertical entre les colonnes plutôt que quatre cartes flottantes.
 *
 * Un stock USDT négatif signifie mécaniquement un achat non saisi : il est
 * traité comme une alerte, pas comme une valeur parmi d'autres.
 */
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { M, T, NUM, LABEL, TONE, TONE_BG } from './marketKit';
import { fmtCompact, fmtNum, type TreasuryCurrency } from './treasuryFormat';

interface Figure {
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
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
  const accounts = (cur: TreasuryCurrency) => {
    const n = totals[cur]?.count ?? 0;
    return `${n} compte${n > 1 ? 's' : ''}`;
  };

  const figures: Figure[] = [
    {
      label: 'Stock USDT',
      value: fmtNum(stockUsdt, 2),
      hint: stockNegative ? 'USDT · achat manquant à saisir' : 'USDT · disponible à la vente',
      danger: stockNegative,
    },
    { label: 'WAC', value: fmtNum(wac, 2), hint: 'XAF/USDT · coût moyen du stock' },
    { label: 'XAF', value: fmtCompact(totals.XAF?.total ?? 0, 'XAF'), hint: `XAF · ${accounts('XAF')}` },
    { label: 'CNY', value: fmtCompact(totals.CNY?.total ?? 0, 'CNY'), hint: `CNY · ${accounts('CNY')}` },
  ];

  return (
    <div className={cn('overflow-hidden rounded-[6px] border', M.border, M.card)}>
      <div className="grid grid-cols-4">
        {figures.map((f, i) => (
          <div key={f.label} className={cn('px-4 py-3', i > 0 && cn('border-l', M.border))}>
            <div className="flex items-center gap-1.5">
              <span className={cn(LABEL, f.danger ? TONE.negative : T.muted)}>{f.label}</span>
              {f.danger && <AlertTriangle className={cn('h-3 w-3', TONE.negative)} />}
            </div>
            <div className={cn('mt-1 text-[21px] font-bold leading-none tracking-[-0.02em]', NUM, f.danger ? TONE.negative : T.ink)}>
              {f.value}
            </div>
            <div className={cn('mt-1.5 text-[10.5px]', T.faint)}>{f.hint}</div>
          </div>
        ))}
      </div>
      {stockNegative && (
        <div className={cn('flex items-center gap-2 border-t px-4 py-2', M.border, TONE_BG.negative)}>
          <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0', TONE.negative)} />
          <span className={cn('text-[11.5px] font-medium', TONE.negative)}>
            Stock USDT négatif (<span className={NUM}>{fmtNum(stockUsdt, 2)}</span>) — il manque un achat au journal. Le WAC et le
            bénéfice sont faux tant que ce n'est pas corrigé.
          </span>
        </div>
      )}
    </div>
  );
}
