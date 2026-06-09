// ============================================================
// MODULE TAUX — RateSetTab (« Aujourd'hui » : définir + flyer)
// Repensé (passe Fable) autour du flux réel de l'admin :
//   1. voir les TAUX ACTIFS (bandeau d'état) ;
//   2. saisir les nouveaux taux (gros chiffres, vrais logos) ;
//   3. choisir la prise d'effet (pilules, sans friction) ;
//   4. PUBLIER (pilule charbon, libellé explicite) ;
//   5. partager le FLYER (aperçu responsive + exports nommés).
// Supprimé : la carte « Vérification » qui dupliquait 2× les
// mêmes chiffres (remplissage). Logique 100% préservée :
// useCreateDailyRates (RPC), direction, getEffectiveAt
// (now/today/yesterday/custom + heure/minute), flyerRates +
// RateFlyer + exports PNG/PDF, états.
// ============================================================
import { useLayoutEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Check, Download, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateField, TextField } from '@/components/form';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate } from '@/types/rates';
import { useCreateDailyRates } from '@/hooks/useDailyRates';
import { RateFlyer } from '@/mobile/components/rates/RateFlyer';
import { downloadFlyerPNG, downloadFlyerPDF } from '@/lib/exportFlyer';
import { SURFACE, TEXT, SOFT_PILL, PrimaryPill, StatusPill } from '@/mobile/designKit';
import { MethodLogo } from '../components/MethodLogo';

interface RateSetTabProps {
  currentRate: DailyRate | null | undefined;
}

// Largeur naturelle du flyer (RateFlyer) — l'aperçu se met à l'échelle du
// conteneur réel (plus de zoom magique 0.172).
const FLYER_W = 2150;
const FLYER_H = 2560;

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
  const [flyerDark, setFlyerDark] = useState(true);
  const [exportingPNG, setExportingPNG] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  // Aperçu responsive du flyer : on mesure le conteneur, on déduit l'échelle.
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewW, setPreviewW] = useState(0);
  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPreviewW(el.clientWidth));
    ro.observe(el);
    setPreviewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const scale = previewW > 0 ? previewW / FLYER_W : 0;

  const createRates = useCreateDailyRates();

  // Helper: build the rates object passed to the Edge Function
  const flyerRates = () => ({
    alipay: parseFloat(rates.alipay)   || currentRate?.rate_alipay   || 0,
    wechat: parseFloat(rates.wechat)   || currentRate?.rate_wechat   || 0,
    bank:   parseFloat(rates.virement) || currentRate?.rate_virement || 0,
    cash:   parseFloat(rates.cash)     || currentRate?.rate_cash     || 0,
  });

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
    // custom
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

      {/* ── 5. FLYER DU JOUR — aperçu + partage ── */}
      <div className={cn('overflow-hidden rounded-[20px]', SURFACE.card, SURFACE.shadow)}>
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <div>
            <div className={cn('text-[15px] font-extrabold', TEXT.strong)}>Flyer du jour</div>
            <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>À partager sur WhatsApp avec vos clients</div>
          </div>
          {/* Toggle Sombre / Clair */}
          <div className="flex gap-1.5">
            {([['dark', 'Sombre'], ['light', 'Clair']] as const).map(([th, label]) => {
              const active = (th === 'dark') === flyerDark;
              return (
                <button
                  key={th}
                  onClick={() => setFlyerDark(th === 'dark')}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors',
                    active ? 'bg-[#8B5CF6] text-white' : cn('bg-[#EDEAFA] dark:bg-[#2A2738]', TEXT.muted),
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Aperçu responsive — mis à l'échelle du conteneur réel */}
        <div ref={previewRef} className="px-4 pb-3">
          {scale > 0 && (
            <div className="overflow-hidden rounded-xl" style={{ height: Math.round(FLYER_H * scale) }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: FLYER_W, pointerEvents: 'none' }}>
                <RateFlyer
                  alipay={parseFloat(rates.alipay) || currentRate?.rate_alipay || 0}
                  wechat={parseFloat(rates.wechat) || currentRate?.rate_wechat || 0}
                  bank={parseFloat(rates.virement) || currentRate?.rate_virement || 0}
                  cash={parseFloat(rates.cash) || currentRate?.rate_cash || 0}
                  theme={flyerDark ? 'dark' : 'light'}
                />
              </div>
            </div>
          )}
        </div>

        {/* Exports — libellés explicites */}
        <div className="flex gap-2.5 px-4 pb-4">
          <button
            onClick={async () => {
              if (exportingPNG) return;
              setExportingPNG(true);
              try { await downloadFlyerPNG(flyerRates(), flyerDark); }
              finally { setExportingPNG(false); }
            }}
            disabled={exportingPNG}
            className="flex flex-[1.6] items-center justify-center gap-2 rounded-full bg-[#1C1B22] py-3 text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-60 dark:bg-[#F2F1F7] dark:text-[#1B1A24]"
          >
            {exportingPNG ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-[15px] w-[15px]" />}
            Télécharger le flyer
          </button>
          <button
            onClick={async () => {
              if (exportingPDF) return;
              setExportingPDF(true);
              try { await downloadFlyerPDF(flyerRates(), flyerDark); }
              finally { setExportingPDF(false); }
            }}
            disabled={exportingPDF}
            className={cn('flex flex-1 items-center justify-center gap-2 py-3 text-[13px] font-bold transition active:scale-[0.98] disabled:opacity-60', SOFT_PILL)}
          >
            {exportingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-[15px] w-[15px]" />}
            PDF
          </button>
        </div>
      </div>
    </div>
  );
}
