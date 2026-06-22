import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function RateInfoBanner() {
  const { t } = useTranslation('client');
  return (
    <div className="flex items-center gap-3 rounded-[22px] bg-[#EAE7FA] p-4 dark:bg-[#272252]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/60 dark:bg-black/20">
        <Sparkles className="h-5 w-5 text-[#5B4CC4] dark:text-[#B5AAF0]" />
      </div>
      <div>
        <p className="text-[14px] font-bold text-[#5B4CC4] dark:text-[#B5AAF0]">{t('rates.banner.title')}</p>
        <p className="mt-0.5 text-[12px] text-[#5B4CC4]/80 dark:text-[#B5AAF0]/80">{t('rates.banner.subtitle')}</p>
      </div>
    </div>
  );
}
