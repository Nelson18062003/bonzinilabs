/**
 * Saisie de montant — géométrie DESKTOP.
 *
 * `components/treasury/MoneyField` fait 54px de haut avec un texte de 18px :
 * c'est une cible tactile, calibrée pour empêcher le zoom automatique d'iOS.
 * Sur desktop la règle du kit est 36px (02-foundation.md §1.3) et cette
 * contrainte iOS n'existe pas.
 *
 * La LOGIQUE, elle, est identique : même `parseAmount` (virgule décimale
 * française, espaces d'affichage) et même formatage au blur — une saisie
 * financière ne doit pas exister en deux versions qui divergent.
 */
import * as React from 'react';
import { parseAmount } from '@/components/form/AmountField';
import { cn } from '@/lib/utils';
import { TEXT } from '@/desktop/designKit';

export function TreasuryMoneyInput({
  currency,
  value,
  onValueChange,
  decimals = 0,
  placeholder = '0',
  id,
  className,
  autoFocus,
}: {
  currency: string;
  value: number | null;
  onValueChange: (value: number | null) => void;
  decimals?: number;
  placeholder?: string;
  id?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const isDecimal = decimals > 0;
  const formatter = React.useMemo(
    () => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimals, useGrouping: true }),
    [decimals],
  );
  const format = React.useCallback(
    (n: number | null) => (n == null || Number.isNaN(n) ? '' : formatter.format(n)),
    [formatter],
  );
  const [display, setDisplay] = React.useState(() => format(value));
  const [focused, setFocused] = React.useState(false);

  // Tant que le champ a le focus, on n'écrase pas ce que l'utilisateur tape.
  React.useEffect(() => {
    if (!focused) setDisplay(format(value));
  }, [value, focused, format]);

  return (
    <div
      className={cn(
        'flex h-9 items-center rounded-[10px] bg-[#F6F5FB] px-3 ring-1 ring-black/[0.06] transition focus-within:ring-2 focus-within:ring-[#6B5BD2] dark:bg-[#2A2836] dark:ring-white/[0.06] dark:focus-within:ring-[#A99BF0]',
        className,
      )}
    >
      {/* eslint-disable-next-line no-restricted-syntax -- surface desktop : la règle des 16px vise le zoom automatique d'iOS, qui ne s'applique pas ici */}
      <input
        id={id}
        type="text"
        inputMode={isDecimal ? 'decimal' : 'numeric'}
        autoFocus={autoFocus}
        value={display}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          const parsed = parseAmount(display, isDecimal);
          setDisplay(parsed == null ? '' : format(parsed));
        }}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^\d.,\s-]/g, '');
          setDisplay(cleaned);
          onValueChange(parseAmount(cleaned, isDecimal));
        }}
        placeholder={placeholder}
        className={cn('min-w-0 flex-1 bg-transparent text-right text-[13px] font-bold tabular-nums outline-none placeholder:font-normal', TEXT.strong)}
      />
      <span className={cn('ml-2 shrink-0 text-[11px] font-semibold', TEXT.muted)}>{currency}</span>
    </div>
  );
}
