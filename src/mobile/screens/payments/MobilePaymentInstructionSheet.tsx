// ============================================================
// L'INSTRUCTION DE PAIEMENT, SUR TÉLÉPHONE — la même carte que sur
// l'ordinateur (PaymentInstructionDocument), dans une feuille.
//
// Le geste au téléphone n'est pas « télécharger » mais « envoyer » : la
// carte part dans WeChat ou WhatsApp, chez le partenaire Alipay qui paie.
// D'où, dans l'ordre :
//   · Partager l'image — la carte entière (montant, QR, bénéficiaire) ;
//   · Partager le PDF  — la page imprimable, pour un e-mail ;
//   · Copier le texte  — quand il faut retaper ou compléter ;
//   · Télécharger le PDF — le garder sur le téléphone.
//
// La feuille de partage du téléphone doit s'ouvrir DANS le toucher (Safari
// refuse navigator.share après une longue attente). L'image et le PDF sont
// donc fabriqués dès l'ouverture ; le toucher partage un fichier déjà prêt.
// L'image D'ABORD (quelques dizaines de ms, le geste principal), le PDF
// ensuite : @react-pdf et la police chinoise (1,6 Mo) occupent le téléphone
// plusieurs secondes — faits en premier, ils retenaient l'image derrière eux.
// Sans feuille de partage (ordinateur, navigateur ancien), le fichier est
// téléchargé. Dans l'app BONZINI HQ, partage, téléchargement et
// presse-papiers passent par l'app (hq-app/src/bridge.ts).
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { Copy, Download, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BottomSheet, Button, TEXT } from '@/mobile/designKit';
import { PaymentInstructionDocument } from '@/components/payment-instruction/PaymentInstructionDocument';
import {
  buildPaymentInstructionText,
  instructionDocumentKey,
  usesQrCode,
  type PaymentInstructionEntry,
} from '@/lib/paymentInstruction';
import { buildInstructionImageFile, buildInstructionPdfFile } from '@/lib/paymentInstructionFiles';
import { deliverFile, downloadFile } from '@/components/customer-code/exportShippingLabel';
import { copyToClipboard } from '@/lib/clipboard';

type Busy = 'image' | 'pdf' | 'download' | null;
const NOT_READY = { image: false, pdf: false };

export function MobilePaymentInstructionSheet({
  open,
  onClose,
  entry,
}: {
  open: boolean;
  onClose: () => void;
  entry: PaymentInstructionEntry;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<Busy>(null);
  // Les fichiers en préparation (promesses gardées : le toucher prend le fichier déjà prêt).
  const pdfRef = useRef<Promise<File> | null>(null);
  const imageRef = useRef<Promise<File> | null>(null);
  // « Prêt » = la fabrication est finie, réussie ou non (un échec s'annonce au toucher).
  const [ready, setReady] = useState(NOT_READY);
  const entryRef = useRef(entry);
  entryRef.current = entry;
  // La fiche recrée l'objet à chaque rendu : la clé dit si le document a changé.
  const key = instructionDocumentKey(entry);
  const isQr = usesQrCode(entry.method);
  const title = `Bonzini · ${entry.reference}`;

  // À l'ouverture : l'image puis le PDF se fabriquent pendant que l'opérateur relit la carte.
  useEffect(() => {
    pdfRef.current = null;
    imageRef.current = null;
    setReady(NOT_READY);
    if (!open) return;
    let alive = true;
    const current = entryRef.current;

    // La carte doit être peinte (la feuille vient de s'ouvrir) ; la fabrique
    // attend elle-même les polices et le QR. Les échecs s'annoncent au
    // toucher, pas en « unhandled rejection ».
    const frame = requestAnimationFrame(() => {
      if (!alive) return;
      const node = cardRef.current;
      const image = node ? buildInstructionImageFile(node, current) : Promise.reject(new Error('Carte absente'));
      image.catch(() => undefined);
      imageRef.current = image;
      void image
        .then(() => undefined, () => undefined)
        .then(() => {
          if (!alive) return;
          setReady((r) => ({ ...r, image: true }));
          const pdf = buildInstructionPdfFile(current);
          pdf.catch(() => undefined);
          pdfRef.current = pdf;
          const settle = () => alive && setReady((r) => ({ ...r, pdf: true }));
          pdf.then(settle, settle);
        });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [open, key]);

  const deliver = async (kind: 'image' | 'pdf') => {
    const file = kind === 'image' ? imageRef.current : pdfRef.current;
    if (busy || !file) return;
    setBusy(kind);
    try {
      const outcome = await deliverFile(await file, title);
      if (outcome === 'downloaded') toast.success(kind === 'image' ? 'Image téléchargée' : 'PDF téléchargé');
    } catch {
      toast.error(kind === 'image' ? "Impossible de préparer l'image" : "Impossible de générer l'instruction");
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    if (busy || !pdfRef.current) return;
    setBusy('download');
    try {
      downloadFile(await pdfRef.current);
      toast.success('PDF téléchargé');
    } catch {
      toast.error("Impossible de générer l'instruction");
    } finally {
      setBusy(null);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Instruction de paiement · 付款指令">
      <div className="space-y-4">
        <p className={cn('text-[14px] leading-snug', TEXT.muted)}>
          Ce que le partenaire en Chine recevra, en anglais et en chinois. Envoyez-la-lui pour qu'il paie.
        </p>

        <PaymentInstructionDocument ref={cardRef} entry={entry} />

        {isQr && !entry.beneficiary_qr_code_url && (
          <p className="text-[14px] font-medium text-[#975102] dark:text-[#E8B931]">
            Aucun QR enregistré pour ce paiement : le partenaire n'aura que l'identifiant.
          </p>
        )}

        <div className="space-y-2">
          <Button className="w-full" onClick={() => deliver('image')} disabled={!!busy || !ready.image}>
            {busy === 'image' || !ready.image ? <Loader2 className="animate-spin" /> : <ImageIcon />}
            {ready.image ? "Partager l'image" : "Préparation de l'image…"}
          </Button>
          <Button variant="neutral" className="w-full" onClick={() => deliver('pdf')} disabled={!!busy || !ready.pdf}>
            {busy === 'pdf' || !ready.pdf ? <Loader2 className="animate-spin" /> : <FileText />}
            {ready.pdf ? 'Partager le PDF' : 'Préparation du PDF…'}
          </Button>
          <Button
            variant="neutral"
            className="w-full"
            onClick={() => copyToClipboard(buildPaymentInstructionText(entry), "Texte de l'instruction")}
          >
            <Copy />
            Copier le texte
          </Button>
          <Button variant="subtle" className="w-full" onClick={downloadPdf} disabled={!!busy || !ready.pdf} loading={busy === 'download'}>
            <Download />
            Télécharger le PDF
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
