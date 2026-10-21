// Le QR que le CLIENT présente au bureau. Il porte le jeton secret du
// paiement (payment_cash_tokens, lisible par le seul client) : l'UUID seul
// ne suffit plus au scan. Jamais affiché sur les écrans du staff.
import { QRCodeSVG } from 'qrcode.react';
import { Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cashQrPayload } from '@/hooks/useCashPayment';
import { formatCurrencyRMB } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/mobile/designKit';

interface CashQRCodeProps {
  paymentId: string;
  /** Le jeton secret du paiement ; `null` tant qu'il se charge. */
  token: string | null;
  paymentReference: string;
  amountRMB: number;
  beneficiaryName: string;
  showDownload?: boolean;
  size?: number;
}

export function CashQRCode({
  paymentId,
  token,
  paymentReference,
  amountRMB,
  beneficiaryName,
  showDownload = true,
  size = 240,
}: CashQRCodeProps) {
  const { t } = useTranslation('payments');
  // Petit contenu pour un scan fiable : l'identifiant et le jeton.
  const qrData = token ? cashQrPayload(paymentId, token) : null;

  const handleDownload = () => {
    const svgElement = document.getElementById(`qr-${paymentId}`);
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new window.Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      const link = document.createElement('a');
      link.download = `bonzini-${paymentReference}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className={cn('flex flex-col items-center gap-4 rounded-[22px] p-6', SURFACE.card, SURFACE.shadow)}>
      <div className="mb-2 text-center">
        <p className={cn('text-sm', TEXT.muted)}>{t('cashQr.title')}</p>
        <p className={cn('text-lg font-bold', TEXT.strong)}>{paymentReference}</p>
      </div>

      {/* QR island — always white for reliable scanning. */}
      <div className="rounded-xl border border-black/10 bg-white p-4">
        {qrData ? (
          <QRCodeSVG
            id={`qr-${paymentId}`}
            value={qrData}
            size={size}
            level="M"
            includeMargin
          />
        ) : (
          <div className="flex items-center justify-center text-black/40" style={{ width: size, height: size }} role="status">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>

      <div className="text-center">
        <p className={cn('text-2xl font-bold', TEXT.strong)}>
          {formatCurrencyRMB(amountRMB)}
        </p>
        <p className={cn('mt-1 text-sm', TEXT.muted)}>
          {t('cashQr.beneficiary')}: <span className={cn('font-medium', TEXT.strong)}>{beneficiaryName}</span>
        </p>
      </div>

      {showDownload && qrData && (
        <button
          type="button"
          onClick={handleDownload}
          className={cn('flex w-full items-center justify-center gap-2 rounded-full py-3 text-[14px] font-bold transition active:scale-[0.99]', SURFACE.holder)}
        >
          <Download className="h-4 w-4" />
          {t('cashQr.download')}
        </button>
      )}

      <p className={cn('text-center text-xs', TEXT.muted)}>
        {t('cashQr.instruction')}
      </p>
    </div>
  );
}
