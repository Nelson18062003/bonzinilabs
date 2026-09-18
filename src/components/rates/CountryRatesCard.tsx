/**
 * Taux par pays — le bloc « Gabon » du module Taux (mobile ET desktop).
 *
 * Après avoir publié les taux (Cameroun = référence), l'équipe voit ici les
 * taux de chaque autre pays, dérivés automatiquement : base × (1 + écart),
 * « pour 1 000 000 XAF ». L'écart se règle par paliers (0, −0,5, −1, −1,5,
 * −2 %) ou à la main, l'aperçu suit la saisie, et l'enregistrement passe par
 * la même ligne `rate_adjustments` que « Réglages » (RPC
 * `update_rate_adjustment`) : les deux écrans ne peuvent pas diverger. Le
 * bouton « Flyer du jour · Gabon » ouvre le flyer déjà réglé sur ce pays.
 *
 * Aucune couleur décorative : le kit, une seule teinte (ambre) pour ce qui
 * n'est pas encore enregistré.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TextField } from '@/components/form';
import { CountryFlag } from '@/components/form/CountryFlag';
import { parseDecimal } from '@/lib/decimalInput';
import {
  COUNTRY_ADJUSTMENT_PRESETS,
  buildCountryRateSheets,
  deriveCountryRates,
  formatCountryPct,
} from '@/lib/countryRates';
import { useUpdateRateAdjustment } from '@/hooks/useDailyRates';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate, RateAdjustment } from '@/types/rates';
import { SURFACE, TEXT, FOCUS_RING, TOGGLE_ON, TOGGLE_OFF, Chip, PrimaryPill, SoftPill, StatusPill } from '@/mobile/designKit';
import { MethodLogo } from '@/mobile/screens/rates/components/MethodLogo';

/** Un écart au-delà de ±20 % est une faute de frappe, pas une politique de prix. */
const MAX_ABS_PCT = 20;

interface CountryRatesCardProps {
  activeRate: DailyRate | null | undefined;
  adjustments: readonly RateAdjustment[] | undefined;
  isLoading?: boolean;
  /** Ouvre le flyer du jour, réglé sur ce pays. */
  onOpenFlyer: (countryKey: string) => void;
  /** `desktop` : titres plus petits, rangée de tuiles sur une ligne. */
  variant?: 'mobile' | 'desktop';
  className?: string;
}

const fmtInt = (n: number) => Math.round(n).toLocaleString('fr-FR');

