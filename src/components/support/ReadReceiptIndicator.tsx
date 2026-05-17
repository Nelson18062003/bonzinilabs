import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ReadReceiptIndicatorProps {
  readAt: string | null;
  className?: string;
}

export function ReadReceiptIndicator({ readAt, className }: ReadReceiptIndicatorProps) {
  const { t } = useTranslation('support');
  const [showTime, setShowTime] = useState(false);

  if (!readAt) {
    return (
      <span
        className={cn('inline-flex items-center gap-1 text-[10px] text-muted-foreground', className)}
        title={t('receipt.sent')}
      >
        <Check className="h-3 w-3" />
        {t('receipt.sent')}
      </span>
    );
  }

  const time = format(new Date(readAt), 'HH:mm');
  const handleClick = () => {
    if (!showTime) {
      setShowTime(true);
      toast.info(t('receipt.seenAt', { time }), { duration: 2000 });
      setTimeout(() => setShowTime(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1 text-[10px] text-bonzini-violet',
        className
      )}
      title={t('receipt.seenAt', { time })}
    >
      <CheckCheck className="h-3 w-3" />
      {showTime ? time : t('receipt.seen')}
    </button>
  );
}
