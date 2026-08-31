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
import { M, T, NUM } from './marketKit';

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
        'flex h-8 items-center rounded-[6px] px-3 transition focus-within:ring-2 focus-within:ring-[#4F46E5] dark:focus-within:ring-[#818CF8]',
        M.inset,
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
        className={cn('min-w-0 flex-1 bg-transparent text-right text-[12.5px] font-bold outline-none placeholder:font-normal', NUM, T.ink)}
      />
      <span className={cn('ml-2 shrink-0 text-[10.5px] font-semibold', T.faint)}>{currency}</span>
    </div>
  );
}
