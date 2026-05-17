import { useTranslation } from 'react-i18next';
import { MessageCircleHeart } from 'lucide-react';
import { ResponseTimeBadge } from './ResponseTimeBadge';

export function EmptyChatState() {
  const { t } = useTranslation('support');
  return (
    <div className="flex max-w-sm flex-col items-center text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-bonzini-violet/10">
        <MessageCircleHeart className="h-10 w-10 text-bonzini-violet" />
      </div>
      <h2 className="mb-2 text-lg font-semibold text-foreground">
        {t('empty.title')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">{t('empty.subtitle')}</p>
      <ResponseTimeBadge />
    </div>
  );
}
