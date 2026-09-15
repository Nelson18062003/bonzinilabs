// ============================================================
// ADMIN MOBILE — l'étiquette colis, en feuille basse.
//
// Le geste le plus fréquent de la journée sur une fiche client : sortir
// l'étiquette et l'envoyer au fournisseur. Donc, dans l'ordre du pouce :
//   1. le mode d'envoi (Sea cargo · Air cargo), une phrase qui dit ce que
//      ça change ;
//   2. les sorties, en pleine largeur, 48 px — sur un téléphone, ENVOYER
//      (la feuille de partage : WhatsApp, WeChat, Fichiers…) passe avant
//      télécharger, et c'est un vrai fichier qui part, jamais un lien ;
//   3. l'aperçu, en dessous : l'image exacte qui sera envoyée.
// Pas de bloc « fournisseur » ici : sur le téléphone, il prenait la place
// sans servir (décision fondateur, 14/09/2026).
// ============================================================
import { useState } from 'react';
import { Download, FileDown, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DESTINATION_HINT_FR,
  DESTINATION_LABEL,
  SHIPPING_DESTINATIONS,
  isLocationConfigured,
  type ShippingDestination,
  type ShippingSettings,
} from '@/lib/customerCode';
import { useShippingLabel, ShippingLabelPreview } from '@/components/customer-code/useShippingLabel';
import { canShareFiles, labelFileName } from '@/components/customer-code/exportShippingLabel';
import { useLabelExport } from '@/components/customer-code/useLabelExport';
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

export function MobileShippingLabelSheet({ open, onClose, code, clientName, clientPhone, clientEmail, companyName, clientCity, clientCountry, settings }: MobileShippingLabelSheetProps) {
  const [destination, setDestination] = useState<ShippingDestination>('warehouse');
  const { preview, render, qr } = useShippingLabel({ code, clientName, clientPhone, clientEmail, companyName, clientCity, clientCountry, destination, settings }, { active: open });

  const configured = isLocationConfigured(settings[destination]);
  const share = canShareFiles();
  const { busy, canRun: ready, run } = useLabelExport(render, code, destination, !!code && configured, {
    downloaded: 'Étiquette téléchargée',
    pdfDownloaded: 'PDF téléchargé',
    copied: 'Image copiée',
    error: "Impossible de générer l'étiquette. Réessaie dans un instant.",
  });

  return (
    <>
      {qr}
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

        {/* 2 · Les sorties — un fichier, remis par la feuille de partage quand elle existe */}
        <div className="flex flex-col gap-2">
          {share ? (
            <>
              <Button className="h-12 w-full text-[16px]" onClick={() => run('share')} disabled={!ready} loading={busy === 'share'}>
                <Share2 />
                Envoyer l'image
              </Button>
              <Button variant="neutral" className="h-12 w-full text-[16px]" onClick={() => run('sharePdf')} disabled={!ready} loading={busy === 'sharePdf'}>
                <FileDown />
                Envoyer le PDF à imprimer
              </Button>
              <Button variant="subtle" className="h-12 w-full text-[16px]" onClick={() => run('png')} disabled={!ready} loading={busy === 'png'}>
                <Download />
                Télécharger l'image
              </Button>
            </>
          ) : (
            <>
              <Button className="h-12 w-full text-[16px]" onClick={() => run('png')} disabled={!ready} loading={busy === 'png'}>
                <Download />
                Télécharger l'image
              </Button>
              <Button variant="neutral" className="h-12 w-full text-[16px]" onClick={() => run('pdf')} disabled={!ready} loading={busy === 'pdf'}>
                <FileDown />
                Télécharger le PDF à imprimer
              </Button>
            </>
          )}
        </div>

        <Line>Le fournisseur colle cette étiquette sur chaque carton. À l'arrivée, un scan rattache le colis à ce client.</Line>

        {/* 3 · L'aperçu : l'image exacte qui part */}
        {code && <ShippingLabelPreview src={preview} />}
        <p className={cn('text-[16px] leading-relaxed text-[#5A5A5A] dark:text-[#CDCDCD]')}>
          Le fichier s'appelle {labelFileName(code, destination, 'png')}.
        </p>
      </div>
      </BottomSheet>
    </>
  );
}
