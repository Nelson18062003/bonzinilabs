// ============================================================
// AGENT-CASH — AgentCashConfirm (recap + checkbox + alerte + signature)
// Présentation migrée sur le design kit (Ofspace/Mola) : canvas doux ·
//   recap Card + Amount · checkbox kit (case Check violette) · alerte tonée
//   pending · zone signature en Card · boutons SoftPill/PrimaryPill.
// ⚠️ CANVAS DE SIGNATURE + SA LOGIQUE 100% INTACTS : SignaturePad, sigCanvas,
//   handleClearSignature, handleSignatureEnd, l'overlay « sign_here », les
//   canvasProps, handleConfirm (toDataURL + confirmMutation), canConfirm.
// ============================================================
import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPaymentDetail } from '@/hooks/useAgentCashPayments';
import { useAgentConfirmCashPayment } from '@/hooks/useAgentCashActions';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { formatCurrencyRMB } from '@/lib/formatters';
import { Check, Eraser, Shield } from 'lucide-react';
import { toast } from 'sonner';
import SignaturePad from 'react-signature-canvas';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  Card,
  Amount,
  SoftPill,
  PrimaryPill,
  ScreenLoader,
  ScreenError,
} from '@/mobile/designKit';

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
    try {
      if (!payment) return '—';
      if (payment.cash_beneficiary_first_name && payment.cash_beneficiary_last_name) {
        return `${payment.cash_beneficiary_first_name} ${payment.cash_beneficiary_last_name}`;
      }
      return payment.beneficiary_name || '—';
    } catch { return '—'; }
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
      <div className={cn('min-h-screen', SURFACE.canvas)}>
        <MobileHeader title={t('cash_confirmation')} showBack />
        <ScreenLoader />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className={cn('min-h-screen', SURFACE.canvas)}>
        <MobileHeader title={t('cash_confirmation')} showBack />
        <ScreenError title={t('payment_not_found')} />
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen', SURFACE.canvas)}>
      <MobileHeader
        title={t('cash_confirmation')}
        showBack
        backTo={`/a/payment/${payment.id}`}
      />

      <div className="px-4 pt-4 pb-8 space-y-5">
        {/* Payment recap */}
        <Card className="animate-slide-up p-5 text-center" style={{ animationFillMode: 'both' }}>
          <Amount value={formatCurrencyRMB(typeof payment.amount_rmb === 'number' ? payment.amount_rmb : 0)} size="lg" />
          <p className={cn('mt-1 text-sm', TEXT.muted)}>→ {getBeneficiaryName()}</p>
          <p className={cn('mt-1 font-mono text-xs', TEXT.muted)}>{payment.reference || '—'}</p>
        </Card>

        {/* Cash handed checkbox */}
        <label
          className="animate-slide-up flex cursor-pointer items-center gap-4"
          style={{ animationDelay: '60ms', animationFillMode: 'both' }}
        >
          <Card className="flex w-full items-center gap-4">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors',
                cashHanded
                  ? 'bg-[#6B5BD2] text-white dark:bg-[#A99BF0] dark:text-[#1B1A24]'
                  : 'bg-black/10 dark:bg-white/10',
              )}
            >
              {cashHanded && <Check className="h-4 w-4" />}
            </span>
            <span className={cn('flex-1 text-[14px] font-medium', TEXT.strong)}>{t('cash_handed')}</span>
          </Card>
          <input
            type="checkbox"
            checked={cashHanded}
            onChange={(e) => setCashHanded(e.target.checked)}
            className="sr-only"
          />
        </label>

        {/* Verify identity instruction */}
        <div
          className="animate-slide-up flex items-start gap-3 rounded-[22px] bg-[#F8EFD8] p-4 dark:bg-[#372D14]"
          style={{ animationDelay: '100ms', animationFillMode: 'both' }}
        >
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6B12] dark:text-[#E7C083]" />
          <p className="text-sm text-[#9A6B12] dark:text-[#E7C083]">{t('verify_identity')}</p>
        </div>

        {/* Signature area */}
        <Card
          className="animate-slide-up space-y-3"
          style={{ animationDelay: '140ms', animationFillMode: 'both' }}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className={cn('text-sm font-semibold', TEXT.strong)}>{t('signature_required')}</h3>
            <p className={cn('text-xs', TEXT.muted)}>{t('signature_instruction')}</p>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.06] dark:ring-white/10">
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
                <p className="text-lg text-[#9B98AD]">{t('sign_here')}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <SoftPill onClick={handleClearSignature} disabled={signatureEmpty} className="flex-1">
              <Eraser className="h-4 w-4" />
              {t('clear')}
            </SoftPill>
          </div>

          {/* Beneficiary name */}
          <div className={cn('text-center text-sm', TEXT.muted)}>
            <p>{t('beneficiary_name_confirmed')}</p>
            <p className={cn('font-semibold', TEXT.strong)}>{getBeneficiaryName()}</p>
          </div>
        </Card>

        {/* Confirm button */}
        <div className="animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          <PrimaryPill
            onClick={handleConfirm}
            disabled={!canConfirm}
            loading={confirmMutation.isPending}
            className="h-14 w-full text-[16px]"
          >
            <Check className="h-5 w-5" />
            {t('confirm_payment')}
          </PrimaryPill>
        </div>
      </div>
    </div>
  );
}
