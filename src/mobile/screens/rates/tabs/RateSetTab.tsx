// ============================================================
// MODULE TAUX — RateSetTab (« Définir les taux du jour »)
// Section concentrée sur la SAISIE et la PUBLICATION :
//   1. bandeau TAUX ACTIFS (état) ;
//   2. saisie des nouveaux taux (gros chiffres, vrais logos) ;
//   3. prise d'effet (pilules) ;
//   4. PUBLIER.
// Le FLYER est sorti d'ici → pilule « Voir le flyer du jour » au bas
// du module (RateFlyerSheet), fidèle à la maquette validée.
// Logique 100% préservée : useCreateDailyRates (RPC), direction,
// getEffectiveAt (now/today/yesterday/custom + heure/minute), états.
// ============================================================
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateField, TextField } from '@/components/form';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate } from '@/types/rates';
import { useCreateDailyRates } from '@/hooks/useDailyRates';
import { SURFACE, TEXT, PrimaryPill, StatusPill } from '@/mobile/designKit';
import { MethodLogo } from '../components/MethodLogo';

interface RateSetTabProps {
  currentRate: DailyRate | null | undefined;
}

export function RateSetTab({ currentRate }: RateSetTabProps) {
  const [direction, setDirection] = useState<'xaf_cny' | 'cny_xaf'>('xaf_cny');
  const [rates, setRates] = useState<Record<string, string>>({
    cash: currentRate?.rate_cash?.toString() || '',
    alipay: currentRate?.rate_alipay?.toString() || '',
    wechat: currentRate?.rate_wechat?.toString() || '',
    virement: currentRate?.rate_virement?.toString() || '',
  });
  const [dateOption, setDateOption] = useState<'now' | 'today' | 'yesterday' | 'custom'>('now');
  const [customDate, setCustomDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customHour, setCustomHour] = useState(new Date().getHours());
  const [customMin, setCustomMin] = useState(0);

  // Pré-remplit les champs quand le taux actif arrive APRÈS le montage
  // (chargement réseau) — sans jamais écraser une saisie en cours.
  useEffect(() => {
    if (!currentRate) return;
    setRates((prev) => ({
      cash: prev.cash || currentRate.rate_cash?.toString() || '',
      alipay: prev.alipay || currentRate.rate_alipay?.toString() || '',
      wechat: prev.wechat || currentRate.rate_wechat?.toString() || '',
      virement: prev.virement || currentRate.rate_virement?.toString() || '',
    }));
  }, [currentRate]);

  const createRates = useCreateDailyRates();

  const getEffectiveAt = (): string => {
    const now = new Date();
    if (dateOption === 'now') return now.toISOString();
    if (dateOption === 'today') {
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    }
    if (dateOption === 'yesterday') {
      now.setDate(now.getDate() - 1);
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    }
    const d = new Date(customDate);
    d.setHours(customHour, customMin, 0, 0);
    return d.toISOString();
  };

  const handleApply = () => {
    createRates.mutate({
      rate_cash: parseFloat(rates.cash) || 0,
      rate_alipay: parseFloat(rates.alipay) || 0,
      rate_wechat: parseFloat(rates.wechat) || 0,
      rate_virement: parseFloat(rates.virement) || 0,
      effective_at: getEffectiveAt(),
    });
  };

  const activeSince = currentRate?.effective_at
    ? new Date(currentRate.effective_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-5">
      {/* ── 1. ÉTAT — taux actuellement actifs ── */}
      {currentRate && (
        <div className={cn('rounded-[20px] p-4', SURFACE.card, SURFACE.shadow)}>
          <div className="flex items-center justify-between">
            <span className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Taux actifs</span>
            <div className="flex items-center gap-2">
              <StatusPill tone="success" label="En ligne" />
              {activeSince && <span className={cn('text-[11px]', TEXT.muted)}>depuis le {activeSince}</span>}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {PAYMENT_METHODS.map((pm) => {
              const v = currentRate[`rate_${pm.key}` as keyof DailyRate] as number | undefined;
              return (
                <div key={pm.key} className="flex flex-col items-center gap-1.5">
                  <MethodLogo method={pm.key} size={34} />
                  <span className={cn('text-[14px] font-extrabold tabular-nums', TEXT.strong)}>
                    {v ? Number(v).toLocaleString('fr-FR') : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 2. SAISIE — nouveaux taux ── */}
      <div>
        <p className={cn('mb-2.5 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>
          Nouveaux taux
        </p>

        {/* Segment direction (XAF↔CNY) */}
        <div className={cn('mb-3 inline-flex w-full items-center gap-1 rounded-full p-1', SURFACE.card, SURFACE.shadow)}>
          {[
            { key: 'xaf_cny' as const, label: 'Pour 1M XAF' },
            { key: 'cny_xaf' as const, label: 'Pour 1 CNY' },
          ].map((d) => {
            const active = direction === d.key;
            return (
              <button
                key={d.key}
                onClick={() => setDirection(d.key)}
                className={cn(
                  'flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors',
                  active ? 'bg-[#8B5CF6] text-white' : TEXT.muted,
                )}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        {/* Une grande ligne de saisie par méthode — gros chiffres, vrais logos */}
        <div className="space-y-2.5">
          {PAYMENT_METHODS.map((pm) => (
            <div
              key={pm.key}
              className={cn('flex items-center gap-3.5 rounded-[20px] p-4', SURFACE.card, SURFACE.shadow)}
            >
              <MethodLogo method={pm.key} size={46} />
              <div className="min-w-0 flex-1">
                <div className={cn('text-[16px] font-bold leading-tight', TEXT.strong)}>{pm.label}</div>
                <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>
                  {direction === 'xaf_cny' ? 'CNY pour 1M XAF' : 'XAF pour 1 CNY'}
                </div>
              </div>
              <TextField
                variant="decimal"
                value={rates[pm.key]}
                onChange={(e) => setRates({ ...rates, [pm.key]: e.target.value })}
                wrapperClassName="w-[128px]"
                controlClassName="h-12 text-right text-[22px] font-black tabular-nums"
                aria-label={`Taux ${pm.label}`}
              />
            </div>
          ))}
        </div>

        <p className={cn('mt-2.5 px-1 text-[11px] leading-relaxed', TEXT.muted)}>
          Taux de base (meilleur cas : Cameroun, ≥ 1M XAF). Les ajustements pays et
          tranches s'appliquent automatiquement — voir Réglages.
        </p>
      </div>

      {/* ── 3. PRISE D'EFFET ── */}
      <div>
        <p className={cn('mb-2.5 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>
          Prise d'effet
        </p>
        <div className="flex gap-2">
          {[
            { key: 'now' as const, label: 'Maintenant' },
            { key: 'today' as const, label: "Aujourd'hui" },
            { key: 'yesterday' as const, label: 'Hier' },
            { key: 'custom' as const, label: 'Autre…' },
          ].map((d) => {
            const active = dateOption === d.key;
            return (
              <button
                key={d.key}
                onClick={() => setDateOption(d.key)}
                className={cn(
                  'flex-1 rounded-full py-2.5 text-[12px] font-semibold transition-colors',
                  active ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted),
                )}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        {dateOption === 'custom' && (
          <div className={cn('mt-2.5 space-y-3 rounded-2xl p-3.5', SURFACE.card, SURFACE.shadow)}>
            <DateField
              label="Date"
              labelClassName={cn('text-[12px] font-semibold', TEXT.muted)}
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              controlClassName="font-semibold"
            />
            <div>
              <label className={cn('mb-1.5 block text-[12px] font-semibold', TEXT.muted)}>
                Heure
              </label>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setCustomHour((h) => Math.max(0, h - 1))}
                  aria-label="Heure précédente"
                  className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold', SURFACE.canvas, TEXT.strong)}
                >
                  −
                </button>
                <div className={cn('flex h-11 w-14 items-center justify-center rounded-xl text-[22px] font-extrabold tabular-nums', SURFACE.canvas, TEXT.strong)}>
                  {String(customHour).padStart(2, '0')}
                </div>
                <button
                  onClick={() => setCustomHour((h) => Math.min(23, h + 1))}
                  aria-label="Heure suivante"
                  className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold', SURFACE.canvas, TEXT.strong)}
                >
                  +
                </button>
                <span className={cn('text-[22px] font-extrabold', TEXT.strong)}>:</span>
                <button
                  onClick={() => setCustomMin((m) => Math.max(0, m - 1))}
                  aria-label="Minute précédente"
                  className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold', SURFACE.canvas, TEXT.strong)}
                >
                  −
                </button>
                <div className={cn('flex h-11 w-14 items-center justify-center rounded-xl text-[22px] font-extrabold tabular-nums', SURFACE.canvas, TEXT.strong)}>
                  {String(customMin).padStart(2, '0')}
                </div>
                <button
                  onClick={() => setCustomMin((m) => Math.min(59, m + 1))}
                  aria-label="Minute suivante"
                  className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold', SURFACE.canvas, TEXT.strong)}
                >
                  +
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-[#EDEAFA] px-3 py-2 text-center text-[13px] font-semibold text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]">
              {customDate.split('-').reverse().join('/')} à {String(customHour).padStart(2, '0')}:{String(customMin).padStart(2, '0')}
            </div>
          </div>
        )}
      </div>

      {/* ── 4. PUBLIER — l'action du jour (pilule charbon du kit) ── */}
      <PrimaryPill
        onClick={handleApply}
        loading={createRates.isPending}
        className={cn(
          'w-full py-[15px] text-[15px]',
          createRates.isSuccess && 'bg-[#10B981] text-white dark:bg-[#10B981] dark:text-white',
        )}
      >
        {createRates.isSuccess ? (
          <>
            <Check className="h-[18px] w-[18px]" />
            Taux publiés !
          </>
        ) : (
          'Publier les taux du jour'
        )}
      </PrimaryPill>
    </div>
  );
}
