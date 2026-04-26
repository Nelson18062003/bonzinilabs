// ============================================================
// History & details accordion. Collapsed by default; expands to
// show a 2-column info grid + the timeline component.
// ============================================================
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentTimelineDisplay } from '@/components/payment/PaymentTimelineDisplay';
import type { PaymentTimelineStepUI } from '@/lib/paymentTimeline';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';
import type { PaymentMethod } from '@/types/payment';
import type { Payment } from '@/hooks/usePayments';

interface Props {
  payment: Payment;
  timelineSteps: PaymentTimelineStepUI[];
  timelineLoading: boolean;
}

export function PaymentDetailsAccordion({ payment, timelineSteps, timelineLoading }: Props) {
  const { t } = useTranslation('payments');

  if (timelineSteps.length === 0) return null;

  const methodLabel = PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method;

  return (
    <Accordion type="single" collapsible className="bg-card rounded-2xl border border-border overflow-hidden">
      <AccordionItem value="timeline" className="border-0">
        <AccordionTrigger className="px-5 py-4 hover:no-underline">
          <span className="flex items-center gap-2 font-semibold text-base">
            <Clock className="w-4 h-4" />
            {t('detail.historyAndDetails')}
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-5 pb-5">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">{t('detail.reference')}</p>
                <p className="font-mono text-xs mt-0.5">{payment.reference}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t('detail.method')}</p>
                <p className="font-medium text-xs mt-0.5">{methodLabel}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t('detail.createdOn')}</p>
                <p className="text-xs mt-0.5">
                  {format(new Date(payment.created_at), 'dd MMM yyyy, HH:mm', { locale: fr })}
                </p>
              </div>
              {payment.processed_at && (
                <div>
                  <p className="text-muted-foreground text-xs">{t('detail.processedOn')}</p>
                  <p className="text-xs mt-0.5">
                    {format(new Date(payment.processed_at), 'dd MMM yyyy, HH:mm', { locale: fr })}
                  </p>
                </div>
              )}
            </div>

            {timelineLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="pt-2">
                <PaymentTimelineDisplay steps={timelineSteps} />
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
