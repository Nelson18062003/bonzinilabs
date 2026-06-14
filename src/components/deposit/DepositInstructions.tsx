// ============================================================
// MODULE DEPOTS — DepositInstructions (refonte « Direction A »).
// Coordonnées Bonzini « où verser » + code marchand + étapes à suivre +
// note. Copie au toucher. Logique getInstructionInfo 100% PRÉSERVÉE.
// ============================================================
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { SURFACE, TEXT } from '@/mobile/designKit';
import {
  getBankInfo,
  getAgencyInfo,
  orangeMoneyAccount,
  mtnMoneyAccount,
  waveAccount,
  omMerchantInfo,
  mtnMerchantInfo,
} from '@/data/depositMethodsData';

interface Deposit {
  method: string;
  amount_xaf: number;
  reference: string;
  bank_name?: string | null;
  agency_name?: string | null;
}

interface DepositInstructionsProps {
  deposit: Deposit;
  showTitle?: boolean;
  compact?: boolean;
}

interface InstructionField {
  label: string;
  value: string;
  mono?: boolean;
}

interface InstructionInfo {
  type: 'bank' | 'mobile' | 'merchant' | 'agency';
  title: string;
  fields: InstructionField[];
  merchantCode?: string;
  instructions: string[];
  note?: string;
}

function getInstructionInfo(deposit: Deposit, t: TFunction): InstructionInfo | null {
  const { method, amount_xaf, reference, bank_name, agency_name } = deposit;

  if ((method === 'bank_transfer' || method === 'bank_cash') && bank_name) {
    const bankInfo = getBankInfo(bank_name);
    if (!bankInfo) return null;

    return {
      type: 'bank',
      title: method === 'bank_transfer' ? t('instructions.bankTransfer') : t('instructions.bankCash'),
      fields: [
        { label: t('instructions.fields.bank'), value: bankInfo.bonziniAccount.bankName },
        { label: t('instructions.fields.holder'), value: bankInfo.bonziniAccount.accountName },
        { label: t('instructions.fields.accountNumber'), value: bankInfo.bonziniAccount.accountNumber, mono: true },
        { label: t('instructions.fields.iban'), value: bankInfo.bonziniAccount.iban, mono: true },
        { label: t('instructions.fields.swift'), value: bankInfo.bonziniAccount.swift, mono: true },
        { label: t('instructions.fields.reference'), value: reference, mono: true },
      ],
      instructions: method === 'bank_transfer'
        ? (t('instructions.steps.bankTransfer', { reference, returnObjects: true }) as string[])
        : (t('instructions.steps.bankCash', { bankName: bankInfo.label, reference, returnObjects: true }) as string[]),
    };
  }

  if (method === 'om_transfer') {
    return {
      type: 'mobile',
      title: t('instructions.omTransfer'),
      fields: [
        { label: t('instructions.fields.operator'), value: 'ORANGE MONEY CAMEROUN' },
        { label: t('instructions.fields.number'), value: orangeMoneyAccount.phone, mono: true },
        { label: t('instructions.fields.holder'), value: orangeMoneyAccount.accountName },
        { label: t('instructions.fields.reference'), value: reference, mono: true },
      ],
      instructions: t('instructions.steps.omTransfer', { phone: orangeMoneyAccount.phone, amount: formatNumber(amount_xaf), returnObjects: true }) as string[],
    };
  }

  if (method === 'om_withdrawal') {
    return {
      type: 'merchant',
      title: t('instructions.omWithdrawal'),
      fields: [
        { label: t('instructions.fields.operator'), value: 'ORANGE MONEY CAMEROUN' },
        { label: t('instructions.fields.holder'), value: omMerchantInfo.accountName },
        { label: t('instructions.fields.reference'), value: reference, mono: true },
      ],
      merchantCode: omMerchantInfo.merchantCode,
      instructions: t('instructions.steps.omWithdrawal', { returnObjects: true }) as string[],
      note: t('instructions.notes.omWithdrawalLimit'),
    };
  }

  if (method === 'mtn_transfer') {
    return {
      type: 'mobile',
      title: t('instructions.mtnTransfer'),
      fields: [
        { label: t('instructions.fields.operator'), value: 'MTN MOBILE MONEY' },
        { label: t('instructions.fields.number'), value: mtnMoneyAccount.phone, mono: true },
        { label: t('instructions.fields.holder'), value: mtnMoneyAccount.accountName },
        { label: t('instructions.fields.reference'), value: reference, mono: true },
      ],
      instructions: t('instructions.steps.mtnTransfer', { phone: mtnMoneyAccount.phone, amount: formatNumber(amount_xaf), returnObjects: true }) as string[],
    };
  }

  if (method === 'mtn_withdrawal') {
    return {
      type: 'merchant',
      title: t('instructions.mtnWithdrawal'),
      fields: [
        { label: t('instructions.fields.operator'), value: 'MTN MOBILE MONEY' },
        { label: t('instructions.fields.holder'), value: mtnMerchantInfo.accountName },
        { label: t('instructions.fields.reference'), value: reference, mono: true },
      ],
      merchantCode: mtnMerchantInfo.merchantCode,
      instructions: t('instructions.steps.mtnWithdrawal', { returnObjects: true }) as string[],
      note: t('instructions.notes.mtnWithdrawalLimit'),
    };
  }

  if (method === 'agency_cash' && agency_name) {
    const agencyInfo = getAgencyInfo(agency_name);
    if (!agencyInfo) return null;

    return {
      type: 'agency',
      title: t('instructions.agencyCash'),
      fields: [
        { label: t('instructions.fields.agency'), value: agencyInfo.label },
        { label: t('instructions.fields.address'), value: agencyInfo.address },
        { label: t('instructions.fields.hours'), value: agencyInfo.hours },
        { label: t('instructions.fields.reference'), value: reference, mono: true },
      ],
      instructions: t('instructions.steps.agencyCash', { agencyName: agencyInfo.label, reference, returnObjects: true }) as string[],
    };
  }

  if (method === 'wave') {
    return {
      type: 'mobile',
      title: t('instructions.wave'),
      fields: [
        { label: t('instructions.fields.waveNumber'), value: waveAccount.phone, mono: true },
        { label: t('instructions.fields.holder'), value: waveAccount.accountName },
        { label: t('instructions.fields.reference'), value: reference, mono: true },
      ],
      instructions: t('instructions.steps.wave', { phone: waveAccount.phone, amount: formatNumber(amount_xaf), returnObjects: true }) as string[],
    };
  }

  return null;
}

