// ============================================================
// MODULE DEPOTS — DepositInstructions
// Method-specific instructions with copy-to-clipboard
// ============================================================
import { useState } from 'react';
import { Copy, Check, Info, MapPin, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatXAF } from '@/lib/formatters';
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
      instructions: t('instructions.steps.omTransfer', { phone: orangeMoneyAccount.phone, amount: formatXAF(amount_xaf), returnObjects: true }) as string[],
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
      instructions: t('instructions.steps.mtnTransfer', { phone: mtnMoneyAccount.phone, amount: formatXAF(amount_xaf), returnObjects: true }) as string[],
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
      instructions: t('instructions.steps.wave', { phone: waveAccount.phone, amount: formatXAF(amount_xaf), returnObjects: true }) as string[],
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
    const parts = info.fields.map(f => `${f.label}: ${f.value}`);
    parts.push(`${t('instructions.fields.amount')}: ${formatXAF(deposit.amount_xaf)} XAF`);
    if (info.merchantCode) parts.push(`Code: ${info.merchantCode}`);
    copyToClipboard(parts.join('\n'), 'all');
  };

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <button
      onClick={() => copyToClipboard(text, field)}
      className="p-1.5 rounded-md hover:bg-muted transition-colors"
    >
      {copiedField === field ? (
        <Check className="w-4 h-4 text-success" />
      ) : (
        <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
      )}
    </button>
  );

  // ── Compact mode (for detail screens) ──
  if (compact) {
    return (
      <div className="text-sm">
        {info.fields.map((field) => (
          <div key={field.label} className="py-2 border-b border-border/50 last:border-b-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground mb-0.5">{field.label}</p>
                <p className={cn(
                  'text-sm font-medium text-foreground break-all',
                  field.mono && 'font-mono text-xs tracking-wide',
                )}>
                  {field.value}
                </p>
              </div>
              <CopyBtn text={field.value} field={field.label} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Full mode ──
  return (
    <div className="space-y-4">
      {showTitle && (
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            {t('instructions.title')}
          </h3>
          <Button variant="ghost" size="sm" onClick={copyAllInfo} className="text-xs">
            {copiedField === 'all' ? (
              <>
                <Check className="w-4 h-4 mr-1 text-success" />
                {t('instructions.copied')}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                {t('instructions.copyAll')}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Account info card */}
      <Card className="p-4 bg-muted/30">
        {info.fields.map((field) => (
          <div key={field.label} className="py-3 border-b border-border/50 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground mb-1">{field.label}</p>
                <p className={cn(
                  'text-sm font-medium text-foreground break-all',
                  field.mono && 'font-mono tracking-wide',
                )}>
                  {field.value}
                </p>
              </div>
              <CopyBtn text={field.value} field={field.label} />
            </div>
          </div>
        ))}

        {info.merchantCode && (
          <div className="py-3 border-b border-border/50">
            <span className="text-sm text-muted-foreground block mb-2">{t('instructions.merchantCode')}</span>
            <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
              <span className="font-bold text-foreground font-mono text-sm break-all">
                {info.merchantCode}
              </span>
              <CopyBtn text={info.merchantCode} field="merchant" />
            </div>
          </div>
        )}
      </Card>

      {/* Step-by-step instructions */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-foreground mb-4">{t('instructions.stepsToFollow')}</p>
        <ol className="space-y-3">
          {info.instructions.map((instruction, index) => (
            <li key={index} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center flex-shrink-0">
                {index + 1}
              </span>
              <span className="text-sm text-muted-foreground pt-0.5">{instruction}</span>
            </li>
          ))}
        </ol>
      </Card>

      {info.note && (
        <Card className="p-4 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20">
          <p className="text-sm text-amber-700 dark:text-amber-400">{info.note}</p>
        </Card>
      )}
    </div>
  );
}
