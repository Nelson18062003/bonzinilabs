// ============================================================
// Documents section. Refonte « Direction A » (designKit) : carte blanche
// ombre douce, séparateurs ténus. Gallery/Upload partagés conservés.
// Logique 100% PRÉSERVÉE (admin/client proofs, upload si non verrouillé).
// ============================================================
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentProofGallery } from '@/components/payment/PaymentProofGallery';
import { PaymentProofUpload } from '@/components/payment/PaymentProofUpload';
import type { Payment, PaymentProof } from '@/hooks/usePayments';
import { SURFACE, TEXT } from '@/mobile/designKit';
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

const DIVIDER = 'border-t border-black/[0.06] dark:border-white/[0.08]';

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
    <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
      <h3 className={cn('mb-4 text-[15px] font-bold', TEXT.strong)}>{t('detail.documents')}</h3>

      {adminProofs.length > 0 && (
        <div className="mb-4">
          <p className={cn('mb-2 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
            {t('detail.bonziniProofs', { count: adminProofs.length })}
          </p>
          <p className={cn('mb-3 text-[12px]', TEXT.muted)}>{t('detail.bonziniProofsDescription')}</p>
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

      {adminProofs.length === 0 && clientProofs.length === 0 && !canUploadInstructions && (
        <p className={cn('py-3 text-center text-[14px]', TEXT.muted)}>{t('detail.noDocuments')}</p>
      )}
    </div>
  );
}
