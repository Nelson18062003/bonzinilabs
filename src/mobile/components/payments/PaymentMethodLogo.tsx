import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAYMENT_METHOD, LOGO_PATH } from '@/mobile/designKit';

interface PaymentMethodLogoProps {
  method: 'alipay' | 'wechat' | 'bank_transfer' | 'cash';
  size?: number;
  className?: string;
}

/**
 * Brand tile for a payment method, aligned with the design kit's single source
 * of method colours/logos (designKit/methods):
 *   Alipay / WeChat → official simple-icons glyphs on their brand colour ·
 *   Virement → violet bank icon · Cash → red ¥ (matches the validated flyer).
 * Same API as before (presentational); restyling propagates to every surface.
 */
export function PaymentMethodLogo({ method, size = 48, className }: PaymentMethodLogoProps) {
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.27),
  };

  switch (method) {
    case 'alipay':
      return (
        <div
          className={cn('flex shrink-0 items-center justify-center', className)}
          style={{ ...containerStyle, background: PAYMENT_METHOD.alipay.color }}
        >
          <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="#fff" aria-hidden>
            <path d={LOGO_PATH.alipay} />
          </svg>
        </div>
      );

    case 'wechat':
      return (
        <div
          className={cn('flex shrink-0 items-center justify-center', className)}
          style={{ ...containerStyle, background: PAYMENT_METHOD.wechat.color }}
        >
          <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="#fff" aria-hidden>
            <path d={LOGO_PATH.wechat} />
          </svg>
        </div>
      );

    case 'bank_transfer':
      return (
        <div
          className={cn('flex shrink-0 items-center justify-center', className)}
          style={{ ...containerStyle, background: PAYMENT_METHOD.virement.color }}
        >
          <Building2 className="text-white" style={{ width: size * 0.5, height: size * 0.5 }} />
        </div>
      );

    case 'cash':
      return (
        <div
          className={cn('flex shrink-0 items-center justify-center font-black text-white', className)}
          style={{ ...containerStyle, background: PAYMENT_METHOD.cash.color, fontSize: size * 0.5 }}
        >
          ¥
        </div>
      );
  }
}
