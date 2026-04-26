// ============================================================
// Documents section: Bonzini-supplied proofs + client-attached
// instruction files + upload area when the payment is not locked.
// ============================================================
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentProofGallery } from '@/components/payment/PaymentProofGallery';
import { PaymentProofUpload } from '@/components/payment/PaymentProofUpload';
import type { Payment, PaymentProof } from '@/hooks/usePayments';
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
}: Props) {
  const { t } = useTranslation('payments');

  const canUploadInstructions = isStatusUploadable(payment.status);
  const isLocked = isStatusLocked(payment.status);

  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <h3 className="text-base font-semibold mb-4">{t('detail.documents')}</h3>

      {adminProofs.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {t('detail.bonziniProofs', { count: adminProofs.length })}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            {t('detail.bonziniProofsDescription')}
          </p>
          <PaymentProofGallery
            proofs={adminProofs}
            title=""
            emptyMessage=""
            showUploadedBy={false}
          />
        </div>
      )}

      {clientProofs.length > 0 && (
        <div className={cn(adminProofs.length > 0 && 'mt-4 pt-4 border-t border-border')}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {t('detail.myInstructions', { count: clientProofs.length })}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            {t('detail.myInstructionsDescription')}
          </p>
          <PaymentProofGallery
            proofs={clientProofs}
            title=""
            emptyMessage=""
            showUploadedBy={false}
          />
          {isLocked && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="w-3.5 h-3.5" />
              {t('detail.noMoreModifications')}
            </div>
          )}
        </div>
      )}

      {canUploadInstructions && (
        <div
          className={cn(
            (adminProofs.length > 0 || clientProofs.length > 0) && 'mt-4 pt-4 border-t border-border',
          )}
        >
          <PaymentProofUpload
            key={uploadKey}
            onFilesSelect={onInstructionFilesChange}
            selectedFiles={instructionFiles}
            onConfirm={onUploadInstructions}
            isSubmitting={isUploadingProofs}
          />
        </div>
      )}

      {adminProofs.length === 0 && clientProofs.length === 0 && !canUploadInstructions && (
        <p className="text-sm text-muted-foreground text-center py-3">{t('detail.noDocuments')}</p>
      )}
    </div>
  );
}
