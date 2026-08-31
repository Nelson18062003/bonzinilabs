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
import { useEffect, useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TextField } from '@/components/form';
import { BzDateTimeField } from '@/mobile/components/BzDateTimePicker';
import { parseDecimal } from '@/lib/decimalInput';
import { rateEffectiveAt, type RateDateOption } from '@/lib/rateEffectiveDate';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate, PaymentMethodKey } from '@/types/rates';
import {
  useCreateDailyRates,
  useLatestSuggestion,
  useComputeSuggestion,
  useMarkSuggestionApplied,
} from '@/hooks/useDailyRates';
import { SURFACE, TEXT, PrimaryPill, StatusPill } from '@/mobile/designKit';
import { MethodLogo } from '../components/MethodLogo';

interface RateSetTabProps {
  currentRate: DailyRate | null | undefined;
}

const RATE_KEYS: PaymentMethodKey[] = ['cash', 'alipay', 'wechat', 'virement'];

// Bascule d'unité : R CNY / 1M XAF → (1 000 000 / R) XAF / 1 CNY, arrondi à
// 2 décimales pour l'AFFICHAGE. L'arrondi n'étant pas exactement inversible,
// la valeur canonique est mémorisée à part (canonicalRef) : un champ non
// modifié re-publie sa valeur exacte, sans dérive d'aller-retour.
function invertRate(v: string): string {
  const n = parseDecimal(v);
  if (!Number.isFinite(n) || n <= 0) return v;
  return String(Math.round((1_000_000 / n) * 100) / 100);
}

