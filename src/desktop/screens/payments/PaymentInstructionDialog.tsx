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
 * Deux sorties, parce que les deux servent :
 *   · le PDF — le QR y est imprimable, c'est ce qu'on joint à un e-mail ;
 *   · le texte — ce qu'on colle dans WeChat, où un PDF se perd.
 */
import { useCallback, useState } from 'react';
import { Copy, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CenterDialog, SOFT_PILL, VIOLET_PILL } from '@/desktop/designKit';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { PaymentInstructionPDF } from '@/lib/pdf/templates/PaymentInstructionPDF';
import {
  buildPaymentInstructionText,
  formatDateIso,
  methodLabel,
  paymentInstructionFilename,
  usesQrCode,
  type PaymentInstructionEntry,
} from '@/lib/paymentInstruction';
import { formatRMB } from '@/lib/pdf/helpers';

/** Le document se lit toujours sur fond clair, quel que soit le thème de l'app. */
const DOC = { strong: '#17151F', muted: '#6E6A80', line: 'rgba(0,0,0,0.08)', violet: '#5B21B6' };

function DocField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px]" style={{ color: DOC.muted }}>
        {label}
      </div>
      <div
        className={cn('mt-0.5 break-words text-[13.5px] font-semibold', mono && 'font-mono tracking-[0.02em]')}
        style={{ color: DOC.strong }}
      >
        {value}
      </div>
    </div>
  );
}

export function PaymentInstructionDialog({
  open,
  onClose,
  entry,
}: {
  open: boolean;
  onClose: () => void;
  entry: PaymentInstructionEntry;
}) {
  const [busy, setBusy] = useState<'pdf' | 'copy' | null>(null);
  const isQr = usesQrCode(entry.method);

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

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.08]">
        {/* En-tête : la méthode et la référence, comme en haut de la page PDF. */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5"
          style={{ borderBottom: `1px solid ${DOC.line}` }}
        >
          <span className="truncate text-[12.5px] font-bold" style={{ color: DOC.strong }}>
            {methodLabel(entry.method)}
          </span>
          <span className="shrink-0 font-mono text-[11.5px] font-bold" style={{ color: DOC.muted }}>
            {entry.reference}
          </span>
        </div>

        {/* Le montant, en grand : c'est la seule chose qui doit être lue de loin. */}
        <div className="px-4 py-4 text-center">
          <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: DOC.muted }}>
            Amount to send · 付款金额
          </div>
          <div className="mt-1 text-[34px] font-extrabold leading-none tabular-nums" style={{ color: DOC.violet }}>
            ¥{formatRMB(entry.amount_rmb)}
          </div>
          <div className="mt-1 text-[11px]" style={{ color: DOC.muted }}>
            RMB · 人民币 — {formatDateIso(entry.created_at)}
          </div>
        </div>

        {isQr && entry.beneficiary_qr_code_url && (
          <div className="flex flex-col items-center px-4 pb-3">
            <div className="rounded-xl bg-white p-2" style={{ border: `1px solid ${DOC.line}` }}>
              <img
                src={entry.beneficiary_qr_code_url}
                crossOrigin="anonymous"
                alt={`QR code ${methodLabel(entry.method)} — ${entry.reference}`}
                className="block h-[190px] w-[190px] bg-white object-contain"
              />
            </div>
            <div className="mt-1.5 text-[10px]" style={{ color: DOC.muted }}>
              QR Code · 二维码 — {methodLabel(entry.method)}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 px-4 pb-4" style={{ borderTop: `1px solid ${DOC.line}`, paddingTop: 12 }}>
          {entry.method === 'bank_transfer' ? (
            <>
              {entry.beneficiary_name && <DocField label="Beneficiary · 收款人" value={entry.beneficiary_name} />}
              {entry.beneficiary_bank_name && <DocField label="Bank · 银行" value={entry.beneficiary_bank_name} />}
              {entry.beneficiary_bank_account && (
                <DocField label="Account · 账号" value={entry.beneficiary_bank_account} mono />
              )}
              {entry.beneficiary_bank_extra && (
                <DocField label="SWIFT / IBAN · 银行代码" value={entry.beneficiary_bank_extra} mono />
              )}
            </>
          ) : (
            <>
              {entry.beneficiary_name && <DocField label="Name · 姓名" value={entry.beneficiary_name} />}
              {entry.beneficiary_identifier && (
                <DocField
                  label={entry.method === 'wechat' ? 'WeChat ID · 微信号' : 'Alipay ID · 支付宝账号'}
                  value={entry.beneficiary_identifier}
                  mono
                />
              )}
            </>
          )}
          {entry.beneficiary_phone && <DocField label="Phone · 电话" value={entry.beneficiary_phone} mono />}
          {entry.beneficiary_email && <DocField label="Email · 邮箱" value={entry.beneficiary_email} />}
          {entry.beneficiary_notes && (
            <div className="col-span-2">
              <DocField label="Notes · 备注" value={entry.beneficiary_notes} />
            </div>
          )}
        </div>
      </div>

      {isQr && !entry.beneficiary_qr_code_url && (
        <p className="mt-2 text-[11.5px] font-medium text-amber-700 dark:text-amber-400">
          Aucun QR enregistré pour ce paiement — le partenaire n'aura que l'identifiant.
        </p>
      )}
    </CenterDialog>
  );
}
