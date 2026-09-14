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
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { customerQrPayload } from '@/lib/customerCode';
import { TEXT, Card, Button } from '@/mobile/designKit';

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
    <Card className={cn('space-y-3', className)}>
      <div className="flex items-center gap-4">
        <div className="shrink-0 rounded-lg bg-white p-2 ring-1 ring-[#D9D9D9]">
          <QRCodeSVG value={customerQrPayload(code)} size={80} level="M" marginSize={0} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-[16px]', TEXT.muted)}>Identifiant client</p>
          <p className={cn('mt-1 text-[26px] font-black leading-none tracking-[0.03em] tabular-nums', TEXT.strong)}>{code}</p>
        </div>
      </div>
      <p className={cn('text-[16px] leading-relaxed', TEXT.body)}>
        Un virement dont le libellé porte ce code est à créditer sur ce client. C'est aussi le code de l'étiquette colis.
      </p>
      <Button variant="neutral" className="h-11 w-full text-[16px]" onClick={copy}>
        {copied ? <Check /> : <Copy />}
        {copied ? 'Identifiant copié' : "Copier l'identifiant"}
      </Button>
    </Card>
  );
}
