/**
 * « Taux appliqué · Modifier » : le taux négocié avec le client (simulateur
 * et cotation). Vide = taux automatique ; « Revenir au taux automatique »
 * quand un taux personnalisé est posé. Rien n'est enregistré en base : c'est
 * le taux de la cotation, comme sur l'ordinateur.
 */
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { parseDecimal } from '@/lib/decimalInput';
import { BigButton, BottomSheet, Line, TEXT, TextInput } from '@/mobile/designKit';
import { dec } from './rateFormat';

export function CustomRateSheet({
  open, onClose, auto, custom, onApply,
}: {
  open: boolean;
  onClose: () => void;
  /** Le taux automatique (pays et palier appliqués). */
  auto: number | null;
  /** Le taux personnalisé en cours, NaN sinon. */
  custom: number;
  onApply: (rate: number) => void;
}) {
  const hasCustom = Number.isFinite(custom) && custom > 0;
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(hasCustom ? String(custom).replace('.', ',') : ''); }, [open, custom, hasCustom]);
  const v = parseDecimal(text);
  const valid = Number.isFinite(v) && v > 0 && v < 1_000_000;
  const gap = valid && auto ? v - auto : null;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Taux appliqué</h3>
      <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{auto ? `Automatique ¥ ${dec(auto)} · pour 1 000 000 XAF` : 'Pour 1 000 000 XAF'}</p>
      <TextInput
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={auto ? dec(auto) : ''}
        aria-label="Taux personnalisé"
        className="mt-4 h-14 text-right text-[24px] font-bold tabular-nums"
      />
      {gap != null && Math.abs(gap) >= 0.01 && (
        <Line className="mt-3" tone={gap < 0 ? 'bad' : 'good'}>
          {gap > 0 ? '+' : '−'}{dec(Math.abs(gap))} ¥ sur le taux du jour
        </Line>
      )}
      <div className="mt-5 flex flex-col gap-2.5">
        <BigButton onClick={() => { if (valid) { onApply(v); onClose(); } }} disabled={!valid}>Appliquer</BigButton>
        {hasCustom && (
          <BigButton variant="soft" onClick={() => { onApply(NaN); onClose(); }}>Revenir au taux automatique</BigButton>
        )}
      </div>
    </BottomSheet>
  );
}
