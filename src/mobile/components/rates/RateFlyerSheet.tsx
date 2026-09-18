// RateFlyerSheet — contenu du panneau « Flyer du jour » (aperçu + exports).
// Ouvert depuis la pilule « Voir le flyer du jour » au bas du module Taux
// (mobile) ou le bouton d'en-tête (desktop), et depuis « Taux par pays » avec
// le pays déjà choisi. Un flyer PAR PAYS : la référence (Cameroun) imprime
// les taux publiés tels quels ; un autre pays imprime ses taux dérivés
// (base × (1 + écart)), « pour 1 000 000 XAF », avec son drapeau dans la
// pilule d'en-tête. Aperçu responsive (échelle mesurée au conteneur).
// L'export capture LE MÊME nœud DOM que l'aperçu (html-to-image) → le
// fichier téléchargé est pixel-identique à ce qui est affiché.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RateFlyer } from './RateFlyer';
import { downloadFlyerPNG, downloadFlyerPDF, FLYER_W, FLYER_H } from '@/lib/exportFlyer';
import { buildCountryRateSheets, countryFileSlug, formatCountryPct, toFlyerRates, REFERENCE_COUNTRY_KEY } from '@/lib/countryRates';
import type { DailyRate, RateAdjustment } from '@/types/rates';
import { CountryFlag } from '@/components/form/CountryFlag';
import { TEXT, SOFT_PILL, Chip } from '@/mobile/designKit';

interface RateFlyerSheetProps {
  /** Publication active — les taux de référence. */
  activeRate: DailyRate | null | undefined;
  /** Ajustements (pays + tranches) — seuls les pays servent ici. */
  adjustments: readonly RateAdjustment[] | undefined;
  /** Pays présélectionné (clé `rate_adjustments`), sinon la référence. */
  initialCountry?: string | null;
}

export function RateFlyerSheet({ activeRate, adjustments, initialCountry }: RateFlyerSheetProps) {
  const [flyerDark, setFlyerDark] = useState(true);
  const [exportingPNG, setExportingPNG] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const sheets = useMemo(() => buildCountryRateSheets(activeRate, adjustments ?? []), [activeRate, adjustments]);
  const [countryKey, setCountryKey] = useState<string>(initialCountry ?? REFERENCE_COUNTRY_KEY);
  useEffect(() => { setCountryKey(initialCountry ?? REFERENCE_COUNTRY_KEY); }, [initialCountry]);

  // Sans ajustements chargés (ou pays inconnu) : la référence, taux publiés bruts.
  const selected = sheets.find((s) => s.key === countryKey) ?? sheets.find((s) => s.isReference) ?? null;
  const rates = selected
    ? toFlyerRates(selected.rates)
    : {
        alipay: activeRate?.rate_alipay || 0,
        wechat: activeRate?.rate_wechat || 0,
        bank: activeRate?.rate_virement || 0,
        cash: activeRate?.rate_cash || 0,
      };
  const flyerCountry = selected && !selected.isReference ? { label: selected.label, iso: selected.iso } : null;
  const slug = selected ? countryFileSlug(selected.key, selected.isReference) : undefined;

  const previewRef = useRef<HTMLDivElement>(null);
  // Nœud NON transformé du flyer (2150×2560) — c'est LUI qu'on exporte.
  const flyerNodeRef = useRef<HTMLDivElement>(null);
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

  const exportWith = async (fn: (node: HTMLElement, slug?: string) => Promise<void>, set: (b: boolean) => void, busy: boolean) => {
    if (busy) return;
    const node = flyerNodeRef.current;
    if (!node) return;
    set(true);
    try { await fn(node, slug); }
    catch { toast.error("Échec de l'export du flyer — réessayez"); }
    finally { set(false); }
  };

  return (
    <div className="space-y-3">
      {/* ── Pays : un flyer par pays ── */}
      {sheets.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Pays du flyer">
          {sheets.map((s) => (
            <Chip
              key={s.key}
              active={selected?.key === s.key}
              onClick={() => setCountryKey(s.key)}
              label={
                <span className="inline-flex items-center gap-2">
                  <CountryFlag iso={s.iso} size={20} />
                  {s.label}
                  <span className={cn('text-[14px] tabular-nums', selected?.key === s.key ? 'opacity-80' : TEXT.muted)}>
                    {s.isReference ? 'réf.' : formatCountryPct(s.percentage)}
                  </span>
                </span>
              }
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className={cn('min-w-0 text-[14px]', TEXT.muted)}>
          {flyerCountry
            ? <>Taux {flyerCountry.label} : Cameroun {formatCountryPct(selected!.percentage)}, pour 1&nbsp;000&nbsp;000&nbsp;XAF</>
            : 'À partager sur WhatsApp avec vos clients'}
        </div>
        <div className="flex shrink-0 gap-1.5">
          {([['dark', 'Sombre'], ['light', 'Clair']] as const).map(([th, label]) => {
            const active = (th === 'dark') === flyerDark;
            return (
              <button
                key={th}
                onClick={() => setFlyerDark(th === 'dark')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[14px] font-bold transition-colors',
                  active ? 'bg-[#2C2C2C] text-white' : cn('bg-[#F5F5F5] dark:bg-[#383838]', TEXT.muted),
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Aperçu responsive — mis à l'échelle du conteneur réel */}
      <div ref={previewRef}>
        {scale > 0 && (
          <div className="overflow-hidden rounded-lg" style={{ height: Math.round(FLYER_H * scale) }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: FLYER_W, pointerEvents: 'none' }}>
              <div ref={flyerNodeRef} style={{ width: FLYER_W, height: FLYER_H }}>
                <RateFlyer
                  alipay={rates.alipay}
                  wechat={rates.wechat}
                  bank={rates.bank}
                  cash={rates.cash}
                  theme={flyerDark ? 'dark' : 'light'}
                  country={flyerCountry}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Exports — libellés explicites */}
      <div className="flex gap-2.5">
        <button
          onClick={() => void exportWith(downloadFlyerPNG, setExportingPNG, exportingPNG)}
          disabled={exportingPNG}
          className="flex flex-[1.6] items-center justify-center gap-2 rounded-lg bg-[#2C2C2C] py-3.5 text-[14px] font-bold text-white transition active:scale-[0.98] disabled:opacity-60 dark:bg-[#E3E3E3] dark:text-[#1E1E1E]"
        >
          {exportingPNG ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-[15px] w-[15px]" />}
          {flyerCountry ? `Télécharger · ${flyerCountry.label}` : 'Télécharger le flyer'}
        </button>
        <button
          onClick={() => void exportWith(downloadFlyerPDF, setExportingPDF, exportingPDF)}
          disabled={exportingPDF}
          className={cn('flex flex-1 items-center justify-center gap-2 py-3.5 text-[14px] font-bold transition active:scale-[0.98] disabled:opacity-60', SOFT_PILL)}
        >
          {exportingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-[15px] w-[15px]" />}
          PDF
        </button>
      </div>
    </div>
  );
}
