import { cn } from '@/lib/utils';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';

type PaymentMethod = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';

interface PaymentMethodCardProps {
  method: PaymentMethod;
  label: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
}

const METHOD_COLORS: Record<PaymentMethod, string> = {
  alipay: 'border-[#1677FF]',
  wechat: 'border-[#07C160]',
  bank_transfer: 'border-slate-500',
  cash: 'border-[#dc2626]',
};

export function PaymentMethodCard({ method, label, description, isSelected, onSelect }: PaymentMethodCardProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-4 p-4 rounded-xl border-2 bg-card transition-all active:scale-[0.98]',
        isSelected ? METHOD_COLORS[method] : 'border-border'
      )}
    >
      <PaymentMethodLogo method={method} size={48} />
      <div className="flex-1 text-left">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
