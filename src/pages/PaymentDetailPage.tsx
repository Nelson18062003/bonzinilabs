// ============================================================
// PAGE — Client payment detail (orchestrator).
// All sections live under src/components/payment-detail/*.
// ============================================================
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';
import {
  usePaymentDetail,
  usePaymentTimeline,
  usePaymentProofs,
} from '@/hooks/usePayments';
import { usePaymentProofMultiUpload } from '@/hooks/usePaymentProofUpload';
import { useMyProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { PAYMENT_STATUS_CONFIG } from '@/types/payment';
import type { PaymentStatus } from '@/types/payment';
import { buildPaymentTimelineSteps } from '@/lib/paymentTimeline';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { PaymentReceiptPDF } from '@/lib/pdf/templates/PaymentReceiptPDF';
import { toast } from 'sonner';
import { STATUS_BADGE_STYLES } from '@/components/payment-detail/types';
import {
  buildReceiptData,
  captureQrDataUrl,
} from '@/components/payment-detail/paymentReceiptHelpers';
import { PaymentHeroCard } from '@/components/payment-detail/PaymentHeroCard';
import { PaymentCashSection } from '@/components/payment-detail/PaymentCashSection';
import { PaymentBeneficiarySection } from '@/components/payment-detail/PaymentBeneficiarySection';
import { PaymentDocumentsSection } from '@/components/payment-detail/PaymentDocumentsSection';
import { PaymentStatusMessages } from '@/components/payment-detail/PaymentStatusMessages';
import { PaymentDetailsAccordion } from '@/components/payment-detail/PaymentDetailsAccordion';
import { PaymentQrViewerDrawer } from '@/components/payment-detail/PaymentQrViewerDrawer';

export default function PaymentDetailPage() {
  const { t } = useTranslation('payments');
  const { paymentId } = useParams();
  const navigate = useNavigate();

  // ── Data ───────────────────────────────────────────────────
  const { data: payment, isLoading: paymentLoading } = usePaymentDetail(paymentId);
  const { data: timeline, isLoading: timelineLoading } = usePaymentTimeline(paymentId);
  const { data: proofs } = usePaymentProofs(paymentId);
  const { data: clientProfile } = useMyProfile();
  const { user: authUser } = useAuth();
  const { uploadProofs, isUploading: isUploadingProofs } = usePaymentProofMultiUpload();

  // ── UI state ───────────────────────────────────────────────
  const [selectedQrUrl, setSelectedQrUrl] = useState<string | null>(null);
  const [instructionFiles, setInstructionFiles] = useState<File[]>([]);
  const [uploadKey, setUploadKey] = useState(0);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const timelineSteps = useMemo(() => {
    if (!payment) return [];
    return buildPaymentTimelineSteps(payment.status, payment.method, timeline || []);
  }, [payment, timeline]);

  // ── Loading / not found ───────────────────────────────────
  if (paymentLoading) {
    return (
      <MobileLayout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </MobileLayout>
    );
  }

  if (!payment) {
    return (
      <MobileLayout>
        <div className="p-4 text-center">
          <p className="text-muted-foreground">{t('detail.notFound')}</p>
          <Button onClick={() => navigate('/payments')} className="mt-4">
            {t('detail.backToPayments')}
          </Button>
        </div>
      </MobileLayout>
    );
  }

  // ── Derived ───────────────────────────────────────────────
  const statusCfg =
    PAYMENT_STATUS_CONFIG[payment.status as PaymentStatus] ?? {
      label: payment.status,
      color: 'bg-gray-100 text-gray-700',
    };

  const adminProofs = (proofs ?? []).filter((p) => p.uploaded_by_type === 'admin');
  const clientProofs = (proofs ?? []).filter((p) => p.uploaded_by_type === 'client');

  const goToEditBeneficiary = () => navigate(`/payments/${payment.id}/edit-beneficiary`);

  // ── Actions ───────────────────────────────────────────────
  const handleUploadInstructions = async () => {
    if (!paymentId || instructionFiles.length === 0) return;
    await uploadProofs({ paymentId, files: instructionFiles });
    setInstructionFiles([]);
    setUploadKey((k) => k + 1);
  };

  const handleDownloadReceipt = async () => {
    if (isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      const clientName = clientProfile
        ? `${clientProfile.first_name} ${clientProfile.last_name}`
        : 'Client';

      let cashPaymentQrDataUrl: string | null = null;
      if (
        payment.method === 'cash' &&
        !['completed', 'rejected'].includes(payment.status)
      ) {
        cashPaymentQrDataUrl = await captureQrDataUrl(payment.id);
      }

      const receiptData = buildReceiptData({
        payment,
        clientName,
        clientPhone: clientProfile?.phone,
        clientEmail: authUser?.email ?? undefined,
        clientCountry: clientProfile?.country,
        cashPaymentQrDataUrl,
        adminProofs,
      });

      await downloadPDF(
        <PaymentReceiptPDF data={receiptData} />,
        `recu_paiement_${payment.reference}_${clientName.replace(/\s+/g, '_')}.pdf`,
      );
      toast.success(t('detail.toast.receiptDownloaded'));
    } catch (error) {
      console.error('Error generating payment PDF:', error);
      toast.error(t('detail.toast.receiptError'));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <MobileLayout>
      <PageHeader
        title={payment.reference}
        showBack
        rightElement={
          <span
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap',
              STATUS_BADGE_STYLES[payment.status] ?? STATUS_BADGE_STYLES.created,
            )}
          >
            {statusCfg.label}
          </span>
        }
      />

      <div className="px-4 py-4 space-y-6">
        <PaymentHeroCard
          payment={payment}
          onDownloadReceipt={handleDownloadReceipt}
          isGeneratingPDF={isGeneratingPDF}
        />

        <PaymentCashSection payment={payment} />

        <PaymentBeneficiarySection
          payment={payment}
          onEdit={goToEditBeneficiary}
          onViewQr={setSelectedQrUrl}
        />

        <PaymentStatusMessages payment={payment} />

        <PaymentDocumentsSection
          payment={payment}
          adminProofs={adminProofs}
          clientProofs={clientProofs}
          uploadKey={uploadKey}
          instructionFiles={instructionFiles}
          onInstructionFilesChange={setInstructionFiles}
          onUploadInstructions={handleUploadInstructions}
          isUploadingProofs={isUploadingProofs}
        />

        <PaymentDetailsAccordion
          payment={payment}
          timelineSteps={timelineSteps}
          timelineLoading={timelineLoading}
        />
      </div>

      <PaymentQrViewerDrawer
        url={selectedQrUrl}
        beneficiaryName={payment.beneficiary_name}
        onClose={() => setSelectedQrUrl(null)}
      />
    </MobileLayout>
  );
}
