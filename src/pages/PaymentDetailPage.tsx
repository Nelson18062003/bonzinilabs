// ============================================================
// PAGE — Fiche paiement client (orchestrateur), STRUCTURE v7 validée :
// en-tête drill-in (retour + référence) · action en tête (reçu si payé,
// action ROUGE « Compléter les coordonnées » si à compléter) · montant
// HÉROS (gros ¥ + taux lilas) · Bénéficiaire (QR + champs copiables) ·
// Suivi (4 jalons cycle de vie) · Preuve & détails (preuves + méta).
// Logique 100 % PRÉSERVÉE : hooks, reçu PDF, upload preuves, QR drawer,
// timeline (buildPaymentTimelineSteps). Drill-in sans header/nav.
// ============================================================
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Download, Loader2 } from 'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, PRIMARY_PILL, PrimaryPill } from '@/mobile/designKit';
import {
  usePaymentDetail,
  usePaymentTimeline,
  usePaymentProofs,
} from '@/hooks/usePayments';
import { usePaymentProofMultiUpload } from '@/hooks/usePaymentProofUpload';
import { useMyProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { buildPaymentTimelineSteps } from '@/lib/paymentTimeline';
import { LIFECYCLE_COLOR } from '@/lib/paymentLifecycle';
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
import { PaymentTrackingSection } from '@/components/payment-detail/PaymentTrackingSection';
import { PaymentDocumentsSection } from '@/components/payment-detail/PaymentDocumentsSection';
import { PaymentStatusMessages } from '@/components/payment-detail/PaymentStatusMessages';
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
          <div className={cn('h-10 w-44 animate-pulse rounded-full', SURFACE.card, SURFACE.shadow)} />
          <div className={cn('h-[52px] w-full animate-pulse rounded-full', SURFACE.card, SURFACE.shadow)} />
          <div className={cn('h-56 w-full animate-pulse rounded-[26px]', SURFACE.card, SURFACE.shadow)} />
          <div className={cn('h-36 w-full animate-pulse rounded-[22px]', SURFACE.card, SURFACE.shadow)} />
          <div className={cn('h-44 w-full animate-pulse rounded-[22px]', SURFACE.card, SURFACE.shadow)} />
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
        {/* En-tête drill-in : retour + référence (pas de numérotation). */}
        <div className="flex items-center gap-3 px-4 pb-1 pt-4">
          <button
            onClick={() => navigate(-1)}
            aria-label={t('detail.backToPayments')}
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95',
              SURFACE.card,
              SURFACE.shadow,
            )}
          >
            <ArrowLeft className={cn('h-5 w-5', TEXT.strong)} />
          </button>
          <span className={cn('truncate text-[17px] font-black', TEXT.strong)}>
            {payment.reference}
          </span>
        </div>

        <div className="space-y-5 px-4 pb-8 pt-3">
          {/* Action en tête : reçu (payé) OU action rouge (à compléter). */}
          {payment.status === 'completed' ? (
            <button
              onClick={handleDownloadReceipt}
              disabled={isGeneratingPDF}
              className={cn(
                'flex w-full items-center justify-center gap-2 py-[15px] text-[15px] font-bold transition active:scale-[0.99] disabled:opacity-60',
                PRIMARY_PILL,
              )}
            >
              {isGeneratingPDF ? (
                <Loader2 className="h-[17px] w-[17px] animate-spin" />
              ) : (
                <Download className="h-[17px] w-[17px]" />
              )}
              {t('detail.downloadReceipt')}
            </button>
          ) : payment.status === 'waiting_beneficiary_info' ? (
            <div className="rounded-[22px] bg-[#FBE7E7] p-4 dark:bg-[#3A2526]">
              <p className="px-1 text-[13px] font-semibold" style={{ color: LIFECYCLE_COLOR.todo }}>
                Coordonnées du bénéficiaire manquantes
              </p>
              <button
                onClick={goToEditBeneficiary}
                className={cn(
                  'mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-[13px] font-bold transition active:scale-[0.99]',
                  PRIMARY_PILL,
                )}
              >
                Compléter les coordonnées <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <PaymentHeroCard payment={payment} />

          <PaymentStatusMessages payment={payment} />

          <PaymentCashSection payment={payment} />

          <PaymentBeneficiarySection
            payment={payment}
            onEdit={goToEditBeneficiary}
            onViewQr={setSelectedQrUrl}
          />

          <PaymentTrackingSection
            payment={payment}
            timelineSteps={timelineSteps}
            timelineLoading={timelineLoading}
            onCompleteBeneficiary={goToEditBeneficiary}
          />

          <PaymentDocumentsSection
            payment={payment}
            adminProofs={adminProofs}
            clientProofs={clientProofs}
            uploadKey={uploadKey}
            instructionFiles={instructionFiles}
            onInstructionFilesChange={setInstructionFiles}
            onUploadInstructions={handleUploadInstructions}
            isUploadingProofs={isUploadingProofs}
            onDownloadReceipt={handleDownloadReceipt}
            isGeneratingPDF={isGeneratingPDF}
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