export function DepositInstructions({ deposit, showTitle = true, compact = false }: DepositInstructionsProps) {
  const { t } = useTranslation('deposits');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const info = getInstructionInfo(deposit, t);
  if (!info) return null;

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(t('instructions.copySuccess'));
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error(t('instructions.copyError'));
    }
  };

  const copyAllInfo = () => {
    const parts = info.fields.map((f) => `${f.label}: ${f.value}`);
    parts.push(`${t('instructions.fields.amount')}: ${formatNumber(deposit.amount_xaf)} XAF`);
    if (info.merchantCode) parts.push(`Code: ${info.merchantCode}`);
    copyToClipboard(parts.join('\n'), 'all');
  };

  // Ligne « libellé → valeur » copiable d'un toucher.
  const Row = ({ field, last }: { field: InstructionField; last?: boolean }) => (
    <button
      type="button"
      onClick={() => copyToClipboard(field.value, field.label)}
      className={cn('flex w-full items-center justify-between gap-3 py-3 text-left transition active:opacity-60', !last && 'border-b border-black/[0.05] dark:border-white/[0.07]')}
    >
      <div className="min-w-0">
        <div className={cn('text-[11px]', TEXT.muted)}>{field.label}</div>
        <div className={cn('mt-0.5 break-all text-[14px] font-bold', field.mono && 'font-mono', TEXT.strong)}>{field.value}</div>
      </div>
      {copiedField === field.label ? (
        <Check className="h-4 w-4 shrink-0 text-[#2E7D52] dark:text-[#7FCBA0]" />
      ) : (
        <Copy className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
      )}
    </button>
  );

  // Compact : juste les lignes (contexte serré).
  if (compact) {
    return (
      <div className="-my-3">
        {info.fields.map((f, i) => (
          <Row key={f.label} field={f} last={i === info.fields.length - 1} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Coordonnées */}
      <section>
        {showTitle && (
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>
              {t('instructions.title')}
            </h2>
            <button onClick={copyAllInfo} className="text-[12px] font-bold text-[#5B4CC4] active:opacity-70 dark:text-[#B5AAF0]">
              {copiedField === 'all' ? t('instructions.copied') : t('instructions.copyAll')}
            </button>
          </div>
        )}
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          {info.fields.map((f, i) => (
            <Row key={f.label} field={f} last={!info.merchantCode && i === info.fields.length - 1} />
          ))}
          {info.merchantCode && (
            <div className="pt-3">
              <div className={cn('mb-2 text-[11px]', TEXT.muted)}>{t('instructions.merchantCode')}</div>
              <button
                onClick={() => copyToClipboard(info.merchantCode!, 'merchant')}
                className={cn('flex w-full items-center justify-between gap-3 rounded-2xl p-3.5 text-left', SURFACE.holder)}
              >
                <span className={cn('break-all font-mono text-[14px] font-bold', TEXT.strong)}>{info.merchantCode}</span>
                {copiedField === 'merchant' ? <Check className="h-4 w-4 shrink-0 text-[#2E7D52] dark:text-[#7FCBA0]" /> : <Copy className={cn('h-4 w-4 shrink-0', TEXT.muted)} />}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Étapes à suivre */}
      <section>
        <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{t('instructions.stepsToFollow')}</h2>
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          <ol className="space-y-3">
            {info.instructions.map((instruction, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EDEAFA] text-[12px] font-bold text-[#5B4CC4] dark:bg-[#221F33] dark:text-[#B5AAF0]">{index + 1}</span>
                <span className={cn('pt-0.5 text-[13px]', TEXT.muted)}>{instruction}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {info.note && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-[#FDF1DD] p-3.5 dark:bg-[#3A2F1A]">
          <span className="text-[12.5px] text-[#9A6B12] dark:text-[#E0B978]">{info.note}</span>
        </div>
      )}
    </div>
  );
}
