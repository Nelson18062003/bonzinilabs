// ============================================================
// AGENT-CASH — AgentCashPaymentDetail (fiche paiement cash)
// Présentation migrée sur le design kit (Ofspace/Mola) : canvas doux ·
//   hero Card + Holder + Amount + StatusPill toné · infos en Row ·
//   boutons d'action en PrimaryPill · ScreenLoader/ScreenError.
// Logique 100% préservée : useAgentCashPaymentDetail, useAgentScanCashPayment,
//   handleProceedToPayment (scan → confirm, fallback déjà scanné), statuts
//   (isPaid/isPending/isCashScanned), CashReceiptDownloadButton, signature.
// ============================================================
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPaymentDetail } from '@/hooks/useAgentCashPayments';
import { useAgentScanCashPayment } from '@/hooks/useAgentCashActions';
import { CashReceiptDownloadButton } from '@/components/cash/CashReceiptDownloadButton';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { formatCurrencyRMB, formatNumber, formatDate } from '@/lib/formatters';
import { Banknote, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  SURFACE,
  TEXT,
  Card,
  Holder,
  Amount,
  Row,
  StatusPill,
  PrimaryPill,
  ScreenLoader,
  ScreenError,
  type Tone,
} from '@/mobile/designKit';

export function AgentCashPaymentDetail() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: payment, isLoading, error } = useAgentCashPaymentDetail(paymentId);
  const scanMutation = useAgentScanCashPayment();

  const getBeneficiaryName = () => {
    try {
      if (!payment) return '—';
      if (payment.cash_beneficiary_first_name && payment.cash_beneficiary_last_name) {
        return `${payment.cash_beneficiary_first_name} ${payment.cash_beneficiary_last_name}`;
      }
      return payment.beneficiary_name || '—';
    } catch { return '—'; }
  };

  const getClientName = () => {
    try {
      if (!payment?.profile) return '—';
      return `${payment.profile.first_name ?? ''} ${payment.profile.last_name ?? ''}`.trim() || '—';
    } catch { return '—'; }
  };

  const isPaid = payment?.status === 'completed';
  const isPending = payment?.status === 'processing' || payment?.status === 'ready_for_payment';
  const isCashScanned = payment?.status === 'cash_scanned' || payment?.status === 'cash_pending';

  const statusTone: Tone = isPaid ? 'success' : isCashScanned ? 'info' : 'pending';
  const statusLabel = isPaid
    ? t('status_paid')
    : isCashScanned
      ? t('status_scanned') || 'Scanné'
      : t('status_to_pay');

  const handleProceedToPayment = async () => {
    if (!payment) return;

    try {
      const result = await scanMutation.mutateAsync(payment.id);
      if (result.success) {
        navigate(`/a/payment/${payment.id}/confirm`);
      } else {
        // If scan fails because already scanned, still allow proceeding to confirm
        const alreadyScanned = payment.status === 'cash_scanned' || payment.status === 'cash_pending';
        if (alreadyScanned) {
          navigate(`/a/payment/${payment.id}/confirm`);
        } else {
          toast.error(result.error || t('error'));
        }
      }
    } catch {
      // If RPC throws but payment is already scanned, allow continuing
      const alreadyScanned = payment.status === 'cash_scanned' || payment.status === 'cash_pending';
      if (alreadyScanned) {
        navigate(`/a/payment/${payment.id}/confirm`);
      } else {
        toast.error(t('error'));
      }
    }
  };

  if (isLoading) {
    return (
      <div className={cn('min-h-screen', SURFACE.canvas)}>
        <MobileHeader title={t('payment_details')} showBack backTo="/a" />
        <ScreenLoader />
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className={cn('min-h-screen', SURFACE.canvas)}>
        <MobileHeader title={t('payment_details')} showBack backTo="/a" />
        <ScreenError title={t('payment_not_found')} />
      </div>
    );
  }

  const safeAmountRmb = typeof payment.amount_rmb === 'number' ? payment.amount_rmb : 0;
  const safeAmountXaf = typeof payment.amount_xaf === 'number' ? payment.amount_xaf : 0;
  const beneficiaryPhone = payment.cash_beneficiary_phone || payment.beneficiary_phone;

  return (
    <div className={cn('min-h-screen', SURFACE.canvas)}>
      <MobileHeader title={t('payment_details')} showBack backTo="/a" />

      <div className="px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 pb-24 sm:pb-28 space-y-3 sm:space-y-4">
        {/* Amount card */}
        <Card className="animate-slide-up p-6 text-center" style={{ animationFillMode: 'both' }}>
          <Holder icon={Banknote} size="lg" className="mx-auto mb-3" />
          <Amount value={formatCurrencyRMB(safeAmountRmb)} size="xl" />
          <p className={cn('mt-1 text-sm', TEXT.muted)}>{formatNumber(safeAmountXaf)} XAF</p>
          <div className="mt-3 flex justify-center">
            <StatusPill
              tone={statusTone}
              label={
                <span className="inline-flex items-center gap-1.5">
                  {isPaid ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                  {statusLabel}
                </span>
              }
            />
          </div>
        </Card>

        {/* Beneficiary info */}
        <Card className="animate-slide-up" style={{ animationDelay: '60ms', animationFillMode: 'both' }}>
          <h3 className={cn('mb-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>
            {t('beneficiary_info')}
          </h3>
          <Row label={t('beneficiary')} value={getBeneficiaryName()} />
          {beneficiaryPhone && <Row label={t('phone')} value={beneficiaryPhone} />}
          {payment.beneficiary_email && <Row label={t('email')} value={payment.beneficiary_email} />}
        </Card>

        {/* Client info */}
        <Card className="animate-slide-up" style={{ animationDelay: '120ms', animationFillMode: 'both' }}>
          <h3 className={cn('mb-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>
            {t('client_info')}
          </h3>
          <Row label={t('client')} value={getClientName()} />
          <Row label={t('reference')} value={<span className="font-mono text-xs">{payment.reference || '—'}</span>} />
          {payment.created_at && <Row label={t('date')} value={formatDate(payment.created_at, 'datetime')} />}
        </Card>

        {/* Already paid info */}
        {isPaid && payment.cash_paid_at && (
          <Card className="animate-slide-up" style={{ animationDelay: '180ms', animationFillMode: 'both' }}>
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#2E7D52] dark:text-[#7FCBA0]" />
              <span className="font-semibold text-[#2E7D52] dark:text-[#7FCBA0]">{t('already_paid')}</span>
            </div>
            <p className={cn('text-sm', TEXT.muted)}>
              {t('already_paid_on')} {formatDate(payment.cash_paid_at, 'datetime')}
            </p>
            {payment.cash_signed_by_name && (
              <p className={cn('mt-1 text-sm', TEXT.muted)}>
                {t('signed_by') || 'Signé par'}: {payment.cash_signed_by_name}
              </p>
            )}

            {/* Signature image */}
            {payment.cash_signature_url && (
              <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-[#DEEFE5] dark:ring-[#1E3A2C]">
                <p className={cn('mb-2 text-xs font-medium', TEXT.muted)}>
                  {t('beneficiary_signature') || 'Signature du bénéficiaire'}
                </p>
                <img
                  src={payment.cash_signature_url}
                  alt="Signature"
                  className="w-full max-w-xs h-auto rounded"
                  style={{ maxHeight: '120px', objectFit: 'contain' }}
                />
              </div>
            )}
          </Card>
        )}

        {/* Action buttons */}
        <div className="animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          {isPaid && (
            <CashReceiptDownloadButton
              payment={payment}
              client={payment.profile ? {
                first_name: payment.profile.first_name,
                last_name: payment.profile.last_name,
                phone: payment.profile.phone,
              } : undefined}
              className="w-full"
              label={t('download_receipt')}
            />
          )}

          {isPending && (
            <PrimaryPill
              onClick={handleProceedToPayment}
              loading={scanMutation.isPending}
              className="h-14 w-full text-[16px]"
            >
              {t('proceed_to_payment')}
            </PrimaryPill>
          )}

          {isCashScanned && (
            <div className="space-y-3">
              <PrimaryPill
                onClick={() => navigate(`/a/payment/${payment.id}/confirm`)}
                className="h-14 w-full text-[16px]"
              >
                <CheckCircle2 className="h-5 w-5" />
                {t('confirm_payment') || 'Confirmer le paiement'}
              </PrimaryPill>
              <p className={cn('text-center text-xs', TEXT.muted)}>
                {t('qr_already_scanned_continue') || 'QR déjà scanné — continuez vers la confirmation'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
