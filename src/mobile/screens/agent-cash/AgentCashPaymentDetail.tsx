import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPaymentDetail } from '@/hooks/useAgentCashPayments';
import { useAgentScanCashPayment } from '@/hooks/useAgentCashActions';
import { CashReceiptDownloadButton } from '@/components/cash/CashReceiptDownloadButton';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { formatCurrencyRMB, formatNumber, formatDate } from '@/lib/formatters';
import { Loader2, Banknote, User, Phone, Mail, FileText, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
      <div>
        <MobileHeader title={t('payment_details')} showBack backTo="/a" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div>
        <MobileHeader title={t('payment_details')} showBack backTo="/a" />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <p className="text-muted-foreground">{t('payment_not_found')}</p>
        </div>
      </div>
    );
  }

  const safeAmountRmb = typeof payment.amount_rmb === 'number' ? payment.amount_rmb : 0;
  const safeAmountXaf = typeof payment.amount_xaf === 'number' ? payment.amount_xaf : 0;

  return (
    <div>
      <MobileHeader title={t('payment_details')} showBack backTo="/a" />

      <div className="px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 pb-24 sm:pb-28 space-y-3 sm:space-y-4">
        {/* Amount card */}
        <div className="card-glass p-6 rounded-2xl text-center animate-slide-up" style={{ animationFillMode: 'both' }}>
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Banknote className="w-7 h-7 text-primary" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrencyRMB(safeAmountRmb)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {formatNumber(safeAmountXaf)} XAF
          </p>

          {/* Status badge */}
          <div className="mt-3">
            <span className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
              isPaid ? 'bg-green-500/10 text-green-600'
                : isCashScanned ? 'bg-blue-500/10 text-blue-600'
                : 'bg-amber-500/10 text-amber-600',
            )}>
              {isPaid ? <CheckCircle2 className="w-4 h-4" /> : null}
              {isPaid ? t('status_paid') : isCashScanned ? t('status_scanned') || 'Scanné' : t('status_to_pay')}
            </span>
          </div>
        </div>

        {/* Beneficiary info */}
        <div className="card-glass p-5 rounded-2xl space-y-3 animate-slide-up" style={{ animationDelay: '60ms', animationFillMode: 'both' }}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('beneficiary_info')}
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{getBeneficiaryName()}</span>
            </div>
            {(payment.cash_beneficiary_phone || payment.beneficiary_phone) && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{payment.cash_beneficiary_phone || payment.beneficiary_phone}</span>
              </div>
            )}
            {payment.beneficiary_email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{payment.beneficiary_email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Client info */}
        <div className="card-glass p-5 rounded-2xl space-y-3 animate-slide-up" style={{ animationDelay: '120ms', animationFillMode: 'both' }}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('client_info')}
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{getClientName()}</span>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-mono text-sm">{payment.reference || '—'}</span>
            </div>
            {payment.created_at && (
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{formatDate(payment.created_at, 'datetime')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Already paid info */}
        {isPaid && payment.cash_paid_at && (
          <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 animate-slide-up" style={{ animationDelay: '180ms', animationFillMode: 'both' }}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-600">{t('already_paid')}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('already_paid_on')} {formatDate(payment.cash_paid_at, 'datetime')}
            </p>
            {payment.cash_signed_by_name && (
              <p className="text-sm text-muted-foreground mt-1">
                {t('signed_by') || 'Signé par'}: {payment.cash_signed_by_name}
              </p>
            )}

            {/* Signature image */}
            {payment.cash_signature_url && (
              <div className="mt-3 p-3 bg-white rounded-xl border border-green-500/20">
                <p className="text-xs text-muted-foreground mb-2 font-medium">
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
          </div>
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
            <button
              onClick={handleProceedToPayment}
              disabled={scanMutation.isPending}
              className="w-full btn-primary-gradient h-14 rounded-xl flex items-center justify-center gap-2 text-lg font-semibold disabled:opacity-50"
            >
              {scanMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : null}
              {t('proceed_to_payment')}
            </button>
          )}

          {isCashScanned && (
            <div className="space-y-3">
              <button
                onClick={() => navigate(`/a/payment/${payment.id}/confirm`)}
                className="w-full btn-primary-gradient h-14 rounded-xl flex items-center justify-center gap-2 text-lg font-semibold"
              >
                <CheckCircle2 className="w-5 h-5" />
                {t('confirm_payment') || 'Confirmer le paiement'}
              </button>
              <p className="text-xs text-center text-muted-foreground">
                {t('qr_already_scanned_continue') || 'QR déjà scanné — continuez vers la confirmation'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
