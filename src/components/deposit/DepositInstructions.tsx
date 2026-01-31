import { useState } from 'react';
import { Copy, Check, Info, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
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

interface InstructionInfo {
  type: 'bank' | 'mobile' | 'merchant' | 'agency';
  title: string;
  accountLabel: string;
  accountValue: string;
  accountName: string;
  bankName?: string;
  address?: string;
  hours?: string;
  merchantCode?: string;
  instructions: string[];
  note?: string;
}

function getInstructionInfo(deposit: Deposit): InstructionInfo | null {
  const { method, amount_xaf, reference, bank_name, agency_name } = deposit;

  // Bank methods
  if ((method === 'bank_transfer' || method === 'bank_cash') && bank_name) {
    const bankInfo = getBankInfo(bank_name);
    if (!bankInfo) return null;

    return {
      type: 'bank',
      title: method === 'bank_transfer' ? 'Virement bancaire' : 'Dépôt cash en banque',
      accountLabel: 'N° Compte',
      accountValue: bankInfo.bonziniAccount.accountNumber,
      accountName: bankInfo.bonziniAccount.accountName,
      bankName: bankInfo.bonziniAccount.bankName,
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

  // Orange Money
  if (method === 'om_transfer') {
    return {
      type: 'mobile',
      title: 'Transfert Orange Money',
      accountLabel: 'Numéro OM',
      accountValue: orangeMoneyAccount.phone,
      accountName: orangeMoneyAccount.accountName,
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
      title: 'Retrait Orange Money',
      accountLabel: 'Titulaire',
      accountValue: omMerchantInfo.accountName,
      accountName: omMerchantInfo.accountName,
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

  // MTN Money
  if (method === 'mtn_transfer') {
    return {
      type: 'mobile',
      title: 'Transfert MTN Mobile Money',
      accountLabel: 'Numéro MOMO',
      accountValue: mtnMoneyAccount.phone,
      accountName: mtnMoneyAccount.accountName,
      instructions: [
        'Composez *126#',
        'Sélectionnez "Transfert d\'argent"',
        `Entrez le numéro: ${mtnMoneyAccount.phone}`,
        `Saisissez le montant: ${formatXAF(amount_xaf)} XAF`,
        'Confirmez avec votre code PIN',
      ],
    };
  }

  if (method === 'mtn_withdrawal') {
    return {
      type: 'merchant',
      title: 'Retrait MTN Mobile Money',
      accountLabel: 'Titulaire',
      accountValue: mtnMerchantInfo.accountName,
      accountName: mtnMerchantInfo.accountName,
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

  // Agency
  if (method === 'agency_cash' && agency_name) {
    const agencyInfo = getAgencyInfo(agency_name);
    if (!agencyInfo) return null;

    return {
      type: 'agency',
      title: 'Dépôt en agence Bonzini',
      accountLabel: 'Agence',
      accountValue: agencyInfo.label,
      accountName: 'BONZINI TRADING',
      address: agencyInfo.address,
      hours: agencyInfo.hours,
      instructions: [
        `Rendez-vous à l'agence ${agencyInfo.label}`,
        'Présentez votre pièce d\'identité',
        `Mentionnez la référence: ${reference}`,
        'Effectuez votre dépôt en espèces',
        'Conservez votre reçu',
      ],
    };
  }

  // Wave
  if (method === 'wave') {
    return {
      type: 'mobile',
      title: 'Transfert Wave',
      accountLabel: 'Numéro Wave',
      accountValue: waveAccount.phone,
      accountName: waveAccount.accountName,
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

  if (!info) {
    return null;
  }

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
    const parts = [
      `${info.accountLabel}: ${info.accountValue}`,
      `Titulaire: ${info.accountName}`,
      `Montant: ${formatXAF(deposit.amount_xaf)} XAF`,
      `Référence: ${deposit.reference}`,
    ];
    if (info.bankName) {
      parts.unshift(`Banque: ${info.bankName}`);
    }
    if (info.merchantCode) {
      parts.push(`Code: ${info.merchantCode}`);
    }
    copyToClipboard(parts.join('\n'), 'all');
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
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

  if (compact) {
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between py-1.5 border-b border-border/50">
          <span className="text-muted-foreground">{info.accountLabel}</span>
          <div className="flex items-center gap-1.5">
            <span className="font-medium font-mono text-xs">{info.accountValue}</span>
            <CopyButton text={info.accountValue} field="account" />
          </div>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-border/50">
          <span className="text-muted-foreground">Titulaire</span>
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{info.accountName}</span>
            <CopyButton text={info.accountName} field="name" />
          </div>
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-muted-foreground">Référence</span>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-primary font-mono text-xs">{deposit.reference}</span>
            <CopyButton text={deposit.reference} field="reference" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with copy all */}
      {showTitle && (
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Instructions de dépôt
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyAllInfo}
            className="text-xs"
          >
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

      {/* Account info */}
      <Card className="p-4 space-y-3 bg-muted/30">
        {info.bankName && (
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Banque</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{info.bankName}</span>
              <CopyButton text={info.bankName} field="bank" />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between py-2 border-b border-border/50">
          <span className="text-sm text-muted-foreground">{info.accountLabel}</span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground font-mono text-sm">{info.accountValue}</span>
            <CopyButton text={info.accountValue} field="account" />
          </div>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-border/50">
          <span className="text-sm text-muted-foreground">Titulaire</span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{info.accountName}</span>
            <CopyButton text={info.accountName} field="name" />
          </div>
        </div>

        {info.address && (
          <div className="flex items-start justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Adresse
            </span>
            <span className="font-medium text-foreground text-right text-sm">{info.address}</span>
          </div>
        )}

        {info.hours && (
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Horaires
            </span>
            <span className="font-medium text-foreground text-sm">{info.hours}</span>
          </div>
        )}

        {info.merchantCode && (
          <div className="py-3 border-b border-border/50">
            <span className="text-sm text-muted-foreground block mb-2">Code Marchand</span>
            <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
              <span className="font-bold text-foreground font-mono text-sm break-all">
                {info.merchantCode}
              </span>
              <CopyButton text={info.merchantCode} field="merchant" />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">Référence</span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-primary font-mono text-xs">{deposit.reference}</span>
            <CopyButton text={deposit.reference} field="reference" />
          </div>
        </div>
      </Card>

      {/* Instructions */}
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

      {/* Note for withdrawal */}
      {info.note && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-700">
            {info.note}
          </p>
        </Card>
      )}
    </div>
  );
}