export function RateSetTab({ currentRate }: RateSetTabProps) {
  const [direction, setDirection] = useState<'xaf_cny' | 'cny_xaf'>('xaf_cny');
  const [rates, setRates] = useState<Record<string, string>>({
    cash: currentRate?.rate_cash?.toString() || '',
    alipay: currentRate?.rate_alipay?.toString() || '',
    wechat: currentRate?.rate_wechat?.toString() || '',
    virement: currentRate?.rate_virement?.toString() || '',
  });
  const [dateOption, setDateOption] = useState<RateDateOption>('now');
  const [customDate, setCustomDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customHour, setCustomHour] = useState(new Date().getHours());
  const [customMin, setCustomMin] = useState(0);

  // En mode « Pour 1 CNY » : valeur canonique exacte derrière chaque champ,
  // et ce que nous avons affiché pour elle (pour détecter une édition).
  const canonicalRef = useRef<Record<string, string>>({});
  const displayedRef = useRef<Record<string, string>>({});

  const showInverted = (key: string, canonical: string): string => {
    canonicalRef.current[key] = canonical;
    const inv = invertRate(canonical);
    displayedRef.current[key] = inv;
    return inv;
  };

  // Pré-remplit les champs quand le taux actif arrive APRÈS le montage
  // (chargement réseau) — sans jamais écraser une saisie en cours. Les
  // valeurs stockées sont canoniques (CNY/1M) : converties si l'admin est
  // déjà passé en « Pour 1 CNY ».
  useEffect(() => {
    if (!currentRate) return;
    setRates((prev) => {
      const next = { ...prev };
      RATE_KEYS.forEach((k) => {
        if (prev[k]) return;
        const s = (currentRate[`rate_${k}` as keyof DailyRate] as number | undefined)?.toString() || '';
        if (!s) return;
        next[k] = direction === 'cny_xaf' ? showInverted(k, s) : s;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRate]);

  // Basculer l'unité CONVERTIT les valeurs affichées — l'ancien segment ne
  // changeait que le libellé, et publier en « Pour 1 CNY » enregistrait la
  // valeur brute (ex. 86,7) comme taux CNY/1M : bug financier corrigé.
  const switchDirection = (d: 'xaf_cny' | 'cny_xaf') => {
    if (d === direction) return;
    setRates((prev) => {
      const next = { ...prev };
      RATE_KEYS.forEach((k) => {
        next[k] =
          d === 'cny_xaf'
            ? showInverted(k, prev[k])
            : // Retour au canonique : restitution EXACTE si le champ n'a pas
              // été touché, conversion sinon.
              prev[k] === displayedRef.current[k] && canonicalRef.current[k] !== undefined
              ? canonicalRef.current[k]
              : invertRate(prev[k]);
      });
      return next;
    });
    setDirection(d);
  };

  /** Valeur saisie → taux canonique CNY / 1M XAF, quel que soit l'affichage. */
  const toCanonical = (key: string): number => {
    const v = rates[key];
    if (direction === 'cny_xaf') {
      if (v === displayedRef.current[key] && canonicalRef.current[key] !== undefined) {
        const exact = parseDecimal(canonicalRef.current[key]);
        return Number.isFinite(exact) && exact > 0 ? exact : 0;
      }
      const n = parseDecimal(v);
      return Number.isFinite(n) && n > 0 ? Math.round((1_000_000 / n) * 100) / 100 : 0;
    }
    const n = parseDecimal(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const createRates = useCreateDailyRates();
  const { data: latestSuggestion } = useLatestSuggestion();
  const computeSuggestion = useComputeSuggestion();
  const markApplied = useMarkSuggestionApplied();

  const handleUseSuggestion = () => {
    if (!latestSuggestion) return;
    // La suggestion est canonique (CNY/1M) — convertie si l'affichage est en
    // « Pour 1 CNY », en mémorisant la valeur exacte.
    const raw = latestSuggestion.suggested_rate.toString();
    setRates(
      Object.fromEntries(
        RATE_KEYS.map((k) => [k, direction === 'cny_xaf' ? showInverted(k, raw) : raw]),
      ) as Record<string, string>,
    );
  };

  const handleApply = () => {
    const suggestionId = latestSuggestion && !latestSuggestion.applied ? latestSuggestion.id : null;
    createRates.mutate(
      {
        rate_cash: toCanonical('cash'),
        rate_alipay: toCanonical('alipay'),
        rate_wechat: toCanonical('wechat'),
        rate_virement: toCanonical('virement'),
        effective_at: rateEffectiveAt(dateOption, customDate, customHour, customMin),
      },
      {
        onSuccess: (result) => {
          if (suggestionId && result.rate_id) {
            markApplied.mutate({ suggestionId, rateId: result.rate_id });
          }
        },
      },
    );
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

      {/* ── 1.5. SUGGESTION AUTO — Binance P2P live ── */}
      <div className={cn('rounded-[20px] p-4', SURFACE.card, SURFACE.shadow)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </span>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Suggestion automatique
              </div>
              <div className={cn('text-[11px]', TEXT.muted)}>
                Binance P2P · méthode Nelson v2
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => computeSuggestion.mutate()}
            disabled={computeSuggestion.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors disabled:opacity-60"
          >
            {computeSuggestion.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Recalculer
          </button>
        </div>

        {!latestSuggestion ? (
          <div className={cn('mt-3 text-[12px]', TEXT.muted)}>
            Aucune suggestion encore. Touche <b>Recalculer</b> pour interroger Binance P2P en direct.
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-3.5 py-3 dark:bg-amber-500/10">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Taux suggéré · 1M XAF
                </div>
                <div className="mt-0.5 text-[24px] font-extrabold leading-none tabular-nums text-amber-700 dark:text-amber-300">
                  {latestSuggestion.suggested_rate.toLocaleString('fr-FR')} <span className="text-sm">CNY</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleUseSuggestion}
                className="shrink-0 rounded-full bg-amber-600 px-3.5 py-2 text-[12px] font-bold text-white"
              >
                Pré-remplir
              </button>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
              <div className={cn('rounded-xl px-3 py-2', SURFACE.card)}>
                <div className={cn('text-[9px] font-bold uppercase tracking-wider', TEXT.muted)}>
                  CMR · max + {latestSuggestion.cmr_margin_xaf} XAF
                </div>
                <div className={cn('font-bold tabular-nums', TEXT.strong)}>
                  {(latestSuggestion.cmr_rate_max + latestSuggestion.cmr_margin_xaf).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} XAF/USDT
                </div>
                <div className={cn('text-[10px]', TEXT.muted)}>
                  {latestSuggestion.cmr_orders.length} ordres MTN/Orange
                </div>
              </div>
              <div className={cn('rounded-xl px-3 py-2', SURFACE.card)}>
                <div className={cn('text-[9px] font-bold uppercase tracking-wider', TEXT.muted)}>
                  CHN · moyenne
                </div>
                <div className={cn('font-bold tabular-nums', TEXT.strong)}>
                  {latestSuggestion.chn_rate_avg.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} CNY/USDT
                </div>
                <div className={cn('text-[10px]', TEXT.muted)}>
                  {latestSuggestion.chn_orders.length} ordres Alipay/WeChat
                </div>
              </div>
            </div>

            <div className={cn('mt-2 text-center text-[10px]', TEXT.muted)}>
              Calculé il y a {formatDistanceToNow(new Date(latestSuggestion.computed_at), { locale: fr })}
              {latestSuggestion.applied && ' · déjà appliqué'}
            </div>
          </>
        )}
      </div>

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
                onClick={() => switchDirection(d.key)}
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
          <div className={cn('mt-2.5 rounded-2xl p-3.5', SURFACE.card, SURFACE.shadow)}>
            <BzDateTimeField
              value={`${customDate}T${String(customHour).padStart(2, '0')}:${String(customMin).padStart(2, '0')}`}
              onChange={(v) => {
                const [d, t] = v.split('T');
                if (!d || !t) return;
                const [h, m] = t.split(':').map(Number);
                setCustomDate(d);
                setCustomHour(Number.isNaN(h) ? 0 : h);
                setCustomMin(Number.isNaN(m) ? 0 : m);
              }}
              accent="#8B5CF6"
              disableFuture={false}
            />
            <div className="mt-3 rounded-xl bg-[#EDEAFA] px-3 py-2 text-center text-[13px] font-semibold text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]">
              Prise d'effet : {customDate.split('-').reverse().join('/')} à {String(customHour).padStart(2, '0')}:{String(customMin).padStart(2, '0')}
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
