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
    <div className="my-3 flex items-center justify-center">
      <span className="rounded-full bg-background px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shadow-[0_0_0_1px_hsl(var(--border))]">
        {label}
      </span>
    </div>
  );
}
