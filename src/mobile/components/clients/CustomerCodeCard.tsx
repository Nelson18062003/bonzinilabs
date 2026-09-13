// ============================================================
// ADMIN — Identifiant client (code + QR) sur la fiche client mobile.
//
// Ce que l'opérateur vient chercher ici : le code à comparer avec le libellé
// d'un virement, ou à dicter au client au téléphone. Le QR est là pour le
// même usage que sur l'étiquette colis — le montrer à un collègue de
// l'entrepôt, ou le scanner depuis un autre poste.
// ============================================================
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { customerQrPayload } from '@/lib/customerCode';
import { SURFACE, TEXT, Card, Holder } from '@/mobile/designKit';

export function CustomerCodeCard({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Identifiant copié');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copie impossible');
    }
  };

  if (!code) return null;

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center gap-3.5">
        <div className="rounded-2xl bg-white p-2 ring-1 ring-black/[0.06]">
          <QRCodeSVG value={customerQrPayload(code)} size={72} level="M" marginSize={0} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn('flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
            <QrCode className="h-3.5 w-3.5" />
            Identifiant client
          </div>
          <div className={cn('mt-1 text-[24px] font-black leading-none tracking-[0.04em] tabular-nums', TEXT.strong)}>{code}</div>
          <p className={cn('mt-1.5 text-[12px] leading-snug', TEXT.muted)}>Libellé de virement · étiquette colis</p>
        </div>
        <Holder icon={copied ? Check : Copy} tone={copied ? 'success' : 'neutral'} size="sm" onClick={copy} ariaLabel="Copier l'identifiant" />
      </div>
      <div className={cn('mt-3 rounded-xl px-3 py-2 text-[12px]', SURFACE.inset, TEXT.body)}>
        Un virement dont le libellé porte ce code est à créditer sur ce client.
      </div>
    </Card>
  );
}
