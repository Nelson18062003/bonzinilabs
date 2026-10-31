// ============================================================
// AGENT-CASH — la remise signée, v2 (maquettes 02-operations/13 et
//   06-messages-douane-outils/18) : le montant et « QR vérifié », le
//   bénéficiaire attendu, le client, la référence ; le NOM que déclare la
//   personne qui signe (obligatoire), sa pièce (facultative), la signature
//   (Effacer), « Espèces remises » ; UN bouton noir « Confirmer la remise ».
// ⚠️ CANVAS DE SIGNATURE + SA LOGIQUE 100% INTACTS : SignaturePad, sigCanvas,
//   handleClearSignature, handleSignatureEnd, l'overlay « sign_here », les
//   canvasProps, handleConfirm (toDataURL + confirmMutation avec nom déclaré
//   et n° de pièce), canConfirm, la garde « cash_scanned seulement ».
// ============================================================
import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPaymentDetail } from '@/hooks/useAgentCashPayments';
import { useAgentConfirmCashPayment } from '@/hooks/useAgentCashActions';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import SignaturePad from 'react-signature-canvas';
import { cn } from '@/lib/utils';
import { cashBeneficiaryName } from '@/lib/cashBeneficiary';
import {
  BigButton, BigFigure, Dock, EmptyLine, KVBox, ScreenLoader, ScreenTop, Tag, TextInput, TEXT, SURFACE, FOCUS_RING,
} from '@/mobile/designKit';
import { CheckRow, FieldLabel } from '@/mobile/screens/operations/parts';
import { yuan } from '@/mobile/screens/operations/opsLabels';

export function AgentCashConfirm() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: payment, isLoading: loadingPayment } = useAgentCashPaymentDetail(paymentId);
  const confirmMutation = useAgentConfirmCashPayment();

  const [cashHanded, setCashHanded] = useState(false);
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  // L'identité que la personne qui signe DÉCLARE (pas le nom attendu).
  const [declaredName, setDeclaredName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const sigCanvas = useRef<SignaturePad>(null);

  const getBeneficiaryName = () => cashBeneficiaryName(payment);

  const handleClearSignature = () => {
    sigCanvas.current?.clear();
    setSignatureEmpty(true);
  };

  const handleSignatureEnd = () => {
    if (sigCanvas.current) {
      setSignatureEmpty(sigCanvas.current.isEmpty());
    }
  };

  const canConfirm = cashHanded && !signatureEmpty && declaredName.trim().length >= 2 && !confirmMutation.isPending;

  const handleConfirm = async () => {
    if (!payment || !sigCanvas.current || sigCanvas.current.isEmpty() || declaredName.trim().length < 2) return;

    const signatureDataUrl = sigCanvas.current.toDataURL('image/png');

    try {
      const result = await confirmMutation.mutateAsync({
        paymentId: payment.id,
        signatureDataUrl,
        signedByName: declaredName,
        signerIdNumber: idNumber,
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
      <div className="flex min-h-full flex-col">
        <ScreenTop title={t('cash_handover_title')} />
        <ScreenLoader />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title={t('cash_handover_title')} />
        <EmptyLine>{t('payment_not_found')}</EmptyLine>
      </div>
    );
  }

  // La signature ne se prend qu'APRÈS le scan du QR du client
  // (confirm_cash_payment n'accepte que cash_scanned).
  if (payment.status !== 'cash_scanned') {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title={t('cash_handover_title')} backTo={`/a/payment/${payment.id}`} />
        <EmptyLine action={{ label: t('back'), onClick: () => navigate(`/a/payment/${payment.id}`, { replace: true }) }}>
          {payment.status === 'completed' ? t('already_paid') : t('confirm_requires_scan')}
        </EmptyLine>
      </div>
    );
  }

  const client = payment.profile ? `${payment.profile.first_name ?? ''} ${payment.profile.last_name ?? ''}`.trim() : '—';

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title={t('cash_handover_title')} backTo={`/a/payment/${payment.id}`} />

      <div className="px-5 pb-4 pt-5">
        <div className="flex flex-col items-center text-center">
          <BigFigure value={yuan(typeof payment.amount_rmb === 'number' ? payment.amount_rmb : 0)} center />
          <Tag tone="success" className="mt-3 inline-flex items-center gap-1.5"><Check className="h-4 w-4" strokeWidth={3} />{t('cash_qr_verified')}</Tag>
        </div>

        <KVBox
          className="mt-5"
          rows={[
            { label: t('expected_beneficiary'), value: getBeneficiaryName() },
            { label: t('client'), value: client || '—' },
            { label: t('reference'), value: payment.reference || '—' },
          ]}
        />

        <FieldLabel>{t('cash_person_name')}</FieldLabel>
        <TextInput
          className="h-14 text-[17px]"
          value={declaredName}
          onChange={(e) => setDeclaredName(e.target.value)}
          aria-label={t('signer_declared_name')}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
        />

        <FieldLabel>{t('cash_id_optional')}</FieldLabel>
        <TextInput
          className="h-14 text-[17px]"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          placeholder={t('cash_id_placeholder')}
          aria-label={t('signer_id_number')}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />

        <FieldLabel
          right={
            <button type="button" onClick={handleClearSignature} disabled={signatureEmpty} className={cn('rounded text-[16px] font-semibold underline underline-offset-[3px] disabled:opacity-40', FOCUS_RING, TEXT.strong)}>
              {t('clear')}
            </button>
          }
        >
          {t('cash_signature')}
        </FieldLabel>
        <div className={cn('relative overflow-hidden rounded-lg border bg-white', SURFACE.field)}>
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
              <p className="text-[17px] text-[#757575]">{t('sign_here')}</p>
            </div>
          )}
          <div aria-hidden className="pointer-events-none absolute inset-x-4 bottom-8 border-b border-dashed border-[#B3B3B3]" />
        </div>

        <CheckRow className="mt-3" checked={cashHanded} onChange={setCashHanded} label={t('cash_handed_short')} />
      </div>

      <Dock>
        <BigButton onClick={() => void handleConfirm()} disabled={!canConfirm} loading={confirmMutation.isPending}>
          {t('cash_confirm_handover')}
        </BigButton>
      </Dock>
    </div>
  );
}
