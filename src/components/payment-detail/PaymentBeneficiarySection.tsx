// ============================================================
// Bénéficiaire — fiche v7 : intitulé HORS carte (« Bénéficiaire ·
// Méthode » + Modifier / Verrouillé), QR en vignette cliquable
// (« Agrandir ») à côté des champs copiables, champs NUANCÉS par
// méthode (Alipay/WeChat : fournisseur + identifiant + canaux ·
// Banque : banque + compte + titulaire + SWIFT · Cash : nom +
// téléphone). Logique 100 % préservée : branches cash / vide /
// rempli, édition seulement si statut éditable et méthode non-cash.
// ============================================================
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AlertCircle, Check, Copy, Edit2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';
import type { Payment } from '@/hooks/usePayments';
import { SURFACE, TEXT, PrimaryPill } from '@/mobile/designKit';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';
import type { PaymentMethod } from '@/types/payment';
import { isStatusEditable, isStatusLocked } from './types';

interface Props {
  payment: Payment;
  onEdit: () => void;
  onViewQr: (url: string) => void;
}

/** Ligne « libellé → valeur » copiable d'un toucher. */
function FieldRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(value, label);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex w-full items-center justify-between gap-3 py-3 text-left transition active:opacity-60"
    >
      <div className="min-w-0">
        <div className={cn('text-[11px]', TEXT.muted)}>{label}</div>
        <div className={cn('mt-0.5 truncate text-[14px] font-bold', TEXT.strong)}>{value}</div>
      </div>
      {copied ? (
        <Check className="h-4 w-4 shrink-0 text-[#2E7D52] dark:text-[#7FCBA0]" />
      ) : (
        <Copy className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
      )}
    </button>
  );
}

/** Champs ordonnés selon la méthode (tous les champs renseignés restent visibles). */
function buildFields(payment: Payment, t: TFunction): { label: string; value: string }[] {
  const candidates: { label: string; value: string | null }[] = [];

  if (payment.method === 'cash') {
    const cashName =
      payment.beneficiary_name ||
      [payment.cash_beneficiary_first_name, payment.cash_beneficiary_last_name]
        .filter(Boolean)
        .join(' ');
    candidates.push(
      { label: t('detail.fields.beneficiaryName'), value: cashName || null },
      { label: t('detail.fields.phone'), value: payment.cash_beneficiary_phone || payment.beneficiary_phone },
      { label: t('detail.fields.email'), value: payment.beneficiary_email },
    );
  } else if (payment.method === 'bank_transfer') {
    candidates.push(
      { label: t('detail.fields.bank'), value: payment.beneficiary_bank_name },
      { label: t('detail.fields.accountNumber'), value: payment.beneficiary_bank_account },
      { label: t('detail.fields.accountHolder'), value: payment.beneficiary_name },
      { label: t('detail.fields.swiftIban'), value: payment.beneficiary_bank_extra },
      { label: t('detail.fields.phone'), value: payment.beneficiary_phone },
      { label: t('detail.fields.email'), value: payment.beneficiary_email },
    );
  } else {
    candidates.push(
      { label: t('detail.fields.supplierName'), value: payment.beneficiary_name },
      {
        label: payment.method === 'wechat' ? t('detail.fields.wechatId') : t('detail.fields.alipayId'),
        value: payment.beneficiary_identifier,
      },
      { label: t('detail.fields.phone'), value: payment.beneficiary_phone },
      { label: t('detail.fields.email'), value: payment.beneficiary_email },
      // Défensif : champs bancaires affichés s'ils existent malgré la méthode.
      { label: t('detail.fields.bank'), value: payment.beneficiary_bank_name },
      { label: t('detail.fields.accountNumber'), value: payment.beneficiary_bank_account },
      { label: t('detail.fields.swiftIban'), value: payment.beneficiary_bank_extra },
    );
  }

  return candidates.filter((f): f is { label: string; value: string } => !!f.value);
}

