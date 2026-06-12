// ============================================================
// AGENT-CASH — AgentCashSuccess (confirmation de paiement)
// Présentation migrée sur le design kit (Ofspace/Mola) : canvas doux ·
//   Holder succès · Amount · signature en encadré ring success · boutons
//   SoftPill / PrimaryPill.
// Logique 100% préservée : useAgentCashPaymentDetail, getBeneficiaryName,
//   CashReceiptDownloadButton, navigation /a et /a/scan, image signature.
// ============================================================
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPaymentDetail } from '@/hooks/useAgentCashPayments';
import { CashReceiptDownloadButton } from '@/components/cash/CashReceiptDownloadButton';
import { formatCurrencyRMB } from '@/lib/formatters';
import { CheckCircle2, ArrowLeft, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, Holder, Amount, SoftPill, PrimaryPill, ScreenLoader } from '@/mobile/designKit';

export function AgentCashSuccess() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: payment, isLoading } = useAgentCashPaymentDetail(paymentId);

  const getBeneficiaryName = () => {
    try {
      if (!payment) return '—';
      if (payment.cash_beneficiary_first_name && payment.cash_beneficiary_last_name) {
        return `${payment.cash_beneficiary_first_name} ${payment.cash_beneficiary_last_name}`;
      }
      return payment.beneficiary_name || '—';
    } catch { return '—'; }
  };

  if (isLoading) {
    return (
      <div className={cn('min-h-screen', SURFACE.canvas)}>
        <ScreenLoader />
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-screen flex-col items-center justify-center px-6 py-12', SURFACE.canvas)}>
      {/* Success icon */}
      <Holder
        icon={CheckCircle2}
        tone="success"
        size="lg"
        className="mb-6 h-16 w-16 animate-scale-in [&>svg]:h-8 [&>svg]:w-8"
      />

      {/* Success text */}
      <h1
        className={cn('mb-2 animate-slide-up text-2xl font-bold', TEXT.strong)}
        style={{ animationDelay: '100ms', animationFillMode: 'both' }}
      >
        {t('payment_success')}
      </h1>

      {/* Payment details */}
      {payment && (
        <div
          className="mb-8 animate-slide-up text-center"
          style={{ animationDelay: '150ms', animationFillMode: 'both' }}
        >
          <Amount
            value={formatCurrencyRMB(typeof payment.amount_rmb === 'number' ? payment.amount_rmb : 0)}
            size="xl"
            className="mt-4"
          />
          <p className={cn('mt-2', TEXT.muted)}>{getBeneficiaryName()}</p>
          <p className={cn('font-mono text-sm', TEXT.muted)}>{payment.reference || '—'}</p>

          {/* Signature confirmation */}
          {payment.cash_signature_url && (
            <div className="mx-auto mt-4 w-full max-w-xs rounded-xl bg-white p-3 ring-1 ring-[#DEEFE5] dark:ring-[#1E3A2C]">
              <p className={cn('mb-2 text-center text-xs font-medium', TEXT.muted)}>
                {t('beneficiary_signature') || 'Signature du bénéficiaire'}
              </p>
              <img
                src={payment.cash_signature_url}
                alt="Signature"
                className="w-full h-auto rounded"
                style={{ maxHeight: '100px', objectFit: 'contain' }}
              />
              {payment.cash_signed_by_name && (
                <p className={cn('mt-1 text-center text-xs', TEXT.muted)}>
                  {payment.cash_signed_by_name}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div
        className="w-full max-w-sm space-y-3 animate-slide-up"
        style={{ animationDelay: '250ms', animationFillMode: 'both' }}
      >
        {/* Download receipt */}
        {payment && (
          <CashReceiptDownloadButton
            payment={payment}
            client={payment.profile ? {
              first_name: payment.profile.first_name,
              last_name: payment.profile.last_name,
              phone: payment.profile.phone,
            } : undefined}
            className="w-full"
            size="lg"
            label={t('download_receipt')}
          />
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3">
          <SoftPill onClick={() => navigate('/a')} className="flex-1">
            <ArrowLeft className="h-4 w-4" />
            {t('back_to_list')}
          </SoftPill>
          <PrimaryPill onClick={() => navigate('/a/scan')} className="flex-1">
            <ScanLine className="h-4 w-4" />
            {t('scan_another')}
          </PrimaryPill>
        </div>
      </div>
    </div>
  );
}
