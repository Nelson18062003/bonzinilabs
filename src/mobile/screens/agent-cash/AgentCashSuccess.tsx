// ============================================================
// AGENT-CASH — « Remis », v2 (maquette 02-operations/14) : le rond vert,
//   le montant et le bénéficiaire, l'heure de la signature ; « Scanner le
//   suivant » (noir) et « Reçu de remise » ; retour à la liste en lien.
// Logique inchangée : useAgentCashPaymentDetail, CashReceiptDownloadButton,
//   navigation /a et /a/scan, image de la signature.
// ============================================================
import { useParams, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPaymentDetail } from '@/hooks/useAgentCashPayments';
import { CashReceiptDownloadButton } from '@/components/cash/CashReceiptDownloadButton';
import { cn } from '@/lib/utils';
import { cashBeneficiaryName } from '@/lib/cashBeneficiary';
import { cashSignatureSrc } from '@/lib/cashSignature';
import { BigButton, ScreenLoader, TEXT, SURFACE, FOCUS_RING } from '@/mobile/designKit';
import { yuan } from '@/mobile/screens/operations/opsLabels';

export function AgentCashSuccess() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: payment, isLoading } = useAgentCashPaymentDetail(paymentId);

  const getBeneficiaryName = () => cashBeneficiaryName(payment);

  if (isLoading) {
    return <ScreenLoader />;
  }

  const signedAt = payment?.cash_paid_at ? format(new Date(payment.cash_paid_at), 'HH:mm') : null;

  return (
    <div className={cn('flex min-h-[100dvh] flex-col px-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-16', SURFACE.canvas)}>
      <div className="text-center">
        <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#CFF7D3] text-[#02542D]">
          <Check className="h-9 w-9" strokeWidth={2.5} />
        </div>
        <h1 className={cn('mt-5 text-[26px] font-semibold leading-tight', TEXT.strong)}>{t('cash_done')}</h1>
        {payment && (
          <p className={cn('mt-2 text-[16px]', TEXT.muted)}>
            {yuan(typeof payment.amount_rmb === 'number' ? payment.amount_rmb : 0)} · {getBeneficiaryName()}
            <br />
            {signedAt ? `${t('cash_signed_at')} ${signedAt} · ` : ''}{payment.reference || '—'}
          </p>
        )}
      </div>

      {payment?.cash_signature_url && (
        <div className={cn('mx-auto mt-6 w-full max-w-xs rounded-lg border bg-white p-3', SURFACE.divider)}>
          <img
            src={cashSignatureSrc(payment.cash_signature_url) ?? undefined}
            alt={t('beneficiary_signature') || 'Signature'}
            className="h-auto w-full"
            style={{ maxHeight: '100px', objectFit: 'contain' }}
          />
          {payment.cash_signed_by_name && <p className={cn('mt-1 text-center text-[15px]', TEXT.muted)}>{payment.cash_signed_by_name}</p>}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2.5 pt-8">
        <BigButton onClick={() => navigate('/a/scan')}>{t('cash_scan_next')}</BigButton>
        {payment && (
          <CashReceiptDownloadButton
            payment={payment}
            client={payment.profile ? {
              first_name: payment.profile.first_name,
              last_name: payment.profile.last_name,
              phone: payment.profile.phone,
            } : undefined}
            className="h-14 w-full rounded-lg text-[18px] font-semibold"
            label={t('cash_receipt')}
          />
        )}
        <button type="button" onClick={() => navigate('/a')} className={cn('mx-auto mt-1 rounded px-2 py-2 text-[16px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong)}>
          {t('back_to_list')}
        </button>
      </div>
    </div>
  );
}