export function PaymentBeneficiarySection({ payment, onEdit, onViewQr }: Props) {
  const { t } = useTranslation('payments');

  const canEdit = isStatusEditable(payment.status);
  const isLocked = isStatusLocked(payment.status);
  const methodLabel = PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method;

  const fields = buildFields(payment, t);
  const showQr =
    !!payment.beneficiary_qr_code_url && ['alipay', 'wechat'].includes(payment.method);

  // « A-t-on des infos bénéficiaire ? » — pilote l'état vide vs rempli.
  const hasBeneficiaryInfo = payment.method === 'cash' || showQr || fields.length > 0;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>
          {t('detail.beneficiaryWithMethod', { method: methodLabel })}
        </h2>
        {isLocked ? (
          <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold', SURFACE.holder)}>
            <Lock className="h-3 w-3" />
            {t('detail.locked')}
          </span>
        ) : canEdit && hasBeneficiaryInfo && payment.method !== 'cash' ? (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-[12px] font-bold text-[#5B4CC4] transition-transform active:scale-95 dark:text-[#B5AAF0]"
          >
            <Edit2 className="h-3.5 w-3.5" />
            {t('detail.edit')}
          </button>
        ) : null}
      </div>

      {!hasBeneficiaryInfo ? (
        /* État vide (non-cash) — rouge = action requise du client. */
        <div className="rounded-[22px] bg-[#FBE7E7] p-6 text-center dark:bg-[#3A2526]">
          <AlertCircle className="mx-auto mb-3 h-9 w-9 text-[#C0504D] dark:text-[#E79A9A]" />
          <p className={cn('text-[15px] font-bold', TEXT.strong)}>
            {t('detail.missingBeneficiaryInfo')}
          </p>
          <p className={cn('mt-1 text-[13px]', TEXT.muted)}>{t('detail.addBeneficiaryPrompt')}</p>
          {canEdit && (
            <div className="mt-4 flex justify-center">
              <PrimaryPill onClick={onEdit}>{t('detail.addInfo')}</PrimaryPill>
            </div>
          )}
        </div>
      ) : (
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          {showQr ? (
            <div className="flex gap-4">
              <button
                onClick={() => onViewQr(payment.beneficiary_qr_code_url!)}
                className="flex shrink-0 flex-col items-center gap-1.5 self-start transition-transform active:scale-[0.97]"
              >
                <img
                  src={payment.beneficiary_qr_code_url!}
                  alt={t('detail.form.qrBeneficiary')}
                  className="h-[88px] w-[88px] rounded-2xl bg-white object-contain ring-1 ring-black/[0.07]"
                />
                <span className="text-[10px] font-semibold text-[#5B4CC4] dark:text-[#B5AAF0]">
                  {t('detail.enlarge')}
                </span>
              </button>
              <div className="-my-3 min-w-0 flex-1 divide-y divide-black/[0.05] dark:divide-white/[0.07]">
                {fields.map((f) => (
                  <FieldRow key={f.label} label={f.label} value={f.value} />
                ))}
              </div>
            </div>
          ) : (
            <div className="-my-3 divide-y divide-black/[0.05] dark:divide-white/[0.07]">
              {fields.map((f) => (
                <FieldRow key={f.label} label={f.label} value={f.value} />
              ))}
              {fields.length === 0 && payment.method === 'cash' && (
                <p className={cn('py-3 text-[13px]', TEXT.muted)}>
                  {t('detail.cashPickupPresentQr')}
                </p>
              )}
            </div>
          )}

          {payment.beneficiary_notes && (
            <div className="mt-4 border-t border-black/[0.05] pt-3 dark:border-white/[0.07]">
              <p className={cn('text-[11px]', TEXT.muted)}>{t('detail.fields.notes')}</p>
              <p className={cn('mt-0.5 text-[14px]', TEXT.strong)}>{payment.beneficiary_notes}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
