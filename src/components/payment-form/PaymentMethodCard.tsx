// Carte de méthode — Direction A (designKit). Carte blanche ombre douce ;
// sélection = anneau violet + coche (au lieu d'une bordure 2px colorée).
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { SURFACE, TEXT } from '@/mobile/designKit';

type PaymentMethod = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';

interface PaymentMethodCardProps {
  method: PaymentMethod;
  label: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
}

export function PaymentMethodCard({ method, label, description, isSelected, onSelect }: PaymentMethodCardProps) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        'flex w-full items-center gap-4 rounded-[20px] p-4 text-left transition active:scale-[0.98]',
        SURFACE.card,
        SURFACE.shadow,
        isSelected && 'ring-2 ring-[#8B5CF6]',
      )}
    >
      <PaymentMethodLogo method={method} size={48} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-[16px] font-bold leading-tight', TEXT.strong)}>{label}</p>
        <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>{description}</p>
      </div>
      {isSelected && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6]">
          <Check className="h-4 w-4 text-white" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
