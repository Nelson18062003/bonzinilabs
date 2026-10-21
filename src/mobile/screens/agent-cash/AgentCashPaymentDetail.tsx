// ============================================================
// AGENT-CASH — AgentCashPaymentDetail (fiche paiement cash)
// Présentation migrée sur le design kit (Ofspace/Mola) : canvas doux ·
//   hero Card + Holder + Amount + StatusPill toné · infos en Row ·
//   boutons d'action en PrimaryPill · ScreenLoader/ScreenError.
// Chaîne cash (21/10/2026) — scan du QR du client ET signature obligatoires :
//   · à remettre (cash_pending, ou ancien ready_for_payment / processing) :
//     « Procéder » n'apparaît QUE si l'on arrive d'un scan (?scanned=1, posé
//     par le scanner du site ou celui de l'app BONZINI HQ) ; sinon on
//     demande de scanner le QR du client ;
//   · QR scanné (cash_scanned) : « Confirmer » mène à la signature.
// ============================================================
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPaymentDetail } from '@/hooks/useAgentCashPayments';
import { useAgentScanCashPayment } from '@/hooks/useAgentCashActions';
import { CashReceiptDownloadButton } from '@/components/cash/CashReceiptDownloadButton';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { formatCurrencyRMB, formatNumber, formatDate } from '@/lib/formatters';
import { Banknote, CheckCircle2, ScanLine } from 'lucide-react';
import { cashHandoverStep } from '@/lib/paymentActions';
import { cn } from '@/lib/utils';
import { cashBeneficiaryName } from '@/lib/cashBeneficiary';
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
  const [searchParams] = useSearchParams();
  const arrivedFromScan = searchParams.get('scanned') === '1';
  const { t } = useLanguage();
  const { data: payment, isLoading, error } = useAgentCashPaymentDetail(paymentId);
  const scanMutation = useAgentScanCashPayment();

  const getBeneficiaryName = () => cashBeneficiaryName(payment);

  const getClientName = () => {
    try {
      if (!payment?.profile) return '—';
      return `${payment.profile.first_name ?? ''} ${payment.profile.last_name ?? ''}`.trim() || '—';
    } catch { return '—'; }
  };

  const isPaid = payment?.status === 'completed';
  const step = payment ? cashHandoverStep(payment.status) : null;
  const isToHandOver = step === 'scan';
  const isCashScanned = step === 'sign';

  const statusTone: Tone = isPaid ? 'success' : isCashScanned ? 'info' : 'pending';
  const statusLabel = isPaid
    ? t('status_paid')
    : isCashScanned
      ? t('status_scanned')
      : t('status_to_hand_over');

  // Le QR vient d'être lu : on enregistre le scan, puis la signature.
  const handleProceedToPayment = async () => {
    if (!payment) return;

    try {
      const result = await scanMutation.mutateAsync(payment.id);
      if (result.success) {
        navigate(`/a/payment/${payment.id}/confirm`);
      } else {
        toast.error(result.error || t('error'));
      }
    } catch {
      toast.error(t('error'));
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
          <h3 className={cn('mb-1 text-[14px] font-bold uppercase tracking-wider', TEXT.muted)}>
            {t('beneficiary_info')}
          </h3>
          <Row label={t('beneficiary')} value={getBeneficiaryName()} />
          {beneficiaryPhone && <Row label={t('phone')} value={beneficiaryPhone} />}
          {payment.beneficiary_email && <Row label={t('email')} value={payment.beneficiary_email} />}
        </Card>

        {/* Client info */}
        <Card className="animate-slide-up" style={{ animationDelay: '120ms', animationFillMode: 'both' }}>
          <h3 className={cn('mb-1 text-[14px] font-bold uppercase tracking-wider', TEXT.muted)}>
            {t('client_info')}
          </h3>
          <Row label={t('client')} value={getClientName()} />
          <Row label={t('reference')} value={<span className="font-mono text-[14px]">{payment.reference || '—'}</span>} />
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
                <p className={cn('mb-2 text-[14px] font-medium', TEXT.muted)}>
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

          {isToHandOver && arrivedFromScan && (
            <PrimaryPill
              onClick={handleProceedToPayment}
              loading={scanMutation.isPending}
              className="h-14 w-full text-[16px]"
            >
              {t('proceed_to_payment')}
            </PrimaryPill>
          )}

          {isToHandOver && !arrivedFromScan && (
            <div className="space-y-3">
              <p className={cn('text-center text-[14px]', TEXT.muted)}>{t('scan_client_qr_first')}</p>
              <PrimaryPill onClick={() => navigate('/a/scan')} className="h-14 w-full text-[16px]">
                <ScanLine className="h-5 w-5" />
                {t('scan_qr')}
              </PrimaryPill>
            </div>
          )}

          {isCashScanned && (
            <div className="space-y-3">
              <PrimaryPill
                onClick={() => navigate(`/a/payment/${payment.id}/confirm`)}
                className="h-14 w-full text-[16px]"
              >
                <CheckCircle2 className="h-5 w-5" />
                {t('confirm_payment')}
              </PrimaryPill>
              <p className={cn('text-center text-[14px]', TEXT.muted)}>
                {t('qr_already_scanned_continue')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
