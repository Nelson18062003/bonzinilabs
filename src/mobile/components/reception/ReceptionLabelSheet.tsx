// ============================================================
// RÉCEPTION — l'étiquette colis d'un client, en feuille basse, dans la
// langue de l'app. Le même peintre et les mêmes sorties que la fiche client
// admin : Sea cargo · Air cargo (le lieu où l'on est, par défaut), puis
// ENVOYER l'image (WhatsApp, WeChat), envoyer le PDF à imprimer, ou
// télécharger. L'aperçu est l'image exacte qui part.
// ============================================================
import { useState } from 'react';
import { Download, FileDown, Share2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { DESTINATION_LABEL, SHIPPING_DESTINATIONS, isLocationConfigured, type ShippingDestination, type ShippingSettings } from '@/lib/customerCode';
import { clientFullName, readStoredLocation, type ReceptionClient } from '@/lib/reception';
import { DestinationMark } from '@/components/customer-code/DestinationMark';
import { ShippingLabelPreview, useShippingLabel } from '@/components/customer-code/useShippingLabel';
import { canShareFiles, labelFileName } from '@/components/customer-code/exportShippingLabel';
import { useLabelExport } from '@/components/customer-code/useLabelExport';
import { TEXT, TYPE, BottomSheet, Button, Segmented } from '@/mobile/designKit';

export function ReceptionLabelSheet({ open, onClose, client, settings }: { open: boolean; onClose: () => void; client: ReceptionClient; settings: ShippingSettings }) {
  const { t, language } = useLanguage();
  const lang = (language === 'zh' || language === 'en' ? language : 'fr') as 'zh' | 'en' | 'fr';
  const [destination, setDestination] = useState<ShippingDestination>(() => readStoredLocation() ?? 'warehouse');
  const code = client.customer_code;
  const { preview, render, qr } = useShippingLabel({
    code, clientName: clientFullName(client), clientPhone: client.phone, clientEmail: client.email,
    companyName: client.company_name, clientCity: client.city, clientCountry: client.country, destination, settings,
  }, { active: open });

  const configured = isLocationConfigured(settings[destination]);
  const share = canShareFiles();
  const { busy, canRun: ready, run } = useLabelExport(render, code, destination, !!code && configured, {
    downloaded: t('rc_label_downloaded'), pdfDownloaded: t('rc_pdf_downloaded'), copied: t('rc_copied'), error: t('rc_label_error'),
  });

  return (
    <>
      {qr}
      <BottomSheet open={open} onClose={onClose} title={`${t('rc_client_label')} · ${code}`}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Segmented
              value={destination}
              onChange={setDestination}
              options={SHIPPING_DESTINATIONS.map((d) => ({ value: d, label: <DestinationMark destination={d}>{DESTINATION_LABEL[d][lang]}</DestinationMark> }))}
            />
            <p className={cn(TYPE.small, TEXT.muted)}>{destination === 'warehouse' ? t('rc_mode_sea_hint') : t('rc_mode_air_hint')}</p>
            {!configured && <p className={cn(TYPE.small, 'text-[#975102] dark:text-[#E8B931]')}>{t('rc_address_missing')}</p>}
          </div>

          <div className="flex flex-col gap-2">
            {share ? (
              <>
                <Button className="h-12 w-full text-[16px]" onClick={() => run('share')} disabled={!ready} loading={busy === 'share'}><Share2 /> {t('rc_send_image')}</Button>
                <Button variant="neutral" className="h-12 w-full text-[16px]" onClick={() => run('sharePdf')} disabled={!ready} loading={busy === 'sharePdf'}><FileDown /> {t('rc_send_pdf')}</Button>
                <Button variant="subtle" className="h-12 w-full text-[16px]" onClick={() => run('png')} disabled={!ready} loading={busy === 'png'}><Download /> {t('rc_download_image')}</Button>
              </>
            ) : (
              <>
                <Button className="h-12 w-full text-[16px]" onClick={() => run('png')} disabled={!ready} loading={busy === 'png'}><Download /> {t('rc_download_image')}</Button>
                <Button variant="neutral" className="h-12 w-full text-[16px]" onClick={() => run('pdf')} disabled={!ready} loading={busy === 'pdf'}><FileDown /> {t('rc_download_pdf')}</Button>
              </>
            )}
          </div>

          <p className={cn(TYPE.small, TEXT.muted)}>{t('rc_client_label_hint')}</p>
          {code && <ShippingLabelPreview src={preview} />}
          <p className={cn(TYPE.small, TEXT.muted)}>{labelFileName(code, destination, 'png')}</p>
        </div>
      </BottomSheet>
    </>
  );
}
