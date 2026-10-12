/**
 * L'instruction de paiement d'UN paiement, en fenêtre.
 *
 * Retour utilisateur : « quand je clique sur Export, ça prend trop de temps —
 * je veux un bouton sur chaque paiement qui ouvre une fenêtre où je peux
 * simplement télécharger, ou copier pour envoyer par e-mail ».
 *
 * L'export du lot existait, mais il produit un document de toutes les
 * opérations en cours : long à générer, et le partenaire doit y chercher la
 * bonne page. Ici, un paiement, tout de suite.
 *
 * Ce que la fenêtre montre est CE QUE LE PARTENAIRE RECEVRA — même contenu,
 * même ordre, mêmes libellés bilingues que la page PDF
 * (`PaymentInstructionPage`), pour qu'on sache avant d'envoyer. D'où le fond
 * blanc constant du bloc : c'est un document, pas un écran.
 *
 * Trois sorties, parce que les trois servent :
 *   · le PDF — le QR y est imprimable, c'est ce qu'on joint à un e-mail ;
 *   · l'IMAGE — une capture de la carte ENTIÈRE, collée telle quelle dans
 *     WeChat ou WhatsApp. Sans ce bouton, « copier l'image » depuis le
 *     navigateur ne prenait que le QR : ni le montant, ni la référence, ni le
 *     nom, ni le téléphone — le destinataire recevait un carré sans contexte ;
 *   · le texte — quand l'image ne suffit pas, ou pour un e-mail.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Download, Image as ImageIcon, Loader2 } from 'lucide-react';
import { copyNodePng, prewarmFontEmbedCss } from '@/lib/nodeImage';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CenterDialog, SOFT_PILL, VIOLET_PILL } from '@/desktop/designKit';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { PaymentInstructionPDF } from '@/lib/pdf/templates/PaymentInstructionPDF';
import {
  buildPaymentInstructionText,
  paymentInstructionFilename,
  usesQrCode,
  type PaymentInstructionEntry,
} from '@/lib/paymentInstruction';
import { PaymentInstructionDocument } from '@/components/payment-instruction/PaymentInstructionDocument';

export function PaymentInstructionDialog({
  open,
  onClose,
  entry,
}: {
  open: boolean;
  onClose: () => void;
  entry: PaymentInstructionEntry;
}) {
  const [busy, setBusy] = useState<'pdf' | 'copy' | 'image' | null>(null);
  const isQr = usesQrCode(entry.method);
  // La capture porte sur CETTE carte, pas sur la fenêtre : ni le titre, ni la
  // phrase d'explication, ni les boutons ne doivent partir chez le partenaire.
  const cardRef = useRef<HTMLDivElement>(null);

  // La capture doit réécrire les `@font-face` en base64 : la première coûte
  // plusieurs secondes de réseau. On la paie pendant que l'opérateur lit la
  // carte, pas après son clic.
  useEffect(() => {
    if (open && cardRef.current) prewarmFontEmbedCss(cardRef.current);
  }, [open]);

  const handleDownload = useCallback(async () => {
    if (busy) return;
    setBusy('pdf');
    try {
      await downloadPDF(<PaymentInstructionPDF entry={entry} />, paymentInstructionFilename(entry));
      toast.success('Instruction téléchargée');
    } catch {
      toast.error("Impossible de générer l'instruction");
    } finally {
      setBusy(null);
    }
  }, [entry, busy]);

  /** La carte ENTIÈRE dans le presse-papiers (repli téléchargement : cf. nodeImage). */
  const handleCopyImage = useCallback(async () => {
    if (busy || !cardRef.current) return;
    setBusy('image');
    try {
      const outcome = await copyNodePng(cardRef.current, `${entry.reference}.png`, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      toast.success(
        outcome === 'copied'
          ? 'Image copiée — collez-la dans WeChat ou WhatsApp'
          : 'Image téléchargée — ce navigateur ne sait pas copier une image',
      );
    } catch {
      toast.error("Impossible de copier l'image");
    } finally {
      setBusy(null);
    }
  }, [entry, busy]);

  const handleCopy = useCallback(async () => {
    if (busy) return;
    setBusy('copy');
    try {
      await navigator.clipboard.writeText(buildPaymentInstructionText(entry));
      toast.success('Texte copié — collez-le dans WeChat ou dans un e-mail');
    } catch {
      toast.error('Impossible de copier le texte');
    } finally {
      setBusy(null);
    }
  }, [entry, busy]);

  return (
    <CenterDialog
      open={open}
      onClose={onClose}
      title="Instruction de paiement"
      width={520}
      footer={
        <>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!!busy}
            className={cn('flex h-10 flex-1 items-center justify-center gap-2 text-[13px]', VIOLET_PILL, busy && 'opacity-60')}
          >
            {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Télécharger le PDF
          </button>
          <button
            type="button"
            onClick={handleCopyImage}
            disabled={!!busy}
            className={cn(
              'flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold disabled:opacity-60',
              SOFT_PILL,
            )}
          >
            {busy === 'image' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            Copier l'image
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!!busy}
            className={cn(
              'flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold disabled:opacity-60',
              SOFT_PILL,
            )}
          >
            {busy === 'copy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Copier le texte
          </button>
        </>
      }
    >
      <p className="mb-3 text-[12px] text-muted-foreground">
        Ce que le partenaire chinois recevra — bilingue EN / 中文, identique à la page de l'export.
      </p>

      <PaymentInstructionDocument ref={cardRef} entry={entry} />

      {isQr && !entry.beneficiary_qr_code_url && (
        <p className="mt-2 text-[11.5px] font-medium text-amber-700 dark:text-amber-400">
          Aucun QR enregistré pour ce paiement — le partenaire n'aura que l'identifiant.
        </p>
      )}
    </CenterDialog>
  );
}
