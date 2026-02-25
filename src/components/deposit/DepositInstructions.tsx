// ============================================================
// MODULE DEPOTS — DepositInstructions
// Method-specific instructions with copy-to-clipboard
// ============================================================
import { useState } from 'react';
import { Copy, Check, Info } from 'lucide-react';
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

function getInstructionInfo(deposit: Deposit): InstructionInfo | null {
  const { method, amount_xaf, reference, bank_name, agency_name } = deposit;

  if ((method === 'bank_transfer' || method === 'bank_cash') && bank_name) {
    const bankInfo = getBankInfo(bank_name);
    if (!bankInfo) return null;

    return {
      type: 'bank',
      title: method === 'bank_transfer' ? 'Virement bancaire' : 'Dépôt cash en banque',
      fields: [
        { label: 'Banque', value: bankInfo.bonziniAccount.bankName },
        { label: 'Titulaire', value: bankInfo.bonziniAccount.accountName },
        { label: 'N° Compte', value: bankInfo.bonziniAccount.accountNumber, mono: true },
        { label: 'IBAN', value: bankInfo.bonziniAccount.iban, mono: true },
        { label: 'Code SWIFT', value: bankInfo.bonziniAccount.swift, mono: true },
        { label: 'Référence', value: reference, mono: true },
      ],
      instructions: method === 'bank_transfer'
        ? [
            'Connectez-vous à votre application bancaire ou rendez-vous en agence',
            'Effectuez un virement vers le compte ci-dessus',
            `Indiquez la référence: ${reference}`,
            'Conservez le reçu et téléchargez-le ici',
          ]
        : [
            `Rendez-vous dans une agence ${bankInfo.label}`,
            'Effectuez un dépôt cash sur le compte ci-dessus',
            `Indiquez la référence: ${reference}`,
            'Conservez le bordereau et téléchargez-le ici',
          ],
    };
  }

  if (method === 'om_transfer') {
    return {
      type: 'mobile',
      title: 'Transfert Orange UV vers Bonzini',
      fields: [
        { label: 'Opérateur', value: 'ORANGE MONEY CAMEROUN' },
        { label: 'Numéro', value: orangeMoneyAccount.phone, mono: true },
        { label: 'Titulaire', value: orangeMoneyAccount.accountName },
        { label: 'Référence', value: reference, mono: true },
      ],
      instructions: [
        'Composez #150*1*1#',
        `Entrez le numéro: ${orangeMoneyAccount.phone}`,
        `Saisissez le montant: ${formatXAF(amount_xaf)} XAF`,
        'Confirmez avec votre code PIN',
        'Prenez une capture d\'écran du SMS de confirmation',
      ],
    };
  }

  if (method === 'om_withdrawal') {
    return {
      type: 'merchant',
      title: 'Retrait Orange Money (code marchand)',
      fields: [
        { label: 'Opérateur', value: 'ORANGE MONEY CAMEROUN' },
        { label: 'Titulaire', value: omMerchantInfo.accountName },
        { label: 'Référence', value: reference, mono: true },
      ],
      merchantCode: omMerchantInfo.merchantCode,
      instructions: [
        'Sur votre téléphone, tapez le code marchand affiché ci-dessous',
        'Remplacez MONTANT par le montant à envoyer',
        'Validez avec votre code PIN Orange Money',
        'Prenez une capture d\'écran du SMS de confirmation',
      ],
      note: 'Limite: 500 000 XAF par transaction',
    };
  }

  if (method === 'mtn_transfer') {
    return {
      type: 'mobile',
      title: 'Transfert MTN Float vers Bonzini',
      fields: [
        { label: 'Opérateur', value: 'MTN MOBILE MONEY' },
        { label: 'Numéro', value: mtnMoneyAccount.phone, mono: true },
        { label: 'Titulaire', value: mtnMoneyAccount.accountName },
        { label: 'Référence', value: reference, mono: true },
      ],
      instructions: [
        'Depuis votre compte MTN Float entreprise',
        `Effectuez un transfert vers: ${mtnMoneyAccount.phone}`,
        `Saisissez le montant: ${formatXAF(amount_xaf)} XAF`,
        'Confirmez avec votre code PIN',
        'Prenez une capture d\'écran de la confirmation',
      ],
    };
  }

  if (method === 'mtn_withdrawal') {
    return {
      type: 'merchant',
      title: 'Retrait MoMo (code marchand)',
      fields: [
        { label: 'Opérateur', value: 'MTN MOBILE MONEY' },
        { label: 'Titulaire', value: mtnMerchantInfo.accountName },
        { label: 'Référence', value: reference, mono: true },
      ],
      merchantCode: mtnMerchantInfo.merchantCode,
      instructions: [
        'Sur votre téléphone, tapez le code marchand affiché ci-dessous',
        'Remplacez MONTANT par le montant à envoyer',
        'Validez avec votre code PIN MTN Mobile Money',
        'Prenez une capture d\'écran du SMS de confirmation',
      ],
      note: 'Limite: 500 000 XAF par transaction',
    };
  }

  if (method === 'agency_cash' && agency_name) {
    const agencyInfo = getAgencyInfo(agency_name);
    if (!agencyInfo) return null;

    return {
      type: 'agency',
      title: 'Dépôt en agence Bonzini',
      fields: [
        { label: 'Agence', value: agencyInfo.label },
        { label: 'Adresse', value: agencyInfo.address },
        { label: 'Horaires', value: agencyInfo.hours },
        { label: 'Référence', value: reference, mono: true },
      ],
      instructions: [
        `Rendez-vous à l'agence ${agencyInfo.label}`,
        'Présentez votre pièce d\'identité',
        `Mentionnez la référence: ${reference}`,
        'Effectuez votre dépôt en espèces',
        'Conservez votre reçu',
      ],
    };
  }

  if (method === 'wave') {
    return {
      type: 'mobile',
      title: 'Transfert Wave',
      fields: [
        { label: 'Numéro Wave', value: waveAccount.phone, mono: true },
        { label: 'Titulaire', value: waveAccount.accountName },
        { label: 'Référence', value: reference, mono: true },
      ],
      instructions: [
        'Ouvrez l\'application Wave',
        'Sélectionnez "Envoyer"',
        `Entrez le numéro: ${waveAccount.phone}`,
        `Saisissez le montant: ${formatXAF(amount_xaf)} XAF`,
        'Confirmez le transfert',
      ],
    };
  }

  return null;
}

export function DepositInstructions({ deposit, showTitle = true, compact = false }: DepositInstructionsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const info = getInstructionInfo(deposit);
  if (!info) return null;

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Copié !');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  const copyAllInfo = () => {
    const parts = info.fields.map(f => `${f.label}: ${f.value}`);
    parts.push(`Montant: ${formatXAF(deposit.amount_xaf)} XAF`);
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
            Instructions de dépôt
          </h3>
          <Button variant="ghost" size="sm" onClick={copyAllInfo} className="text-xs">
            {copiedField === 'all' ? (
              <>
                <Check className="w-4 h-4 mr-1 text-success" />
                Copié
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Tout copier
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
            <span className="text-sm text-muted-foreground block mb-2">Code Marchand</span>
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
        <p className="text-sm font-semibold text-foreground mb-4">Étapes à suivre</p>
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
