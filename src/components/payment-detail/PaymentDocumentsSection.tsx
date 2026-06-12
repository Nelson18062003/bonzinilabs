// ============================================================
// Preuve & détails — fiche v7 : UN bloc regroupant la preuve de
// paiement ajoutée par Bonzini (vignettes cliquables), les pièces
// jointes du client (+ upload si statut uploadable), puis les
// lignes Référence / Méthode / Créé le / Payé le. Pour un paiement
// non terminé, l'accès au reçu vit ici (en pilule douce) — le
// paiement terminé a déjà son gros bouton reçu en tête de fiche.
// Logique 100 % PRÉSERVÉE (preuves admin/client, upload, verrou).
// ============================================================
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileDown, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentProofGallery } from '@/components/payment/PaymentProofGallery';
import { PaymentProofUpload } from '@/components/payment/PaymentProofUpload';
import type { Payment, PaymentProof } from '@/hooks/usePayments';
import { SURFACE, TEXT, SOFT_PILL, SectionTitle } from '@/mobile/designKit';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';
import type { PaymentMethod } from '@/types/payment';
import { isStatusLocked, isStatusUploadable } from './types';

interface Props {
  payment: Payment;
  adminProofs: PaymentProof[];
  clientProofs: PaymentProof[];
  uploadKey: number;
  instructionFiles: File[];
  onInstructionFilesChange: (files: File[]) => void;
  onUploadInstructions: () => void;
  isUploadingProofs: boolean;
  onDownloadReceipt: () => void;
  isGeneratingPDF: boolean;
}

const DIVIDER = 'border-t border-black/[0.06] dark:border-white/[0.08]';

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className={cn('text-[13px]', TEXT.muted)}>{label}</span>
      <span className={cn('truncate text-[13px] font-bold', mono && 'font-mono', TEXT.strong)}>
        {value}
      </span>
    </div>
  );
}

export function PaymentDocumentsSection({
  payment,
  adminProofs,
  clientProofs,
  uploadKey,
  instructionFiles,
  onInstructionFilesChange,
  onUploadInstructions,
  isUploadingProofs,
  onDownloadReceipt,
  isGeneratingPDF,
}: Props) {
  const { t } = useTranslation('payments');

  const canUploadInstructions = isStatusUploadable(payment.status);
  const isLocked = isStatusLocked(payment.status);
  const methodLabel = PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method;
  const hasDocBlocks = adminProofs.length > 0 || clientProofs.length > 0 || canUploadInstructions;

  return (
    <section>
      <SectionTitle>Preuve & détails</SectionTitle>
      <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
        {adminProofs.length > 0 && (
          <div>
            <p className={cn('text-[14px] font-bold', TEXT.strong)}>Preuve de paiement</p>
            <p className={cn('mb-3 mt-0.5 text-[12px]', TEXT.muted)}>
              Ajoutée par Bonzini · toucher pour agrandir
            </p>
            <PaymentProofGallery proofs={adminProofs} title="" emptyMessage="" showUploadedBy={false} />
          </div>
        )}

        {clientProofs.length > 0 && (
          <div className={cn(adminProofs.length > 0 && cn('mt-4 pt-4', DIVIDER))}>
            <p className={cn('mb-2 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
              {t('detail.myInstructions', { count: clientProofs.length })}
            </p>
            <p className={cn('mb-3 text-[12px]', TEXT.muted)}>{t('detail.myInstructionsDescription')}</p>
            <PaymentProofGallery proofs={clientProofs} title="" emptyMessage="" showUploadedBy={false} />
            {isLocked && (
              <div className={cn('mt-2 flex items-center gap-1.5 text-[12px]', TEXT.muted)}>
                <Lock className="h-3.5 w-3.5" />
                {t('detail.noMoreModifications')}
              </div>
            )}
          </div>
        )}

        {canUploadInstructions && (
          <div className={cn((adminProofs.length > 0 || clientProofs.length > 0) && cn('mt-4 pt-4', DIVIDER))}>
            <PaymentProofUpload
              key={uploadKey}
              onFilesSelect={onInstructionFilesChange}
              selectedFiles={instructionFiles}
              onConfirm={onUploadInstructions}
              isSubmitting={isUploadingProofs}
            />
          </div>
        )}

        {/* Lignes de détail — toujours présentes. */}
        <div className={cn(hasDocBlocks && cn('mt-4 pt-3', DIVIDER))}>
          <MetaRow label={t('detail.reference')} value={payment.reference} mono />
          <MetaRow label={t('detail.method')} value={methodLabel} />
          <MetaRow
            label={t('detail.createdOn')}
            value={format(new Date(payment.created_at), 'd MMM yyyy, HH:mm', { locale: fr })}
          />
          {payment.processed_at && (
            <MetaRow
              label={payment.status === 'completed' ? 'Payé le' : 'Traité le'}
              value={format(new Date(payment.processed_at), 'd MMM yyyy, HH:mm', { locale: fr })}
            />
          )}
        </div>

        {payment.status !== 'completed' && (
          <button
            onClick={onDownloadReceipt}
            disabled={isGeneratingPDF}
            className={cn(
              'mt-3 flex w-full items-center justify-center gap-2 py-3 text-[13px] font-bold transition active:scale-[0.99] disabled:opacity-50',
              SOFT_PILL,
            )}
          >
            {isGeneratingPDF ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            {t('detail.downloadReceipt')}
          </button>
        )}
      </div>
    </section>
  );
}
