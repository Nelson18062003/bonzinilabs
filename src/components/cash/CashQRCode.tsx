import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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
  size = 200,
}: CashQRCodeProps) {
  // QR Code data structure
  const qrData = JSON.stringify({
    type: 'BONZINI_CASH_PAYMENT',
    id: paymentId,
    ref: paymentReference,
    amount: amountRMB,
    currency: 'RMB',
    beneficiary: beneficiaryName,
    v: 1, // version
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

  return (
    <Card className="p-6 flex flex-col items-center gap-4 bg-white">
      <div className="text-center mb-2">
        <p className="text-sm text-muted-foreground">QR Code de paiement</p>
        <p className="font-semibold text-lg">{paymentReference}</p>
      </div>
      
      <div className="p-4 bg-white rounded-xl border-2 border-primary/20">
        <QRCodeSVG
          id={`qr-${paymentId}`}
          value={qrData}
          size={size}
          level="H"
          includeMargin
          imageSettings={{
            src: '/favicon.ico',
            height: 24,
            width: 24,
            excavate: true,
          }}
        />
      </div>

      <div className="text-center">
        <p className="text-2xl font-bold text-primary">
          ¥ {amountRMB.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} RMB
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Bénéficiaire: <span className="font-medium text-foreground">{beneficiaryName}</span>
        </p>
      </div>

      {showDownload && (
        <Button variant="outline" onClick={handleDownload} className="w-full">
          <Download className="w-4 h-4 mr-2" />
          Télécharger le QR Code
        </Button>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Présentez ce QR Code au bureau Bonzini Guangzhou pour récupérer votre argent
      </p>
    </Card>
  );
}
