// ============================================================
// AGENT-CASH — la fiche d'un retrait, v2 (maquette 02-operations/11) :
//   le rond cash, le montant en ¥, le client et le XAF, le tag ; qui
//   retire (le client ou un tiers) ; Créé · Référence ; UN bouton noir.
// Chaîne cash (21/10/2026) INCHANGÉE — scan du QR du client ET signature :
//   · à remettre (cash_pending) : « Procéder » n'apparaît QUE si l'on arrive
//     d'un scan portant le QR du client (« ?qr=… », posé par le scanner du
//     site ou celui de l'app BONZINI HQ) ; le jeton qu'il contient part au
//     serveur au geste « Procéder » (scan_cash_payment). Sinon : « Scanner
//     le QR du client » ;
//   · QR scanné (cash_scanned) : « Confirmer la remise » mène à la signature.
// ============================================================
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPaymentDetail } from '@/hooks/useAgentCashPayments';
import { useAgentScanCashPayment } from '@/hooks/useAgentCashActions';
import { CashReceiptDownloadButton } from '@/components/cash/CashReceiptDownloadButton';
import { formatDate } from '@/lib/formatters';
import { cashHandoverStep } from '@/lib/paymentActions';
import { parseCashQRCode } from '@/hooks/useCashPayment';
import { cn } from '@/lib/utils';
import { cashBeneficiaryName } from '@/lib/cashBeneficiary';
import { cashSignatureSrc } from '@/lib/cashSignature';
import { toast } from 'sonner';
import {
  BigButton, BigFigure, Dock, EmptyLine, Initials, KVBox, MethodCircle, ScreenLoader, ScreenTop, Tag, TEXT, SURFACE, type KV, type Tone,
} from '@/mobile/designKit';
import { n0, yuan } from '@/mobile/screens/operations/opsLabels';

export function AgentCashPaymentDetail() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scannedQr = parseCashQRCode(searchParams.get('qr'));
  const scannedToken = scannedQr.isValid && scannedQr.paymentId === paymentId?.toLowerCase() ? scannedQr.token : null;
  const arrivedFromScan = !!scannedToken;
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

  const statusTone: Tone = isPaid ? 'success' : isCashScanned ? 'pending' : 'neutral';
  const statusLabel = isPaid ? t('cash_done') : isCashScanned ? t('cash_qr_read') : t('cash_at_office');

  // Le QR vient d'être lu : on enregistre le scan, puis la signature.
  const handleProceedToPayment = async () => {
    if (!payment || !scannedToken) return;

    try {
      const result = await scanMutation.mutateAsync({ paymentId: payment.id, token: scannedToken });
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
      <div className="flex min-h-full flex-col">
        <ScreenTop title={t('cash_withdrawal')} backTo="/a" />
        <ScreenLoader />
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title={t('cash_withdrawal')} backTo="/a" />
        <EmptyLine action={{ label: t('back_to_list'), onClick: () => navigate('/a') }}>{t('payment_not_found')}</EmptyLine>
      </div>
    );
  }

  const safeAmountRmb = typeof payment.amount_rmb === 'number' ? payment.amount_rmb : 0;
  const safeAmountXaf = typeof payment.amount_xaf === 'number' ? payment.amount_xaf : 0;
  const beneficiaryPhone = payment.cash_beneficiary_phone || payment.beneficiary_phone || payment.profile?.phone;
  const byClient = payment.cash_beneficiary_type !== 'other';

  const rows: KV[] = [
    ...(payment.created_at ? [{ label: t('cash_created'), value: formatDate(payment.created_at, 'datetime') }] : []),
    { label: t('reference'), value: payment.reference || '—' },
    ...(isPaid && payment.cash_paid_at ? [{ label: t('already_paid_on'), value: formatDate(payment.cash_paid_at, 'datetime') }] : []),
    ...(isPaid && payment.cash_signed_by_name ? [{ label: t('signed_by') || 'Signé par', value: payment.cash_signed_by_name }] : []),
    ...(payment.beneficiary_email ? [{ label: t('email'), value: payment.beneficiary_email }] : []),
  ];

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title={t('cash_withdrawal')} backTo="/a" />

      <div className="flex flex-col items-center px-5 pt-5 text-center">
        <MethodCircle method="cash" size={60} />
        <BigFigure className="mt-4" value={yuan(safeAmountRmb)} center />
        <p className={cn('mt-2 text-[17px]', TEXT.body)}>{getClientName()} · {n0(safeAmountXaf)} XAF</p>
        <Tag tone={statusTone} className="mt-3">{statusLabel}</Tag>
      </div>

      <div className="px-5 pt-6">
        <div className={cn('flex items-center gap-3 rounded-lg border px-3.5 py-3', SURFACE.divider)}>
          <Initials name={getBeneficiaryName()} />
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{getBeneficiaryName()}</span>
            <span className={cn('block truncate text-[15px]', TEXT.muted)}>
              {byClient ? t('cash_the_client') : t('cash_third_party')}{beneficiaryPhone ? ` · ${beneficiaryPhone}` : ''}
            </span>
          </span>
        </div>
        <KVBox rows={rows} className="mt-4" />

        {isPaid && payment.cash_signature_url && (
          <div className={cn('mt-4 rounded-lg border bg-white p-3', SURFACE.divider)}>
            <img
              src={cashSignatureSrc(payment.cash_signature_url) ?? undefined}
              alt={t('beneficiary_signature') || 'Signature'}
              className="mx-auto h-auto w-full max-w-xs"
              style={{ maxHeight: '120px', objectFit: 'contain' }}
            />
          </div>
        )}
      </div>

      {isPaid ? (
        <div className="px-5 pb-8 pt-5">
          <CashReceiptDownloadButton
            payment={payment}
            client={payment.profile ? {
              first_name: payment.profile.first_name,
              last_name: payment.profile.last_name,
              phone: payment.profile.phone,
            } : undefined}
            className="h-14 w-full rounded-lg text-[17px] font-semibold"
            label={t('cash_receipt')}
          />
        </div>
      ) : (isToHandOver || isCashScanned) ? (
        <Dock aboveTabBar>
          {isToHandOver && arrivedFromScan && (
            <BigButton onClick={() => void handleProceedToPayment()} loading={scanMutation.isPending}>
              {t('proceed_to_payment')}
            </BigButton>
          )}
          {isToHandOver && !arrivedFromScan && (
            <BigButton onClick={() => navigate('/a/scan')}>{t('cash_scan_client_qr')}</BigButton>
          )}
          {isCashScanned && (
            <BigButton onClick={() => navigate(`/a/payment/${payment.id}/confirm`)}>{t('cash_confirm_handover')}</BigButton>
          )}
        </Dock>
      ) : null}
    </div>
  );
}
