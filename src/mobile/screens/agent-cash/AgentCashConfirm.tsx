import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPaymentDetail } from '@/hooks/useAgentCashPayments';
import { useAgentConfirmCashPayment } from '@/hooks/useAgentCashActions';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { formatCurrencyRMB } from '@/lib/formatters';
import { Loader2, AlertCircle, Check, Eraser, Shield } from 'lucide-react';
import { toast } from 'sonner';
import SignaturePad from 'react-signature-canvas';

export function AgentCashConfirm() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: payment, isLoading: loadingPayment } = useAgentCashPaymentDetail(paymentId);
  const confirmMutation = useAgentConfirmCashPayment();

  const [cashHanded, setCashHanded] = useState(false);
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const sigCanvas = useRef<SignaturePad>(null);

  const getBeneficiaryName = () => {
    if (!payment) return '—';
    if (payment.cash_beneficiary_first_name && payment.cash_beneficiary_last_name) {
      return `${payment.cash_beneficiary_first_name} ${payment.cash_beneficiary_last_name}`;
    }
    return payment.beneficiary_name || '—';
  };

  const handleClearSignature = () => {
    sigCanvas.current?.clear();
    setSignatureEmpty(true);
  };

  const handleSignatureEnd = () => {
    if (sigCanvas.current) {
      setSignatureEmpty(sigCanvas.current.isEmpty());
    }
  };

  const canConfirm = cashHanded && !signatureEmpty && !confirmMutation.isPending;

  const handleConfirm = async () => {
    if (!payment || !sigCanvas.current || sigCanvas.current.isEmpty()) return;

    const signatureDataUrl = sigCanvas.current.toDataURL('image/png');
    const signedByName = getBeneficiaryName();

    try {
      const result = await confirmMutation.mutateAsync({
        paymentId: payment.id,
        signatureDataUrl,
        signedByName,
      });

      if (result.success) {
        navigate(`/a/payment/${payment.id}/success`, { replace: true });
      } else {
        toast.error(result.error || t('error'));
      }
    } catch {
      toast.error(t('error'));
    }
  };

  if (loadingPayment) {
    return (
      <div>
        <MobileHeader title={t('cash_confirmation')} showBack />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div>
        <MobileHeader title={t('cash_confirmation')} showBack />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <p className="text-muted-foreground">{t('payment_not_found')}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <MobileHeader
        title={t('cash_confirmation')}
        showBack
        backTo={`/a/payment/${payment.id}`}
      />

      <div className="px-4 pt-4 pb-8 space-y-5">
        {/* Payment recap */}
        <div className="card-glass p-5 rounded-2xl text-center animate-slide-up" style={{ animationFillMode: 'both' }}>
          <p className="text-2xl font-bold tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrencyRMB(payment.amount_rmb)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            → {getBeneficiaryName()}
          </p>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            {payment.reference}
          </p>
        </div>

        {/* Cash handed checkbox */}
        <label
          className="card-glass p-4 rounded-2xl flex items-center gap-4 cursor-pointer animate-slide-up"
          style={{ animationDelay: '60ms', animationFillMode: 'both' }}
        >
          <div
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
              cashHanded
                ? 'bg-primary border-primary'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {cashHanded && <Check className="w-4 h-4 text-primary-foreground" />}
          </div>
          <div className="flex-1">
            <p className="font-medium">{t('cash_handed')}</p>
          </div>
          <input
            type="checkbox"
            checked={cashHanded}
            onChange={(e) => setCashHanded(e.target.checked)}
            className="sr-only"
          />
        </label>

        {/* Verify identity instruction */}
        <div
          className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl animate-slide-up"
          style={{ animationDelay: '100ms', animationFillMode: 'both' }}
        >
          <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            {t('verify_identity')}
          </p>
        </div>

        {/* Signature area */}
        <div
          className="card-glass p-5 rounded-2xl space-y-3 animate-slide-up"
          style={{ animationDelay: '140ms', animationFillMode: 'both' }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t('signature_required')}</h3>
            <p className="text-xs text-muted-foreground">{t('signature_instruction')}</p>
          </div>

          <div className="relative border-2 border-dashed border-primary/30 rounded-xl bg-white overflow-hidden">
            <SignaturePad
              ref={sigCanvas}
              canvasProps={{
                className: 'w-full h-48 touch-none',
                style: { width: '100%', height: '192px' },
              }}
              onEnd={handleSignatureEnd}
            />

            {signatureEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-muted-foreground/50 text-lg">{t('sign_here')}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleClearSignature}
              disabled={signatureEmpty}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium disabled:opacity-50 transition-colors hover:bg-muted"
            >
              <Eraser className="w-4 h-4" />
              {t('clear')}
            </button>
          </div>

          {/* Beneficiary name */}
          <div className="text-center text-sm text-muted-foreground">
            <p>{t('beneficiary_name_confirmed')}</p>
            <p className="font-semibold text-foreground">{getBeneficiaryName()}</p>
          </div>
        </div>

        {/* Confirm button */}
        <div className="animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full btn-primary-gradient h-14 rounded-xl flex items-center justify-center gap-2 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            {t('confirm_payment')}
          </button>
        </div>
      </div>
    </div>
  );
}
