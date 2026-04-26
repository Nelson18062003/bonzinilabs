// ============================================================
// Bottom-drawer fullscreen viewer for the beneficiary QR code,
// with a download link.
// ============================================================
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';

interface Props {
  url: string | null;
  beneficiaryName: string | null;
  onClose: () => void;
}

export function PaymentQrViewerDrawer({ url, beneficiaryName, onClose }: Props) {
  const { t } = useTranslation('payments');

  return (
    <Drawer open={!!url} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>{t('detail.qrCodeBeneficiary')}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4 space-y-3">
          {beneficiaryName && (
            <p className="text-center text-sm font-medium">{beneficiaryName}</p>
          )}
          {url && <img src={url} alt="QR Code" className="w-full rounded-xl" />}
          {url && (
            <a
              href={url}
              download="qr-code-beneficiaire"
              className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border border-border font-medium text-sm active:scale-[0.98] transition-transform"
            >
              <Download className="w-4 h-4" />
              {t('detail.downloadQrCode')}
            </a>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
