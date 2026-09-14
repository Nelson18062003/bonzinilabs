// ============================================================
// ADMIN MOBILE — l'étiquette colis, en feuille basse.
//
// Le geste le plus fréquent de la journée sur une fiche client : sortir
// l'étiquette et l'envoyer au fournisseur. Donc, dans l'ordre du pouce :
//   1. le mode d'envoi (Sea cargo · Air cargo), une phrase qui dit ce que
//      ça change ;
//   2. les trois sorties, en pleine largeur, 48 px — Télécharger d'abord ;
//   3. l'aperçu, en dessous, à l'échelle de l'écran.
// Pas de bloc « fournisseur » ici : sur le téléphone, il prenait la place
// sans servir (décision fondateur, 14/09/2026). L'export est en mode rapide
// (×2, polices du système) — voir exportShippingLabel.ts.
// ============================================================
import { useRef, useState } from 'react';
import { Download, FileDown, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DESTINATION_HINT_FR,
  DESTINATION_LABEL,
  DESTINATION_SLUG,
  SHIPPING_DESTINATIONS,
  isLocationConfigured,
  type ShippingDestination,
  type ShippingSettings,
} from '@/lib/customerCode';
import { ShippingLabel, LABEL_W, LABEL_H } from '@/components/customer-code/ShippingLabel';
import { downloadShippingLabelPdf, downloadShippingLabelPng, shareShippingLabel } from '@/components/customer-code/exportShippingLabel';
import { BottomSheet, Button, Line, Segmented } from '@/mobile/designKit';

export interface MobileShippingLabelSheetProps {
  open: boolean;
  onClose: () => void;
  code: string;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  companyName?: string | null;
  clientCity?: string | null;
  clientCountry?: string | null;
  settings: ShippingSettings;
}

type Kind = 'png' | 'share' | 'pdf';

const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof File !== 'undefined';

export function MobileShippingLabelSheet({ open, onClose, code, clientName, clientPhone, clientEmail, companyName, clientCity, clientCountry, settings }: MobileShippingLabelSheetProps) {
  const labelRef = useRef<HTMLDivElement>(null);
  const [destination, setDestination] = useState<ShippingDestination>('warehouse');
  const [busy, setBusy] = useState<Kind | null>(null);

  const configured = isLocationConfigured(settings[destination]);
  const ready = !!code && configured && busy === null;

  const run = async (kind: Kind) => {
    if (!labelRef.current || !ready) return;
    setBusy(kind);
    try {
      if (kind === 'png') {
        await downloadShippingLabelPng(labelRef.current, code, destination, { fast: true });
        toast.success('Étiquette téléchargée');
      } else if (kind === 'share') {
        const outcome = await shareShippingLabel(labelRef.current, code, destination, { fast: true });
        if (outcome === 'downloaded') toast.success('Étiquette téléchargée');
      } else {
        await downloadShippingLabelPdf(labelRef.current, code, destination, { fast: true });
      }
    } catch (err) {
      console.error('shipping label export', err);
      toast.error("Impossible de générer l'étiquette. Réessaie dans un instant.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Étiquette colis">
      <div className="space-y-4">
        {/* 1 · Le mode d'envoi */}
        <div className="space-y-2">
          <Segmented
            value={destination}
            onChange={setDestination}
            options={SHIPPING_DESTINATIONS.map((d) => ({ value: d, label: DESTINATION_LABEL[d].fr }))}
          />
          <Line>{DESTINATION_HINT_FR[destination]}</Line>
          {!configured && <Line tone="warn">L'adresse de ce mode n'est pas encore renseignée dans Plus → Expédition.</Line>}
        </div>

        {/* 2 · Les sorties — Télécharger d'abord, en pleine largeur */}
        <div className="flex flex-col gap-2">
          <Button className="h-12 w-full text-[16px]" onClick={() => run('png')} disabled={!ready} loading={busy === 'png'}>
            <Download />
            Télécharger l'image
          </Button>
          {canShareFiles && (
            <Button variant="neutral" className="h-12 w-full text-[16px]" onClick={() => run('share')} disabled={!ready} loading={busy === 'share'}>
              <Share2 />
              Envoyer l'image (WhatsApp, WeChat)
            </Button>
          )}
          <Button variant="neutral" className="h-12 w-full text-[16px]" onClick={() => run('pdf')} disabled={!ready} loading={busy === 'pdf'}>
            <FileDown />
            PDF à imprimer
          </Button>
        </div>

        <Line>Le fournisseur colle cette étiquette sur chaque carton. À l'arrivée, un scan rattache le colis à ce client.</Line>

        {/* 3 · L'aperçu : le même nœud que celui exporté, réduit à la largeur de l'écran */}
        <div className="overflow-hidden rounded-lg ring-1 ring-black/[0.08] dark:ring-white/[0.1]">
          <div className="relative w-full" style={{ aspectRatio: `${LABEL_W} / ${LABEL_H}` }}>
            {code && (
              <div
                className="absolute left-0 top-0 origin-top-left"
                style={{ width: LABEL_W, height: LABEL_H, transform: 'scale(var(--label-scale, 0.5))' }}
                ref={(el) => {
                  if (!el?.parentElement) return;
                  const w = el.parentElement.clientWidth;
                  if (w > 0) el.style.setProperty('--label-scale', String(w / LABEL_W));
                }}
              >
                <ShippingLabel
                  ref={labelRef}
                  code={code}
                  clientName={clientName}
                  clientPhone={clientPhone}
                  clientEmail={clientEmail}
                  companyName={companyName}
                  clientCity={clientCity}
                  clientCountry={clientCountry}
                  destination={destination}
                  settings={settings}
                />
              </div>
            )}
          </div>
        </div>
        <p className={cn('text-[16px] leading-relaxed text-[#5A5A5A] dark:text-[#CDCDCD]')}>
          Identifiant {code}. Le fichier s'appelle bonzini-etiquette-{DESTINATION_SLUG[destination]}-{code}.
        </p>
      </div>
    </BottomSheet>
  );
}
