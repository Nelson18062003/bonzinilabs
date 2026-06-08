// ============================================================
// MODULE TAUX — RateSetTab (définir les taux du jour)
// Présentation migrée sur le design kit (Ofspace/Mola), calquée
// sur la maquette validée rates.tsx : segment direction · cartes
// blanches par méthode (vrais logos + gros chiffre) · carte de
// vérification · sélecteur de date en pilules · CTA Publier ·
// carte Flyer.
// Logique 100% préservée : useCreateDailyRates (RPC), direction,
// getEffectiveAt (now/today/yesterday/custom + heure/minute),
// flyerRates + RateFlyer + exports PNG/PDF, états.
// ============================================================
import { useState } from 'react';
import { format } from 'date-fns';
import { Check, Download, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateField, TextField } from '@/components/form';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate } from '@/types/rates';
import { useCreateDailyRates } from '@/hooks/useDailyRates';
import { RateFlyer } from '@/mobile/components/rates/RateFlyer';
import { downloadFlyerPNG, downloadFlyerPDF } from '@/lib/exportFlyer';
import { SURFACE, TEXT, PrimaryPill } from '@/mobile/designKit';
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
  const [flyerDark, setFlyerDark] = useState(true);
  const [exportingPNG, setExportingPNG] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

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

  // Pilule pleine vs douce (langage kit) — couleur d'accent violet.
  const pillBase = 'rounded-full py-2.5 text-[13px] font-semibold transition-colors';

  return (
    <div className="space-y-5">
      {/* Segment direction (XAF↔CNY) */}
      <div className={cn('inline-flex w-full items-center gap-1 rounded-full p-1', SURFACE.card, SURFACE.shadow)}>
        {[
          { key: 'cny_xaf' as const, label: '1 CNY → XAF' },
          { key: 'xaf_cny' as const, label: '1M XAF → CNY' },
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

      <p className={cn('text-[13px] font-medium', TEXT.muted)}>
        {direction === 'xaf_cny'
          ? 'CNY pour 1 000 000 XAF par mode :'
          : 'XAF pour 1 CNY par mode :'}
      </p>

      {/* Cartes de saisie par méthode (vrais logos + gros chiffre) */}
      <div className="space-y-2.5">
        {PAYMENT_METHODS.map((pm) => (
          <div
            key={pm.key}
            className={cn('flex items-center gap-3 rounded-[18px] p-3.5', SURFACE.card, SURFACE.shadow)}
          >
            <MethodLogo method={pm.key} size={40} />
            <div className="min-w-0 flex-1">
              <div className={cn('text-[15px] font-bold leading-tight', TEXT.strong)}>{pm.label}</div>
              <div className={cn('text-[11px]', TEXT.muted)}>
                {direction === 'xaf_cny' ? 'CNY / 1M XAF' : 'XAF / 1 CNY'}
              </div>
            </div>
            <TextField
              variant="decimal"
              value={rates[pm.key]}
              onChange={(e) => setRates({ ...rates, [pm.key]: e.target.value })}
              wrapperClassName="w-[112px]"
              controlClassName="text-right text-[18px] font-extrabold tabular-nums"
              aria-label={`Taux ${pm.label}`}
            />
          </div>
        ))}
      </div>

      {/* Carte de vérification */}
      <div className={cn('rounded-[18px] p-4', SURFACE.card, SURFACE.shadow)}>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#6B5BD2] dark:text-[#A99BF0]">
          Vérification de vos taux saisis
        </div>
        <div className={cn('mb-3 text-[11px]', TEXT.muted)}>
          Taux de base (meilleur cas : Cameroun, gros montant ≥ 1M XAF). Les
          ajustements pays et tranches s'appliqueront automatiquement.
        </div>
        {PAYMENT_METHODS.map((pm) => {
          const val = parseFloat(rates[pm.key]) || 0;
          return (
            <div
              key={pm.key}
              className="flex items-center justify-between py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <MethodLogo method={pm.key} size={34} />
                <div>
                  <div className={cn('text-[13px] font-bold', TEXT.strong)}>{pm.label}</div>
                  <div className={cn('text-[11px]', TEXT.muted)}>
                    1M XAF = {val.toLocaleString('fr-FR')} CNY
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl bg-[#F3F1F9] px-3 py-2 dark:bg-[#2A2738]">
                <span className="text-[15px] font-bold text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
                <span className={cn('text-[20px] font-black tabular-nums', TEXT.strong)}>
                  {val.toLocaleString('fr-FR')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sélecteur de date d'effet */}
      <div>
        <p className={cn('mb-2.5 text-[14px] font-bold', TEXT.strong)}>Date d'effet</p>
        <div className="mb-2.5 flex gap-2">
          {[
            { key: 'now' as const, label: 'Maintenant' },
            { key: 'today' as const, label: "Aujourd'hui" },
            { key: 'yesterday' as const, label: 'Hier' },
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

        <button
          onClick={() => setDateOption('custom')}
          className={cn(
            pillBase,
            'flex w-full items-center justify-center gap-2',
            dateOption === 'custom' ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted),
          )}
        >
          Autre date...
        </button>

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
                  className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-lg', SURFACE.canvas, TEXT.strong)}
                >
                  −
                </button>
                <div className={cn('flex h-11 w-14 items-center justify-center rounded-xl text-[22px] font-extrabold', SURFACE.canvas, TEXT.strong)}>
                  {String(customHour).padStart(2, '0')}
                </div>
                <button
                  onClick={() => setCustomHour((h) => Math.min(23, h + 1))}
                  className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-lg', SURFACE.canvas, TEXT.strong)}
                >
                  +
                </button>
                <span className={cn('text-[22px] font-extrabold', TEXT.strong)}>:</span>
                <button
                  onClick={() => setCustomMin((m) => Math.max(0, m - 1))}
                  className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-lg', SURFACE.canvas, TEXT.strong)}
                >
                  −
                </button>
                <div className={cn('flex h-11 w-14 items-center justify-center rounded-xl text-[22px] font-extrabold', SURFACE.canvas, TEXT.strong)}>
                  {String(customMin).padStart(2, '0')}
                </div>
                <button
                  onClick={() => setCustomMin((m) => Math.min(59, m + 1))}
                  className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-lg', SURFACE.canvas, TEXT.strong)}
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

      {/* CTA Publier — pilule pleine (verte au succès) */}
      <PrimaryPill
        onClick={handleApply}
        loading={createRates.isPending}
        className={cn(
          'w-full py-[15px] text-[15px]',
          createRates.isSuccess
            ? 'bg-[#10B981] text-white dark:bg-[#10B981] dark:text-white'
            : 'bg-[#8B5CF6] text-white dark:bg-[#8B5CF6] dark:text-white',
        )}
      >
        {createRates.isSuccess ? (
          <>
            <Check className="h-[18px] w-[18px]" />
            Taux appliqués !
          </>
        ) : (
          'Appliquer les nouveaux taux'
        )}
      </PrimaryPill>

      {/* ── FLYER DU JOUR ── */}
      <div className={cn('overflow-hidden rounded-[20px]', SURFACE.card, SURFACE.shadow)}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <div>
            <div className={cn('text-[14px] font-extrabold', TEXT.strong)}>Flyer du jour</div>
            <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>Taux actuels — prêt à partager</div>
          </div>
          {/* Toggle Dark / Light */}
          <div className="flex gap-1.5">
            {(['dark', 'light'] as const).map((th) => {
              const active = (th === 'dark') === flyerDark;
              return (
                <button
                  key={th}
                  onClick={() => setFlyerDark(th === 'dark')}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors',
                    active ? 'bg-[#8B5CF6] text-white' : cn('bg-[#EDEAFA] dark:bg-[#2A2738]', TEXT.muted),
                  )}
                >
                  {th === 'dark' ? 'Dark' : 'Light'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Miniature preview — flyer naturel 2150×2560, réduit à ~0.172 pour tenir sur mobile */}
        <div className="flex justify-center overflow-hidden px-4 pb-3">
          <div style={{ transform: 'scale(0.172)', transformOrigin: 'top center', height: Math.round(2560 * 0.172), pointerEvents: 'none' }}>
            <RateFlyer
              alipay={parseFloat(rates.alipay) || currentRate?.rate_alipay || 0}
              wechat={parseFloat(rates.wechat) || currentRate?.rate_wechat || 0}
              bank={parseFloat(rates.virement) || currentRate?.rate_virement || 0}
              cash={parseFloat(rates.cash) || currentRate?.rate_cash || 0}
              theme={flyerDark ? 'dark' : 'light'}
            />
          </div>
        </div>

        {/* Boutons d'export */}
        <div className="flex gap-2.5 px-4 pb-4">
          <button
            onClick={async () => {
              if (exportingPNG) return;
              setExportingPNG(true);
              try { await downloadFlyerPNG(flyerRates(), flyerDark); }
              finally { setExportingPNG(false); }
            }}
            disabled={exportingPNG}
            className="flex flex-1 items-center justify-center gap-2 rounded-[12px] bg-[#8B5CF6] py-3 text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {exportingPNG ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-[15px] w-[15px]" />}
            PNG
          </button>
          <button
            onClick={async () => {
              if (exportingPDF) return;
              setExportingPDF(true);
              try { await downloadFlyerPDF(flyerRates(), flyerDark); }
              finally { setExportingPDF(false); }
            }}
            disabled={exportingPDF}
            className="flex flex-1 items-center justify-center gap-2 rounded-[12px] bg-[#E8932A] py-3 text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {exportingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-[15px] w-[15px]" />}
            PDF
          </button>
        </div>
      </div>
    </div>
  );
}
