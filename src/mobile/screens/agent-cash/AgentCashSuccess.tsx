import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPaymentDetail } from '@/hooks/useAgentCashPayments';
import { CashReceiptDownloadButton } from '@/components/cash/CashReceiptDownloadButton';
import { formatCurrencyRMB } from '@/lib/formatters';
import { Loader2, CheckCircle2, ArrowLeft, ScanLine } from 'lucide-react';

export function AgentCashSuccess() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: payment, isLoading } = useAgentCashPaymentDetail(paymentId);

  const getBeneficiaryName = () => {
    if (!payment) return '—';
    if (payment.cash_beneficiary_first_name && payment.cash_beneficiary_last_name) {
      return `${payment.cash_beneficiary_first_name} ${payment.cash_beneficiary_last_name}`;
    }
    return payment.beneficiary_name || '—';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      {/* Success icon */}
      <div
        className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6 animate-scale-in"
        style={{ animationFillMode: 'both' }}
      >
        <CheckCircle2 className="w-10 h-10 text-green-500" />
      </div>

      {/* Success text */}
      <h1
        className="text-2xl font-bold mb-2 animate-slide-up"
        style={{ animationDelay: '100ms', animationFillMode: 'both' }}
      >
        {t('payment_success')}
      </h1>

      {/* Payment details */}
      {payment && (
        <div
          className="text-center mb-8 animate-slide-up"
          style={{ animationDelay: '150ms', animationFillMode: 'both' }}
        >
          <p className="text-3xl font-bold tracking-tight mt-4" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrencyRMB(payment.amount_rmb)}
          </p>
          <p className="text-muted-foreground mt-2">{getBeneficiaryName()}</p>
          <p className="text-sm text-muted-foreground font-mono">{payment.reference}</p>
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
          <button
            onClick={() => navigate('/a')}
            className="flex-1 h-12 rounded-xl border border-border flex items-center justify-center gap-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('back_to_list')}
          </button>
          <button
            onClick={() => navigate('/a/scan')}
            className="flex-1 h-12 rounded-xl btn-primary-gradient flex items-center justify-center gap-2 text-sm font-semibold"
          >
            <ScanLine className="w-4 h-4" />
            {t('scan_another')}
          </button>
        </div>
      </div>
    </div>
  );
}
