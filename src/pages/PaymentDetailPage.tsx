// ============================================================
// PAGE — Client payment detail (orchestrator). Refonte « Direction A » :
// canvas designKit, en-tête unique avec StatusPill SÉMANTIQUE (unifie les
// deux systèmes de badges liste/détail), drill-in sans bottom-nav.
// Sections sous src/components/payment-detail/*.
// Logique 100% PRÉSERVÉE : hooks, timelineSteps, reçu PDF, upload preuves.
// ============================================================
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, PrimaryPill, StatusPill, paymentStatusTone } from '@/mobile/designKit';
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
      <MobileLayout showNav={false} showHeader={false}>
        <div className={cn('min-h-[100dvh] space-y-4 p-4', SURFACE.canvas)}>
          <div className={cn('h-8 w-48 animate-pulse rounded-full', SURFACE.card, SURFACE.shadow)} />
          <div className={cn('h-48 w-full animate-pulse rounded-[24px]', SURFACE.card, SURFACE.shadow)} />
          <div className={cn('h-32 w-full animate-pulse rounded-[22px]', SURFACE.card, SURFACE.shadow)} />
          <div className={cn('h-24 w-full animate-pulse rounded-[22px]', SURFACE.card, SURFACE.shadow)} />
        </div>
      </MobileLayout>
    );
  }

  if (!payment) {
    return (
      <MobileLayout showNav={false} showHeader={false}>
        <div className={cn('flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center', SURFACE.canvas)}>
          <p className={cn('text-[15px]', TEXT.muted)}>{t('detail.notFound')}</p>
          <PrimaryPill onClick={() => navigate('/payments')} className="mt-5">
            {t('detail.backToPayments')}
          </PrimaryPill>
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
    <MobileLayout showNav={false} showHeader={false}>
      <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
        <PageHeader
          title={payment.reference}
          showBack
          rightElement={<StatusPill tone={paymentStatusTone(payment.status)} label={statusCfg.label} />}
        />

        <div className="space-y-4 px-4 py-4">
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
      </div>

      <PaymentQrViewerDrawer
        url={selectedQrUrl}
        beneficiaryName={payment.beneficiary_name}
        onClose={() => setSelectedQrUrl(null)}
      />
    </MobileLayout>
  );
}
