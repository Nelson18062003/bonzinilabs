import { useTranslation } from 'react-i18next';
import { format, isToday, isYesterday } from 'date-fns';
import { getDateFnsLocale } from '@/i18n';
import { useEffect, useState } from 'react';
import type { Locale } from 'date-fns';

interface DateSeparatorProps {
  isoDate: string;
}

export function DateSeparator({ isoDate }: DateSeparatorProps) {
  const { t } = useTranslation('support');
  const [locale, setLocale] = useState<Locale | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getDateFnsLocale().then((l) => {
      if (!cancelled) setLocale(l);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const date = new Date(isoDate);
  let label: string;
  if (isToday(date)) {
    label = t('day.today');
  } else if (isYesterday(date)) {
    label = t('day.yesterday');
  } else {
    label = format(date, 'd MMMM yyyy', locale ? { locale } : undefined);
  }

  return (
    <div className="my-2 flex items-center justify-center">
      <span className="rounded-full bg-muted/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
