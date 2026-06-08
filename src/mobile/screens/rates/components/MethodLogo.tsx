// Logo de méthode pour le module Taux — réutilise la source unique des logos
// de marque du designKit via PaymentMethodLogo (Alipay/WeChat officiels,
// Virement violet, Cash ¥ rouge — aligné maquette rates.tsx validée).
// Mappe la clé métier `PaymentMethodKey` ('virement' → 'bank_transfer').
import type { PaymentMethodKey } from '@/types/rates';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';

export function MethodLogo({
  method,
  size = 40,
  className,
}: {
  method: PaymentMethodKey;
  size?: number;
  className?: string;
}) {
  const k = method === 'virement' ? 'bank_transfer' : method;
  return <PaymentMethodLogo method={k} size={size} className={className} />;
}
