import { QRCodeSVG } from 'qrcode.react';
import { Download, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { formatCurrencyRMB } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/mobile/designKit';

interface CashQRCodeProps {
  paymentId: string;
  paymentReference: string;
  amountRMB: number;
  beneficiaryName: string;
  showDownload?: boolean;
  size?: number;
}

export function CashQRCode({
  paymentId,
  paymentReference,
  amountRMB,
  beneficiaryName,
  showDownload = true,
  size = 240,
}: CashQRCodeProps) {
  const { t } = useTranslation('payments');
  const [copied, setCopied] = useState(false);

  // QR Code payload kept intentionally SMALL for reliable scanning.
  // The backend fetches all details from the payment ID.
  const qrData = JSON.stringify({
    type: 'BONZINI_CASH_PAYMENT',
    id: paymentId,
    v: 1,
  });

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

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(paymentId);
      setCopied(true);
      toast.success(t('cashQr.idCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('cashQr.copyFailed'));
    }
  };

  return (
    <div className={cn('flex flex-col items-center gap-4 rounded-[22px] p-6', SURFACE.card, SURFACE.shadow)}>
      <div className="mb-2 text-center">
        <p className={cn('text-sm', TEXT.muted)}>{t('cashQr.title')}</p>
        <p className={cn('text-lg font-bold', TEXT.strong)}>{paymentReference}</p>
      </div>

      {/* QR island — always white for reliable scanning. */}
      <div className="rounded-xl border border-black/10 bg-white p-4">
        <QRCodeSVG
          id={`qr-${paymentId}`}
          value={qrData}
          size={size}
          level="M"
          includeMargin
        />
      </div>

      <div className="text-center">
        <p className={cn('text-2xl font-bold', TEXT.strong)}>
          {formatCurrencyRMB(amountRMB)}
        </p>
        <p className={cn('mt-1 text-sm', TEXT.muted)}>
          {t('cashQr.beneficiary')}: <span className={cn('font-medium', TEXT.strong)}>{beneficiaryName}</span>
        </p>
      </div>

      {/* Copyable ID */}
      <div className={cn('w-full rounded-xl p-3', SURFACE.holder)}>
        <p className={cn('mb-2 text-center text-xs', TEXT.muted)}>{t('cashQr.paymentId')}</p>
        <div className="flex items-center gap-2">
          <code className={cn('flex-1 truncate rounded-lg p-2 font-mono text-xs', SURFACE.card, TEXT.strong)}>
            {paymentId}
          </code>
          <button
            type="button"
            onClick={handleCopyId}
            aria-label={t('cashQr.paymentId')}
            className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition active:scale-95', SURFACE.card, SURFACE.shadow)}
          >
            {copied ? <Check className="h-4 w-4 text-[#2E7D52]" /> : <Copy className={cn('h-4 w-4', TEXT.muted)} />}
          </button>
        </div>
      </div>

      {showDownload && (
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
