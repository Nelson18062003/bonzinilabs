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
import { PaymentTimelineDisplay } from '@/components/payment/PaymentTimelineDisplay';
import type { PaymentTimelineStepUI } from '@/lib/paymentTimeline';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';
import type { PaymentMethod } from '@/types/payment';
import type { Payment } from '@/hooks/usePayments';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/mobile/designKit';

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
    <Accordion type="single" collapsible className={cn('overflow-hidden rounded-[22px]', SURFACE.card, SURFACE.shadow)}>
      <AccordionItem value="timeline" className="border-0">
        <AccordionTrigger className="px-5 py-4 hover:no-underline">
          <span className={cn('flex items-center gap-2 text-[15px] font-bold', TEXT.strong)}>
            <Clock className={cn('h-4 w-4', TEXT.muted)} />
            {t('detail.historyAndDetails')}
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-5 pb-5">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={cn('text-[11px]', TEXT.muted)}>{t('detail.reference')}</p>
                <p className={cn('mt-0.5 font-mono text-[12px]', TEXT.strong)}>{payment.reference}</p>
              </div>
              <div>
                <p className={cn('text-[11px]', TEXT.muted)}>{t('detail.method')}</p>
                <p className={cn('mt-0.5 text-[12px] font-semibold', TEXT.strong)}>{methodLabel}</p>
              </div>
              <div>
                <p className={cn('text-[11px]', TEXT.muted)}>{t('detail.createdOn')}</p>
                <p className={cn('mt-0.5 text-[12px]', TEXT.strong)}>
                  {format(new Date(payment.created_at), 'dd MMM yyyy, HH:mm', { locale: fr })}
                </p>
              </div>
              {payment.processed_at && (
                <div>
                  <p className={cn('text-[11px]', TEXT.muted)}>{t('detail.processedOn')}</p>
                  <p className={cn('mt-0.5 text-[12px]', TEXT.strong)}>
                    {format(new Date(payment.processed_at), 'dd MMM yyyy, HH:mm', { locale: fr })}
                  </p>
                </div>
              )}
            </div>

            {timelineLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={cn('h-12 w-full animate-pulse rounded-xl', SURFACE.canvas)} />
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