export function CountryRatesCard({ activeRate, adjustments, isLoading, onOpenFlyer, variant = 'mobile', className }: CountryRatesCardProps) {
  const desktop = variant === 'desktop';
  const sheets = useMemo(() => buildCountryRateSheets(activeRate, adjustments ?? []), [activeRate, adjustments]);
  const updateAdjustment = useUpdateRateAdjustment();
  // L'écart se modifie avec `canManageRates` (miroir de la RPC) ; les autres
  // rôles lisent les taux et ouvrent le flyer.
  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission('canManageRates');

  // Le Gabon (premier pays dérivé) est ouvert d'office : la référence est déjà
  // sous les yeux dans « Taux actifs ». La sélection est ÉPINGLÉE dès qu'elle
  // est résolue : un refetch qui réordonne les pays ne déplace pas un
  // brouillon sous un autre pays.
  const [countryKey, setCountryKey] = useState<string | null>(null);
  const selected = sheets.find((s) => s.key === countryKey) ?? sheets.find((s) => !s.isReference) ?? sheets[0] ?? null;
  useEffect(() => {
    if (countryKey === null && selected) setCountryKey(selected.key);
  }, [countryKey, selected]);

  // Brouillon d'écart, lié au pays qu'il concerne : `null` = valeur serveur.
  // Le signe est un bouton à part (le pavé décimal d'iOS n'a pas de « − »,
  // et un écart est presque toujours négatif).
  const [draft, setDraft] = useState<{ key: string; sign: -1 | 1; abs: string } | null>(null);
  const pick = (key: string) => { setCountryKey(key); setDraft(null); };
  const liveDraft = draft && selected && draft.key === selected.key ? draft : null;
  const setAbs = (abs: string) => selected && setDraft({ key: selected.key, sign: liveDraft?.sign ?? (selected.percentage > 0 ? 1 : -1), abs });
  const setSign = (sign: -1 | 1) => selected && setDraft({ key: selected.key, sign, abs: liveDraft?.abs ?? String(Math.abs(selected.percentage)) });
  const setPreset = (pct: number) => selected && setDraft({ key: selected.key, sign: pct > 0 ? 1 : -1, abs: String(Math.abs(pct)) });

  const draftAbs = liveDraft ? parseDecimal(liveDraft.abs) : null;
  const draftPct = liveDraft && draftAbs !== null && Number.isFinite(draftAbs) ? liveDraft.sign * Math.abs(draftAbs) : null;
  const draftValid = draftPct !== null && Math.abs(draftPct) <= MAX_ABS_PCT;
  const effectivePct = selected ? (draftValid ? (draftPct as number) : selected.percentage) : 0;
  const dirty = !!selected && draftValid && (draftPct as number) !== selected.percentage;
  const draftSign: -1 | 1 = liveDraft?.sign ?? (selected && selected.percentage > 0 ? 1 : -1);
  const draftAbsText = liveDraft?.abs ?? (selected ? String(Math.abs(selected.percentage)) : '');
  const previewRates = selected && activeRate ? deriveCountryRates(activeRate, effectivePct) : selected?.rates ?? null;
  const baseRates = selected && activeRate ? deriveCountryRates(activeRate, 0) : null;

  const save = async () => {
    if (!selected || !dirty || updateAdjustment.isPending) return;
    try {
      await updateAdjustment.mutateAsync({ adjustmentId: selected.adjustmentId, percentage: draftPct as number });
      setDraft(null);
    } catch {
      /* toast déjà affiché par la mutation */
    }
  };

  const title = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className={cn('font-bold leading-tight', desktop ? 'text-[15px]' : 'text-[16px]', TEXT.strong)}>Taux par pays</h3>
        <p className={cn(desktop ? 'text-[13px]' : 'text-[16px]', 'mt-0.5', TEXT.muted)}>
          Dérivés des taux Cameroun publiés · pour 1&nbsp;000&nbsp;000&nbsp;XAF
        </p>
      </div>
      {isLoading && <Loader2 className={cn('mt-1 h-4 w-4 shrink-0 animate-spin', TEXT.muted)} />}
    </div>
  );

  return (
    <div className={cn('rounded-lg p-4', SURFACE.card, SURFACE.shadow, className)}>
      {title}

      {sheets.length === 0 ? (
        <p className={cn('mt-3', desktop ? 'text-[13px]' : 'text-[16px]', TEXT.muted)}>
          {isLoading ? 'Chargement des pays…' : 'Aucun pays configuré — voir Réglages.'}
        </p>
      ) : (
        <>
          {/* ── Pays ── */}
          <div
            className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Pays"
          >
            {sheets.map((s) => {
              const active = selected?.key === s.key;
              return (
                <Chip
                  key={s.key}
                  active={active}
                  onClick={() => pick(s.key)}
                  className={desktop ? 'h-9 text-[13px]' : undefined}
                  label={
                    <span className="inline-flex items-center gap-2">
                      <CountryFlag iso={s.iso} size={desktop ? 18 : 20} />
                      {s.label}
                      <span className={cn('tabular-nums', desktop ? 'text-[12px]' : 'text-[14px]', active ? 'opacity-80' : TEXT.muted)}>
                        {s.isReference ? 'réf.' : formatCountryPct(s.percentage)}
                      </span>
                    </span>
                  }
                />
              );
            })}
          </div>

          {selected && (
            <div className="mt-4 space-y-4">
              {/* ── Écart vs référence ── */}
              {selected.isReference || !canEdit ? (
                <div className="flex flex-wrap items-center gap-2">
                  {selected.isReference
                    ? <StatusPill tone="success" label="Référence" />
                    : <StatusPill tone="neutral" label={`Écart ${formatCountryPct(selected.percentage)}`} />}
                  <span className={cn(desktop ? 'text-[13px]' : 'text-[16px]', TEXT.muted)}>
                    {selected.isReference
                      ? "Les taux publiés, tels quels. Les autres pays s'en écartent d'un pourcentage."
                      : 'Écart vs Cameroun, réglé par un responsable des taux.'}
                  </span>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline justify-between gap-3 px-0.5">
                    <span className={cn('font-bold', desktop ? 'text-[13px]' : 'text-[16px]', TEXT.strong)}>
                      Écart vs Cameroun
                    </span>
                    <span className={cn('tabular-nums', desktop ? 'text-[12px]' : 'text-[14px]', TEXT.muted)}>
                      enregistré : {formatCountryPct(selected.percentage)}
                    </span>
                  </div>
                  {/* Paliers sur UNE ligne (défilement) : un écart se lit d'un coup d'œil. */}
                  <div className="-mx-1 mt-2 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {COUNTRY_ADJUSTMENT_PRESETS.map((preset) => (
                      <Chip
                        key={preset}
                        label={formatCountryPct(preset)}
                        active={effectivePct === preset && (liveDraft === null || draftValid)}
                        onClick={() => setPreset(preset)}
                        className={cn('tabular-nums', desktop ? 'h-9 text-[13px]' : undefined)}
                      />
                    ))}
                    <div className="flex shrink-0 items-center gap-1">
                      {([[-1, '−', 'Écart négatif (en dessous du Cameroun)'], [1, '+', 'Écart positif (au-dessus du Cameroun)']] as const).map(([sign, glyph, aria]) => (
                        <button
                          key={sign}
                          type="button"
                          aria-label={aria}
                          aria-pressed={draftSign === sign}
                          onClick={() => setSign(sign)}
                          className={cn(
                            'inline-flex shrink-0 items-center justify-center font-bold transition-colors',
                            FOCUS_RING,
                            draftSign === sign ? TOGGLE_ON : TOGGLE_OFF,
                            desktop ? 'h-9 w-9 text-[15px]' : 'h-11 w-11 text-[18px]',
                          )}
                        >
                          {glyph}
                        </button>
                      ))}
                      <TextField
                        variant="decimal"
                        size="sm"
                        value={draftAbsText}
                        onChange={(e) => setAbs(e.target.value.replace(/[−+-]/g, ''))}
                        wrapperClassName={desktop ? 'w-[64px]' : 'w-[76px]'}
                        controlClassName={cn('text-right font-bold tabular-nums', desktop ? 'h-9 text-[13px]' : 'h-11')}
                        aria-label={`Écart ${selected.label} en pourcentage, valeur absolue`}
                      />
                      <span className={cn('font-semibold', desktop ? 'text-[13px]' : 'text-[16px]', TEXT.muted)}>%</span>
                    </div>
                  </div>
                  {liveDraft !== null && !draftValid && (
                    <p className={cn('mt-2 font-semibold text-[#C00F0C] dark:text-[#FCB3AD]', desktop ? 'text-[13px]' : 'text-[14px]')}>
                      Écart illisible ou au-delà de ±{MAX_ABS_PCT} %.
                    </p>
                  )}
                </div>
              )}

              {/* ── Les quatre taux dérivés ── */}
              {!activeRate ? (
                <p className={cn('rounded-lg px-3 py-2.5', SURFACE.inset, desktop ? 'text-[13px]' : 'text-[16px]', TEXT.muted)}>
                  Aucun taux publié — publiez d'abord les taux du jour.
                </p>
              ) : previewRates && (
                <div className={cn('grid gap-3', desktop ? 'grid-cols-4 gap-2' : 'grid-cols-2 min-[360px]:grid-cols-4 min-[360px]:gap-2')}>
                  {PAYMENT_METHODS.map((pm) => {
                    const value = previewRates[pm.key];
                    const base = baseRates?.[pm.key] ?? 0;
                    return (
                      <div key={pm.key} className={cn('flex flex-col items-center gap-1.5 rounded-lg py-3', SURFACE.inset)}>
                        <MethodLogo method={pm.key} size={desktop ? 28 : 34} />
                        <span className={cn('font-bold tabular-nums', desktop ? 'text-[15px]' : 'text-[16px]', dirty ? 'text-[#975102] dark:text-[#E8B931]' : TEXT.strong)}>
                          {value > 0 ? fmtInt(value) : '—'}
                        </span>
                        {!selected.isReference && base > 0 && (
                          <span className={cn('tabular-nums', desktop ? 'text-[11px]' : 'text-[14px]', TEXT.muted)}>
                            réf. {fmtInt(base)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Enregistrer / Flyer ── */}
              {dirty ? (
                <div className="space-y-2">
                  <p className={cn('font-semibold text-[#975102] dark:text-[#E8B931]', desktop ? 'text-[13px]' : 'text-[14px]')}>
                    Non enregistré — dès l'enregistrement, l'écart s'applique à tous les paiements {selected.label} et au flyer.
                    {effectivePct > 0 && <> Écart POSITIF : {selected.label} paiera plus cher que le Cameroun.</>}
                  </p>
                  <div className="flex gap-2">
                    <PrimaryPill onClick={() => void save()} loading={updateAdjustment.isPending} className={cn('flex-1', desktop && 'h-10 text-[13px]')}>
                      Enregistrer {formatCountryPct(effectivePct)}
                    </PrimaryPill>
                    <SoftPill onClick={() => setDraft(null)} disabled={updateAdjustment.isPending} className={cn(desktop && 'h-10 text-[13px]')}>
                      Annuler
                    </SoftPill>
                  </div>
                </div>
              ) : (
                <SoftPill
                  onClick={() => onOpenFlyer(selected.key)}
                  disabled={!activeRate}
                  className={cn('w-full', desktop && 'h-10 text-[13px]')}
                >
                  <span className="inline-flex items-center gap-1.5">
                    Flyer du jour · {selected.label} <ChevronRight className="h-4 w-4" />
                  </span>
                </SoftPill>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
