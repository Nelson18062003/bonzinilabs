import { Check } from 'lucide-react';
import { formatXAF, formatRMB } from '@/lib/formatters';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';

type PaymentMethod = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';

interface SuccessScreenProps {
  variant: 'admin' | 'client';
  amountXAF: number;
  amountRMB: number;
  method: PaymentMethod;
  clientName?: string;
  onNewPayment: () => void;
  onViewPayment: () => void;
  onGoBack?: () => void;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  alipay: 'Alipay',
  wechat: 'WeChat Pay',
  bank_transfer: 'Virement bancaire',
  cash: 'Cash',
};

export function SuccessScreen({
  variant,
  amountXAF,
  amountRMB,
  method,
  clientName,
  onNewPayment,
  onViewPayment,
  onGoBack,
}: SuccessScreenProps) {
  if (variant === 'admin') {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
        {/* Animated checkmark */}
        <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center mb-6 animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-10 h-10 text-green-500" strokeWidth={3} />
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-2">Paiement créé</h1>

        <div className="flex items-center gap-2 mb-2">
          <PaymentMethodLogo method={method} size={28} />
          <span className="text-sm text-muted-foreground">{METHOD_LABELS[method]}</span>
        </div>

        <p className="text-3xl font-bold text-primary mb-1">¥{formatRMB(amountRMB)}</p>
        <p className="text-sm text-muted-foreground mb-1">{formatXAF(amountXAF)} XAF</p>
        {clientName && (
          <p className="text-sm text-muted-foreground">pour {clientName}</p>
        )}

        <div className="w-full max-w-xs mt-8 space-y-3">
          <button
            onClick={onNewPayment}
            className="w-full h-12 rounded-xl border border-border font-medium transition-colors hover:bg-muted"
          >
            Nouveau paiement
          </button>
          <button
            onClick={onViewPayment}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium"
          >
            Voir la fiche
          </button>
        </div>
      </div>
    );
  }

  // Client variant
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6 animate-scale-in">
        <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check className="w-8 h-8 text-green-500" strokeWidth={3} />
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-2">Paiement créé !</h2>
      <p className="text-muted-foreground mb-4">Votre demande a été enregistrée</p>

      <p className="text-3xl font-bold text-primary mb-1">¥{formatRMB(amountRMB)}</p>
      <p className="text-sm text-muted-foreground mb-8">{formatXAF(amountXAF)} XAF débités</p>

      <div className="w-full space-y-3">
        <button
          onClick={onViewPayment}
          className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold"
        >
          Voir le paiement
        </button>
        <button
          onClick={onNewPayment}
          className="w-full py-3 bg-secondary text-foreground font-medium rounded-xl"
        >
          Mes paiements
        </button>
        {onGoBack && (
          <button
            onClick={onGoBack}
            className="w-full py-3 text-muted-foreground font-medium hover:bg-secondary rounded-xl transition-colors"
          >
            Retour à l'accueil
          </button>
        )}
      </div>
    </div>
  );
}
