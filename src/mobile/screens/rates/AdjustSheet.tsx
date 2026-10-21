/**
 * La feuille « Écart du Gabon » / « 400 000 à 999 999 XAF » (maquettes
 * 08-taux/11 et 13) : paliers 0 à −2 %, puis le signe et la saisie libre,
 * l'avant → après des taux touchés, et « Enregistrer −1 % ».
 *
 * Même règle que CountryRatesCard : le signe est un bouton à part (le pavé
 * décimal d'iOS n'a pas de « − »), un écart au-delà de ±20 % est refusé, un
 * écart positif est signalé. L'enregistrement passe par la même ligne
 * `rate_adjustments` (RPC `update_rate_adjustment`, `canManageRates`).
 */
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { parseDecimal } from '@/lib/decimalInput';
import { COUNTRY_ADJUSTMENT_PRESETS, formatCountryPct } from '@/lib/countryRates';
import { BigButton, BottomSheet, KVBox, Line, TEXT, TOGGLE_OFF, TOGGLE_ON, FOCUS_RING, type KV, TextInput } from '@/mobile/designKit';
import { ChoiceChips } from './parts';

const MAX_ABS_PCT = 20;

export function AdjustSheet({
  open, onClose, title, subtitle, current, rows, note, positiveWarning, onSave, saving,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  /** L'écart enregistré, en %. */
  current: number;
  /** L'avant → après pour un écart donné. */
  rows: (pct: number) => KV[];
  note?: React.ReactNode;
  positiveWarning: React.ReactNode;
  onSave: (pct: number) => Promise<void>;
  saving: boolean;
}) {
  const [sign, setSign] = useState<-1 | 1>(current > 0 ? 1 : -1);
  const [abs, setAbs] = useState(String(Math.abs(current)).replace('.', ','));
  useEffect(() => {
    if (!open) return;
    setSign(current > 0 ? 1 : -1);
    setAbs(String(Math.abs(current)).replace('.', ','));
  }, [open, current]);

  const n = parseDecimal(abs);
  const pct = Number.isFinite(n) ? sign * Math.abs(n) : NaN;
  const valid = Number.isFinite(pct) && Math.abs(pct) <= MAX_ABS_PCT;
  const shown = valid ? (Object.is(pct, -0) ? 0 : pct) : current;
  const dirty = valid && shown !== current;

  const setPreset = (p: number) => { setSign(p > 0 ? 1 : -1); setAbs(String(Math.abs(p)).replace('.', ',')); };
  const preset = COUNTRY_ADJUSTMENT_PRESETS.includes(shown) ? shown : null;

  return (
    <BottomSheet open={open} onClose={saving ? () => undefined : onClose}>
      <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>{title}</h3>
      <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{subtitle}</p>

      <ChoiceChips
        className="mt-5"
        options={COUNTRY_ADJUSTMENT_PRESETS.map((p) => ({ value: p, label: formatCountryPct(p) }))}
        value={preset}
        onChange={setPreset}
      />

      <div className="mt-3 flex items-center gap-2">
        {([[-1, '−', 'Écart négatif'], [1, '+', 'Écart positif']] as const).map(([s, glyph, aria]) => (
          <button
            key={s}
            type="button"
            aria-label={aria}
            aria-pressed={sign === s}
            onClick={() => setSign(s)}
            className={cn('flex h-12 w-12 shrink-0 items-center justify-center text-[22px] font-semibold', FOCUS_RING, sign === s ? TOGGLE_ON : TOGGLE_OFF)}
          >
            {glyph}
          </button>
        ))}
        <TextInput
          inputMode="decimal"
          value={abs}
          onChange={(e) => setAbs(e.target.value)}
          aria-label="Écart en %"
          className="flex-1 h-12 text-right text-[18px] font-semibold tabular-nums"
        />
        <span className={cn('text-[18px] font-semibold', TEXT.muted)}>%</span>
      </div>

      <KVBox className="mt-4" rows={rows(shown)} />

      <div className="mt-3">
        {!valid ? (
          <Line tone="bad">Entre −{MAX_ABS_PCT} % et +{MAX_ABS_PCT} %</Line>
        ) : shown > 0 ? (
          <Line tone="warn">{positiveWarning}</Line>
        ) : note != null ? (
          <Line>{note}</Line>
        ) : null}
      </div>

      <div className="mt-4">
        <BigButton onClick={() => { if (dirty) void onSave(shown); }} disabled={!dirty} loading={saving}>
          Enregistrer {formatCountryPct(shown)}
        </BigButton>
      </div>
    </BottomSheet>
  );
}
