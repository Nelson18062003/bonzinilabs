// ============================================================
// Bottom-drawer fullscreen viewer for the beneficiary QR code,
// with a download link.
// ============================================================
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { TEXT, SOFT_PILL } from '@/mobile/designKit';

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
        <div className="space-y-3 px-4 pb-4">
          {beneficiaryName && (
            <p className={cn('text-center text-[14px] font-bold', TEXT.strong)}>{beneficiaryName}</p>
          )}
          {url && <img src={url} alt="QR Code" className="w-full rounded-xl bg-white" />}
          {url && (
            <a
              href={url}
              download="qr-code-beneficiaire"
              className={cn('flex h-12 w-full items-center justify-center gap-2 text-[14px] font-semibold transition active:scale-[0.98]', SOFT_PILL)}
            >
              <Download className="h-4 w-4" />
              {t('detail.downloadQrCode')}
            </a>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
