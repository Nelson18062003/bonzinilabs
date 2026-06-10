// RateFlyerSheet — contenu du panneau « Flyer du jour » (aperçu + exports).
// Ouvert depuis la pilule « Voir le flyer du jour » au bas du module Taux
// (fidèle à la maquette validée). Aperçu responsive (échelle mesurée au
// conteneur). Logique d'export 100% préservée (downloadFlyerPNG/PDF).
import { useLayoutEffect, useRef, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RateFlyer } from './RateFlyer';
import { downloadFlyerPNG, downloadFlyerPDF } from '@/lib/exportFlyer';
import { TEXT, SOFT_PILL } from '@/mobile/designKit';

const FLYER_W = 2150;
const FLYER_H = 2560;

interface FlyerRates {
  alipay: number;
  wechat: number;
  bank: number;
  cash: number;
}

export function RateFlyerSheet({ rates }: { rates: FlyerRates }) {
  const [flyerDark, setFlyerDark] = useState(true);
  const [exportingPNG, setExportingPNG] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className={cn('text-[12px]', TEXT.muted)}>À partager sur WhatsApp avec vos clients</div>
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
      <div ref={previewRef}>
        {scale > 0 && (
          <div className="overflow-hidden rounded-2xl" style={{ height: Math.round(FLYER_H * scale) }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: FLYER_W, pointerEvents: 'none' }}>
              <RateFlyer alipay={rates.alipay} wechat={rates.wechat} bank={rates.bank} cash={rates.cash} theme={flyerDark ? 'dark' : 'light'} />
            </div>
          </div>
        )}
      </div>

      {/* Exports — libellés explicites */}
      <div className="flex gap-2.5">
        <button
          onClick={async () => {
            if (exportingPNG) return;
            setExportingPNG(true);
            try { await downloadFlyerPNG(rates, flyerDark); }
            finally { setExportingPNG(false); }
          }}
          disabled={exportingPNG}
          className="flex flex-[1.6] items-center justify-center gap-2 rounded-full bg-[#1C1B22] py-3.5 text-[14px] font-bold text-white transition active:scale-[0.98] disabled:opacity-60 dark:bg-[#F2F1F7] dark:text-[#1B1A24]"
        >
          {exportingPNG ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-[15px] w-[15px]" />}
          Télécharger le flyer
        </button>
        <button
          onClick={async () => {
            if (exportingPDF) return;
            setExportingPDF(true);
            try { await downloadFlyerPDF(rates, flyerDark); }
            finally { setExportingPDF(false); }
          }}
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
