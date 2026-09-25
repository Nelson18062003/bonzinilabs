// RateFlyerSheet — contenu du panneau « Flyer du jour » (aperçu + exports).
// Ouvert depuis la pilule « Voir le flyer du jour » au bas du module Taux
// (mobile) ou le bouton d'en-tête (desktop), et depuis « Taux par pays » avec
// le pays déjà choisi. Un flyer PAR PAYS (Cameroun compris), au seul nom de
// NORTON GAUSS BONZINI SARL, avec les petits paiements en rouge : tout vient
// de buildFlyerData (publication active + rate_adjustments). Sous l'aperçu :
// l'image, le PDF, et le texte du jour à coller dans WhatsApp.
// L'export capture LE MÊME nœud DOM que l'aperçu (html-to-image) → le
// fichier téléchargé est pixel-identique à ce qui est affiché.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RateFlyer } from './RateFlyer';
import { downloadFlyerPNG, downloadFlyerPDF, FLYER_W, FLYER_H } from '@/lib/exportFlyer';
import { buildCountryRateSheets, formatCountryPct, REFERENCE_COUNTRY_KEY } from '@/lib/countryRates';
import { buildFlyerData, flyerCaption } from '@/lib/rateFlyer';
import type { DailyRate, RateAdjustment } from '@/types/rates';
import { CountryFlag } from '@/components/form/CountryFlag';
import { TEXT, SOFT_PILL, Chip } from '@/mobile/designKit';

interface RateFlyerSheetProps {
  /** Publication active — les taux de référence. */
  activeRate: DailyRate | null | undefined;
  /** Ajustements (pays + tranches de montant). */
  adjustments: readonly RateAdjustment[] | undefined;
  /** Pays présélectionné (clé `rate_adjustments`), sinon la référence. */
  initialCountry?: string | null;
}

export function RateFlyerSheet({ activeRate, adjustments, initialCountry }: RateFlyerSheetProps) {
  const [exportingPNG, setExportingPNG] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [copied, setCopied] = useState(false);

  const sheets = useMemo(() => buildCountryRateSheets(activeRate, adjustments ?? []), [activeRate, adjustments]);
  const [countryKey, setCountryKey] = useState<string>(initialCountry ?? REFERENCE_COUNTRY_KEY);
  useEffect(() => { setCountryKey(initialCountry ?? REFERENCE_COUNTRY_KEY); }, [initialCountry]);

  const selected = sheets.find((s) => s.key === countryKey) ?? sheets.find((s) => s.isReference) ?? null;
  const flyer = useMemo(
    () => (activeRate ? buildFlyerData(activeRate, adjustments ?? [], selected?.key ?? REFERENCE_COUNTRY_KEY) : null),
    [activeRate, adjustments, selected?.key],
  );

  const copyCaption = async () => {
    if (!flyer) return;
    try {
      await navigator.clipboard.writeText(flyerCaption(flyer));
      setCopied(true);
      toast.success('Texte copié — collez-le sous le flyer dans WhatsApp');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copie impossible sur cet appareil');
    }
  };

  const previewRef = useRef<HTMLDivElement>(null);
  // Nœud NON transformé du flyer (1080×1350) — c'est LUI qu'on exporte.
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

  const exportWith = async (fn: (node: HTMLElement, countryKey: string) => Promise<void>, set: (b: boolean) => void, busy: boolean) => {
    if (busy || !flyer) return;
    const node = flyerNodeRef.current;
    if (!node) return;
    set(true);
    try { await fn(node, flyer.country.key); }
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

      <div className={cn('text-[14px]', TEXT.muted)}>
        {flyer
          ? `Flyer ${flyer.country.label}${selected && !selected.isReference ? ` (Cameroun ${formatCountryPct(selected.percentage)})` : ''} — à partager sur WhatsApp`
          : 'Aucun taux publié : publiez les taux du jour pour obtenir le flyer.'}
      </div>

      {/* Aperçu responsive — mis à l'échelle du conteneur réel */}
      <div ref={previewRef}>
        {scale > 0 && flyer && (
          <div className="overflow-hidden rounded-lg" style={{ height: Math.round(FLYER_H * scale) }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: FLYER_W, pointerEvents: 'none' }}>
              <div ref={flyerNodeRef} style={{ width: FLYER_W, height: FLYER_H }}>
                <RateFlyer data={flyer} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Exports — libellés explicites */}
      <div className="flex gap-2.5">
        <button
          onClick={() => void exportWith(downloadFlyerPNG, setExportingPNG, exportingPNG)}
          disabled={exportingPNG || !flyer}
          className="flex flex-[1.6] items-center justify-center gap-2 rounded-lg bg-[#2C2C2C] py-3.5 text-[14px] font-bold text-white transition active:scale-[0.98] disabled:opacity-60 dark:bg-[#E3E3E3] dark:text-[#1E1E1E]"
        >
          {exportingPNG ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-[15px] w-[15px]" />}
          {flyer ? `Télécharger · ${flyer.country.label}` : 'Télécharger le flyer'}
        </button>
        <button
          onClick={() => void exportWith(downloadFlyerPDF, setExportingPDF, exportingPDF)}
          disabled={exportingPDF || !flyer}
          className={cn('flex flex-1 items-center justify-center gap-2 py-3.5 text-[14px] font-bold transition active:scale-[0.98] disabled:opacity-60', SOFT_PILL)}
        >
          {exportingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-[15px] w-[15px]" />}
          PDF
        </button>
      </div>
      <button
        onClick={() => void copyCaption()}
        disabled={!flyer}
        className={cn('flex w-full items-center justify-center gap-2 py-3.5 text-[14px] font-bold transition active:scale-[0.98] disabled:opacity-60', SOFT_PILL)}
      >
        {copied ? <Check className="h-[15px] w-[15px]" /> : <Copy className="h-[15px] w-[15px]" />}
        Copier le texte du jour
      </button>
    </div>
  );
}
