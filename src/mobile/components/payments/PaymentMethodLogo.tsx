import { Building2, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentMethodLogoProps {
  method: 'alipay' | 'wechat' | 'bank_transfer' | 'cash';
  size?: number;
  className?: string;
}

export function PaymentMethodLogo({ method, size = 48, className }: PaymentMethodLogoProps) {
  const containerStyle = { width: size, height: size };
  const iconSize = { width: size * 0.5, height: size * 0.5 };

  switch (method) {
    case 'alipay':
      return (
        <div
          className={cn('rounded-xl flex items-center justify-center flex-shrink-0', className)}
          style={{ ...containerStyle, background: 'linear-gradient(135deg, #1677FF, #0958d9)' }}
        >
          <span className="text-white font-bold" style={{ fontSize: size * 0.45 }}>
            支
          </span>
        </div>
      );

    case 'wechat':
      return (
        <div
          className={cn('rounded-xl flex items-center justify-center flex-shrink-0', className)}
          style={{ ...containerStyle, background: 'linear-gradient(135deg, #07C160, #06ae56)' }}
        >
          <span className="text-white font-bold" style={{ fontSize: size * 0.45 }}>
            微
          </span>
        </div>
      );

    case 'bank_transfer':
      return (
        <div
          className={cn(
            'rounded-xl flex items-center justify-center flex-shrink-0',
            'bg-gradient-to-br from-slate-600 to-slate-800',
            className
          )}
          style={containerStyle}
        >
          <Building2 className="text-white" style={iconSize} />
        </div>
      );

    case 'cash':
      return (
        <div
          className={cn(
            'rounded-xl flex items-center justify-center flex-shrink-0',
            'bg-gradient-to-br from-emerald-500 to-emerald-700',
            className
          )}
          style={containerStyle}
        >
          <Banknote className="text-white" style={iconSize} />
        </div>
      );
  }
}
